import { readMediaFile } from '@/engine/storage/opfs'
import type { Asset, Clip, Project, Track } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import { effectFilter, effectVignette } from '@/engine/render/filters'
import { WebMMuxer } from './webm-muxer'

export interface ExportOptions {
  width: number
  height: number
  fps: number
  bitrate: number
  codec: 'vp8' | 'vp9' | 'av1'
  onProgress: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  frames: number
}

function codecString(codec: ExportOptions['codec']): string {
  switch (codec) {
    case 'vp8':
      return 'vp8'
    case 'vp9':
      return 'vp09.00.10.08'
    case 'av1':
      return 'av01.0.04M.08'
  }
}

function seekTo(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState >= 1 && Math.abs(el.currentTime - time) < 0.02) {
      resolve()
      return
    }
    const onSeeked = () => {
      el.removeEventListener('seeked', onSeeked)
      resolve()
    }
    el.addEventListener('seeked', onSeeked)
    try {
      el.currentTime = time
    } catch {
      resolve()
    }
    window.setTimeout(resolve, 1500)
  })
}

async function loadMediaElement(asset: Asset): Promise<HTMLVideoElement> {
  const el = document.createElement('video')
  el.preload = 'auto'
  el.muted = true
  el.playsInline = true
  el.crossOrigin = 'anonymous'
  const file = await readMediaFile(asset.filePath)
  const url = URL.createObjectURL(file)
  el.src = url
  await new Promise<void>((resolve) => {
    if (el.readyState >= 2) {
      resolve()
      return
    }
    el.addEventListener('loadedmetadata', () => resolve(), { once: true })
    el.addEventListener('error', () => resolve(), { once: true })
    window.setTimeout(resolve, 5000)
  })
  return el
}

export async function exportProject(
  project: Project,
  assets: Asset[],
  opts: ExportOptions,
): Promise<ExportResult> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not supported in this browser')
  }

  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const muxer = new WebMMuxer({ width: opts.width, height: opts.height, duration: projectDuration(project.tracks), codec: opts.codec })

  const encoder = new VideoEncoder({
    output: (chunk) => {
      muxer.addChunk({ data: new Uint8Array(chunk.byteLength), timestamp: chunk.timestamp / 1000, isKey: chunk.type === 'key' })
    },
    error: (e) => {
      throw e
    },
  })

  const encoderConfig: VideoEncoderConfig = {
    codec: codecString(opts.codec),
    width: opts.width,
    height: opts.height,
    bitrate: opts.bitrate,
    framerate: opts.fps,
  }
  const support = await VideoEncoder.isConfigSupported(encoderConfig)
  if (!support.supported) {
    encoderConfig.bitrate = undefined
    encoderConfig.framerate = undefined
    const retry = await VideoEncoder.isConfigSupported(encoderConfig)
    if (!retry.supported) throw new Error(`Encoder config not supported: ${opts.codec}`)
  }
  encoder.configure(encoderConfig)

  const mediaElements = new Map<string, HTMLVideoElement>()
  const imageCache = new Map<string, HTMLImageElement>()
  const total = Math.max(1, Math.round(projectDuration(project.tracks) * opts.fps))

  const activeClipsAt = (time: number) => {
    const video: Array<{ clip: Clip; track: Track; z: number }> = []
    project.tracks.forEach((track, trackIndex) => {
      if (track.hidden || track.locked) return
      const clip = track.clips.find((c) => time >= c.startTime && time < c.startTime + c.duration)
      if (!clip) return
      if (track.type === 'video') video.push({ clip, track, z: trackIndex })
    })
    video.sort((a, b) => b.z - a.z)
    return video
  }

  const loadImage = async (asset: Asset): Promise<HTMLImageElement> => {
    const cached = imageCache.get(asset.id)
    if (cached) return cached
    const file = await readMediaFile(asset.filePath)
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = url
    })
    imageCache.set(asset.id, img)
    return img
  }

  const duration = projectDuration(project.tracks)
  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
    const time = Math.min((i / opts.fps), duration - 1 / opts.fps)
    ctx.clearRect(0, 0, opts.width, opts.height)

    let vignette = 0
    const clips = activeClipsAt(time)
    for (const { clip, track } of clips) {
      void track
      const asset = assets.find((a) => a.id === clip.assetId)
      if (!asset) continue
      vignette = Math.max(vignette, effectVignette(clip.effects))
      const srcTime = (time - clip.startTime) * clip.speed + clip.sourceStart

      ctx.globalAlpha = clip.opacity
      ctx.filter = effectFilter(clip.effects)
      ctx.save()
      ctx.translate(opts.width / 2, opts.height / 2)
      ctx.rotate((clip.rotation * Math.PI) / 180)
      ctx.scale(clip.scale.x, clip.scale.y)

      if (asset.type === 'video') {
        let el = mediaElements.get(asset.id)
        if (!el) {
          el = await loadMediaElement(asset)
          mediaElements.set(asset.id, el)
        }
        const elTime = Math.min(Math.max(0, srcTime), Math.max(0, (asset.duration ?? srcTime) - 0.05))
        await seekTo(el, elTime)
        if (el.videoWidth > 0) {
          const scale = Math.max(opts.width / el.videoWidth, opts.height / el.videoHeight)
          ctx.drawImage(el, (-el.videoWidth * scale) / 2, (-el.videoHeight * scale) / 2, el.videoWidth * scale, el.videoHeight * scale)
        }
      } else if (asset.type === 'image') {
        const img = await loadImage(asset)
        if (img.width > 0) {
          const scale = Math.max(opts.width / img.width, opts.height / img.height)
          ctx.drawImage(img, (-img.width * scale) / 2, (-img.height * scale) / 2, img.width * scale, img.height * scale)
        }
      }
      ctx.restore()
      ctx.filter = 'none'
      ctx.globalAlpha = 1
    }

    if (vignette > 0) {
      const grad = ctx.createRadialGradient(opts.width / 2, opts.height / 2, Math.min(opts.width, opts.height) * 0.35, opts.width / 2, opts.height / 2, Math.max(opts.width, opts.height) * 0.75)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, vignette)})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, opts.width, opts.height)
    }

    const frame = new VideoFrame(canvas, { timestamp: Math.round(time * 1_000_000) })
    encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(opts.fps * 2)) === 0 })
    frame.close()

    opts.onProgress(i + 1, total)
    if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0))
  }

  await encoder.flush()
  encoder.close()
  for (const el of mediaElements.values()) el.src = ''
  for (const url of imageCache.values()) url.src = ''

  const blob = muxer.finalize()
  return { blob, frames: total }
}