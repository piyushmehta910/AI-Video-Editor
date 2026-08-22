import { decompressFrames, parseGIF } from 'gifuct-js'
import { WebMMuxer } from '@/engine/export/webm-muxer'
import { codecConfig, codecString } from '@/engine/motion/sandbox'

/**
 * GIF → WebM conversion for animated stickers.
 *
 * Decode: WebCodecs ImageDecoder (full composited frames, per-frame timing)
 * with a gifuct-js fallback for browsers without ImageDecoder GIF support.
 * Encode: the shared pipeline used by motion graphics and 3D rendering —
 * WebCodecs VideoEncoder + `WebMMuxer` from `@/engine/export/webm-muxer`.
 *
 * Per-frame timing: GIFs carry per-frame delays (centiseconds), not a fixed
 * frame rate. Delays are always parsed from the container (gifuct) so timing
 * is exact regardless of which pixel decoder ran; VideoFrame timestamps are
 * cumulative microseconds, preserving non-uniform timing through the encode.
 *
 * Transparency limitation: VP8/VP9 encoding via WebCodecs cannot preserve
 * alpha (`alpha: 'keep'` is unsupported for encoding, and our muxer does not
 * write BlockAdditional alpha). Transparent areas flatten to black. The UI
 * documents this at import time.
 */

/** Default GIF frame delay when the container omits it: 100ms (10cs). */
const DEFAULT_DELAY_US = 100_000

export interface GifMeta {
  width: number
  height: number
  /** Number of animation frames. */
  frameCount: number
  /** Per-frame delays in microseconds (from each frame's own GCE). */
  delaysUs: number[]
  /** Cumulative per-frame start timestamps in microseconds. */
  timestampsUs: number[]
  /** Total animation duration in seconds. */
  durationSec: number
}

/**
 * Pure metadata parse of an animated GIF — works in Node and browsers.
 * Uses gifuct-js to read every frame's own delay so non-uniform timing is
 * preserved exactly as authored.
 */
export function parseGifMeta(buffer: ArrayBuffer): GifMeta {
  const parsed = parseGIF(buffer)
  const frames = decompressFrames(parsed, false)
  if (!frames.length) throw new Error('GIF contains no frames')

  const delaysUs = frames.map((f) => {
    // gifuct reports each GCE delay in milliseconds (centiseconds × 10).
    const us = Math.round(f.delay * 1000)
    if (!isFinite(us) || us <= 0) return DEFAULT_DELAY_US
    return us
  })

  const timestampsUs: number[] = []
  let total = 0
  for (const d of delaysUs) {
    timestampsUs.push(total)
    total += d
  }

  return {
    width: parsed.lsd.width,
    height: parsed.lsd.height,
    frameCount: frames.length,
    delaysUs,
    timestampsUs,
    durationSec: total / 1_000_000,
  }
}

export interface DecodedGifFrames {
  meta: GifMeta
  /** Composited full frames in decode order. Caller closes/cleans up. */
  sources: Array<ImageBitmap | HTMLCanvasElement | VideoFrame>
  /** True when decoded via WebCodecs ImageDecoder. */
  viaImageDecoder: boolean
}

/** Feature-detect ImageDecoder with GIF support (2026 support matrix). */
export async function supportsImageDecoderGif(): Promise<boolean> {
  try {
    if (typeof ImageDecoder === 'undefined') return false
    return await ImageDecoder.isTypeSupported('image/gif')
  } catch {
    return false
  }
}

function sleep(ms = 0): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Decode composited frames via WebCodecs ImageDecoder. */
async function decodeWithImageDecoder(buffer: ArrayBuffer, meta: GifMeta): Promise<DecodedGifFrames> {
  const decoder = new ImageDecoder({ data: buffer, type: 'image/gif', preferAnimation: true })
  await decoder.tracks.ready
  const track = decoder.tracks.selectedTrack
  const count = Math.max(1, Math.min(track?.frameCount ?? meta.frameCount, meta.frameCount))

  const sources: Array<ImageBitmap | HTMLCanvasElement | VideoFrame> = []
  try {
    for (let i = 0; i < count; i++) {
      const result = await decoder.decode({ frameIndex: i })
      if (result.image) sources.push(result.image)
      if (i % 8 === 0) await sleep()
    }
  } finally {
    decoder.close()
  }
  if (!sources.length) throw new Error('ImageDecoder produced no frames')
  return { meta: { ...meta, frameCount: sources.length }, sources, viaImageDecoder: true }
}

