import { compositeFrame, type CompositeMedia } from '@/engine/render/composite'
import { makeCaptionsProvider } from '@/engine/captions/render'
import { loadMediaElement } from '@/engine/export/exportVideo'
import { mixProjectAudio } from '@/engine/export/audioMix'
import { readMediaFile } from '@/engine/storage/opfs'
import type { Asset, Project } from '@/engine/types'
import { projectDuration, defaultCameraRig } from '@/engine/types'
import {
  bitrateFor,
  frameCountFor,
  type ExportFormatId,
  type QualityId,
} from '@/lib/exportFormats'

/**
 * Immediate-export engine built on MediaRecorder + canvas.captureStream().
 *
 * The compositor runs on the main thread (video elements cannot move into a
 * worker), paced to wall-clock time so the recording has the correct duration.
 * PNG encoding and ZIP assembly for the Frames format are offloaded to
 * workers/exportWorker via OffscreenCanvas.
 */

export interface CanvasExportSettings {
  format: ExportFormatId
  width: number
  height: number
  fps: number
  quality: QualityId
  includeAudio: boolean
}

export interface ExportProgress {
  done: number
  total: number
  stage: 'render' | 'encode'
}

export interface CanvasExportResult {
  blob: Blob
  extension: string
}

/** Shared media pools + a draw(time) closure bound to one canvas. */
async function createRenderer(
  project: Project,
  assets: Asset[],
  canvas: HTMLCanvasElement,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  const videos = new Map<string, HTMLVideoElement>()
  const images = new Map<string, HTMLImageElement>()
  const thumbs = new Map<string, HTMLImageElement | 'failed'>()

  const media: CompositeMedia = {
    video: async (_clip, asset, srcTime) => {
      let el = videos.get(asset.id)
      if (!el) {
        el = await loadMediaElement(asset)
        videos.set(asset.id, el)
      }
      // Seek-mode: deterministic enough at realtime pacing, no free-run drift.
      if (el.readyState >= 1 && Math.abs(el.currentTime - srcTime) > 0.08) {
        el.currentTime = srcTime
      }
      return el.videoWidth > 0 ? el : null
    },
    image: async (asset) => {
      const cached = images.get(asset.id)
      if (cached) return cached
      const img = await loadImage(asset)
      images.set(asset.id, img)
      return img
    },
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
      })
    },
    thumbnail: async (asset) => {
      const cached = thumbs.get(asset.id)
      if (cached && cached !== 'failed') return cached
      if (cached === 'failed') return null
      const img = await loadThumbnail(asset)
      thumbs.set(asset.id, img ?? 'failed')
      return img
    },
    captions: makeCaptionsProvider(project),
  }

  const drawAt = (time: number) => compositeFrame(ctx, project, assets, time, media)

  const dispose = () => {
    for (const el of videos.values()) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    videos.clear()
  }

  return { drawAt, dispose }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function loadImage(asset: Asset): Promise<HTMLImageElement> {
  const file = await readMediaFile(asset.filePath)
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${asset.name}`))
    img.src = url
  })
}

async function loadThumbnail(asset: Asset): Promise<HTMLImageElement | null> {
  const url = asset.thumbnailUrl
  if (!url) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.width > 0 ? img : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Mix timeline audio once so it can be piped into the recorded stream. */
async function buildAudioTrack(
  project: Project,
  assets: Asset[],
  signal: AbortSignal,
): Promise<{ track: MediaStreamTrack; start: () => void; stop: () => void } | null> {
  if (!project.tracks.some((t) => t.type === 'audio' && t.clips.length > 0 && !t.hidden)) return null
  const mixed = await mixProjectAudio(project, assets, {}, signal)
  if (!mixed) return null

  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null
  const audioCtx = new AudioCtor()
  const dest = audioCtx.createMediaStreamDestination()
  const source = audioCtx.createBufferSource()
  source.buffer = mixed.buffer
  source.connect(dest)

  return {
    track: dest.stream.getAudioTracks()[0],
    start: () => {
      void audioCtx.resume()
      source.start()
    },
    stop: () => {
      try { source.stop() } catch { /* already stopped */ }
      void audioCtx.close()
    },
  }
}

/**
 * Record the project to WebM/MP4 using MediaRecorder. Rendering is paced to
 * real time — a 15s timeline takes ~15s — which keeps captured frames aligned
 * with their intended timestamps.
 */
export async function recordCanvasVideo(
  project: Project,
  assets: Asset[],
  settings: CanvasExportSettings & { mimeType: string },
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<CanvasExportResult> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not available in this browser. Use the Frame export option.')
  }

  const canvas = createCanvas(settings.width, settings.height)
  const renderer = await createRenderer(project, assets, canvas)
  const duration = projectDuration(project.tracks)
  if (duration <= 0) throw new Error('Timeline is empty — nothing to export.')

  const stream = canvas.captureStream(settings.fps)

  let audio: Awaited<ReturnType<typeof buildAudioTrack>> = null
  if (settings.includeAudio) {
    try {
      audio = await buildAudioTrack(project, assets, signal)
      if (audio?.track) stream.addTrack(audio.track)
    } catch {
      // Video-only fallback when audio mixing fails.
    }
  }

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType: settings.mimeType,
    videoBitsPerSecond: bitrateFor(settings.quality, settings.width, settings.height),
    audioBitsPerSecond: 128_000,
  })
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || settings.mimeType }))
    recorder.onerror = () => reject(new Error('Recording failed'))
  })

  const abort = () => {
    try { recorder.stop() } catch { /* not started */ }
  }
  signal.addEventListener('abort', abort, { once: true })

  const totalFrames = frameCountFor(duration, settings.fps)
  onProgress({ done: 0, total: totalFrames, stage: 'render' })

  try {
    // Prime first frame before recording starts.
    await renderer.drawAt(0)
    recorder.start(250)
    audio?.start()

    const startedAt = performance.now()
    await new Promise<void>((resolve, reject) => {
      const tick = async () => {
        if (signal.aborted) {
          resolve()
          return
        }
        const elapsed = (performance.now() - startedAt) / 1000
        const time = Math.min(elapsed, duration)
        await renderer.drawAt(time)
        onProgress({
          done: Math.min(totalFrames, Math.round(time * settings.fps)),
          total: totalFrames,
          stage: 'render',
        })
        if (elapsed >= duration) {
          resolve()
          return
        }
        requestAnimationFrame(() => void tick())
      }
      void tick().catch(reject)
    })

    // Hold the last frame briefly so trailing samples flush into the muxer.
    await new Promise((r) => setTimeout(r, 120))
    if (recorder.state !== 'inactive') recorder.stop()
    const blob = await finished
    audio?.stop()
    if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
    onProgress({ done: totalFrames, total: totalFrames, stage: 'render' })
    return { blob, extension: settings.mimeType.includes('mp4') ? 'mp4' : 'webm' }
  } finally {
    signal.removeEventListener('abort', abort)
    renderer.dispose()
    audio?.stop()
  }
}

/**
 * Render every frame deterministically (seek + draw per frame) and encode PNGs
 * in the export worker, then bundle them into a ZIP.
 */
export async function exportFramesZip(
  project: Project,
  assets: Asset[],
  settings: CanvasExportSettings,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<CanvasExportResult> {
  const duration = projectDuration(project.tracks)
  if (duration <= 0) throw new Error('Timeline is empty — nothing to export.')
  const total = frameCountFor(duration, settings.fps)

  const canvas = createCanvas(settings.width, settings.height)
  const renderer = await createRenderer(project, assets, canvas)
  const worker = new Worker(new URL('../workers/exportWorker.ts', import.meta.url), { type: 'module' })
  const jobId = crypto.randomUUID()

  try {
    const zipBlob = await new Promise<Blob>((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', onAbort)
        worker.terminate()
      }
      const onAbort = () => {
        cleanup()
        reject(new DOMException('Export cancelled', 'AbortError'))
      }
      signal.addEventListener('abort', onAbort, { once: true })

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data
        if (msg.id !== jobId) return
        if (msg.type === 'png-done') {
          onProgress({ done: msg.index + 1, total, stage: 'encode' })
        } else if (msg.type === 'zip') {
          cleanup()
          resolve(new Blob([msg.buffer], { type: 'application/zip' }))
        } else if (msg.type === 'error') {
          cleanup()
          reject(new Error(msg.message))
        }
      }
      worker.onerror = () => {
        cleanup()
        reject(new Error('Frame encoder crashed'))
      }

      ;(async () => {
        for (let i = 0; i < total; i++) {
          if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
          const time = i / settings.fps
          await renderer.drawAt(time)
          const bitmap = await createImageBitmap(canvas)
          worker.postMessage(
            { id: jobId, type: 'png', index: i, bitmap, width: settings.width, height: settings.height },
            [bitmap],
          )
          onProgress({ done: i, total, stage: 'render' })
        }
        worker.postMessage({ id: jobId, type: 'finish' })
      })().catch((err) => {
        cleanup()
        reject(err instanceof Error ? err : new Error(String(err)))
      })
    })
    return { blob: zipBlob, extension: 'zip' }
  } finally {
    renderer.dispose()
  }
}
