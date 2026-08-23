import { WebMMuxer } from '@/engine/export/webm-muxer'

export interface AvatarMouth {
  /** Anchor X as a fraction of the frame width (0-1). */
  x: number
  /** Anchor Y as a fraction of the frame height (0-1). */
  y: number
  /** Mouth width as a fraction of the frame width. */
  width: number
  /** Maximum mouth opening as a fraction of the frame height. */
  maxOpen: number
}

export type LipsyncStyle = 'realistic' | 'cartoon' | 'robotic' | 'circle'

export interface LipsyncOptions {
  imageFile: Blob
  audioFile: Blob
  width: number
  height: number
  fps: number
  bitrate: number
  mouth: AvatarMouth
  style?: LipsyncStyle
  background: 'transparent' | 'solid' | 'blurred'
  codec?: 'vp8' | 'vp9'
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface LipsyncResult {
  blob: Blob
  duration: number
  frames: number
}

let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext()
  return sharedContext
}

export async function decodeAudio(file: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  return await getAudioContext().decodeAudioData(arrayBuffer)
}

/**
 * Compute a per-frame mouth openness envelope from an audio buffer. Each frame
 * holds the normalized RMS of its samples, smoothed with a fast attack and a
 * slower release so the mouth opens quickly on syllables and closes naturally.
 */
export function computeMouthEnvelope(buffer: AudioBuffer, fps: number): Float32Array {
  const frameCount = Math.max(1, Math.ceil(buffer.duration * fps))
  const rms = new Float32Array(frameCount)
  const frameSamples = buffer.sampleRate / fps
  const channels = buffer.numberOfChannels

  let peak = 1e-6
  for (let i = 0; i < frameCount; i++) {
    const start = Math.floor(i * frameSamples)
    const end = Math.min(buffer.length, start + Math.ceil(frameSamples))
    let sum = 0
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c)
      for (let s = start; s < end; s++) {
        const v = data[s]
        sum += v * v
      }
    }
    const count = Math.max(1, (end - start) * channels)
    const value = Math.sqrt(sum / count)
    rms[i] = value
    if (value > peak) peak = value
  }

  // Normalize so the loudest frame reaches 1.0.
  for (let i = 0; i < frameCount; i++) rms[i] /= peak

  // Attack ~45ms, release ~140ms.
  const attack = 1 - Math.exp(-1 / (0.045 * fps))
  const release = 1 - Math.exp(-1 / (0.14 * fps))
  const out = new Float32Array(frameCount)
  let prev = 0
  for (let i = 0; i < frameCount; i++) {
    const target = rms[i]
    const rate = target > prev ? attack : release
    prev = prev + (target - prev) * rate
    out[i] = Math.min(1, Math.max(0, prev))
  }
  return out
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2)
  ctx.fill()
}