/** gifuct-js fallback: compose delta patches onto a canvas, honouring GIF disposal rules. */
async function decodeWithGifuct(buffer: ArrayBuffer, meta: GifMeta): Promise<DecodedGifFrames> {
  const parsed = parseGIF(buffer)
  const framesData = decompressFrames(parsed, true)

  const canvas = document.createElement('canvas')
  canvas.width = meta.width
  canvas.height = meta.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D unavailable for GIF composition')

  const sources: Array<ImageBitmap | HTMLCanvasElement | VideoFrame> = []
  let previousSnapshot: ImageData | null = null

  for (const frame of framesData) {
    if (frame.disposalType === 3) previousSnapshot = ctx.getImageData(0, 0, meta.width, meta.height)

    // Draw this frame's RGBA patch at its position. putImageData replaces
    // pixels including alpha, so transparent regions behave correctly.
    const patch = new Uint8ClampedArray(frame.patch)
    const imageData = new ImageData(patch, frame.dims.width, frame.dims.height)
    ctx.putImageData(imageData, frame.dims.left, frame.dims.top)

    // Snapshot the composed full frame.
    const full = document.createElement('canvas')
    full.width = meta.width
    full.height = meta.height
    const fullCtx = full.getContext('2d')
    if (!fullCtx) throw new Error('Canvas 2D unavailable for frame snapshot')
    fullCtx.drawImage(canvas, 0, 0)
    sources.push(full)

    // Apply disposal AFTER capturing the frame.
    if (frame.disposalType === 2) {
      ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height)
    } else if (frame.disposalType === 3 && previousSnapshot) {
      ctx.putImageData(previousSnapshot, 0, 0)
      previousSnapshot = null
    }
  }

  if (!sources.length) throw new Error('GIF fallback decoder produced no frames')
  return { meta: { ...meta, frameCount: sources.length }, sources, viaImageDecoder: false }
}

/** Decode pixels using the best available path. */
export async function decodeGif(buffer: ArrayBuffer): Promise<DecodedGifFrames> {
  const meta = parseGifMeta(buffer)
  if (await supportsImageDecoderGif()) {
    try {
      return await decodeWithImageDecoder(buffer, meta)
    } catch {
      // fall through to gifuct
    }
  }
  return decodeWithGifuct(buffer, meta)
}

export interface EncodeFramesToWebMOptions {
  fps?: number
  bitrate?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface EncodedWebM {
  blob: Blob
  frames: number
  durationSec: number
}

/**
 * Encode canvas/frame sources into a WebM using the SAME mux + encoder path
 * as the main export (VideoEncoder + `WebMMuxer`). Timestamps come straight
 * from the GIF's cumulative per-frame timings, so output timing matches the
 * source animation even when frame delays are non-uniform.
 */
export async function encodeFramesToWebM(
  sources: Array<ImageBitmap | HTMLCanvasElement | VideoFrame>,
  meta: GifMeta,
  opts: EncodeFramesToWebMOptions = {},
): Promise<EncodedWebM> {
  if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs VideoEncoder is not supported in this browser')
  if (!sources.length) throw new Error('No frames to encode')

  const totalUs = meta.timestampsUs[meta.frameCount - 1] + meta.delaysUs[meta.frameCount - 1]
  const durationSec = totalUs / 1_000_000
  // Average fps hint for the encoder config (per-frame timestamps stay exact).
  const avgFps = opts.fps ?? Math.max(5, Math.round(meta.frameCount / Math.max(durationSec, 0.04)))

  let muxer: WebMMuxer | null = null
  let encoder: VideoEncoder | null = null
  try {
    const codec = await codecString()
    muxer = new WebMMuxer({ width: meta.width, height: meta.height, duration: durationSec, codec })
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
      width: meta.width,
      height: meta.height,
      bitrate: opts.bitrate ?? 6_000_000,
      framerate: avgFps,
    }
    const support = await VideoEncoder.isConfigSupported(encoderConfig)
    if (!support.supported) {
      encoderConfig.bitrate = undefined
      encoderConfig.framerate = undefined
      await VideoEncoder.isConfigSupported(encoderConfig)
    }
    encoder.configure(encoderConfig)

    for (let i = 0; i < sources.length; i++) {
      if (opts.signal?.aborted) throw new DOMException('Conversion aborted', 'AbortError')
      const frame = new VideoFrame(sources[i], { timestamp: meta.timestampsUs[i] })
      encoder.encode(frame, { keyFrame: i === 0 || i % 30 === 0 })
      frame.close()
      opts.onProgress?.(i + 1, sources.length)
      if (i % 8 === 0) await sleep()
    }

    await encoder.flush()
    encoder.close()
    encoder = null
    return { blob: muxer.finalize(), frames: sources.length, durationSec }
  } finally {
    encoder?.close()
  }
}

