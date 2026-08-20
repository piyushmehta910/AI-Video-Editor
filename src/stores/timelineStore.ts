import { create } from 'zustand'
import type { Asset, Clip, Project, Track } from '@/engine/types'
import { newProject, projectDuration, defaultCameraRig } from '@/engine/types'
import { getRecord, getAllRecords, putRecord, deleteRecord } from '@/engine/storage/db'
import { writeMediaFile, deleteMediaFile } from '@/engine/storage/opfs'
import { generateThumbnail, probeMedia } from '@/engine/storage/thumbnails'
import { detectMediaType } from '@/engine/storage/mediaType'
import { generateProxy } from '@/engine/media/proxy'
import { generateFilmstrip } from '@/engine/media/filmstrip'
import { generateWaveform } from '@/engine/media/waveform'

const HISTORY_LIMIT = 200
let transactionDepth = 0

export interface TimelineState {
  project: Project
  assets: Asset[]
  hydrated: boolean
  saving: boolean
  selection: { clipIds: string[]; trackId: string | null }
  playhead: number
  zoom: number
  clipboard: Clip[]
  past: Project[]
  future: Project[]

  hydrate: () => Promise<void>
  save: () => Promise<void>

  importFiles: (files: File[]) => Promise<{ imported: Asset[]; errors: string[] }>
  deleteAsset: (assetId: string) => Promise<void>

  begin: () => void
  undo: () => void
  redo: () => void
  /** Run fn as a single undoable transaction: one begin snapshot, inner begins suppressed. */
  withTransaction: (fn: () => void) => void

  renameProject: (name: string) => void
  setProjectSettings: (patch: Partial<Pick<Project, 'width' | 'height' | 'fps' | 'aspectRatio'>>) => void
  resetProject: () => void

  addClip: (assetId: string, trackId: string, startTime?: number) => Clip | undefined
  addClipToTrack: (clip: Clip) => void
  addTextClip: (text: string, trackId: string, startTime?: number) => Clip | undefined
  updateClip: (clipId: string, patch: Partial<Clip>) => void
  updateClips: (clipIds: string[], patch: Partial<Clip>) => void
  moveClip: (clipId: string, delta: number, targetTrackId?: string) => void
  trimClip: (clipId: string, edge: 'start' | 'end', delta: number) => void
  splitClip: (clipId: string, atTime: number) => void
  joinClips: (clipId1: string, clipId2: string) => void
  deleteClips: (clipIds: string[], ripple?: boolean) => void
  duplicateClips: (clipIds: string[]) => void
  copyClips: (clipIds: string[]) => void
  cutClips: (clipIds: string[]) => void
  pasteClips: () => void

  toggleTrackLock: (trackId: string) => void
  toggleTrackMute: (trackId: string) => void
  toggleTrackHidden: (trackId: string) => void
  setTrackClips: (trackId: string, clips: Clip[]) => void

  select: (clipIds: string[], trackId?: string | null) => void
  setPlayhead: (time: number) => void
  setZoom: (zoom: number) => void

  duration: () => number
}

function cloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p)) as Project
}

