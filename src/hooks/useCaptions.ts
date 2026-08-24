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
  const pendingRejectRef = useRef<((err: Error) => void) | null>(null)
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
      pendingRejectRef.current = reject
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'result') {
          pendingRejectRef.current = null
          workerRef.current!.removeEventListener('message', handler)
          resolve(event.data.result as TranscriptionResult)
        } else if (event.data.type === 'error') {
          pendingRejectRef.current = null
          workerRef.current!.removeEventListener('message', handler)
          reject(new Error(event.data.error))
        }
      }
      workerRef.current!.addEventListener('message', handler)
      workerRef.current!.postMessage({ type: 'transcribe', audioBuffer, sampleRate })
    })
  }, [initialize])

  const cancel = useCallback(() => {
    if (workerRef.current) workerRef.current.postMessage({ type: 'cancel' })
    pendingRejectRef.current?.(new DOMException('Transcription aborted', 'AbortError'))
    pendingRejectRef.current = null
    setProcessing(false)
    setProgress(0)
  }, [])

  const transcribeFromFile = useCallback(async (file: File) => {
    const arrayBuffer = await file.arrayBuffer()
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    // Close the context when done — leaked contexts exhaust the browser cap.
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const channelData = audioBuffer.getChannelData(0)
      return await transcribe(channelData, audioBuffer.sampleRate)
    } finally {
      void audioContext.close()
    }
  }, [transcribe])

  const transcribeFromVideo = useCallback(async (videoFile: File) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    try {
      const decoded = await audioContext.decodeAudioData(await videoFile.arrayBuffer())
      const channelData = decoded.getChannelData(0)
      return await transcribe(channelData, decoded.sampleRate)
    } finally {
      void audioContext.close()
    }
  }, [transcribe])

  const terminate = useCallback(() => {
    pendingRejectRef.current?.(new DOMException('Transcription aborted', 'AbortError'))
    pendingRejectRef.current = null
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
    cancel,
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