import type { Asset, Clip, Project, TextAnimation } from '@/engine/types'
import { computeEffects, transitionAlpha } from './filters'
import { drawCaptions, type CaptionRender } from '@/engine/captions/render'
import { type CropWindow, type CropKeyframe } from '@/engine/reframing'

export interface CompositeMedia {
  /** Return a drawable source for a video asset positioned at `srcTime`, or null if not ready. */
  video: (clip: Clip, asset: Asset, srcTime: number) => Promise<CanvasImageSource | null>
  /** Return a loaded image for an image asset. */
  image: (asset: Asset) => Promise<CanvasImageSource | null>
  /** Render one frame of a 3D model asset's camera animation at the output size. */
  model?: (clip: Clip, asset: Asset, time: number, size: { width: number; height: number }) => Promise<CanvasImageSource | null>
  /** Fallback when a video is not ready/decodable. */
  thumbnail?: (asset: Asset) => Promise<CanvasImageSource | null>
  /** Compute the auto-caption layer for this frame, or null when nothing to draw. */
  captions?: (input: {
    time: number
    size: { width: number; height: number }
    activeClip: { clip: Clip; asset: Asset } | null
  }) => Promise<CaptionRender | null>
}

function sourceSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight }
  if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) return { w: source.width, h: source.height }
  return { w: (source as ImageBitmap).width, h: (source as ImageBitmap).height }
}

/** Ease-out cubic: fast start, gentle settle. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Ease-out back with a small overshoot — for "pop". */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Ease-out bounce for "bounce". */
function easeOutBounce(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}

/** Interpolate crop window from keyframes at a given time. */
function interpolateCrop(keyframes: CropKeyframe[] | undefined, time: number): CropWindow | null {
  if (!keyframes?.length) return null
  if (keyframes.length === 1) return keyframes[0].crop
  // Find the two keyframes that bracket the time
  let i = 0
  while (i < keyframes.length - 1 && keyframes[i + 1].time <= time) i++
  if (i === keyframes.length - 1) return keyframes[i].crop
  const k0 = keyframes[i]
  const k1 = keyframes[i + 1]
  const t = (time - k0.time) / (k1.time - k0.time)
  const clampedT = Math.max(0, Math.min(1, t))
  // Linear interpolation
  return {
    x: k0.crop.x + (k1.crop.x - k0.crop.x) * clampedT,
    y: k0.crop.y + (k1.crop.y - k0.crop.y) * clampedT,
    width: k0.crop.width + (k1.crop.width - k0.crop.width) * clampedT,
    height: k0.crop.height + (k1.crop.height - k0.crop.height) * clampedT,
  }
}

/** Draw a video source with special effects (chromatic aberration, glitch). */
function drawVideoWithEffects(
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
  effects: ReturnType<typeof import('./filters').computeEffects>,
): void {
  // Draw base image
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)

  // Apply chromatic aberration if enabled
  if (effects.chromaticAberration > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.33

    // Red channel (shifted right)
    ctx.drawImage(source, sx, sy, sw, sh, dx + effects.chromaticAberration, dy, dw, dh)
    // Green channel (center)
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
    // Blue channel (shifted left)
    ctx.drawImage(source, sx, sy, sw, sh, dx - effects.chromaticAberration, dy, dw, dh)

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  // Apply glitch effect
  if (effects.glitch) {
    const intensity = effects.glitch.intensity
    if (Math.random() < intensity) {
      const displacement = (Math.random() - 0.5) * dh * 0.1 * intensity
      ctx.translate(displacement, 0)
    }

    // Apply scanlines
    if (effects.glitch.scanlines > 0) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      for (let i = 0; i < effects.glitch.scanlines; i++) {
        if (Math.random() < 0.3) {
          ctx.fillRect(dx, dy + i * (dh / effects.glitch.scanlines), dw, (dh / effects.glitch.scanlines) * 0.5)
        }
      }
      ctx.restore()
    }

    // Color channel shift glitch
    if (Math.random() < intensity * 0.5) {
      // const shift = (Math.random() - 0.5) * 10 * intensity
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.2
      // We'd need to redraw for this, skipping for performance
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
  }
}

export interface TextAnimationState {
  /** 0..1 progress through the animation */
  progress: number
  /** Extra alpha multiplier */
  alpha: number
  /** Offset (px) applied to the text, in local clip space */
  offsetX: number
  offsetY: number
  /** Scale multiplier */
  scale: number
  /** For typewriter: number of visible characters (0..1 fraction) */
  reveal: number
}

