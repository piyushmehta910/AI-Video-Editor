import { WebMMuxer } from '@/engine/export/webm-muxer'
import { codecConfig, codecString } from '@/engine/motion/sandbox'
import { renderModelFrame } from './modelRenderer'
import type { CameraRig } from './rig'
import type { Asset } from '@/engine/types'

export interface GlbVideoOptions {
  asset: Asset
  rig: CameraRig
  duration: number
  fps?: number
  width?: number
  height?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface GlbVideoResult {
  blob: Blob
  frames: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Render a 3D model asset's camera-rig animation to a WebM video clip:
 * GLB -> three.js (WebGPU/WebGL) camera animation -> canvas frames ->
 * WebCodecs VideoEncoder -> WebM. Reuses the shared model renderer and the
 * same encoder pipeline as motion graphics.
 */
export async function renderGlbToVideo(opts: GlbVideoOptions): Promise<GlbVideoResult> {
  const { asset, rig, duration, signal } = opts
  const fps = opts.fps ?? 30
  const width = opts.width ?? 1280
  const height = opts.height ?? 720

  if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs VideoEncoder is not supported in this browser')
  if (width <= 0 || height <= 0 || duration <= 0) throw new Error('Invalid render dimensions or duration')

  let muxer: WebMMuxer | null = null
  let encoder: VideoEncoder | null = null
  try {
    if (signal?.aborted) throw new DOMException('Render aborted', 'AbortError')

    const codec = await codecString()
    muxer = new WebMMuxer({ width, height, duration, codec })
    encoder = new VideoEncoder({
      output: (chunk) => {
        muxer?.addChunk({ data: new Uint8Array(chunk.byteLength), timestamp: chunk.timestamp / 1000, isKey: chunk.type === 'key' })
      },
      error: (e) => {
        throw e
      },
    })
    const encoderConfig: VideoEncoderConfig = {
      codec: codecConfig(codec),
      width,
      height,
      bitrate: 8_000_000,
      framerate: fps,
    }
    const support = await VideoEncoder.isConfigSupported(encoderConfig)
    if (!support.supported) {
      encoderConfig.bitrate = undefined
      encoderConfig.framerate = undefined
      await VideoEncoder.isConfigSupported(encoderConfig)
    }
    encoder.configure(encoderConfig)

    const total = Math.max(1, Math.round(duration * fps))
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('Render aborted', 'AbortError')
      const t = Math.min(i / fps, duration)
      const source = await renderModelFrame({
        asset,
        rig,
        time: t,
        clipStart: 0,
        clipDuration: duration,
        width,
        height,
        signal,
      })
      if (!source) throw new Error(`Failed to render 3D frame ${i} — the model may be unsupported.`)
      const frame = new VideoFrame(source, { timestamp: Math.round(t * 1_000_000) })
      encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(fps * 2)) === 0 })
      frame.close()
      if (source instanceof ImageBitmap) source.close()
      opts.onProgress?.(i + 1, total)
      if (i % 8 === 0) await sleep(0)
    }

    await encoder.flush()
    encoder.close()
    encoder = null
    return { blob: muxer.finalize(), frames: total }
  } finally {
    encoder?.close()
  }
}