function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const iw = img.naturalWidth || img.width || 1
  const ih = img.naturalHeight || img.height || 1
  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, mode: LipsyncOptions['background'], img: HTMLImageElement) {
  if (mode === 'transparent') {
    ctx.clearRect(0, 0, w, h)
    return
  }
  if (mode === 'solid') {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#3a2f4a')
    grad.addColorStop(1, '#171321')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    return
  }
  // blurred backdrop
  ctx.save()
  ctx.filter = 'blur(48px)'
  coverDraw(ctx, img, w, h)
  ctx.restore()
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  mouth: AvatarMouth,
  openness: number,
  w: number,
  h: number,
  style: LipsyncStyle = 'realistic',
) {
  const x = mouth.x * w
  const y = mouth.y * h
  const mw = Math.max(4, mouth.width * w)
  const maxOpenPx = Math.max(1, mouth.maxOpen * h)
  const openPx = openness * maxOpenPx
  const lip = Math.max(2, mw * 0.16)

  if (style === 'robotic') {
    // Cyberpunk frequency visualizer mouth
    const barCount = 7
    const barWidth = mw / (barCount * 1.5)
    const startX = x - mw / 2 + barWidth / 2
    for (let b = 0; b < barCount; b++) {
      const distFromCenter = Math.abs(b - (barCount - 1) / 2) / ((barCount - 1) / 2)
      const barH = Math.max(2, (1 - distFromCenter * 0.4) * openPx * 1.8)
      const bx = startX + b * (barWidth * 1.5)
      ctx.fillStyle = '#10b981'
      ctx.fillRect(bx, y - barH / 2, barWidth, barH)
      ctx.fillStyle = '#ecfdf5'
      ctx.fillRect(bx, y - Math.min(2, barH / 2), barWidth, Math.min(2, barH))
    }
    return
  }

  if (style === 'circle') {
    // Podcast minimal dynamic circle
    const radius = Math.max(3, mw * 0.2 + openness * mw * 0.25)
    ctx.fillStyle = 'rgba(124, 58, 237, 0.25)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#8b5cf6'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  if (style === 'cartoon') {
    // Anime / 2D Cartoon dynamic mouth
    if (openPx > 1.2) {
      ctx.fillStyle = '#881337'
      ctx.beginPath()
      ctx.ellipse(x, y + openPx * 0.1, mw * 0.48, openPx * 0.75, 0, 0, Math.PI * 2)
      ctx.fill()
      // Teeth bar
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(x, y - openPx * 0.35, mw * 0.38, Math.min(openPx * 0.3, 5), 0, 0, Math.PI * 2)
      ctx.fill()
      // Tongue
      ctx.fillStyle = '#fb7185'
      ctx.beginPath()
      ctx.ellipse(x, y + openPx * 0.45, mw * 0.32, Math.min(openPx * 0.35, 6), 0, 0, Math.PI * 2)
      ctx.fill()
      // Outline
      ctx.strokeStyle = '#1e1b4b'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.ellipse(x, y + openPx * 0.1, mw * 0.48, openPx * 0.75, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeStyle = '#1e1b4b'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(x - mw * 0.35, y)
      ctx.quadraticCurveTo(x, y + 2, x + mw * 0.35, y)
      ctx.stroke()
    }
    return
  }

  // Realistic default mouth
  if (openPx > 0.8) {
    ctx.fillStyle = '#4a161b'
    ellipse(ctx, x, y, mw * 0.55, Math.min(openPx * 0.85, maxOpenPx * 0.9))
    if (openPx > 3) {
      ctx.fillStyle = '#f5f5f4'
      ellipse(ctx, x, y - openPx * 0.35, mw * 0.35, Math.min(2.5, openPx * 0.2))
    }
  }

  // Upper and lower lips
  ctx.fillStyle = '#b56a6e'
  ellipse(ctx, x, y - openPx * 0.22, mw * 0.5, Math.max(lip * 0.45, lip - openPx * 0.4))
  ellipse(ctx, x, y + openPx * 0.3, mw * 0.5, Math.max(lip * 0.4, lip * 0.7 + openPx * 0.5))

  if (openPx < lip) {
    ctx.strokeStyle = 'rgba(60,20,25,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x - mw * 0.42, y)
    ctx.quadraticCurveTo(x, y + 2, x + mw * 0.42, y)
    ctx.stroke()
  }
}

function encodedChunkBytes(chunk: EncodedAudioChunk): Uint8Array {
  const bytes = new Uint8Array(chunk.byteLength)
  chunk.copyTo(bytes)
  return bytes
}

async function encodeAudioToMuxer(muxer: WebMMuxer, buffer: AudioBuffer, signal?: AbortSignal): Promise<void> {
  if (typeof AudioEncoder === 'undefined') return
  const channels: Float32Array[] = []
  for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) {
    channels.push(buffer.getChannelData(c))
  }
  if (!channels.length) return
  muxer.setAudio({ sampleRate: buffer.sampleRate, channels: channels.length })

  const config: AudioEncoderConfig = {
    codec: 'opus',
    sampleRate: buffer.sampleRate,
    numberOfChannels: channels.length,
    bitrate: 128_000,
  }
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
  for (let offset = 0; offset < buffer.length; offset += CHUNK_FRAMES) {
    if (signal?.aborted) throw new DOMException('Lip-sync aborted', 'AbortError')
    const frames = Math.min(CHUNK_FRAMES, buffer.length - offset)
    const plane = new Float32Array(frames * channels.length)
    for (let c = 0; c < channels.length; c++) {
      plane.set(channels[c].subarray(offset, offset + frames), c * frames)
    }
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: buffer.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels.length,
      timestamp: Math.round((offset / buffer.sampleRate) * 1_000_000),
      data: plane,
    })
    encoder.encode(data)
    data.close()
  }
  await encoder.flush()
  encoder.close()
}

/**
 * Generate a talking-head WebM video entirely in the browser: the speech audio
 * drives a mouth that animates over the avatar image. No network calls, no API.
 */
export async function generateLipsyncVideo(opts: LipsyncOptions): Promise<LipsyncResult> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not supported in this browser')
  }

  const imageUrl = URL.createObjectURL(opts.imageFile)
  const img = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not load the avatar image'))
      img.src = imageUrl
    })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }

  const audio = await decodeAudio(opts.audioFile)
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
    throw new Error('The selected audio could not be decoded')
  }
  const envelope = computeMouthEnvelope(audio, opts.fps)

  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const codec = opts.codec ?? 'vp8'
  const muxer = new WebMMuxer({ width: opts.width, height: opts.height, duration: audio.duration, codec })
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const bytes = new Uint8Array(chunk.byteLength)
      chunk.copyTo(bytes)
      muxer.addChunk({ data: bytes, timestamp: chunk.timestamp / 1000, isKey: chunk.type === 'key' })
    },
    error: (e) => {
      throw e
    },
  })

  const config: VideoEncoderConfig = {
    codec: codec === 'vp8' ? 'vp8' : 'vp09.00.10.08',
    width: opts.width,
    height: opts.height,
    bitrate: opts.bitrate,
    framerate: opts.fps,
  }
  const support = await VideoEncoder.isConfigSupported(config)
  if (!support.supported) {
    config.bitrate = undefined
    config.framerate = undefined
    const retry = await VideoEncoder.isConfigSupported(config)
    if (!retry.supported) throw new Error(`${codec.toUpperCase()} encoding is not supported in this browser`)
  }
  encoder.configure(config)

  const total = Math.max(1, Math.ceil(audio.duration * opts.fps))
  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) throw new DOMException('Lip-sync aborted', 'AbortError')
    const time = Math.min(i / opts.fps, Math.max(0, audio.duration - 1 / opts.fps))
    const openness = envelope[Math.min(i, envelope.length - 1)] ?? 0

    drawBackground(ctx, opts.width, opts.height, opts.background, img)
    coverDraw(ctx, img, opts.width, opts.height)
    drawMouth(ctx, opts.mouth, openness, opts.width, opts.height, opts.style)

    const frame = new VideoFrame(canvas, { timestamp: Math.round(time * 1_000_000) })
    encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(opts.fps * 2)) === 0 })
    frame.close()

    opts.onProgress?.(i + 1, total)
    if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0))
  }

  await encoder.flush()
  encoder.close()
  await encodeAudioToMuxer(muxer, audio, opts.signal)

  img.src = ''
  return { blob: muxer.finalize(), duration: audio.duration, frames: total }
}