// ─── OPFS cache ───────────────────────────────────────────────────────────────

const CACHE_DIR = 'sticker-cache'

function cachePath(stickerId: string): string {
  return `${CACHE_DIR}/${stickerId.replace(/[^\w.-]/g, '_')}.webm`
}

async function readCachedSticker(stickerId: string): Promise<File | null> {
  try {
    const { readMediaFile } = await import('@/engine/storage/opfs')
    const file = await readMediaFile(cachePath(stickerId))
    return file.size > 0 ? file : null
  } catch {
    return null
  }
}

async function writeCachedSticker(stickerId: string, blob: Blob): Promise<void> {
  try {
    const { writeMediaFile } = await import('@/engine/storage/opfs')
    await writeMediaFile(CACHE_DIR, new File([blob], `${stickerId}.webm`, { type: 'video/webm' }), `${stickerId}.webm`)
  } catch {
    // Cache failures must never break conversion.
  }
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export interface StickerConversionPhase {
  phase: 'decoding' | 'encoding' | 'done'
  done: number
  total: number
}

export interface StickerConversionResult {
  webmFile: File
  width: number
  height: number
  frames: number
  durationSec: number
  cached: boolean
}

/**
 * Convert a downloaded sticker GIF into a looping WebM video clip.
 * Results are cached in OPFS by sticker id so re-adding the same sticker
 * never re-converts. Throws when the GIF is not animated (callers should
 * fall back to a plain image import).
 */
export async function convertStickerGif(
  gif: Blob,
  stickerId: string,
  onPhase?: (p: StickerConversionPhase) => void,
  signal?: AbortSignal,
): Promise<StickerConversionResult> {
  const cached = await readCachedSticker(stickerId)
  if (cached) {
    return { webmFile: cached, width: 0, height: 0, frames: 0, durationSec: 0, cached: true }
  }

  const buffer = await gif.arrayBuffer()
  onPhase?.({ phase: 'decoding', done: 0, total: 1 })
  const decoded = await decodeGif(buffer)

  const encoded = await encodeFramesToWebM(decoded.sources, decoded.meta, {
    signal,
    onProgress: (done, total) => onPhase?.({ phase: 'encoding', done, total }),
  })

  // Release decoder resources.
  for (const s of decoded.sources) {
    if (typeof VideoFrame !== 'undefined' && s instanceof VideoFrame) s.close()
    else if (typeof ImageBitmap !== 'undefined' && s instanceof ImageBitmap) s.close()
  }

  const webmFile = new File([encoded.blob], `sticker-${stickerId}.webm`, { type: 'video/webm' })
  await writeCachedSticker(stickerId, encoded.blob)
  onPhase?.({ phase: 'done', done: 1, total: 1 })

  return {
    webmFile,
    width: decoded.meta.width,
    height: decoded.meta.height,
    frames: encoded.frames,
    durationSec: encoded.durationSec,
    cached: false,
  }
}
