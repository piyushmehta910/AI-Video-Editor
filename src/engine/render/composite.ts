import type { Asset, Clip, Project, TextAnimation } from '@/engine/types'
import { computeEffects, transitionAlpha } from './filters'
import { drawCaptions, type CaptionRender } from '@/engine/captions/render'
import { type CropWindow, type CropKeyframe } from '@/engine/reframing'
import { interpolatePropertyKeyframe } from '@/lib/keyframes'

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

function drawImagePlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number, label: string) {
  const size = Math.max(1, Math.min(w, h) * 0.08)
  ctx.save()
  ctx.translate(-w / 2, -h / 2)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 2
  ctx.strokeRect(2, 2, w - 4, h - 4)
  ctx.fillStyle = '#64748b'
  ctx.font = `${size}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxWidth = w * 0.9
  const truncated = label.length > 30 ? label.slice(0, 27) + '...' : label
  ctx.fillText(truncated, w / 2, h / 2, maxWidth)
  ctx.restore()
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

/** Lazily-built film-grain noise tile used by the grain overlay. */
let grainTile: HTMLCanvasElement | null = null
function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.floor(Math.random() * 130)
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  grainTile = c
  return c
}

function drawGrainOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number): void {
  const pattern = ctx.createPattern(getGrainTile(), 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalAlpha = Math.min(0.45, intensity * 0.45)
  ctx.globalCompositeOperation = 'overlay'
  const ox = Math.floor(Math.random() * 128)
  const oy = Math.floor(Math.random() * 128)
  ctx.translate(-ox, -oy)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w + 128, h + 128)
  ctx.restore()
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
  let vignetteRadius = 0.35
  let grain = 0
  for (const { clip } of video) {
    const asset = assets.find((a) => a.id === clip.assetId)
    if (!asset) continue
    const effects = computeEffects(clip.effects)
    if (effects.vignette > vignette) {
      vignette = effects.vignette
      vignetteRadius = effects.vignetteRadius
    }
    grain = Math.max(grain, effects.grain)
    const clipLocalTime = time - clip.startTime
    const srcTime = clipLocalTime * clip.speed + clip.sourceStart

    const currentOpacity = interpolatePropertyKeyframe(clip.keyframes, 'opacity', clipLocalTime, clip.opacity)
    const currentPosX = interpolatePropertyKeyframe(clip.keyframes, 'position.x', clipLocalTime, clip.position.x)
    const currentPosY = interpolatePropertyKeyframe(clip.keyframes, 'position.y', clipLocalTime, clip.position.y)
    const currentScaleX = interpolatePropertyKeyframe(clip.keyframes, 'scale.x', clipLocalTime, clip.scale.x)
    const currentScaleY = interpolatePropertyKeyframe(clip.keyframes, 'scale.y', clipLocalTime, clip.scale.y)
    const currentRotation = interpolatePropertyKeyframe(clip.keyframes, 'rotation', clipLocalTime, clip.rotation)

    ctx.save()
    ctx.globalAlpha = currentOpacity * transitionAlpha(clip.startTime, clip.duration, time, clip.transitions.in, clip.transitions.out)
    ctx.filter = effects.cssFilter
    if (clip.blendMode && clip.blendMode !== 'normal') {
      ctx.globalCompositeOperation = clip.blendMode
    }
    if (clip.dropShadow) {
      ctx.shadowColor = clip.dropShadow.color
      ctx.shadowBlur = clip.dropShadow.blur
      ctx.shadowOffsetX = clip.dropShadow.offsetX
      ctx.shadowOffsetY = clip.dropShadow.offsetY
    }
    ctx.translate(w / 2, h / 2)
    // Media layers honor position (text always did).
    ctx.translate(currentPosX, currentPosY)
    ctx.rotate((currentRotation * Math.PI) / 180)
    ctx.scale(currentScaleX, currentScaleY)
    const anchorX = (clip.anchor?.x ?? 0.5) - 0.5
    const anchorY = (clip.anchor?.y ?? 0.5) - 0.5

    /** Apply manual percentage crop to a full source rect. */
    const applyManualCrop = (sw: number, sh: number): { sx: number; sy: number; sw: number; sh: number } => {
      const c = clip.crop
      if (!c || (c.top === 0 && c.right === 0 && c.bottom === 0 && c.left === 0)) {
        return { sx: 0, sy: 0, sw, sh }
      }
      const left = (Math.min(45, Math.max(0, c.left)) / 100) * sw
      const right = (Math.min(45, Math.max(0, c.right)) / 100) * sw
      const top = (Math.min(45, Math.max(0, c.top)) / 100) * sh
      const bottom = (Math.min(45, Math.max(0, c.bottom)) / 100) * sh
      return { sx: left, sy: top, sw: Math.max(1, sw - left - right), sh: Math.max(1, sh - top - bottom) }
    }

    /** Stroke the configured border just inside the drawn rect. */
    const drawBorder = (dx: number, dy: number, dw: number, dh: number) => {
      const b = clip.border
      if (!b || b.width <= 0) return
      ctx.shadowColor = 'transparent'
      ctx.save()
      ctx.strokeStyle = b.color
      ctx.lineWidth = b.width
      const inset = b.width / 2
      const x = dx + inset
      const y = dy + inset
      const bw = Math.max(1, dw - b.width)
      const bh = Math.max(1, dh - b.width)
      if (b.radius > 0) {
        ctx.beginPath()
        ctx.roundRect(x, y, bw, bh, Math.min(b.radius, bw / 2, bh / 2))
        ctx.stroke()
      } else {
        ctx.strokeRect(x, y, bw, bh)
      }
      ctx.restore()
    }

    if (asset.type === 'video') {
      const source = await media.video(clip, asset, srcTime)
      if (source) {
        const { w: sw, h: sh } = sourceSize(source)
        if (sw > 0 && sh > 0) {
          const reframingCrop = clip.reframing?.enabled ? interpolateCrop(clip.reframing.keyframes, srcTime) : null
          if (reframingCrop) {
            drawVideoWithEffects(ctx, source, reframingCrop.x, reframingCrop.y, reframingCrop.width, reframingCrop.height, -w / 2 + anchorX * w, -h / 2 + anchorY * h, w, h, effects)
            drawBorder(-w / 2 + anchorX * w, -h / 2 + anchorY * h, w, h)
          } else {
            const r = applyManualCrop(sw, sh)
            let dw = r.sw
            let dh = r.sh
            if (clip.fitMode === 'contain') {
              const scale = Math.min(w / r.sw, h / r.sh)
              dw = r.sw * scale
              dh = r.sh * scale
            } else if (clip.fitMode === 'fill') {
              dw = w
              dh = h
            } else if (clip.fitMode === 'none') {
              dw = r.sw
              dh = r.sh
            } else {
              // default 'cover'
              const scale = Math.max(w / r.sw, h / r.sh)
              dw = r.sw * scale
              dh = r.sh * scale
            }
            const dx = -dw / 2 + anchorX * dw
            const dy = -dh / 2 + anchorY * dh
            drawVideoWithEffects(ctx, source, r.sx, r.sy, r.sw, r.sh, dx, dy, dw, dh, effects)
            drawBorder(dx, dy, dw, dh)
          }
        }
      } else if (media.thumbnail) {
        const thumb = await media.thumbnail(asset)
        if (thumb) {
          const { w: tw, h: th } = sourceSize(thumb)
          if (tw > 0 && th > 0) {
            const scale = clip.fitMode === 'contain' ? Math.min(w / tw, h / th) : Math.max(w / tw, h / th)
            ctx.drawImage(thumb, ((-tw * scale) / 2) + anchorX * tw * scale, ((-th * scale) / 2) + anchorY * th * scale, tw * scale, th * scale)
          } else {
            drawImagePlaceholder(ctx, w, h, asset.name ?? 'Video')
          }
        } else {
          drawImagePlaceholder(ctx, w, h, asset.name ?? 'Video')
        }
      }
    } else if (asset.type === 'image') {
      let img: CanvasImageSource | null = null
      try {
        img = await media.image(asset)
      } catch (e) {
        console.warn('Failed to load image asset:', asset.id, e)
      }
      if (img) {
        const { w: iw, h: ih } = sourceSize(img)
        if (iw > 0 && ih > 0) {
          const r = applyManualCrop(iw, ih)
          let dw = r.sw
          let dh = r.sh
          if (clip.fitMode === 'contain') {
            const scale = Math.min(w / r.sw, h / r.sh)
            dw = r.sw * scale
            dh = r.sh * scale
          } else if (clip.fitMode === 'fill') {
            dw = w
            dh = h
          } else if (clip.fitMode === 'none') {
            dw = r.sw
            dh = r.sh
          } else {
            // default 'cover'
            const scale = Math.max(w / r.sw, h / r.sh)
            dw = r.sw * scale
            dh = r.sh * scale
          }
          const dx = -dw / 2 + anchorX * dw
          const dy = -dh / 2 + anchorY * dh
          ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, dx, dy, dw, dh)
          drawBorder(dx, dy, dw, dh)
        } else {
          drawImagePlaceholder(ctx, w, h, asset.name ?? 'Image')
        }
      } else {
        drawImagePlaceholder(ctx, w, h, asset.name ?? 'Image')
      }
    } else if (asset.type === 'model') {
      if (media.model) {
        const source = await media.model(clip, asset, time, { width: w, height: h })
        if (source) {
          const { w: mw, h: mh } = sourceSize(source)
          if (mw > 0 && mh > 0) {
            ctx.drawImage(source, -w / 2 + anchorX * w, -h / 2 + anchorY * h, w, h)
          }
        }
      }
    }
    ctx.restore()
  }

  if (grain > 0) drawGrainOverlay(ctx, w, h, grain)

  // Text overlays (drawn above clip media, below vignette).
  for (const { clip } of video) {
    if (!clip.text) continue
    const clipLocalTime = time - clip.startTime
    const currentOpacity = interpolatePropertyKeyframe(clip.keyframes, 'opacity', clipLocalTime, clip.opacity)
    const currentPosX = interpolatePropertyKeyframe(clip.keyframes, 'position.x', clipLocalTime, clip.position.x)
    const currentPosY = interpolatePropertyKeyframe(clip.keyframes, 'position.y', clipLocalTime, clip.position.y)
    const currentScaleX = interpolatePropertyKeyframe(clip.keyframes, 'scale.x', clipLocalTime, clip.scale.x)
    const currentScaleY = interpolatePropertyKeyframe(clip.keyframes, 'scale.y', clipLocalTime, clip.scale.y)
    const currentRotation = interpolatePropertyKeyframe(clip.keyframes, 'rotation', clipLocalTime, clip.rotation)

    const t = clip.text
    const anim = textAnimationAt(t.animation ?? 'none', t.animationDuration, time, clip.startTime, clip.duration)
    ctx.save()
    ctx.globalAlpha = currentOpacity * transitionAlpha(clip.startTime, clip.duration, time, clip.transitions.in, clip.transitions.out) * anim.alpha
    ctx.translate(w / 2, h / 2)
    ctx.rotate((currentRotation * Math.PI) / 180)
    ctx.scale(currentScaleX, currentScaleY)
    ctx.translate(currentPosX, currentPosY)
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
        ctx.shadowColor = t.shadowColor ?? 'rgba(0,0,0,0.7)'
        ctx.shadowBlur = t.shadowBlur ?? 6
        ctx.shadowOffsetX = t.shadowOffsetX ?? 2
        ctx.shadowOffsetY = t.shadowOffsetY ?? 2
      }
      if (t.stroke && t.stroke.width > 0) {
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.lineWidth = t.stroke.width * 2
        ctx.strokeStyle = t.stroke.color
        ctx.strokeText(lines[i], 0, y)
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
    const inner = Math.min(w, h) * Math.max(0.05, vignetteRadius)
    const grad = ctx.createRadialGradient(w / 2, h / 2, inner, w / 2, h / 2, Math.max(w, h) * 0.75)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, vignette)})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}