import { useCallback, useRef, useState } from 'react'
import type { LipSyncInput, LipSyncResult, Wav2LipConfig } from '@/engine/lipsync/wav2lip-engine'

interface UseLipSyncOptions {
  config?: Wav2LipConfig
  onProgress?: (progress: number) => void
  onComplete?: (result: LipSyncResult) => void
  onError?: (error: string) => void
}

export function useLipSync(options: UseLipSyncOptions = {}) {
  const workerRef = useRef<Worker | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<LipSyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(
      new URL('@/engine/lipsync/lipsync-worker.ts?worker', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event) => {
      const { type, progress: prog, result: res, error: err } = event.data
      switch (type) {
        case 'progress':
          setProgress(prog as number)
          options.onProgress?.(prog as number)
          break
        case 'result':
          setProcessing(false)
          setProgress(1)
          setResult(res as LipSyncResult)
          options.onComplete?.(res as LipSyncResult)
          break
        case 'error':
          setProcessing(false)
          setError(err as string)
          options.onError?.(err as string)
          break
      }
    }

    worker.onerror = (err) => {
      setProcessing(false)
      setError(err.message)
      options.onError?.(err.message)
    }

    workerRef.current = worker
    return worker
  }, [options])

  const initialize = useCallback(async (config?: Wav2LipConfig) => {
    const worker = initWorker()
    return new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'init') {
          worker.removeEventListener('message', handler)
          if (event.data.payload?.success) resolve()
          else reject(new Error('Worker init failed'))
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'init', config: config || options.config })
    })
  }, [initWorker, options.config])

  const process = useCallback(async (input: LipSyncInput) => {
    if (!workerRef.current) await initialize()
    setProcessing(true)
    setProgress(0)
    setError(null)
    setResult(null)
    workerRef.current!.postMessage({ type: 'process', input })
  }, [initialize])

  const terminate = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setProcessing(false)
    setProgress(0)
  }, [])

  return {
    processing,
    progress,
    result,
    error,
    initialize,
    process,
    terminate,
  }
}

export function createLipSyncInput(
  videoFile: File,
  audioFile: File
): Promise<LipSyncInput> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(videoFile)
    video.onloadedmetadata = async () => {
      try {
        const frames = await extractVideoFrames(video)
        const audioBuffer = await decodeAudio(audioFile)
        resolve({ videoFrames: frames, audioBuffer, sampleRate: 16000 })
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(video.src)
      }
    }
    video.onerror = () => reject(new Error('Failed to load video'))
  })
}

export function createLipSyncInputFromImage(
  imageFile: File,
  audioFile: File
): Promise<LipSyncInput> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = URL.createObjectURL(imageFile)
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)

        const audioBuffer = await decodeAudio(audioFile)
        resolve({ image: imageData, audioBuffer, sampleRate: 16000 })
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(img.src)
      }
    }
    img.onerror = () => reject(new Error('Failed to load image'))
  })
}

async function extractVideoFrames(video: HTMLVideoElement): Promise<ImageData[]> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')!

  const frames: ImageData[] = []
  const duration = video.duration
  const frameCount = Math.floor(duration * 25)
  const step = duration / frameCount

  for (let i = 0; i < frameCount; i++) {
    video.currentTime = i * step
    await new Promise(resolve => {
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0)
        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
        video.onseeked = null
        resolve(undefined)
      }
    })
  }
  return frames
}

async function decodeAudio(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
  // Close the context when done — leaked contexts exhaust the browser cap.
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)
    const resampled = new Float32Array(Math.floor(channelData.length * 16000 / audioBuffer.sampleRate))
    for (let i = 0; i < resampled.length; i++) {
      const srcIndex = i * audioBuffer.sampleRate / 16000
      const idx = Math.floor(srcIndex)
      const frac = srcIndex - idx
      resampled[i] = channelData[idx] * (1 - frac) + (channelData[idx + 1] || 0) * frac
    }
    return resampled
  } finally {
    void audioContext.close()
  }
}

export function renderFramesToVideo(frames: ImageData[], fps: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (frames.length === 0) return reject(new Error('No frames to render'))

    const canvas = document.createElement('canvas')
    canvas.width = frames[0].width
    canvas.height = frames[0].height
    const ctx = canvas.getContext('2d')!

    const stream = canvas.captureStream(fps)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
    const chunks: BlobPart[] = []

    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
    recorder.onerror = reject

    recorder.start()

    let frameIndex = 0
    const drawFrame = () => {
      if (frameIndex >= frames.length) {
        recorder.stop()
        return
      }
      ctx.putImageData(frames[frameIndex], 0, 0)
      frameIndex++
      requestAnimationFrame(drawFrame)
    }
    drawFrame()
  })
}