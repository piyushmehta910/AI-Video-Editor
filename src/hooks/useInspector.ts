import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, Clip, ClipKeyframe, Track } from '@/engine/types'
import { keyframeAt, removeKeyframe, upsertKeyframe } from '@/lib/keyframes'

/**
 * Shared inspector state: resolves the primary selected clip, provides
 * real-time updates that batch into single history entries (a slider drag
 * becomes one undo step), keyframe toggling, and audio normalization.
 */

/** How long after the last change an edit batch closes (one undo step). */
const BATCH_CLOSE_MS = 500

export interface InspectorTarget {
  clip: Clip
  track: Track
  asset?: Asset
}

export interface InspectorApi {
  target: InspectorTarget | null
  selectionCount: number
  /** Immediate update — one history entry per call. */
  update: (patch: Partial<Clip>, label?: string) => void
  /**
   * Real-time update batched for history: consecutive calls within
   * BATCH_CLOSE_MS collapse into a single undo step.
   */
  batched: (patch: Partial<Clip>, label?: string) => void
  /** Close any open edit batch immediately (e.g. on selection change). */
  flushBatch: () => void
  /** Toggle a property keyframe at the playhead. */
  toggleKeyframe: (prop: string, value: number) => void
  /** True when a keyframe for `prop` exists at (or within half a frame of) the playhead. */
  hasKeyframeAt: (prop: string) => boolean
}

export function useInspector(): InspectorApi {
  const selection = useTimelineStore((s) => s.selection)
  const project = useTimelineStore((s) => s.project)
  const assets = useTimelineStore((s) => s.assets)
  const playhead = useTimelineStore((s) => s.playhead)

  const target = React.useMemo<InspectorTarget | null>(() => {
    const id = selection.clipIds[0]
    if (!id) return null
    for (const track of project.tracks) {
      const clip = track.clips.find((c) => c.id === id)
      if (clip) return { clip, track, asset: assets.find((a) => a.id === clip.assetId) }
    }
    return null
  }, [selection.clipIds, project, assets])

  const batchOpen = React.useRef(false)
  const batchTimer = React.useRef<number | null>(null)

  const flushBatch = React.useCallback(() => {
    if (batchTimer.current != null) {
      window.clearTimeout(batchTimer.current)
      batchTimer.current = null
    }
    if (batchOpen.current) {
      batchOpen.current = false
      useTimelineStore.getState().endHistoryGroup()
    }
  }, [])

  // Closing a batch when the target changes prevents edits leaking between clips.
  React.useEffect(() => {
    flushBatch()
  }, [target?.clip.id, flushBatch])

  React.useEffect(() => () => flushBatch(), [flushBatch])

  const update = React.useCallback(
    (patch: Partial<Clip>, _label?: string) => {
      if (!target) return
      useTimelineStore.getState().updateClip(target.clip.id, patch)
    },
    [target],
  )

  const batched = React.useCallback(
    (patch: Partial<Clip>, label?: string) => {
      if (!target) return
      const store = useTimelineStore.getState()
      if (!batchOpen.current) {
        store.beginHistoryGroup({
          type: 'edit',
          description: label ?? 'Edited',
          clipId: target.clip.id,
        })
        batchOpen.current = true
      }
      store.updateClip(target.clip.id, patch)
      if (batchTimer.current != null) window.clearTimeout(batchTimer.current)
      batchTimer.current = window.setTimeout(() => {
        batchTimer.current = null
        if (batchOpen.current) {
          batchOpen.current = false
          useTimelineStore.getState().endHistoryGroup()
        }
      }, BATCH_CLOSE_MS)
    },
    [target],
  )

  const toggleKeyframe = React.useCallback(
    (prop: string, value: number) => {
      if (!target) return
      const clip = target.clip
      const existing = keyframeAt(clip.keyframes, prop, playhead)
      let next: ClipKeyframe[]
      if (existing) {
        next = removeKeyframe(clip.keyframes ?? [], existing.id)
      } else {
        next = upsertKeyframe(clip.keyframes ?? [], prop, playhead, value)
      }
      useTimelineStore.getState().updateClip(clip.id, {
        keyframes: next,
      })
    },
    [target, playhead],
  )

  const hasKeyframeAt = React.useCallback(
    (prop: string) => {
      if (!target) return false
      return Boolean(keyframeAt(target.clip.keyframes, prop, playhead))
    },
    [target, playhead],
  )

  return {
    target,
    selectionCount: selection.clipIds.length,
    update,
    batched,
    flushBatch,
    toggleKeyframe,
    hasKeyframeAt,
  }
}

