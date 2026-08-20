import type { Asset, CaptionCue, CaptionPosition, CaptionWord, Clip, Project } from '@/engine/types'
import type { StoredTranscript } from '@/engine/analysis/types'

/** Normalized (0..1) box within the frame. */
export interface FrameBox {
  x: number
  y: number
  w: number
  h: number
}

/** Map a timeline time to the active clip's asset-relative time. */
export function assetTimeAt(clip: Clip, time: number): number {
  return (time - clip.startTime) * clip.speed + clip.sourceStart
}

/** Top-most video clip active at `time`, or null. */
export function topmostVideoClip(
  project: Project,
  assets: Asset[],
  time: number,
): { clip: Clip; asset: Asset } | null {
  const matches: Array<{ clip: Clip; asset: Asset; z: number }> = []
  project.tracks.forEach((track, trackIndex) => {
    if (track.hidden || track.locked || track.type !== 'video') return
    const clip = track.clips.find((c) => time >= c.startTime && time < c.startTime + c.duration)
    if (!clip) return
    const asset = assets.find((a) => a.id === clip.assetId)
    if (asset && asset.type === 'video') matches.push({ clip, asset, z: trackIndex })
  })
  if (!matches.length) return null
  matches.sort((a, b) => b.z - a.z)
  return { clip: matches[0].clip, asset: matches[0].asset }
}

const cueCache = new WeakMap<StoredTranscript, CaptionCue[]>()

export function buildCaptionCues(transcript: StoredTranscript): CaptionCue[] {
  const cached = cueCache.get(transcript)
  if (cached) return cached

  const cues: CaptionCue[] = []
  for (const sentence of transcript.sentences ?? []) {
    const text = sentence.text.trim()
    if (!text) continue
    const words = (transcript.words ?? []).filter(
      (w) => w.start >= sentence.start - 0.05 && w.end <= sentence.end + 0.05,
    )
    cues.push({
      start: sentence.start,
      end: sentence.end,
      text,
      words: words.length ? (words as CaptionWord[]) : undefined,
    })
  }

  if (cues.length === 0 && (transcript.words ?? []).length) {
    for (const w of transcript.words ?? []) {
      cues.push({ start: w.start, end: w.end, text: w.word, words: [w as CaptionWord] })
    }
  }

  cueCache.set(transcript, cues)
  return cues
}

/** The cue active at `assetTime`, or null. */
export function cueAt(cues: CaptionCue[], assetTime: number): CaptionCue | null {
  return cues.find((c) => assetTime >= c.start && assetTime < c.end) ?? null
}

/** Index of the word currently being spoken, or -1 when before the first word. */
export function activeWordIndex(cue: CaptionCue, assetTime: number): number {
  if (!cue.words?.length) return -1
  let last = -1
  for (let i = 0; i < cue.words.length; i++) {
    if (assetTime >= cue.words[i].start) last = i
    else break
  }
  return last
}

/** Fraction of `box`'s area overlapped by `region`. */
export function overlapFraction(box: FrameBox, region: FrameBox): number {
  const ix = Math.max(0, Math.min(box.x + box.w, region.x + region.w) - Math.max(box.x, region.x))
  const iy = Math.max(0, Math.min(box.y + box.h, region.y + region.h) - Math.max(box.y, region.y))
  return (ix * iy) / Math.max(1e-9, box.w * box.h)
}

export interface CaptionAnchorInput {
  /** Output frame size in pixels. */
  frame: { width: number; height: number }
  /** Measured caption box in pixels. */
  box: { width: number; height: number }
  position: CaptionPosition
  /** Normalized protected regions. */
  protectedRegions: FrameBox[]
  avoidProtectedRegions: boolean
}

/**
 * Pick the caption anchor (center point, px) for a measured box. Honors the
 * position mode, then — when avoidance is enabled — moves the caption to the
 * opposite edge if the chosen band overlaps a protected region.
 */
export function captionAnchor(input: CaptionAnchorInput): { x: number; y: number } {
  const { frame, box, position, protectedRegions, avoidProtectedRegions } = input
  const w = frame.width
  const h = frame.height
  const marginY = position.marginY * h

  const toNormalized = (yCenter: number): FrameBox => ({
    x: (w / 2 - box.width / 2) / w,
    y: (yCenter - box.height / 2) / h,
    w: box.width / w,
    h: box.height / h,
  })

  const occlusion = (yCenter: number) =>
    protectedRegions.reduce((sum, r) => sum + overlapFraction(toNormalized(yCenter), r), 0)

  const bottomY = h - marginY - box.height / 2
  const topY = marginY + box.height / 2

  let mode = position.mode
  if (mode === 'auto') {
    mode = occlusion(topY) < occlusion(bottomY) ? 'top' : 'bottom'
  }

  let y = mode === 'top' ? topY : bottomY
  if (avoidProtectedRegions && protectedRegions.length) {
    const altY = mode === 'top' ? bottomY : topY
    if (occlusion(y) > 0.05 && occlusion(altY) < occlusion(y)) {
      y = altY
    }
  }

  return { x: w / 2, y }
}