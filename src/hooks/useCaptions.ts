import { useCallback, useRef, useState } from 'react'
import type { TranscriptionResult, WhisperConfig } from '@/engine/captions/whisper-engine'

interface UseCaptionsOptions {
  config?: WhisperConfig
  onProgress?: (progress: number) => void
  onComplete?: (result: TranscriptionResult) => void
  onError?: (error: string) => void
}

export function useCaptions(options: UseCaptionsOptions = {}) {
  const workerRef = useRef<Worker | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(
      new URL('@/engine/captions/captions-worker.ts?worker', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event) => {
      const { type, result: res, error: err } = event.data
      switch (type) {
        case 'progress':
          setProgress(event.data.progress as number)
          options.onProgress?.(event.data.progress as number)
          break
        case 'result':
          setProcessing(false)
          setProgress(1)
          setResult(res as TranscriptionResult)
          options.onComplete?.(res as TranscriptionResult)
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

  const initialize = useCallback(async (config?: WhisperConfig) => {
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

  const transcribe = useCallback(async (audioBuffer: Float32Array, sampleRate: number): Promise<TranscriptionResult> => {
    if (!workerRef.current) await initialize()
    setProcessing(true)
    setProgress(0)
    setError(null)
    setResult(null)

    return new Promise<TranscriptionResult>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'result') {
          workerRef.current!.removeEventListener('message', handler)
          resolve(event.data.result as TranscriptionResult)
        } else if (event.data.type === 'error') {
          workerRef.current!.removeEventListener('message', handler)
          reject(new Error(event.data.error))
        }
      }
      workerRef.current!.addEventListener('message', handler)
      workerRef.current!.postMessage({ type: 'transcribe', audioBuffer, sampleRate })
    })
  }, [initialize])

  const transcribeFromFile = useCallback(async (file: File) => {
    const arrayBuffer = await file.arrayBuffer()
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)
    return transcribe(channelData, audioBuffer.sampleRate)
  }, [transcribe])

  const transcribeFromVideo = useCallback(async (videoFile: File) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(videoFile)

    return new Promise<TranscriptionResult>((resolve, reject) => {
      video.onloadedmetadata = async () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
          const audioDest = audioContext.createMediaStreamDestination()
          ;(video as any).captureStream().getAudioTracks().forEach((track: MediaStreamTrack) => audioDest.stream.addTrack(track))
          const source = audioContext.createMediaElementSource(video)
          source.connect(audioDest)
          source.connect(audioContext.destination)

          const recorder = new MediaRecorder(audioDest.stream)
          const chunks: BlobPart[] = []

          recorder.ondataavailable = (e) => chunks.push(e.data)
          recorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: 'audio/wav' })
            const arrayBuffer = await audioBlob.arrayBuffer()
            const audioBufferDecoded = await audioContext.decodeAudioData(arrayBuffer)
            const channelData = audioBufferDecoded.getChannelData(0)
            URL.revokeObjectURL(video.src)
            const result = await transcribe(channelData, audioBufferDecoded.sampleRate)
            resolve(result)
          }
          recorder.onerror = reject

          video.muted = true
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
  }, [transcribe])

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
    transcribe,
    transcribeFromFile,
    transcribeFromVideo,
    terminate,
  }
}

export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}

export function generateSRT(segments: TranscriptionResult['segments']): string {
  return segments
    .map((seg, i) => {
      return `${i + 1}\n${formatTimestamp(seg.start).replace(',', '.')} --> ${formatTimestamp(seg.end).replace(',', '.')}\n${seg.text}\n`
    })
    .join('\n')
}

export function generateVTT(segments: TranscriptionResult['segments']): string {
  const header = 'WEBVTT\n\n'
  const body = segments
    .map((seg) => {
      return `${formatTimestamp(seg.start).replace(',', '.')} --> ${formatTimestamp(seg.end).replace(',', '.')}\n${seg.text}\n`
    })
    .join('\n')
  return header + body
}

export function downloadSubtitle(content: string, filename: string, type: 'srt' | 'vtt' = 'srt'): void {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${type}`
  a.click()
  URL.revokeObjectURL(url)
}