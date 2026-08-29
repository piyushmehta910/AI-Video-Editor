import { readMediaFile } from '@/engine/storage/opfs'
import type { Asset, Project } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import { compositeFrame } from '@/engine/render/composite'
import { makeCaptionsProvider } from '@/engine/captions/render'
import { mixProjectAudio, type MixedAudio } from './audioMix'
import { loadMediaElement, seekTo } from './exportVideo'
import { wrapSourceTime } from '@/engine/media/sourceTime'
import type { ExportOptions, ExportResult } from './exportVideo'
import { createEncoderGuard, waitForDrain, yieldToBrowser } from './encoderGuard'
import { beginExportSession } from './exportSession'
import { deviceSafetyGuard } from '@/engine/safety/DeviceSafetyGuard'
import {
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
} from 'mediabunny'

export interface Mp4ExportOptions extends Omit<ExportOptions, 'codec'> {}

const AVC_CODECS = ['avc1.42001f', 'avc1.420028', 'avc1.4d0028', 'avc1.640028']

async function pickVideoConfig(opts: Mp4ExportOptions): Promise<VideoEncoderConfig> {
  const full: VideoEncoderConfig[] = AVC_CODECS.map((codec) => ({
    codec,
    width: opts.width,
    height: opts.height,
    bitrate: opts.bitrate,
    framerate: opts.fps,
  }))
  for (const cfg of full) {
    try {
      const support = await VideoEncoder.isConfigSupported(cfg)
      if (support.supported) return cfg
    } catch {
      /* try next */
    }
  }
  const bare: VideoEncoderConfig[] = AVC_CODECS.map((codec) => ({
    codec,
    width: opts.width,
    height: opts.height,
  }))
  for (const cfg of bare) {
    try {
      const support = await VideoEncoder.isConfigSupported(cfg)
      if (support.supported) return cfg
    } catch {
      /* try next */
    }
  }
  throw new Error('H.264 encoding is not supported in this browser (try WebM export)')
}

async function encodeAudioAac(
  encoder: AudioEncoder,
  mixed: MixedAudio,
  signal?: AbortSignal,
): Promise<void> {
  const channels: Float32Array[] = []
  for (let c = 0; c < Math.min(2, mixed.buffer.numberOfChannels); c++) {
    channels.push(mixed.buffer.getChannelData(c))
  }
  if (channels.length === 0) return

  try {
    const CHUNK_FRAMES = 1024
    for (let offset = 0; offset < mixed.buffer.length; offset += CHUNK_FRAMES) {
      if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
      await waitForDrain(encoder, 16)
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
      if (offset > 0 && offset % (CHUNK_FRAMES * 8) === 0) {
        await yieldToBrowser(false)
      }
    }
    await encoder.flush()
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }
}

/**
 * Export the project as an MP4 (H.264 + AAC) using WebCodecs and mediabunny.
 */
