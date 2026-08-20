import { useCallback, useRef, useState } from 'react'
import type { BackgroundRemovalInput, BackgroundRemovalResult, BackgroundRemovalConfig } from '@/engine/background-removal/bgremoval-engine'

interface UseBackgroundRemovalOptions {
  config?: BackgroundRemovalConfig
  onProgress?: (progress: number) => void
  onComplete?: (result: BackgroundRemovalResult) => void
  onError?: (error: string) => void
}

export function useBackgroundRemoval(options: UseBackgroundRemovalOptions = {}) {
  const workerRef = useRef<Worker | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<BackgroundRemovalResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current

    const worker = new Worker(
      new URL('@/engine/background-removal/bgremoval-worker.ts?worker', import.meta.url),
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
          setResult(res as BackgroundRemovalResult)
          options.onComplete?.(res as BackgroundRemovalResult)
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

  const initialize = useCallback(async (config?: BackgroundRemovalConfig) => {
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

  const process = useCallback(async (input: BackgroundRemovalInput) => {
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