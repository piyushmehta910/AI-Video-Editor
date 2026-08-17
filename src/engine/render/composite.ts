import type { Asset, Clip, Project } from '@/engine/types'
import { effectFilter, effectVignette, transitionAlpha } from './filters'

export interface CompositeMedia {
  /** Return a drawable source for a video asset positioned at `srcTime`, or null if not ready. */
  video: (clip: Clip, asset: Asset, srcTime: number) => Promise<CanvasImageSource | null>
  /** Return a loaded image for an image asset. */
  image: (asset: Asset) => Promise<CanvasImageSource | null>
  /** Fallback when a video is not ready/decodable. */
  thumbnail?: (asset: Asset) => Promise<CanvasImageSource | null>
}

function sourceSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight }
  if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) return { w: source.width, h: source.height }
  return { w: (source as ImageBitmap).width, h: (source as ImageBitmap).height }
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
    if (track.type === 'video') video.push({ clip, z: trackIndex })
  })
  video.sort((a, b) => b.z - a.z)

  let vignette = 0
  for (const { clip } of video) {
    const asset = assets.find((a) => a.id === clip.assetId)
    if (!asset) continue
    vignette = Math.max(vignette, effectVignette(clip.effects))
    const srcTime = (time - clip.startTime) * clip.speed + clip.sourceStart

    ctx.globalAlpha = clip.opacity * transitionAlpha(clip.startTime, clip.duration, time, clip.transitions.in, clip.transitions.out)
    ctx.filter = effectFilter(clip.effects)
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((clip.rotation * Math.PI) / 180)
    ctx.scale(clip.scale.x, clip.scale.y)

    if (asset.type === 'video') {
      const source = await media.video(clip, asset, srcTime)
      if (source) {
        const { w: sw, h: sh } = sourceSize(source)
        if (sw > 0 && sh > 0) {
          const scale = Math.max(w / sw, h / sh)
          ctx.drawImage(source, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale)
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
    }
    ctx.restore()
    ctx.filter = 'none'
    ctx.globalAlpha = 1
  }

  // Text overlays (drawn above clip media, below vignette).
  for (const { clip } of video) {
    if (!clip.text) continue
    const t = clip.text
    ctx.save()
    ctx.globalAlpha = clip.opacity * transitionAlpha(clip.startTime, clip.duration, time, clip.transitions.in, clip.transitions.out)
    ctx.translate(w / 2, h / 2)
    ctx.rotate((clip.rotation * Math.PI) / 180)
    ctx.scale(clip.scale.x, clip.scale.y)
    ctx.translate(clip.position.x, clip.position.y)

    const fontWeight = t.fontWeight === 'bold' ? 'bold ' : ''
    const fontStyle = t.fontStyle === 'italic' ? 'italic ' : ''
    ctx.font = `${fontStyle}${fontWeight}${t.fontSize}px ${t.fontFamily}`
    ctx.textAlign = t.textAlign
    ctx.textBaseline = 'middle'

    const lines = t.text.split('\n')
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

  if (vignette > 0) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, vignette)})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}