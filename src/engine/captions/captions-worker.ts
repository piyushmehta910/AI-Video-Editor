import type { WhisperConfig, TranscriptionResult } from './whisper-engine'
import { WhisperEngine } from './whisper-engine'

interface WorkerMessage {
  type: 'init' | 'transcribe' | 'cancel' | 'progress' | 'result' | 'error'
  config?: WhisperConfig
  audioBuffer?: Float32Array
  sampleRate?: number
  progress?: number
  result?: TranscriptionResult
  error?: string
}

let engine: WhisperEngine | null = null
let cancelRequested = false

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, config, audioBuffer, sampleRate } = event.data

  try {
    switch (type) {
      case 'init': {
        engine = new WhisperEngine(config)
        cancelRequested = false
        await engine.initialize((p) => {
          if (!cancelRequested) self.postMessage({ type: 'progress', progress: p })
        })
        self.postMessage({ type: 'init', payload: { success: true } })
        break
      }
      case 'transcribe': {
        if (!engine) {
          self.postMessage({ type: 'error', error: 'Engine not initialized' })
          break
        }
        if (!audioBuffer) {
          self.postMessage({ type: 'error', error: 'No audio buffer provided' })
          break
        }
        cancelRequested = false
        const result = await engine.transcribe(audioBuffer, sampleRate!, {
          signal: { get aborted() { return cancelRequested } } as AbortSignal,
          onProgress: (p) => self.postMessage({ type: 'progress', progress: p }),
        })
        if (cancelRequested) return
        self.postMessage({ type: 'result', result })
        break
      }
      case 'cancel':
        cancelRequested = true
        break
      default:
        self.postMessage({ type: 'error', error: `Unknown message type: ${type}` })
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    self.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

export {}