import { create } from 'zustand'
import { temporal } from 'zundo'
import { produce, setAutoFreeze } from 'immer'
import type { Asset, CaptionsConfig, Clip, MediaClipType, Project, Track, TrackType } from '@/engine/types'
import { newProject, projectDuration, defaultCameraRig, migrateProjectTracks } from '@/engine/types'
import { getAllRecords, putRecord, deleteRecord } from '@/engine/storage/db'
import { writeMediaFile, deleteMediaFile } from '@/engine/storage/opfs'
import { generateThumbnail, probeMedia } from '@/engine/storage/thumbnails'
import { validateFile } from '@/engine/storage/mediaType'
import { generateProxy } from '@/engine/media/proxy'
import { generateFilmstrip } from '@/engine/media/filmstrip'
import { generateWaveform } from '@/engine/media/waveform'
import { getStoredOcr } from '@/engine/analysis/ocr'
import { getStoredScenes, getStoredTranscript } from '@/api/llm/understanding'
import type { StoredOcr, StoredScenes, StoredTranscript } from '@/engine/analysis/types'
import {
  useHistoryStore,
  loadPersistedHistory,
  registerTemporalStore,
  HISTORY_LOG_LIMIT,
  type HistoryType,
  type UiCheckpoint,
} from '@/stores/historyStore'
import { buildWelcomeContent, storeWelcomeTranscript, WELCOME_ATTEMPTED_KEY, WELCOME_CREATED_KEY } from '@/components/onboarding/WelcomeProject'

// Structural sharing without freezing: snapshots in history share unchanged
// subtrees by reference (copy-on-write), while existing code keeps its
// mutation-friendly update style.
setAutoFreeze(false)

/** Maximum undo steps kept in the temporal stack. */
const HISTORY_LIMIT = 50

/** Metadata staged with each document snapshot for the human-readable log. */
export interface HistoryMeta {
  type: HistoryType
  description: string
  clipId?: string
}

let suppressDepth = 0

export interface TimelineState {
  project: Project
  assets: Asset[]
  hydrated: boolean
  saving: boolean
  /** True when this session generated the first-run Welcome Project (drives the tour). */
  welcomeLoaded: boolean
  selection: { clipIds: string[]; trackId: string | null }
  playhead: number
  zoom: number
  /** Magnetic snapping on clip drag; Shift temporarily inverts it. */
  snapEnabled: boolean
  clipboard: Clip[]

  /** Per-asset local intelligence cache, mirrored from IndexedDB into memory. */
  transcripts: Record<string, StoredTranscript>
  scenes: Record<string, StoredScenes>
  ocr: Record<string, StoredOcr>

  hydrate: () => Promise<void>
  save: () => Promise<void>

  importFiles: (files: File[]) => Promise<{ imported: Asset[]; errors: string[] }>
  deleteAsset: (assetId: string) => Promise<void>

  setTranscript: (t: StoredTranscript) => void
  setScenes: (s: StoredScenes) => void
  setOcr: (o: StoredOcr) => void
  setCaptions: (patch: Partial<CaptionsConfig>) => void

  /** Stage a document snapshot (pre-mutation state) with log metadata. No-op inside a group. */
  begin: (meta?: HistoryMeta) => void
  undo: () => void
  redo: () => void
  /**
   * Run fn as a single undoable group — one snapshot for the whole batch,
   * including async bodies. Inner begins are suppressed until the outermost
   * group closes.
   */
  withTransaction: (fn: () => void | Promise<void>, meta?: HistoryMeta) => Promise<void>
  /** Open a manual group (e.g. a pointer drag); close it with endHistoryGroup. */
  beginHistoryGroup: (meta?: HistoryMeta) => void
  endHistoryGroup: () => void
  /** Suppress snapshots while running an async batch; on close, the whole batch is one step. */
  suspendHistory: (on: boolean) => void

  renameProject: (name: string) => void
  setProjectSettings: (patch: Partial<Pick<Project, 'width' | 'height' | 'fps' | 'aspectRatio'>>) => void
  resetProject: () => void

