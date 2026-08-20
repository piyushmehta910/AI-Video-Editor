import { readMediaFile } from '@/engine/storage/opfs'
import type { Asset, Project } from '@/engine/types'
import { projectDuration, defaultCameraRig } from '@/engine/types'
import { compositeFrame } from '@/engine/render/composite'
import { makeCaptionsProvider } from '@/engine/captions/render'
import { mixProjectAudio, type MixedAudio } from './audioMix'
import { WebMMuxer } from './webm-muxer'

export interface ExportOptions {
  width: number
  height: number
  fps: number
  bitrate: number
  codec: 'vp8' | 'vp9' | 'av1'
  masterVolume?: number
  muted?: boolean
  includeAudio?: boolean
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

export function seekTo(el: HTMLVideoElement, time: number): Promise<void> {
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

export async function loadMediaElement(asset: Asset): Promise<HTMLVideoElement> {
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

function encodedChunkBytes(chunk: EncodedAudioChunk): Uint8Array {
  const bytes = new Uint8Array(chunk.byteLength)
  chunk.copyTo(bytes)
  return bytes
}

/**
 * Encode a mixed audio buffer to Opus and feed the chunks to the muxer.
 * Skips silently when WebCodecs AudioEncoder is unavailable.
 */
async function encodeAudio(muxer: WebMMuxer, mixed: MixedAudio, signal?: AbortSignal): Promise<void> {
  if (typeof AudioEncoder === 'undefined') return
  const channels: Float32Array[] = []
  for (let c = 0; c < Math.min(2, mixed.buffer.numberOfChannels); c++) {
    channels.push(mixed.buffer.getChannelData(c))
  }
  if (channels.length === 0) return
  muxer.setAudio({ sampleRate: mixed.sampleRate, channels: channels.length })

  const config: AudioEncoderConfig = { codec: 'opus', sampleRate: mixed.sampleRate, numberOfChannels: channels.length, bitrate: 128_000 }
  try {
    const support = await AudioEncoder.isConfigSupported(config)
    if (!support.supported) return
  } catch {
    return
  }

  const encoder = new AudioEncoder({
    output: (chunk) => {
      muxer.addAudioChunk({ data: encodedChunkBytes(chunk), timestamp: chunk.timestamp / 1000 })
    },
    error: (e) => {
      throw e
    },
  })
  encoder.configure(config)

  const CHUNK_FRAMES = 1024
  for (let offset = 0; offset < mixed.buffer.length; offset += CHUNK_FRAMES) {
    if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
    const frames = Math.min(CHUNK_FRAMES, mixed.buffer.length - offset)
    const plane = new Float32Array(frames * channels.length)
    for (let c = 0; c < channels.length; c++) {
      plane.set(channels[c].subarray(offset, offset + frames), c * frames)
    }
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: mixed.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels.length,
      timestamp: Math.round((offset / mixed.sampleRate) * 1_000_000),
      data: plane,
    })
    encoder.encode(data)
    data.close()
  }
  await encoder.flush()
  encoder.close()
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

  const mixedAudio =
    opts.includeAudio === false
      ? null
      : await mixProjectAudio(project, assets, { masterVolume: opts.masterVolume ?? 1, muted: opts.muted ?? false }, opts.signal)

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

    await compositeFrame(
      ctx,
      project,
      assets,
      time,
      {
        video: async (_clip, asset, srcTime) => {
          let el = mediaElements.get(asset.id)
          if (!el) {
            el = await loadMediaElement(asset)
            mediaElements.set(asset.id, el)
          }
          const elTime = Math.min(Math.max(0, srcTime), Math.max(0, (asset.duration ?? srcTime) - 0.05))
          await seekTo(el, elTime)
          return el.videoWidth > 0 ? el : null
        },
        image: (asset) => loadImage(asset),
        model: async (clip, asset, time, size) => {
          const { renderModelFrame } = await import('@/engine/three/modelRenderer')
          return renderModelFrame({
            asset,
            rig: clip.modelRig ?? defaultCameraRig(),
            time,
            clipStart: clip.startTime,
            clipDuration: clip.duration,
            width: size.width,
            height: size.height,
            signal: opts.signal,
          })
        },
        captions: makeCaptionsProvider(project),
      },
      { width: opts.width, height: opts.height },
    )

    const frame = new VideoFrame(canvas, { timestamp: Math.round(time * 1_000_000) })
    encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(opts.fps * 2)) === 0 })
    frame.close()

    opts.onProgress(i + 1, total)
    if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0))
  }

  await encoder.flush()
  encoder.close()
  if (mixedAudio) await encodeAudio(muxer, mixedAudio, opts.signal)
  for (const el of mediaElements.values()) el.src = ''
  for (const url of imageCache.values()) url.src = ''

  const blob = muxer.finalize()
  return { blob, frames: total }
}