/**
 * One-click peak normalization for audio-bearing clips: measures the source's
 * peak amplitude over the trimmed range and sets volume so peaks hit ~-0.5 dB.
 */
export async function normalizeClipVolume(clip: Clip): Promise<number | null> {
  const store = useTimelineStore.getState()
  const asset = store.assets.find((a) => a.id === clip.assetId)
  if (!asset) return null
  try {
    const { readMediaFile } = await import('@/engine/storage/opfs')
    const file = await readMediaFile(asset.filePath)
    const buf = await file.arrayBuffer()
    const ctx = new AudioContext()
    let buffer: AudioBuffer
    try {
      buffer = await ctx.decodeAudioData(buf)
    } finally {
      void ctx.close()
    }
    const sr = buffer.sampleRate
    const from = Math.max(0, Math.floor(clip.sourceStart * sr))
    const to = Math.min(buffer.length, Math.ceil(Math.max(clip.sourceEnd, clip.sourceStart + 0.05) * sr))
    let peak = 0
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch)
      // Stride sampling keeps large files snappy while finding true peaks.
      const stride = Math.max(1, Math.floor((to - from) / 400_000))
      for (let i = from; i < to; i += stride) {
        const v = Math.abs(data[i])
        if (v > peak) peak = v
      }
    }
    if (peak < 0.001) return null
    const TARGET = 0.95
    const volume = Math.min(2, Math.max(0.01, TARGET / peak))
    return Math.abs(volume - clip.volume) < 0.005 ? null : volume
  } catch {
    return null
  }
}

interface CustomFontEntry {
  family: string
  filePath: string
}

const CUSTOM_FONTS_KEY = 'clipforge-custom-fonts'

function readCustomFontList(): CustomFontEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FONTS_KEY)
    return raw ? (JSON.parse(raw) as CustomFontEntry[]) : []
  } catch {
    return []
  }
}

function writeCustomFontList(list: CustomFontEntry[]): void {
  localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(list))
}

async function registerFontFace(family: string, file: File): Promise<void> {
  const face = new FontFace(family, await file.arrayBuffer())
  await face.load()
  document.fonts.add(face)
}

/**
 * Custom font uploads persist to OPFS and re-register with the FontFace API
 * on every session so previously styled text keeps rendering.
 */
export function useCustomFonts() {
  const [families, setFamilies] = React.useState<string[]>([])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = readCustomFontList()
      if (!list.length) return
      const { readMediaFile } = await import('@/engine/storage/opfs')
      const loaded: string[] = []
      for (const entry of list) {
        try {
          const file = await readMediaFile(entry.filePath)
          await registerFontFace(entry.family, file)
          loaded.push(entry.family)
        } catch {
          // Font file missing — drop it from the persisted list.
        }
      }
      if (!cancelled) setFamilies(loaded)
      const valid = list.filter((e) => loaded.includes(e.family))
      writeCustomFontList(valid)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const upload = React.useCallback(async (file: File): Promise<string> => {
    const family = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Custom font'
    await registerFontFace(family, file)
    const { writeMediaFile } = await import('@/engine/storage/opfs')
    const filePath = await writeMediaFile(crypto.randomUUID(), file)
    const list = [...readCustomFontList().filter((e) => e.family !== family), { family, filePath }]
    writeCustomFontList(list)
    setFamilies((prev) => [...prev.filter((f) => f !== family), family])
    return family
  }, [])

  return { families, upload }
}