export async function exportMp4(
  project: Project,
  assets: Asset[],
  opts: Mp4ExportOptions,
): Promise<ExportResult> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not supported in this browser')
  }

  const releaseExport = beginExportSession()

  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    releaseExport()
    throw new Error('Canvas 2D context unavailable')
  }

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  })
  const videoSource = new EncodedVideoPacketSource('avc')
  output.addVideoTrack(videoSource)

  const mixedAudio =
    opts.includeAudio === false
      ? null
      : await mixProjectAudio(project, assets, { masterVolume: opts.masterVolume ?? 1, muted: opts.muted ?? false }, opts.signal)

  // Only declare an audio track when we can actually encode AAC — a declared
  // track with zero packets produces a malformed MP4.
  let audioSource: EncodedAudioPacketSource | null = null
  if (mixedAudio && typeof AudioEncoder !== 'undefined') {
    const aacSupported = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: mixedAudio.sampleRate,
      numberOfChannels: Math.min(2, mixedAudio.buffer.numberOfChannels),
      bitrate: 128_000,
    })
      .then((s) => s.supported)
      .catch(() => false)
    if (aacSupported) {
      audioSource = new EncodedAudioPacketSource('aac')
      output.addAudioTrack(audioSource)
    }
  }
  await output.start()

  const encoderConfig = await pickVideoConfig(opts)
  const guard = createEncoderGuard()
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta)
    },
    error: (e) => guard.fail(e),
  })
  encoder.configure(encoderConfig)

  let audioEncoder: AudioEncoder | null = null
  if (mixedAudio && audioSource && typeof AudioEncoder !== 'undefined') {
    const channels = Math.min(2, mixedAudio.buffer.numberOfChannels)
    const aacConfig: AudioEncoderConfig = {
      codec: 'mp4a.40.2',
      sampleRate: mixedAudio.sampleRate,
      numberOfChannels: channels,
      bitrate: 128_000,
    }
    try {
      const support = await AudioEncoder.isConfigSupported(aacConfig)
      if (support.supported) {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            audioSource?.add(EncodedPacket.fromEncodedChunk(chunk), meta)
          },
          error: (e) => guard.fail(e),
        })
        audioEncoder.configure(aacConfig)
      }
    } catch {
      audioEncoder = null
    }
  }

  const mediaElements = new Map<string, HTMLVideoElement>()
  const imageCache = new Map<string, HTMLImageElement>()
  const blobUrls: string[] = []
  const total = Math.max(1, Math.round(projectDuration(project.tracks) * opts.fps))
  const duration = projectDuration(project.tracks)

  const loadImage = async (asset: Asset): Promise<HTMLImageElement> => {
    const cached = imageCache.get(asset.id)
    if (cached) return cached
    const file = await readMediaFile(asset.filePath)
    const url = URL.createObjectURL(file)
    blobUrls.push(url)
    const img = new Image()
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = url
    })
    imageCache.set(asset.id, img)
    return img
  }

  try {
    for (let i = 0; i < total; i++) {
      if (opts.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
      // Backpressure: let the hardware encoder catch up before compositing
      // more frames — an unbounded queue exhausts memory and pegs the CPU.
      await waitForDrain(encoder, deviceSafetyGuard.getMaxEncoderQueue())
      if (guard.failed) throw guard.error ?? new Error('Video encoder failed')
      const time = Math.min(i / opts.fps, duration - 1 / opts.fps)
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
              el = await loadMediaElement(asset, blobUrls)
              mediaElements.set(asset.id, el)
            }
            // Match the WebM pipeline: loop short sources (stickers/GIFs)
            // instead of freezing on the final frame.
            const elTime = wrapSourceTime(srcTime, asset.duration ?? el.duration)
            await seekTo(el, elTime)
            return el.videoWidth > 0 ? el : null
          },
          image: (asset) => loadImage(asset),
          captions: makeCaptionsProvider(project),
        },
        { width: opts.width, height: opts.height },
      )

      const frame = new VideoFrame(canvas, { timestamp: Math.round(time * 1_000_000) })
      encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(opts.fps * 2)) === 0 })
      frame.close()

      opts.onProgress(i + 1, total)

      // Evict dormant media elements to prevent memory leakage
      if (i > 0 && i % 30 === 0) {
        const activeAssetIds = new Set<string>()
        for (const track of project.tracks) {
          for (const c of track.clips) {
            if (time >= c.startTime - 1.0 && time <= c.startTime + c.duration + 1.0) {
              activeAssetIds.add(c.assetId)
            }
          }
        }
        deviceSafetyGuard.evictUnusedMediaElements(mediaElements, activeAssetIds)
      }

      // Device safety: adaptive CPU pacing & thermal throttling protection
      await deviceSafetyGuard.adaptiveYield(i)
    }

    await Promise.race([encoder.flush(), guard.failure])
    if (audioEncoder && mixedAudio) await encodeAudioAac(audioEncoder, mixedAudio, opts.signal)
  } finally {
    releaseExport()
    if (encoder.state !== 'closed') encoder.close()
    if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close()
    for (const el of mediaElements.values()) {
      try {
        el.pause()
        el.removeAttribute('src')
        el.load()
      } catch {
        /* element already torn down */
      }
    }
    mediaElements.clear()
    imageCache.clear()
    for (const url of blobUrls) URL.revokeObjectURL(url)
  }

  await output.finalize()
  const buffer = output.target.buffer as ArrayBuffer
  return { blob: new Blob([buffer], { type: 'video/mp4' }), frames: total }
}
