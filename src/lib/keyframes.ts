import type { ClipKeyframe } from '@/engine/types'

/**
 * Pure helpers for clip property keyframes. Keyframes currently act as
 * captured markers (toggle at playhead); interpolation is a future concern.
 */

/** Tolerance for "at playhead": half a frame at the project fps. */
export function keyframeAt(
  keyframes: ClipKeyframe[] | undefined,
  prop: string,
  time: number,
  fps = 30,
): ClipKeyframe | undefined {
  const tol = 0.5 / fps
  return keyframes?.find((k) => k.prop === prop && Math.abs(k.time - time) <= tol)
}

/** Insert or replace the keyframe for `prop` nearest `time`, keeping time order. */
export function upsertKeyframe(
  keyframes: ClipKeyframe[],
  prop: string,
  time: number,
  value: number,
): ClipKeyframe[] {
  const existing = keyframes.find((k) => k.prop === prop && k.time === time)
  if (existing) {
    return keyframes.map((k) => (k === existing ? { ...k, value } : k))
  }
  const next = [...keyframes, { id: crypto.randomUUID(), prop, time: Math.round(time * 1000) / 1000, value }]
  next.sort((a, b) => a.time - b.time)
  return next
}

export function removeKeyframe(keyframes: ClipKeyframe[], id: string): ClipKeyframe[] {
  return keyframes.filter((k) => k.id !== id)
}
