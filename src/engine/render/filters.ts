import type { Effect, Transition } from '@/engine/types'

export interface EffectResult {
  /** CSS filter string for standard effects */
  cssFilter: string
  /** Vignette intensity */
  vignette: number
  /** Chromatic aberration offset in pixels */
  chromaticAberration: number
  /** Glitch effect parameters */
  glitch: { intensity: number; scanlines: number } | null
}

/**
 * Compute combined effect parameters from a list of effects.
 * Returns both CSS filter string and special effect parameters for custom rendering.
 */
export function computeEffects(effects: Effect[]): EffectResult {
  let brightness = 1
  let contrast = 1
  let saturate = 1
  let blur = 0
  let grayscale = 0
  let vignette = 0
  let chromaticAberration = 0
  let glitch: EffectResult['glitch'] = null

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
      case 'vignette':
        vignette = Math.max(vignette, effect.value)
        break
      case 'chromatic-aberration':
        chromaticAberration = effect.aberrationOffset ?? 2
        break
      case 'glitch':
        glitch = {
          intensity: effect.glitchIntensity ?? 0.3,
          scanlines: effect.scanlines ?? 8,
        }
        break
      default:
        break
    }
  }

  const parts = [`brightness(${brightness})`, `contrast(${contrast})`, `saturate(${saturate})`]
  if (blur > 0) parts.push(`blur(${blur}px)`)
  if (grayscale > 0.5) parts.push('grayscale(1)')

  return {
    cssFilter: parts.join(' '),
    vignette,
    chromaticAberration,
    glitch,
  }
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

/**
 * Apply chromatic aberration effect to a canvas context.
 * Draws the source image three times with R/G/B channel offsets.
 */
export function applyChromaticAberration(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  offset: number,
): void {
  const offsetX = offset
  const offsetY = offset * 0.5

  // Red channel (shifted right/down)
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgb(255,0,0)'
  ctx.globalAlpha = 0.33
  ctx.drawImage(source, sx, sy, sw, sh, dx + offsetX, dy + offsetY, dw, dh)

  // Green channel (center)
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgb(0,255,0)'
  ctx.globalAlpha = 0.33
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)

  // Blue channel (shifted left/up)
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgb(0,0,255)'
  ctx.globalAlpha = 0.33
  ctx.drawImage(source, sx, sy, sw, sh, dx - offsetX, dy - offsetY, dw, dh)

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

/**
 * Apply glitch effect to a canvas context.
 * Adds scanlines, random displacement, and color channel shifts.
 */
export function applyGlitch(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  intensity: number,
  scanlineCount: number,
): void {
  const glitchCtx = ctx.canvas.getContext('2d')!
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = dw
  tempCanvas.height = dh
  const tempCtx = tempCanvas.getContext('2d')!

  // Draw source to temp canvas
  tempCtx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh)

  // Apply scanlines
  if (scanlineCount > 0) {
    glitchCtx.fillStyle = 'rgba(0,0,0,0.1)'
    const lineHeight = dh / scanlineCount
    for (let i = 0; i < scanlineCount; i++) {
      if (Math.random() < 0.3) {
        glitchCtx.fillRect(0, i * lineHeight, dw, lineHeight * 0.5)
      }
    }
  }

  // Random horizontal displacement
  if (Math.random() < intensity) {
    const displacement = (Math.random() - 0.5) * dw * 0.1 * intensity
    ctx.drawImage(tempCanvas, 0, 0, dw, dh, dx + displacement, dy, dw, dh)
  } else {
    ctx.drawImage(tempCanvas, 0, 0, dw, dh, dx, dy, dw, dh)
  }

  // Color channel shift glitch
  if (Math.random() < intensity * 0.5) {
    const shift = (Math.random() - 0.5) * 10 * intensity
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.2
    ctx.drawImage(tempCanvas, 0, 0, dw, dh, dx + shift, dy, dw, dh)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }
}