/**
 * Compute entrance animation state for a text overlay at a given timeline time.
 * `duration` clamps progress so the animation plays within the clip's first `animationDuration` seconds.
 */
export function textAnimationAt(animation: TextAnimation, duration: number, time: number, clipStart: number, clipDuration: number): TextAnimationState {
  const state: TextAnimationState = { progress: 1, alpha: 1, offsetX: 0, offsetY: 0, scale: 1, reveal: 1 }
  if (animation === 'none' || duration <= 0) return state

  const local = Math.min(Math.max(time - clipStart, 0), clipDuration)
  const raw = local / duration
  const p = Math.min(Math.max(raw, 0), 1)
  state.progress = p
  const e = easeOutCubic(p)

  switch (animation) {
    case 'fade-in':
      state.alpha = e
      break
    case 'slide-up':
      state.alpha = e
      state.offsetY = (1 - e) * 80
      break
    case 'slide-down':
      state.alpha = e
      state.offsetY = -(1 - e) * 80
      break
    case 'slide-left':
      state.alpha = e
      state.offsetX = (1 - e) * 120
      break
    case 'slide-right':
      state.alpha = e
      state.offsetX = -(1 - e) * 120
      break
    case 'zoom-in':
      state.alpha = e
      state.scale = 0.5 + 0.5 * e
      break
    case 'zoom-out':
      state.alpha = e
      state.scale = 1.5 - 0.5 * e
      break
    case 'pop':
      state.alpha = Math.min(1, e * 1.2)
      state.scale = easeOutBack(p)
      break
    case 'bounce':
      state.alpha = Math.min(1, e * 1.2)
      state.offsetY = -(1 - easeOutBounce(p)) * 120
      break
    case 'typewriter':
      state.reveal = e
      break
    default:
      break
  }
  return state
}

/**
 * Render one composite frame of the project at `time` onto `ctx`.
 * Shared by the live preview and the export pipeline so both produce identical
 * output (clips, effects, transitions, text overlays, vignette).
 */