  addClip: (assetId: string, trackId: string, startTime?: number) => Clip | undefined
  /** Adds an asset to its default track (audio→audio, everything else→video), appended after the last clip. */
  addAssetToTimeline: (assetId: string) => Clip | undefined
  addClipToTrack: (clip: Clip) => void
  addTextClip: (text: string, trackId: string, startTime?: number) => Clip | undefined
  updateClip: (clipId: string, patch: Partial<Clip>) => void
  updateClips: (clipIds: string[], patch: Partial<Clip>) => void
  moveClip: (clipId: string, delta: number, targetTrackId?: string) => void
  trimClip: (clipId: string, edge: 'start' | 'end', delta: number) => void
  splitClip: (clipId: string, atTime: number) => void
  joinClips: (clipId1: string, clipId2: string) => void
  /** Toggle a ruler marker at (or within half a frame of) the given time. */
  toggleMarker: (time: number) => void
  deleteClips: (clipIds: string[], ripple?: boolean) => void
  duplicateClips: (clipIds: string[]) => void
  copyClips: (clipIds: string[]) => void
  cutClips: (clipIds: string[]) => void
  pasteClips: () => void

  toggleTrackLock: (trackId: string) => void
  toggleTrackMute: (trackId: string) => void
  toggleTrackHidden: (trackId: string) => void
  /** Audio-only: solo this track, silencing other (non-soloed) audio tracks. */
  toggleTrackSolo: (trackId: string) => void
  renameTrack: (trackId: string, name: string) => void
  setTrackClips: (trackId: string, clips: Clip[]) => void

  select: (clipIds: string[], trackId?: string | null) => void
  setPlayhead: (time: number) => void
  setZoom: (zoom: number) => void
  setSnapEnabled: (on: boolean) => void

  duration: () => number
}

function cloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p)) as Project
}

const PATCH_DESCRIPTIONS: Array<[keyof Clip, string, HistoryType]> = [
  ['position', 'Moved', 'move'],
  ['startTime', 'Moved', 'move'],
  ['duration', 'Resized', 'edit'],
  ['sourceStart', 'Trimmed', 'edit'],
  ['sourceEnd', 'Trimmed', 'edit'],
  ['scale', 'Scaled', 'edit'],
  ['rotation', 'Rotated', 'edit'],
  ['opacity', 'Changed opacity of', 'edit'],
  ['volume', 'Changed volume of', 'edit'],
  ['speed', 'Changed speed of', 'edit'],
  ['effects', 'Applied effect to', 'edit'],
  ['transitions', 'Changed transition on', 'edit'],
  ['text', 'Edited text of', 'edit'],
  ['fadeIn', 'Changed fade-in of', 'edit'],
  ['fadeOut', 'Changed fade-out of', 'edit'],
  ['name', 'Renamed', 'edit'],
  ['muted', 'Muted', 'edit'],
  ['crop', 'Cropped', 'edit'],
  ['blendMode', 'Changed blend mode of', 'edit'],
  ['eq', 'Adjusted EQ of', 'edit'],
  ['keyframes', 'Keyframed', 'edit'],
]

/** Human-readable log metadata for a clip property patch. */
function describePatch(patch: Partial<Clip>): { type: HistoryType; description: string } {
  for (const [key, label, type] of PATCH_DESCRIPTIONS) {
    if (key in patch) return { type, description: label }
  }
  return { type: 'edit', description: 'Edited' }
}

function trackName(trackId: string): string {
  const t = useTimelineStore.getState().project.tracks.find((tr) => tr.id === trackId)
  return t ? `'${t.name}'` : 'track'
}

