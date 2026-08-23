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

/**
 * Interpolate numeric value of a clip property at `time` (relative to clip start).
 * Returns `defaultValue` if no keyframes exist for `prop`.
 */
export function interpolatePropertyKeyframe(
  keyframes: ClipKeyframe[] | undefined,
  prop: string,
  time: number,
  defaultValue: number,
): number {
  if (!keyframes || keyframes.length === 0) return defaultValue
  const propKeyframes = keyframes.filter((k) => k.prop === prop).sort((a, b) => a.time - b.time)
  if (propKeyframes.length === 0) return defaultValue
  if (propKeyframes.length === 1) return propKeyframes[0].value
  if (time <= propKeyframes[0].time) return propKeyframes[0].value
  const lastIndex = propKeyframes.length - 1
  if (time >= propKeyframes[lastIndex].time) return propKeyframes[lastIndex].value

  let i = 0
  while (i < lastIndex && propKeyframes[i + 1].time <= time) {
    i++
  }
  const k0 = propKeyframes[i]
  const k1 = propKeyframes[i + 1]
  const span = k1.time - k0.time
  if (span <= 0) return k0.value
  const t = Math.max(0, Math.min(1, (time - k0.time) / span))
  return k0.value + (k1.value - k0.value) * t
}

