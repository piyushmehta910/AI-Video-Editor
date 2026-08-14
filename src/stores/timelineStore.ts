import { create } from 'zustand'
import type { Asset, Clip, Project, Track } from '@/engine/types'
import { newProject, projectDuration } from '@/engine/types'
import { getRecord, getAllRecords, putRecord, deleteRecord } from '@/engine/storage/db'
import { writeMediaFile, deleteMediaFile } from '@/engine/storage/opfs'
import { generateThumbnail, probeMedia } from '@/engine/storage/thumbnails'

const HISTORY_LIMIT = 200

export interface TimelineState {
  project: Project
  assets: Asset[]
  hydrated: boolean
  saving: boolean
  selection: { clipIds: string[]; trackId: string | null }
  playhead: number
  zoom: number
  past: Project[]
  future: Project[]

  hydrate: () => Promise<void>
  save: () => Promise<void>

  importFiles: (files: File[]) => Promise<{ imported: Asset[]; errors: string[] }>
  deleteAsset: (assetId: string) => Promise<void>

  begin: () => void
  undo: () => void
  redo: () => void

  renameProject: (name: string) => void
  setProjectSettings: (patch: Partial<Pick<Project, 'width' | 'height' | 'fps' | 'aspectRatio'>>) => void
  resetProject: () => void

  addClip: (assetId: string, trackId: string, startTime?: number) => Clip | undefined
  addClipToTrack: (clip: Clip) => void
  updateClip: (clipId: string, patch: Partial<Clip>) => void
  updateClips: (clipIds: string[], patch: Partial<Clip>) => void
  moveClip: (clipId: string, delta: number, targetTrackId?: string) => void
  trimClip: (clipId: string, edge: 'start' | 'end', delta: number) => void
  splitClip: (clipId: string, atTime: number) => void
  deleteClips: (clipIds: string[], ripple?: boolean) => void
  duplicateClips: (clipIds: string[]) => void

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
        const type = file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : file.type.startsWith('image/')
              ? 'image'
              : null
        if (!type) {
          errors.push(`${file.name}: unsupported file type`)
          continue
        }
        try {
          const id = crypto.randomUUID()
          const filePath = await writeMediaFile(id, file)
          const probe = await probeMedia(file, type)
          const thumb = await generateThumbnail(file, type)
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
        // Place each newly imported item on its matching track, appended at the end.
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
      set((state) => {
        const past = [...state.past, cloneProject(state.project)].slice(-HISTORY_LIMIT)
        return { past, future: [] }
      })
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

      const duration = asset.type === 'image' ? 4 : Math.min(asset.duration || 5, 30)
      const start = startTime ?? Math.max(0, Math.floor(playhead * 10) / 10)
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        trackId: track.id,
        startTime: start,
        duration,
        sourceStart: 0,
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
      set({ playhead: Math.max(0, time) })
    },

    setZoom: (zoom) => {
      set({ zoom: Math.min(400, Math.max(15, zoom)) })
    },

    duration: () => projectDuration(get().project.tracks),
  }
})