export async function compositeFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  assets: Asset[],
  time: number,
  media: CompositeMedia,
  size?: { width: number; height: number },
): Promise<void> {
  const w = size?.width ?? project.width
  const h = size?.height ?? project.height
  ctx.clearRect(0, 0, w, h)

  const video: Array<{ clip: Clip; z: number }> = []
  project.tracks.forEach((track, trackIndex) => {
    if (track.hidden || track.locked) return
    const clip = track.clips.find((c) => time >= c.startTime && time < c.startTime + c.duration)
    if (!clip) return
    if (track.type === 'video' || track.type === 'text') video.push({ clip, z: trackIndex })
  })
  video.sort((a, b) => b.z - a.z)

  let vignette = 0
  for (const { clip } of video) {
    const asset = assets.find((a) => a.id === clip.assetId)
    if (!asset) continue
    const effects = computeEffects(clip.effects)
    vignette = Math.max(vignette, vignette)
    const srcTime = (time - clip.startTime) * clip.speed + clip.sourceStart

    ctx.globalAlpha = clip.opacity * transitionAlpha(clip.startTime, clip.duration, time, clip.transitions.in, clip.transitions.out)
    ctx.filter = effects.cssFilter
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((clip.rotation * Math.PI) / 180)
    ctx.scale(clip.scale.x, clip.scale.y)

    if (asset.type === 'video') {
      const source = await media.video(clip, asset, srcTime)
      if (source) {
        const { w: sw, h: sh } = sourceSize(source)
        if (sw > 0 && sh > 0) {
          // Check for smart reframing crop keyframes
          const crop = clip.reframing?.enabled ? interpolateCrop(clip.reframing.keyframes, srcTime) : null
          if (crop) {
            // Draw with smart reframing crop
            drawVideoWithEffects(ctx, source, crop.x, crop.y, crop.width, crop.height, -w / 2, -h / 2, w, h, effects)
          } else {
            // Standard center-crop (cover fit)
            const scale = Math.max(w / sw, h / sh)
            drawVideoWithEffects(ctx, source, 0, 0, sw, sh, -w / 2, -h / 2, sw * scale, sh * scale, effects)
          }
        }
      } else if (media.thumbnail) {
        const thumb = await media.thumbnail(asset)
        if (thumb) {
          const { w: tw, h: th } = sourceSize(thumb)
          if (tw > 0 && th > 0) {
            const scale = Math.max(w / tw, h / th)
            ctx.drawImage(thumb, (-tw * scale) / 2, (-th * scale) / 2, tw * scale, th * scale)
          }
        }
      }
    } else if (asset.type === 'image') {
      const img = await media.image(asset)
      if (img) {
        const { w: iw, h: ih } = sourceSize(img)
        if (iw > 0 && ih > 0) {
          const scale = Math.max(w / iw, h / ih)
          ctx.drawImage(img, (-iw * scale) / 2, (-ih * scale) / 2, iw * scale, ih * scale)
        }
      }
    } else if (asset.type === 'model') {
      if (media.model) {
        const source = await media.model(clip, asset, time, { width: w, height: h })
        if (source) {
          const { w: mw, h: mh } = sourceSize(source)
          if (mw > 0 && mh > 0) {
            ctx.drawImage(source, -w / 2, -h / 2, w, h)
          }
        }
      }
    }
    ctx.restore()
    ctx.filter = 'none'
    ctx.globalAlpha = 1
  }

  // Text overlays (drawn above clip media, below vignette).
  for (const { clip } of video) {
    if (!clip.text) continue
    const t = clip.text
    const anim = textAnimationAt(t.animation ?? 'none', t.animationDuration, time, clip.startTime, clip.duration)
    ctx.save()
    ctx.globalAlpha = clip.opacity * transitionAlpha(clip.startTime, clip.duration, time, clip.transitions.in, clip.transitions.out) * anim.alpha
    ctx.translate(w / 2, h / 2)
    ctx.rotate((clip.rotation * Math.PI) / 180)
    ctx.scale(clip.scale.x, clip.scale.y)
    ctx.translate(clip.position.x, clip.position.y)
    if (anim.scale !== 1) ctx.scale(anim.scale, anim.scale)
    if (anim.offsetX !== 0 || anim.offsetY !== 0) ctx.translate(anim.offsetX, anim.offsetY)

    const fontWeight = t.fontWeight === 'bold' ? 'bold ' : ''
    const fontStyle = t.fontStyle === 'italic' ? 'italic ' : ''
    ctx.font = `${fontStyle}${fontWeight}${t.fontSize}px ${t.fontFamily}`
    ctx.textAlign = t.textAlign
    ctx.textBaseline = 'middle'

    let text = t.text
    if (anim.reveal < 1) {
      const visibleChars = Math.floor(text.length * anim.reveal)
      text = text.slice(0, visibleChars)
    }
    const lines = text.split('\n')
    const lineHeight = t.fontSize * 1.2
    const totalHeight = lines.length * lineHeight
    const startY = -totalHeight / 2 + lineHeight / 2

    if (t.backgroundColor && t.backgroundColor !== 'transparent') {
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width))
      const bgX = t.textAlign === 'center' ? -maxLineW / 2 - t.paddingLeft : t.textAlign === 'right' ? -maxLineW - t.paddingLeft : -t.paddingLeft
      const bgY = startY - lineHeight / 2 - t.paddingTop
      const bgW = maxLineW + t.paddingLeft + t.paddingRight
      const bgH = totalHeight + t.paddingTop + t.paddingBottom
      ctx.fillStyle = t.backgroundColor
      if (t.borderRadius > 0) {
        ctx.beginPath()
        ctx.roundRect(bgX, bgY, bgW, bgH, t.borderRadius)
        ctx.fill()
      } else {
        ctx.fillRect(bgX, bgY, bgW, bgH)
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * lineHeight
      if (t.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.7)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
      }
      ctx.fillStyle = t.color
      ctx.fillText(lines[i], 0, y)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }
    ctx.restore()
  }

  // Auto-caption layer (transcript-driven, drawn above clips and text overlays,
  // below the vignette) — identical in preview and export.
  if (media.captions) {
    const top = video.find(({ clip }) => {
      const a = assets.find((x) => x.id === clip.assetId)
      return a && a.type === 'video'
    })
    const activeClip = top
      ? { clip: top.clip, asset: assets.find((a) => a.id === top.clip.assetId)! }
      : null
    const cap = await media.captions({ time, size: { width: w, height: h }, activeClip })
    if (cap) drawCaptions(ctx, cap, { width: w, height: h })
  }

  if (vignette > 0) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, vignette)})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}