export const useTimelineStore = create<TimelineState>()(
  temporal<TimelineState, [], [], { project: Project }>((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().save()
    }, 2000)
  }

  // --- History engine -------------------------------------------------------
  // zundo holds the canonical snapshot stacks (partialized to { project }).
  // Auto-tracking is paused below; recording is driven explicitly:
  //   begin(meta)  → capture the pre-mutation project reference
  //   commit()     → push it onto the temporal stack + append a log entry
  // Because immer produces immutable states, captured references share
  // structure across snapshots (cheap memory-wise).
  let groupDepth = 0
  let pendingPast: Project | null = null
  let pendingMeta: HistoryMeta | null = null
  let pendingUi: UiCheckpoint | null = null

  const captureUi = (): UiCheckpoint => {
    const s = get()
    return { selection: { clipIds: [...s.selection.clipIds], trackId: s.selection.trackId }, playhead: s.playhead }
  }

  const restoreUi = (cp: UiCheckpoint | undefined) => {
    if (!cp) return
    set((state) => ({
      selection: cp.selection ?? state.selection,
      playhead: Math.min(cp.playhead ?? state.playhead, projectDuration(state.project.tracks)),
    }))
  }

  const commitHistory = () => {
    // Inside a group/suppressed batch, keep the staged pre-state so the
    // outermost close produces exactly one snapshot.
    if (groupDepth > 0 || suppressDepth > 0) return
    const meta = pendingMeta
    const beforeProject = pendingPast
    const beforeUi = pendingUi
    pendingMeta = null
    pendingPast = null
    pendingUi = null
    if (!beforeProject) return
    if (beforeProject === get().project) return // no-op drag/click: don't pollute history
    const t = useTimelineStore.temporal.getState()
    // Snapshots must match the partialized shape ({ project }) so zundo's
    // undo()/redo() can feed them straight back into setState.
    t.pastStates.push({ project: beforeProject })
    if (t.pastStates.length > HISTORY_LIMIT) t.pastStates.shift()
    t.futureStates.length = 0 // new action clears the redo stack
    useHistoryStore.getState().pushEntry({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: meta?.type ?? 'edit',
      description: meta?.description ?? 'Edit',
      clipId: meta?.clipId,
      before: beforeUi ?? {},
      after: captureUi(),
    })
  }

  /** Stage pre-mutation state. Skipped inside groups or suppressed batches. */
  const beginHistory = (meta?: HistoryMeta) => {
    if (suppressDepth > 0) return
    if (groupDepth > 0) return
    pendingPast ??= get().project
    pendingUi ??= captureUi()
    if (meta) pendingMeta = meta
  }

  const mutate = (updater: (p: Project) => Project) => {
    set((state) => ({
      project: produce(state.project, (draft) => updater(draft as Project)),
    }))
    scheduleSave()
  }

  const findClip = (p: Project, clipId: string): { track: Track; clip: Clip } | null => {
    for (const track of p.tracks) {
      const clip = track.clips.find((c) => c.id === clipId)
      if (clip) return { track, clip }
    }
    return null
  }

  return {
    project: newProject(),
    assets: [],
    hydrated: false,
    saving: false,
    welcomeLoaded: false,
    selection: { clipIds: [], trackId: null },
    playhead: 0,
    zoom: 90,
    snapEnabled: true,
    clipboard: [],
    transcripts: {},
    scenes: {},
    ocr: {},

    hydrate: async () => {
      try {
        // Most-recent project wins (keyed by id, sorted by modifiedAt).
        const projects = await getAllRecords<Project>('projects')
        projects.sort((a, b) => b.modifiedAt - a.modifiedAt)
        let storedProject = projects[0]

        let welcomeLoaded = false
        if (!storedProject && localStorage.getItem(WELCOME_ATTEMPTED_KEY) !== '1') {
          try {
            localStorage.setItem(WELCOME_ATTEMPTED_KEY, '1')
            const { project, transcriptAssetId } = await buildWelcomeContent(
              (files) => get().importFiles(files),
            )
            if (transcriptAssetId) await storeWelcomeTranscript(transcriptAssetId)
            await putRecord('projects', { ...cloneProject(project), modifiedAt: Date.now() })
            storedProject = project
            welcomeLoaded = true
            localStorage.setItem(WELCOME_CREATED_KEY, '1')
          } catch (err) {
            console.warn('Welcome project generation failed', err)
          }
        }

        const assets = (await getAllRecords<Asset>('assets')).sort((a, b) => b.importedAt - a.importedAt)
        const transcripts: Record<string, StoredTranscript> = {}
        const scenes: Record<string, StoredScenes> = {}
        const ocr: Record<string, StoredOcr> = {}
        await Promise.all(
          assets.map(async (asset) => {
            const [t, s, o] = await Promise.all([
              getStoredTranscript(asset.id),
              getStoredScenes(asset.id),
              getStoredOcr(asset.id),
            ])
            if (t) transcripts[asset.id] = t
            if (s) scenes[asset.id] = s
            if (o) ocr[asset.id] = o
          }),
        )
        // Seed history for existing projects so undo works across refreshes.
        const t = useTimelineStore.temporal.getState()
        t.pastStates.length = 0
        t.futureStates.length = 0
        pendingPast = null
        pendingMeta = null
        pendingUi = null
        if (storedProject && !welcomeLoaded) {
          const persisted = await loadPersistedHistory()
          if (persisted) {
            const snapshots = persisted.snapshots.slice(-HISTORY_LIMIT) as Array<{ project: Project }>
            for (const snapshot of snapshots) {
              t.pastStates.push(snapshot)
            }
            useHistoryStore
              .getState()
              .setLog(
                persisted.entries.slice(-HISTORY_LOG_LIMIT),
                Math.min(persisted.index, persisted.entries.length),
              )
          } else {
            useHistoryStore.getState().clearLog()
          }
        } else {
          useHistoryStore.getState().clearLog()
        }

        set({
          assets,
          project: storedProject ? migrateProjectTracks(storedProject) : newProject(),
          transcripts,
          scenes,
          ocr,
          hydrated: true,
          welcomeLoaded,
        })
      } catch (err) {
        console.error('Hydrate failed', err)
        set({ hydrated: true })
      }
    },

    save: async () => {
      const { project } = get()
      set({ saving: true })
      try {
        await putRecord('projects', { ...cloneProject(project), modifiedAt: Date.now() })
      } finally {
        set({ saving: false })
      }
    },

    importFiles: async (files) => {
      const imported: Asset[] = []
      const errors: string[] = []
      for (const file of files) {
        const validation = validateFile(file)
        if (!validation.valid) {
          errors.push(`${file.name}: ${validation.error}`)
          continue
        }
        const type = validation.type!
        try {
          const id = crypto.randomUUID()
          const filePath = await writeMediaFile(id, file)
          const probe = await probeMedia(file, type)
          const thumb = await generateThumbnail(file, type)

          let proxyPath: string | undefined
          let filmstrip: import('@/engine/types').FilmstripData | undefined
          let waveform: import('@/engine/types').FilmstripData | undefined
          let modelRadius: number | undefined
          if (type === 'video') {
            const [proxy, strip] = await Promise.all([
              generateProxy(id, file),
              generateFilmstrip(file, type),
            ])
            proxyPath = proxy ?? undefined
            filmstrip = strip ?? undefined
          } else if (type === 'audio') {
            waveform = (await generateWaveform(file, type)) ?? undefined
          } else if (type === 'model') {
            const { probeModel } = await import('@/engine/three/modelRenderer')
            const probe = await probeModel(file)
            modelRadius = probe.radius
          }

          const asset: Asset = {
            id,
            name: file.name.replace(/\.[^.]+$/, ''),
            type,
            filePath,
            mime: file.type,
            size: file.size,
            width: probe.width,
            height: probe.height,
            duration: probe.duration,
            thumbnailUrl: thumb.url,
            proxyPath,
            filmstrip,
            waveform,
            modelRadius,
            importedAt: Date.now(),
          }
          await putRecord('assets', asset)
          imported.push(asset)
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (imported.length) {
        set((state) => ({
          assets: [...imported.reverse(), ...state.assets],
        }))
      }
      // NOTE: importing only registers assets in the library — nothing lands on
      // the timeline until the user (or a tool) explicitly adds it.
      return { imported, errors }
    },

    addAssetToTimeline: (assetId) => {
      const asset = get().assets.find((a) => a.id === assetId)
      if (!asset) return undefined
      const trackType: TrackType = asset.type === 'audio' ? 'audio' : 'video'
      const track = get().project.tracks.find((t) => t.type === trackType)
      if (!track) return undefined
      const lastEnd = track.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
      return get().addClip(asset.id, track.id, Math.round(lastEnd * 10) / 10)
    },

    deleteAsset: async (assetId) => {
      const asset = get().assets.find((a) => a.id === assetId)
      if (!asset) return
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.filter((c) => c.assetId !== assetId)
        }
        return p
      })
      await deleteRecord('assets', assetId)
      await deleteMediaFile(assetId)
      set((state) => ({ assets: state.assets.filter((a) => a.id !== assetId) }))
    },

    begin: (meta?: HistoryMeta) => {
      beginHistory(meta)
    },

    /**
     * While true, suppress snapshots. Used by async batch operations (e.g.
     * applyPlan): the pre-batch state is captured when suppression starts, so
     * the entire batch becomes exactly one undo step on release.
     */
    suspendHistory: (on: boolean) => {
      if (on) {
        suppressDepth++
        if (suppressDepth === 1) {
          pendingPast ??= get().project
          pendingUi ??= captureUi()
        }
      } else {
        suppressDepth = Math.max(0, suppressDepth - 1)
        if (suppressDepth === 0) commitHistory()
      }
    },

    withTransaction: async (fn, meta) => {
      get().beginHistoryGroup(meta)
      try {
        await fn()
      } finally {
        get().endHistoryGroup()
      }
    },

    beginHistoryGroup: (meta?: HistoryMeta) => {
      if (suppressDepth > 0) return
      groupDepth++
      if (groupDepth === 1) {
        pendingPast ??= get().project
        pendingUi ??= captureUi()
        if (meta) pendingMeta = meta
      }
    },

    endHistoryGroup: () => {
      if (groupDepth === 0) return
      groupDepth--
      if (groupDepth === 0 && suppressDepth === 0) commitHistory()
    },

    undo: () => {
      const t = useTimelineStore.temporal.getState()
      if (!t.pastStates.length) return
      const h = useHistoryStore.getState()
      const entry = h.entries[h.index - 1]
      t.undo() // restores the partialized { project } onto the base store
      h.stepIndex(-1)
      if (entry) {
        h.showToast(`Undid: ${entry.description}`)
        restoreUi(entry.before)
      }
      scheduleSave()
    },

    redo: () => {
      const t = useTimelineStore.temporal.getState()
      if (!t.futureStates.length) return
      const h = useHistoryStore.getState()
      const entry = h.entries[h.index]
      t.redo()
      h.stepIndex(1)
      if (entry) {
        h.showToast(`Redid: ${entry.description}`)
        restoreUi(entry.after)
      }
      scheduleSave()
    },

    renameProject: (name) => {
      beginHistory({ type: 'edit', description: `Renamed project to '${name}'` })
      mutate((p) => ({ ...p, name }))
      commitHistory()
    },

    setProjectSettings: (patch) => {
      beginHistory({ type: 'edit', description: 'Changed project settings' })
      mutate((p) => ({ ...p, ...patch }))
      commitHistory()
    },

    resetProject: () => {
      useTimelineStore.temporal.getState().clear()
      useHistoryStore.getState().clearLog()
      pendingPast = null
      pendingMeta = null
      pendingUi = null
      set({ project: newProject(), selection: { clipIds: [], trackId: null }, playhead: 0 })
      scheduleSave()
    },

    setTranscript: (t) => {
      set((state) => ({ transcripts: { ...state.transcripts, [t.assetId]: t } }))
    },

    setScenes: (s) => {
      set((state) => ({ scenes: { ...state.scenes, [s.assetId]: s } }))
    },

    setOcr: (o) => {
      set((state) => ({ ocr: { ...state.ocr, [o.assetId]: o } }))
    },

    setCaptions: (patch) => {
      beginHistory({ type: 'edit', description: 'Changed caption settings' })
      mutate((p) => ({
        ...p,
        captions: { ...(p.captions ?? newProject().captions!), ...patch },
      }))
      commitHistory()
    },

    addClip: (assetId, trackId, startTime) => {
      const { project, playhead } = get()
      const asset = get().assets.find((a) => a.id === assetId)
      if (!asset) return undefined
      const track = project.tracks.find((t) => t.id === trackId)
      if (!track) return undefined

      const duration = asset.type === 'image' || asset.type === 'model' ? 4 : Math.min(asset.duration || 5, 30)
      const start = startTime ?? Math.max(0, Math.floor(playhead * 10) / 10)
      const clipType: MediaClipType =
        asset.type === 'video' ? 'video'
        : asset.type === 'image' ? 'image'
        : asset.type === 'model' ? 'animation'
        : 'audio'
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        trackId: track.id,
        startTime: start,
        duration,
        sourceStart: 0,
        clipType,
        sourceEnd: asset.type === 'image' || asset.type === 'model' ? duration : Math.min(asset.duration ?? duration, duration),
        speed: 1,
        name: asset.name,
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        opacity: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        effects: [],
        transitions: {},
        thumbnailUrl: asset.thumbnailUrl,
        modelRig: asset.type === 'model' ? { ...defaultCameraRig(), radiusStart: (asset.modelRadius ?? 2.4) * 2.5, radiusEnd: (asset.modelRadius ?? 2.4) * 2.5 } : undefined,
      }
      get().begin({ type: 'add', description: `Added '${asset.name}' to ${track.name}`, clipId: clip.id })
      mutate((p) => {
        const t = p.tracks.find((tr) => tr.id === track.id)!
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
      get().select([clip.id], track.id)
      return clip
    },

    addTextClip: (text, trackId, startTime) => {
      const { project, playhead } = get()
      const track = project.tracks.find((t) => t.id === trackId)
      if (!track) return undefined

      const start = startTime ?? Math.max(0, Math.floor(playhead * 10) / 10)
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: '',
        trackId: track.id,
        startTime: start,
        duration: 4,
        sourceStart: 0,
        textType: 'title',
        sourceEnd: 4,
        speed: 1,
        name: text.slice(0, 30) || 'Text',
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        opacity: 1,
        volume: 0,
        fadeIn: 0,
        fadeOut: 0,
        effects: [],
        transitions: {},
        text: {
          text,
          fontSize: 48,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#ffffff',
          backgroundColor: 'transparent',
          textAlign: 'center',
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 16,
          paddingRight: 16,
          borderRadius: 0,
          shadow: true,
          animation: 'none',
          animationDuration: 1,
        },
      }
      get().begin({ type: 'add', description: `Added text '${clip.name}'`, clipId: clip.id })
      mutate((p) => {
        const t = p.tracks.find((tr) => tr.id === track.id)!
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
      get().select([clip.id], track.id)
      return clip
    },

    addClipToTrack: (clip) => {
      get().begin({ type: 'add', description: `Added '${clip.name}'`, clipId: clip.id })
      mutate((p) => {
        const t = p.tracks.find((tr) => tr.id === clip.trackId)
        if (!t) return p
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
    },

    updateClip: (clipId, patch) => {
      const found = findClip(get().project, clipId)
      const subject = found ? `'${found.clip.name}'` : 'clip'
      beginHistory({ type: describePatch(patch).type, description: `${describePatch(patch).description} ${subject}`, clipId })
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c))
        }
        return p
      })
      commitHistory()
    },

    updateClips: (clipIds, patch) => {
      const ids = new Set(clipIds)
      beginHistory({ type: describePatch(patch).type, description: `Edited ${clipIds.length} ${clipIds.length === 1 ? 'clip' : 'clips'}` })
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.map((c) => (ids.has(c.id) ? { ...c, ...patch } : c))
        }
        return p
      })
      commitHistory()
    },

    moveClip: (clipId, delta, targetTrackId) => {
      const found = findClip(get().project, clipId)
      const subject = found ? `'${found.clip.name}'` : 'clip'
      const target = targetTrackId ? get().project.tracks.find((t) => t.id === targetTrackId) : undefined
      beginHistory({
        type: 'move',
        description: target ? `Moved ${subject} to ${target.name}` : `Moved ${subject}`,
        clipId,
      })
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.map((c) => {
            if (c.id !== clipId) return c
            if (targetTrackId && targetTrackId !== c.trackId) {
              const target = p.tracks.find((t) => t.id === targetTrackId)
              if (target && target.type === track.type) {
                return { ...c, trackId: target.id, startTime: c.startTime + delta }
              }
            }
            return { ...c, startTime: c.startTime + delta }
          })
        }
        return p
      })
      commitHistory()
    },

    trimClip: (clipId, edge, delta) => {
      const found = findClip(get().project, clipId)
      const subject = found ? `'${found.clip.name}'` : 'clip'
      beginHistory({ type: 'edit', description: `Trimmed ${subject}`, clipId })
      mutate((p) => {
        const found = findClip(p, clipId)
        if (!found) return p
        const { clip } = found
        const frame = 1 / p.fps
        if (edge === 'start') {
          const newStart = Math.max(0, clip.sourceStart + delta)
          const applied = Math.min(newStart, clip.sourceEnd - frame)
          clip.startTime += applied - clip.sourceStart
          clip.duration -= applied - clip.sourceStart
          clip.sourceStart = applied
        } else {
          const newEnd = Math.min(clip.sourceEnd + delta, (clip.sourceStart + 3600))
          clip.duration += newEnd - clip.sourceEnd
          clip.sourceEnd = newEnd
        }
        return p
      })
      commitHistory()
    },

    splitClip: (clipId, atTime) => {
      const found = findClip(get().project, clipId)
      if (!found) return
      const { clip } = found
      const splitTime = atTime - clip.startTime
      if (splitTime < 0.05 || splitTime > clip.duration - 0.05) return

      get().begin({ type: 'split', description: `Split '${clip.name}'`, clipId })
      mutate((p) => {
        for (const track of p.tracks) {
          const idx = track.clips.findIndex((c) => c.id === clipId)
          if (idx === -1) continue
          const original = track.clips[idx]
          const sourceCut = original.sourceStart + splitTime
          const left: Clip = { ...original, duration: splitTime, sourceEnd: sourceCut }
          const right: Clip = {
            ...original,
            id: crypto.randomUUID(),
            startTime: original.startTime + splitTime,
            duration: original.duration - splitTime,
            sourceStart: sourceCut,
          }
          track.clips.splice(idx, 1, left, right)
          return p
        }
        return p
      })
      commitHistory()
    },

    toggleMarker: (time) => {
      const t = Math.max(0, time)
      beginHistory({ type: 'edit', description: `Marker at ${t.toFixed(1)}s` })
      mutate((p) => {
        const frame = 1 / p.fps
        const existing = (p.markers ?? []).some((m) => Math.abs(m - t) < frame / 2)
        if (existing) {
          p.markers = (p.markers ?? []).filter((m) => Math.abs(m - t) >= frame / 2)
        } else {
          p.markers = [...(p.markers ?? []), t].sort((a, b) => a - b)
        }
        return p
      })
      commitHistory()
    },

    joinClips: (clipId1, clipId2) => {
      const s = get()
      let clip1: Clip | null = null
      let clip2: Clip | null = null
      let trackId: string | null = null
      for (const track of s.project.tracks) {
        const c1 = track.clips.find((c) => c.id === clipId1)
        const c2 = track.clips.find((c) => c.id === clipId2)
        if (c1) { clip1 = c1; trackId = track.id }
        if (c2) clip2 = c2
      }
      if (!clip1 || !clip2 || !trackId) return
      if (clip1.trackId !== clip2.trackId) return

      const left = clip1.startTime <= clip2.startTime ? clip1 : clip2
      const right = clip1.startTime <= clip2.startTime ? clip2 : clip1
      const gap = right.startTime - (left.startTime + left.duration)
      if (gap > 0.05 || left.startTime + left.duration < right.startTime - 0.05) return

      get().begin({ type: 'merge', description: `Merged '${left.name}' clips` })
      mutate((p) => {
        for (const track of p.tracks) {
          if (track.id !== trackId) continue
          const merged: Clip = {
            ...left,
            id: left.id,
            duration: left.duration + right.duration,
            sourceEnd: right.sourceEnd,
            name: left.name,
          }
          track.clips = track.clips
            .filter((c) => c.id !== right.id)
            .map((c) => (c.id === left.id ? merged : c))
          track.clips.sort((a, b) => a.startTime - b.startTime)
          break
        }
        return p
      })
      commitHistory()
    },

    deleteClips: (clipIds, ripple = false) => {
      const ids = new Set(clipIds)
      get().begin({ type: 'remove', description: `Deleted ${clipIds.length} ${clipIds.length === 1 ? 'clip' : 'clips'}`, clipId: clipIds[0] })
      mutate((p) => {
        for (const track of p.tracks) {
          if (track.locked) continue
          const removed = track.clips.filter((c) => ids.has(c.id))
          const remaining = track.clips.filter((c) => !ids.has(c.id))
          if (ripple) {
            const minStart = Math.min(...removed.map((c) => c.startTime))
            const removedLength = removed.reduce((sum, c) => sum + c.duration, 0)
            track.clips = remaining.map((c) =>
              c.startTime >= minStart ? { ...c, startTime: c.startTime - removedLength } : c,
            )
          } else {
            track.clips = remaining
          }
        }
        return p
      })
      commitHistory()
      set({ selection: { clipIds: [], trackId: null } })
    },

    duplicateClips: (clipIds) => {
      const ids = new Set(clipIds)
      get().begin({ type: 'add', description: `Duplicated ${clipIds.length} ${clipIds.length === 1 ? 'clip' : 'clips'}` })
      const duplicates: Clip[] = []
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.map((c) => {
            if (!ids.has(c.id)) return c
            const dup: Clip = {
              ...c,
              id: crypto.randomUUID(),
              startTime: c.startTime + 0.5,
              name: `${c.name} copy`,
            }
            duplicates.push(dup)
            return c
          })
        }
        for (const dup of duplicates) {
          const track = p.tracks.find((t) => t.id === dup.trackId)
          if (track) track.clips.push(dup)
        }
        for (const track of p.tracks) {
          track.clips.sort((a, b) => a.startTime - b.startTime)
        }
        return p
      })
      commitHistory()
      set({ selection: { clipIds: duplicates.map((d) => d.id), trackId: null } })
    },

    copyClips: (clipIds) => {
      const ids = new Set(clipIds)
      const copied: Clip[] = []
      for (const track of get().project.tracks) {
        for (const c of track.clips) {
          if (ids.has(c.id)) copied.push(JSON.parse(JSON.stringify(c)) as Clip)
        }
      }
      set({ clipboard: copied })
    },

    cutClips: (clipIds) => {
      const s = get()
      const ids = new Set(clipIds)
      const copied: Clip[] = []
      for (const track of s.project.tracks) {
        for (const c of track.clips) {
          if (ids.has(c.id)) copied.push(JSON.parse(JSON.stringify(c)) as Clip)
        }
      }
      set({ clipboard: copied })
      s.deleteClips(clipIds)
    },

    pasteClips: () => {
      const s = get()
      const source = s.clipboard
      if (!source.length) return
      const playhead = s.playhead
      const minStart = Math.min(...source.map((c) => c.startTime))
      s.begin({ type: 'add', description: `Pasted ${source.length} ${source.length === 1 ? 'clip' : 'clips'}` })
      const created: Clip[] = []
      mutate((p) => {
        for (const src of source) {
          const track = p.tracks.find((t) => t.id === src.trackId)
          if (!track || track.locked) continue
          const paste: Clip = {
            ...JSON.parse(JSON.stringify(src)) as Clip,
            id: crypto.randomUUID(),
            startTime: playhead + (src.startTime - minStart),
            name: src.name,
          }
          track.clips.push(paste)
          track.clips.sort((a, b) => a.startTime - b.startTime)
          created.push(paste)
        }
        return p
      })
      commitHistory()
      set({ selection: { clipIds: created.map((c) => c.id), trackId: null } })
    },

    toggleTrackLock: (trackId) => {
      beginHistory({ type: 'edit', description: `Locked/unlocked ${trackName(trackId)}` })
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)),
      }))
      commitHistory()
    },

    toggleTrackMute: (trackId) => {
      beginHistory({ type: 'edit', description: `Muted/unmuted ${trackName(trackId)}` })
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
      }))
      commitHistory()
    },

    toggleTrackHidden: (trackId) => {
      beginHistory({ type: 'edit', description: `Show/hide ${trackName(trackId)}` })
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, hidden: !t.hidden } : t)),
      }))
      commitHistory()
    },

    toggleTrackSolo: (trackId) => {
      beginHistory({ type: 'edit', description: `Soloed ${trackName(trackId)}` })
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) =>
          t.type === 'audio' && t.id === trackId ? { ...t, soloed: !t.soloed } : t,
        ),
      }))
      commitHistory()
    },

    renameTrack: (trackId, name) => {
      const clean = name.trim()
      if (!clean) return
      beginHistory({ type: 'edit', description: `Renamed track to '${clean}'` })
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, name: clean } : t)),
      }))
      commitHistory()
    },

    setTrackClips: (trackId, clips) => {
      beginHistory({ type: 'edit', description: `Edited clips on ${trackName(trackId)}` })
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, clips } : t)),
      }))
      commitHistory()
    },

    select: (clipIds, trackId = null) => {
      set({ selection: { clipIds, trackId } })
    },

    setPlayhead: (time) => {
      set({ playhead: Math.max(0, Math.min(time, projectDuration(get().project.tracks))) })
    },

    setZoom: (zoom) => {
      set({ zoom: Math.min(400, Math.max(15, zoom)) })
    },

    setSnapEnabled: (on) => {
      set({ snapEnabled: on })
    },

    duration: () => projectDuration(get().project.tracks),
  }
  }, {
    // Only document state participates in history — UI state (selection,
    // playhead, zoom) never triggers snapshots.
    partialize: (state) => ({ project: state.project }),
    limit: HISTORY_LIMIT,
    equality: (a, b) => a.project === b.project,
  }),
)

// Auto-tracking is off: recording is driven explicitly by the begin/commit
// engine above so drags and async batches collapse into single steps. zundo
// remains the canonical stack holder (undo/redo/clear + limit).
useTimelineStore.temporal.getState().pause()
registerTemporalStore(useTimelineStore.temporal.getState())