export const useTimelineStore = create<TimelineState>()((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().save()
    }, 2000)
  }

  const mutate = (updater: (p: Project) => Project) => {
    set((state) => ({ project: updater(cloneProject(state.project)) }))
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
    selection: { clipIds: [], trackId: null },
    playhead: 0,
    zoom: 90,
    clipboard: [],
    past: [],
    future: [],

    hydrate: async () => {
      try {
        const [assets, project] = await Promise.all([
          getAllRecords<Asset>('assets'),
          getRecord<Project>('projects', 'active'),
        ])
        set({
          assets: assets.sort((a, b) => b.importedAt - a.importedAt),
          project: project ?? newProject(),
          hydrated: true,
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
        const type = detectMediaType(file)
        if (!type) {
          errors.push(`${file.name}: unsupported file type`)
          continue
        }
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
        for (const asset of imported) {
          const type = asset.type === 'audio' ? 'audio' : 'video'
          const track = get().project.tracks.find((t) => t.type === type)
          if (!track) continue
          const lastEnd = track.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
          get().addClip(asset.id, track.id, Math.round(lastEnd * 10) / 10)
        }
      }
      return { imported, errors }
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

    begin: () => {
      if (transactionDepth > 0) return
      set((state) => {
        const past = [...state.past, cloneProject(state.project)].slice(-HISTORY_LIMIT)
        return { past, future: [] }
      })
    },

    withTransaction: (fn) => {
      get().begin()
      transactionDepth++
      try {
        fn()
      } finally {
        transactionDepth--
      }
    },

    undo: () => {
      set((state) => {
        if (!state.past.length) return {}
        const previous = state.past[state.past.length - 1]
        const past = state.past.slice(0, -1)
        return {
          project: cloneProject(previous),
          past,
          future: [...state.future, cloneProject(state.project)].slice(-HISTORY_LIMIT),
          selection: { clipIds: [], trackId: null },
          playhead: Math.min(state.playhead, projectDuration(previous.tracks)),
        }
      })
      scheduleSave()
    },

    redo: () => {
      set((state) => {
        if (!state.future.length) return {}
        const next = state.future[state.future.length - 1]
        const future = state.future.slice(0, -1)
        return {
          project: cloneProject(next),
          future,
          past: [...state.past, cloneProject(state.project)].slice(-HISTORY_LIMIT),
          selection: { clipIds: [], trackId: null },
          playhead: Math.min(state.playhead, projectDuration(next.tracks)),
        }
      })
      scheduleSave()
    },

    renameProject: (name) => {
      mutate((p) => ({ ...p, name }))
    },

    setProjectSettings: (patch) => {
      mutate((p) => ({ ...p, ...patch }))
    },

    resetProject: () => {
      set({ project: newProject(), past: [], future: [], selection: { clipIds: [], trackId: null }, playhead: 0 })
      scheduleSave()
    },

    addClip: (assetId, trackId, startTime) => {
      const { project, playhead } = get()
      const asset = get().assets.find((a) => a.id === assetId)
      if (!asset) return undefined
      const track = project.tracks.find((t) => t.id === trackId)
      if (!track) return undefined

      const duration = asset.type === 'image' || asset.type === 'model' ? 4 : Math.min(asset.duration || 5, 30)
      const start = startTime ?? Math.max(0, Math.floor(playhead * 10) / 10)
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        trackId: track.id,
        startTime: start,
        duration,
        sourceStart: 0,
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
      get().begin()
      mutate((p) => {
        const t = p.tracks.find((tr) => tr.id === track.id)!
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
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
      get().begin()
      mutate((p) => {
        const t = p.tracks.find((tr) => tr.id === track.id)!
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
      get().select([clip.id], track.id)
      return clip
    },

    addClipToTrack: (clip) => {
      get().begin()
      mutate((p) => {
        const t = p.tracks.find((tr) => tr.id === clip.trackId)
        if (!t) return p
        t.clips = [...t.clips, clip].sort((a, b) => a.startTime - b.startTime)
        return p
      })
    },

    updateClip: (clipId, patch) => {
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c))
        }
        return p
      })
    },

    updateClips: (clipIds, patch) => {
      const ids = new Set(clipIds)
      mutate((p) => {
        for (const track of p.tracks) {
          track.clips = track.clips.map((c) => (ids.has(c.id) ? { ...c, ...patch } : c))
        }
        return p
      })
    },

    moveClip: (clipId, delta, targetTrackId) => {
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
    },

    trimClip: (clipId, edge, delta) => {
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
    },

    splitClip: (clipId, atTime) => {
      const found = findClip(get().project, clipId)
      if (!found) return
      const { clip } = found
      const splitTime = atTime - clip.startTime
      if (splitTime < 0.05 || splitTime > clip.duration - 0.05) return

      get().begin()
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

      get().begin()
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
    },

    deleteClips: (clipIds, ripple = false) => {
      const ids = new Set(clipIds)
      get().begin()
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
      set({ selection: { clipIds: [], trackId: null } })
    },

    duplicateClips: (clipIds) => {
      const ids = new Set(clipIds)
      get().begin()
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
      s.begin()
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
      set({ selection: { clipIds: created.map((c) => c.id), trackId: null } })
    },

    toggleTrackLock: (trackId) => {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)),
      }))
    },

    toggleTrackMute: (trackId) => {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
      }))
    },

    toggleTrackHidden: (trackId) => {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, hidden: !t.hidden } : t)),
      }))
    },

    setTrackClips: (trackId, clips) => {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, clips } : t)),
      }))
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

    duration: () => projectDuration(get().project.tracks),
  }
})