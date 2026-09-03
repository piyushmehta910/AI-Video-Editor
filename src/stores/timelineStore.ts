import { create } from 'zustand'
import { temporal } from 'zundo'
import { produce, setAutoFreeze } from 'immer'
import type { Asset, CaptionsConfig, Clip, MediaClipType, Project, Track, TrackType } from '@/engine/types'
import { newProject, projectDuration, migrateProjectTracks } from '@/engine/types'
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
  /** True from the first unsaved mutation until the next autosave completes. */
  dirty: boolean
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
  /** List all saved projects (newest first) for the Open Project picker. */
  listProjects: () => Promise<Project[]>
  /** Swap the active project to a previously saved one (by id). Re-seeds history. Returns false if not found. */
  loadProject: (id: string) => Promise<boolean>

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
  resetProject: (options?: import('@/engine/types').NewProjectOptions) => void

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
  shiftClips: (clipIds: string[], delta: number) => void
  alignClipsToTime: (clipIds: string[], targetTime: number) => void
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
  return structuredClone(p) as Project
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
    set({ dirty: true })
    saveTimer = setTimeout(() => {
      void get().save()
    }, 2000)
  }

  /** Persist immediately, bypassing the debounce (used on tab close/hide and Ctrl+S). */
  const flushSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (get().dirty) void get().save()
  }

  // Data-safety: flush pending edits the moment the tab hides or closes so a
  // change made within the 2s debounce window is never lost.
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('beforeunload', flushSave)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSave()
    })
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
  // Set when hydrate could not read the stored project; autosave must stand down
  // so a failed load never clobbers good data with a blank project.
  let hydrateFailed = false
  // Hydration lock — prevents concurrent hydrate() calls from racing each other
  // and corrupting state. Returns the in-flight promise if a hydrate is active.
  let hydrationLock: Promise<void> | null = null

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
    try {
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
    } catch (err) {
      // If the history store throws (e.g. quota exceeded), don't lose user data.
      // Roll back the partial push so undo stays consistent.
      console.error('commitHistory failed, rolling back snapshot:', err)
      t.pastStates.pop()
    }
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

  const isTrackOverlapping = (tr: Track, start: number, duration: number, excludeClipId?: string) =>
    tr.clips.some(
      (c) =>
        c.id !== excludeClipId &&
        Math.max(start, c.startTime) < Math.min(start + duration, c.startTime + c.duration) - 0.01,
    )

  /**
   * Pure track resolver: never mutates `project` (mutating live state here
   * would leak untracked tracks into history snapshots). When no free track
   * exists it returns a fresh candidate — callers must insert it inside their
   * mutate() callback if absent.
   */
  const findNonCollidingTrack = (
    project: Project,
    requestedTrack: Track,
    start: number,
    duration: number,
    excludeClipId?: string,
  ): Track => {
    // If requested track has no overlap, use it
    if (!isTrackOverlapping(requestedTrack, start, duration, excludeClipId)) return requestedTrack

    // Look for any existing track of the same type that has no overlap
    const sameTypeTracks = project.tracks.filter((t) => t.type === requestedTrack.type)
    const freeTrack = sameTypeTracks.find((t) => !isTrackOverlapping(t, start, duration, excludeClipId))
    if (freeTrack) return freeTrack

    // Otherwise, create a new separate track for this type so it never overlaps or collapses
    const newTrack: Track = {
      id: crypto.randomUUID(),
      type: requestedTrack.type,
      name: `${requestedTrack.name.replace(/\s*\d+$/, '')} ${sameTypeTracks.length + 1}`,
      index: project.tracks.length,
      locked: false,
      muted: false,
      hidden: false,
      clips: [],
    }
    return newTrack
  }

  return {
    project: newProject(),
    assets: [],
    hydrated: false,
    saving: false,
    dirty: false,
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
      // If a hydration is already in flight, return the existing promise to
      // prevent concurrent calls from racing and corrupting state.
      if (hydrationLock) return hydrationLock
      hydrationLock = (async () => {
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
        // A later successful hydrate re-enables autosave even if an earlier
        // attempt failed transiently.
        hydrateFailed = false
      } catch (err) {
        console.error('Hydrate failed', err)
        // Block autosave: writing now would overwrite the stored project with a blank one.
        hydrateFailed = true
        set({ hydrated: true })
      }
      })()
      // Release lock when done (success or failure)
      hydrationLock.finally(() => {
        hydrationLock = null
      })
      return hydrationLock
    },

    save: async () => {
      const { project } = get()
      // After a failed load, only refuse to write when the project is still an
      // untouched blank — that would overwrite good stored data with nothing.
      if (hydrateFailed && project.tracks.every((t) => t.clips.length === 0)) {
        console.warn('Skipped autosave because the last load failed — refusing to overwrite stored data')
        return
      }
      set({ saving: true })
      try {
        await putRecord('projects', { ...cloneProject(project), modifiedAt: Date.now() })
        set({ dirty: false })
      } finally {
        set({ saving: false })
      }
    },
    listProjects: async () => {
      const projects = await getAllRecords<Project>('projects')
      return projects.sort((a, b) => b.modifiedAt - a.modifiedAt)
    },

    loadProject: async (id) => {
      const stored = (await getAllRecords<Project>('projects')).find((p) => p.id === id)
      if (!stored) return false
      // Persist any pending edits on the outgoing project first so switching
      // never loses work.
      flushSave()
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
      useTimelineStore.temporal.getState().clear()
      useHistoryStore.getState().clearLog()
      pendingPast = null
      pendingMeta = null
      pendingUi = null
      // The stored project loaded fine, so autosave is safe again.
      hydrateFailed = false
      set({
        project: migrateProjectTracks(stored),
        assets,
        transcripts,
        scenes,
        ocr,
        selection: { clipIds: [], trackId: null },
        playhead: 0,
        dirty: false,
      })
      return true
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
          if (type === 'video') {
            const [proxy, strip] = await Promise.all([
              generateProxy(id, file),
              generateFilmstrip(file, type),
            ])
            proxyPath = proxy ?? undefined
            filmstrip = strip ?? undefined
          } else if (type === 'audio') {
            waveform = (await generateWaveform(file, type)) ?? undefined
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
      // Removing the asset also removes its clips — make that undoable so the
      // timeline side of the deletion can be reversed.
      get().begin({ type: 'remove', description: `Removed clips of '${asset.name}'` })
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.filter((c) => c.assetId !== assetId)
        }
        return p
      })
      commitHistory()
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
      if (groupDepth === 0) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[history] endHistoryGroup called with no matching begin — bug')
        }
        return
      }
      groupDepth = Math.max(0, groupDepth - 1)
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

    resetProject: (options) => {
      useTimelineStore.temporal.getState().clear()
      useHistoryStore.getState().clearLog()
      pendingPast = null
      pendingMeta = null
      pendingUi = null
      set({ project: newProject(options), selection: { clipIds: [], trackId: null }, playhead: 0 })
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

      const duration = asset.type === 'image' ? 4 : Math.min(asset.duration || 5, 30)
      const start = Math.max(0, startTime ?? Math.max(0, Math.floor(playhead * 10) / 10))
      const targetTrack = findNonCollidingTrack(project, track, start, duration)

      const clipType: MediaClipType =
        asset.type === 'video' ? 'video'
        : asset.type === 'image' ? 'image'
        : 'audio'
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        trackId: targetTrack.id,
        startTime: start,
        duration,
        sourceStart: 0,
        clipType,
        sourceEnd: asset.type === 'image' ? duration : Math.min(asset.duration ?? duration, duration),
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
      }
      get().begin({ type: 'add', description: `Added '${asset.name}' to ${targetTrack.name}`, clipId: clip.id })
      mutate((p) => {
        let t = p.tracks.find((tr) => tr.id === targetTrack.id)
        if (!t) {
          p.tracks.push(targetTrack)
          t = targetTrack
        }
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
      get().select([clip.id], targetTrack.id)
      return clip
    },

    addTextClip: (text, trackId, startTime) => {
      const { project, playhead } = get()
      const track = project.tracks.find((t) => t.id === trackId)
      if (!track) return undefined

      const start = Math.max(0, startTime ?? Math.max(0, Math.floor(playhead * 10) / 10))
      const duration = 4
      const targetTrack = findNonCollidingTrack(project, track, start, duration)

      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: '',
        trackId: targetTrack.id,
        startTime: start,
        duration,
        sourceStart: 0,
        textType: 'title',
        sourceEnd: duration,
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
        let t = p.tracks.find((tr) => tr.id === targetTrack.id)
        if (!t) {
          p.tracks.push(targetTrack)
          t = targetTrack
        }
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
      get().select([clip.id], targetTrack.id)
      return clip
    },

    addClipToTrack: (clip) => {
      get().begin({ type: 'add', description: `Added '${clip.name}'`, clipId: clip.id })
      mutate((p) => {
        // Clamp inside the draft stage so the caller's object is never touched
        // before it becomes part of the document.
        clip.startTime = Math.max(0, clip.startTime)
        clip.sourceStart = Math.max(0, clip.sourceStart)
        let t = p.tracks.find((tr) => tr.id === clip.trackId)
        if (!t) {
          t = p.tracks[0]
          clip.trackId = t.id
        }
        const targetTrack = findNonCollidingTrack(p, t, clip.startTime, clip.duration)
        clip.trackId = targetTrack.id
        let dest = p.tracks.find((tr) => tr.id === targetTrack.id)
        if (!dest) {
          p.tracks.push(targetTrack)
          dest = targetTrack
        }
        dest.clips = [...dest.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
      get().select([clip.id], clip.trackId)
    },

    updateClip: (clipId, patch) => {
      const found = findClip(get().project, clipId)
      if (!found) return
      const subject = `'${found.clip.name}'`
      beginHistory({ type: describePatch(patch).type, description: `${describePatch(patch).description} ${subject}`, clipId })
      const safePatch = { ...patch }
      if (typeof safePatch.startTime === 'number') {
        safePatch.startTime = Math.max(0, safePatch.startTime)
      }
      if (typeof safePatch.sourceStart === 'number') {
        safePatch.sourceStart = Math.max(0, safePatch.sourceStart)
      }
      mutate((p) => {
        const f = findClip(p, clipId)
        if (!f) return p
        const { track, clip } = f
        const updated: Clip = { ...clip, ...safePatch }

        // If track changed:
        if (safePatch.trackId && safePatch.trackId !== track.id) {
          const dest = p.tracks.find((t) => t.id === safePatch.trackId)
          if (dest && dest.type === track.type) {
            track.clips = track.clips.filter((c) => c.id !== clipId)
            const targetTrack = isTrackOverlapping(dest, updated.startTime, updated.duration, clipId)
              ? findNonCollidingTrack(p, dest, updated.startTime, updated.duration, clipId)
              : dest
            let insertDest = p.tracks.find((t) => t.id === targetTrack.id)
            if (!insertDest) {
              p.tracks.push(targetTrack)
              insertDest = targetTrack
            }
            updated.trackId = insertDest.id
            insertDest.clips.push(updated)
            insertDest.clips.sort((a, b) => a.startTime - b.startTime)
            return p
          }
        }

        // If staying on same track, check if new startTime/duration causes overlap
        if (typeof safePatch.startTime === 'number' || typeof safePatch.duration === 'number') {
          if (isTrackOverlapping(track, updated.startTime, updated.duration, clipId)) {
            const targetTrack = findNonCollidingTrack(p, track, updated.startTime, updated.duration, clipId)
            if (targetTrack.id !== track.id) {
              track.clips = track.clips.filter((c) => c.id !== clipId)
              let moveInsert = p.tracks.find((t) => t.id === targetTrack.id)
              if (!moveInsert) {
                p.tracks.push(targetTrack)
                moveInsert = targetTrack
              }
              updated.trackId = moveInsert.id
              moveInsert.clips.push(updated)
              moveInsert.clips.sort((a, b) => a.startTime - b.startTime)
              return p
            }
          }
        }

        track.clips = track.clips.map((c) => (c.id === clipId ? updated : c))
        track.clips.sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
    },

    updateClips: (clipIds, patch) => {
      const ids = new Set(clipIds)
      beginHistory({ type: describePatch(patch).type, description: `Edited ${clipIds.length} ${clipIds.length === 1 ? 'clip' : 'clips'}` })
      const safePatch = { ...patch }
      if (typeof safePatch.startTime === 'number') {
        safePatch.startTime = Math.max(0, safePatch.startTime)
      }
      if (typeof safePatch.sourceStart === 'number') {
        safePatch.sourceStart = Math.max(0, safePatch.sourceStart)
      }
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.map((c) => (ids.has(c.id) ? { ...c, ...safePatch } : c))
        }
        return p
      })
      commitHistory()
    },

    moveClip: (clipId, delta, targetTrackId) => {
      const found = findClip(get().project, clipId)
      if (!found) return
      const { track: currentTrack, clip: currentClip } = found
      const subject = `'${currentClip.name}'`
      const target = targetTrackId ? get().project.tracks.find((t) => t.id === targetTrackId) : undefined
      beginHistory({
        type: 'move',
        description: target && target.id !== currentTrack.id ? `Moved ${subject} to ${target.name}` : `Moved ${subject}`,
        clipId,
      })
      mutate((p) => {
        let movingClip: Clip | null = null
        for (const tr of p.tracks) {
          const idx = tr.clips.findIndex((c) => c.id === clipId)
          if (idx !== -1) {
            movingClip = tr.clips[idx]
            tr.clips.splice(idx, 1)
            break
          }
        }
        if (!movingClip) return p

        let destTrack = p.tracks.find((t) => t.id === (targetTrackId || movingClip.trackId))
        if (!destTrack || destTrack.type !== currentTrack.type) {
          destTrack = p.tracks.find((t) => t.id === currentTrack.id) || p.tracks[0]
        }

        let nextStart = Math.max(0, movingClip.startTime + delta)
        const duration = movingClip.duration

        // Prevent overlap with existing clips on destTrack
        const otherClips = destTrack.clips.filter((c) => c.id !== clipId).sort((a, b) => a.startTime - b.startTime)
        const colliding = otherClips.find(
          (c) => Math.max(nextStart, c.startTime) < Math.min(nextStart + duration, c.startTime + c.duration) - 0.01,
        )

        if (colliding) {
          if (delta <= 0) {
            // Moving left: snap to right edge of colliding clip
            nextStart = Math.max(0, colliding.startTime + colliding.duration)
          } else {
            // Moving right: snap to left edge of colliding clip
            nextStart = Math.max(0, colliding.startTime - duration)
          }
        }

        // If after clamping there's still an overlap on destTrack, find or create non-colliding track
        const stillColliding = otherClips.find(
          (c) => Math.max(nextStart, c.startTime) < Math.min(nextStart + duration, c.startTime + c.duration) - 0.01,
        )
        if (stillColliding) {
          destTrack = findNonCollidingTrack(p, destTrack, nextStart, duration, clipId)
        }
        let moveDest = p.tracks.find((t) => t.id === destTrack.id)
        if (!moveDest) {
          p.tracks.push(destTrack)
          moveDest = destTrack
        }

        movingClip.startTime = nextStart
        movingClip.trackId = moveDest.id
        moveDest.clips.push(movingClip)
        moveDest.clips.sort((a, b) => a.startTime - b.startTime)
        return p
      })
      commitHistory()
    },

    trimClip: (clipId, edge, delta) => {
      const found = findClip(get().project, clipId)
      if (!found) return
      const { clip } = found
      const subject = `'${clip.name}'`
      beginHistory({ type: 'edit', description: `Trimmed ${subject}`, clipId })
      mutate((p) => {
        const f = findClip(p, clipId)
        if (!f) return p
        const { track: tr, clip: c } = f
        const frame = 1 / p.fps
        const otherClips = tr.clips.filter((other) => other.id !== clipId).sort((a, b) => a.startTime - b.startTime)

        if (edge === 'start') {
          const prevClips = otherClips.filter((other) => other.startTime + other.duration <= c.startTime + 0.01)
          const minPossibleStart = prevClips.length > 0 ? Math.max(...prevClips.map((other) => other.startTime + other.duration)) : 0

          // `delta` arrives in TIMELINE seconds; source space moves by delta×speed.
          const requestedSourceStart = c.sourceStart + delta * c.speed
          const appliedSourceStart = Math.min(Math.max(0, requestedSourceStart), c.sourceEnd - frame)
          let newClipStart = c.startTime + (appliedSourceStart - c.sourceStart) / c.speed
          newClipStart = Math.max(0, minPossibleStart, newClipStart)
          const timelineDelta = newClipStart - c.startTime

          c.startTime = newClipStart
          c.duration = Math.max(frame, c.duration - timelineDelta)
          c.sourceStart = Math.max(0, c.sourceStart + timelineDelta * c.speed)
        } else {
          const nextClips = otherClips.filter((other) => other.startTime >= c.startTime + c.duration - 0.01)
          const maxPossibleEnd = nextClips.length > 0 ? Math.min(...nextClips.map((other) => other.startTime)) : c.startTime + 3600

          const requestedSourceEnd = c.sourceEnd + delta * c.speed
          const newSourceEnd = Math.min(Math.max(requestedSourceEnd, c.sourceStart + frame), c.sourceStart + 3600)
          const growthTimeline = (newSourceEnd - c.sourceEnd) / c.speed
          const maxDuration = Math.max(frame, maxPossibleEnd - c.startTime)
          const clampedDuration = Math.max(frame, Math.min(c.duration + growthTimeline, maxDuration))

          c.duration = clampedDuration
          c.sourceEnd = c.sourceStart + clampedDuration * c.speed
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
          // `splitTime` is a TIMELINE offset — the cut lands splitTime×speed
          // into the source media.
          const sourceCut = original.sourceStart + splitTime * original.speed
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

    shiftClips: (clipIds, delta) => {
      const ids = new Set(clipIds)
      get().begin({
        type: 'move',
        description: `Shifted ${clipIds.length} ${clipIds.length === 1 ? 'clip' : 'clips'} by ${delta > 0 ? '+' : ''}${delta.toFixed(1)}s`,
      })
      mutate((p) => {
        for (const track of p.tracks) {
          if (track.locked) continue
          track.clips = track.clips.map((c) => {
            if (!ids.has(c.id)) return c
            return { ...c, startTime: Math.max(0, c.startTime + delta) }
          })
          track.clips.sort((a, b) => a.startTime - b.startTime)
        }
        return p
      })
      commitHistory()
    },

    alignClipsToTime: (clipIds, targetTime) => {
      const ids = new Set(clipIds)
      get().begin({
        type: 'move',
        description: `Aligned ${clipIds.length} ${clipIds.length === 1 ? 'clip' : 'clips'} to ${targetTime.toFixed(1)}s`,
      })
      mutate((p) => {
        for (const track of p.tracks) {
          if (track.locked) continue
          track.clips = track.clips.map((c) => {
            if (!ids.has(c.id)) return c
            return { ...c, startTime: Math.max(0, targetTime) }
          })
          track.clips.sort((a, b) => a.startTime - b.startTime)
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
              c.startTime >= minStart
                ? { ...c, startTime: Math.max(0, Math.round((c.startTime - removedLength) * 100) / 100) }
                : c,
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
          const matching = track.clips.filter((c) => ids.has(c.id))
          for (const c of matching) {
            // Find a non-colliding placement: on an empty track or after c
            const targetTrack = findNonCollidingTrack(p, track, c.startTime, c.duration)
            const dupStartTime = targetTrack.id === track.id ? c.startTime + c.duration : c.startTime
            let finalTrack = isTrackOverlapping(targetTrack, dupStartTime, c.duration)
              ? findNonCollidingTrack(p, targetTrack, dupStartTime, c.duration)
              : targetTrack
            let dupDest = p.tracks.find((t) => t.id === finalTrack.id)
            if (!dupDest) {
              p.tracks.push(finalTrack)
              dupDest = finalTrack
            } else {
              finalTrack = dupDest
            }

            const dup: Clip = {
              ...(structuredClone(c) as Clip),
              id: crypto.randomUUID(),
              trackId: finalTrack.id,
              startTime: dupStartTime,
              name: `${c.name} copy`,
            }
            finalTrack.clips.push(dup)
            finalTrack.clips.sort((a, b) => a.startTime - b.startTime)
            duplicates.push(dup)
          }
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
          if (ids.has(c.id)) copied.push(structuredClone(c) as Clip)
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
          if (ids.has(c.id)) copied.push(structuredClone(c) as Clip)
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
          const pasteStart = playhead + (src.startTime - minStart)
          const targetTrack = findNonCollidingTrack(p, track, pasteStart, src.duration)
          const paste: Clip = {
            ...(structuredClone(src) as Clip),
            id: crypto.randomUUID(),
            trackId: targetTrack.id,
            startTime: pasteStart,
            name: src.name,
          }
          let dest = p.tracks.find((t) => t.id === targetTrack.id)
          if (!dest) {
            p.tracks.push(targetTrack)
            dest = targetTrack
          }
          dest.clips.push(paste)
          dest.clips.sort((a, b) => a.startTime - b.startTime)
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
      const dur = projectDuration(get().project.tracks)
      const clamped = dur > 0 ? Math.max(0, Math.min(time, dur)) : 0
      set({ playhead: Number.isFinite(clamped) ? clamped : 0 })
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