import { useCallback, useRef, useState } from 'react'
import type { DenoiseResult, RNNoiseConfig } from '@/engine/denoise/rnnoise-engine'

interface UseDenoiseOptions {
  config?: RNNoiseConfig
  onProgress?: (progress: number) => void
  onComplete?: (result: DenoiseResult) => void
  onError?: (error: string) => void
}

export function useDenoise(options: UseDenoiseOptions = {}) {
  const workerRef = useRef<Worker | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<DenoiseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(
      new URL('@/engine/denoise/denoise-worker.ts?worker', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event) => {
      const { type, result: res, error: err } = event.data
      switch (type) {
        case 'result':
          setProcessing(false)
          setProgress(1)
          setResult(res as DenoiseResult)
          options.onComplete?.(res as DenoiseResult)
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

  const initialize = useCallback(async (config?: RNNoiseConfig) => {
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

  const denoise = useCallback(async (audioBuffer: Float32Array, sampleRate: number): Promise<DenoiseResult> => {
    if (!workerRef.current) await initialize()
    setProcessing(true)
    setProgress(0)
    setError(null)
    setResult(null)

    return new Promise<DenoiseResult>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'result') {
          workerRef.current!.removeEventListener('message', handler)
          resolve(event.data.result as DenoiseResult)
        } else if (event.data.type === 'error') {
          workerRef.current!.removeEventListener('message', handler)
          reject(new Error(event.data.error))
        }
      }
      workerRef.current!.addEventListener('message', handler)
      workerRef.current!.postMessage({ type: 'denoise', audioBuffer, sampleRate })
    })
  }, [initialize])

  const denoiseFromFile = useCallback(async (file: File): Promise<DenoiseResult> => {
    const arrayBuffer = await file.arrayBuffer()
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 })
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)
    return denoise(channelData, audioBuffer.sampleRate)
  }, [denoise])

  const denoiseFromVideo = useCallback(async (videoFile: File): Promise<DenoiseResult> => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(videoFile)

    return new Promise<DenoiseResult>((resolve, reject) => {
      video.onloadedmetadata = async () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 })
          const stream = (video as any).captureStream()
          const audioDest = audioContext.createMediaStreamDestination()
          stream.getAudioTracks().forEach((track: MediaStreamTrack) => audioDest.stream.addTrack(track))

          const recorder = new MediaRecorder(audioDest.stream)
          const chunks: BlobPart[] = []

          recorder.ondataavailable = (e) => chunks.push(e.data)
          recorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: 'audio/wav' })
            const arrayBuffer = await audioBlob.arrayBuffer()
            const audioBufferDecoded = await audioContext.decodeAudioData(arrayBuffer)
            const channelData = audioBufferDecoded.getChannelData(0)
            URL.revokeObjectURL(video.src)
            const result = await denoise(channelData, audioBufferDecoded.sampleRate)
            resolve(result)
          }
          recorder.onerror = reject

          recorder.start()
          await video.play()
          video.onended = () => recorder.stop()
        } catch (err) {
          URL.revokeObjectURL(video.src)
          reject(err)
        }
      }
      video.onerror = () => reject(new Error('Failed to load video'))
    })
  }, [denoise])

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
    denoise,
    denoiseFromFile,
    denoiseFromVideo,
    terminate,
  }
}

export function applyDenoiseToAudioBuffer(audioBuffer: Float32Array, denoisedBuffer: Float32Array, mix = 1.0): Float32Array {
  const length = Math.min(audioBuffer.length, denoisedBuffer.length)
  const output = new Float32Array(audioBuffer.length)
  for (let i = 0; i < length; i++) {
    output[i] = audioBuffer[i] * (1 - mix) + denoisedBuffer[i] * mix
  }
  for (let i = length; i < audioBuffer.length; i++) {
    output[i] = audioBuffer[i]
  }
  return output
}