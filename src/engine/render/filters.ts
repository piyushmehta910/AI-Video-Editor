import type { Effect, Transition } from '@/engine/types'

export function effectFilter(effects: Effect[]): string {
  let brightness = 1
  let contrast = 1
  let saturate = 1
  let blur = 0
  let grayscale = 0
  for (const effect of effects) {
    if (!effect.enabled) continue
    switch (effect.type) {
      case 'brightness':
        brightness = Math.max(0, 1 + effect.value)
        break
      case 'contrast':
        contrast = Math.max(0, 1 + effect.value)
        break
      case 'saturation':
        saturate = Math.max(0, 1 + effect.value)
        break
      case 'blur':
        blur = Math.max(0, effect.value)
        break
      case 'grayscale':
        grayscale = Math.max(grayscale, effect.value)
        break
      default:
        break
    }
  }
  const parts = [`brightness(${brightness})`, `contrast(${contrast})`, `saturate(${saturate})`]
  if (blur > 0) parts.push(`blur(${blur}px)`)
  if (grayscale > 0.5) parts.push('grayscale(1)')
  return parts.join(' ')
}

export function effectVignette(effects: Effect[]): number {
  let vignette = 0
  for (const effect of effects) {
    if (!effect.enabled || effect.type !== 'vignette') continue
    vignette = Math.max(vignette, effect.value)
  }
  return vignette
}

/**
 * Compute the alpha multiplier for a clip based on its in/out transitions.
 * Returns 1 when fully visible, 0 when fully transparent.
 */
export function transitionAlpha(
  clipStart: number,
  clipDuration: number,
  currentTime: number,
  transitionIn?: Transition,
  transitionOut?: Transition,
): number {
  let alpha = 1
  if (transitionIn && transitionIn.duration > 0) {
    const elapsed = currentTime - clipStart
    if (elapsed < transitionIn.duration) {
      const progress = Math.max(0, elapsed / transitionIn.duration)
      alpha *= smoothstep(progress)
    }
  }
  if (transitionOut && transitionOut.duration > 0) {
    const remaining = (clipStart + clipDuration) - currentTime
    if (remaining < transitionOut.duration) {
      const progress = Math.max(0, remaining / transitionOut.duration)
      alpha *= smoothstep(progress)
    }
  }
  return alpha
}

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}
