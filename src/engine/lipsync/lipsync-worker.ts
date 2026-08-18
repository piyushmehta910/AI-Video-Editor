// @ts-nocheck
import type { LipSyncInput, LipSyncResult, Wav2LipConfig } from './wav2lip-engine'
import { Wav2LipEngine } from './wav2lip-engine'

interface WorkerMessage {
  type: 'init' | 'process' | 'progress' | 'result' | 'error'
  payload?: unknown
  config?: Wav2LipConfig
  input?: LipSyncInput
  progress?: number
  result?: LipSyncResult
  error?: string
}

let engine: Wav2LipEngine | null = null

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload, config, input } = event.data

  try {
    switch (type) {
      case 'init': {
        engine = new Wav2LipEngine(config)
        await engine.initialize()
        self.postMessage({ type: 'init', payload: { success: true } })
        break
      }
      case 'process': {
        if (!engine) {
          self.postMessage({ type: 'error', error: 'Engine not initialized' })
          break
        }
        const result = await engine.process(input!, (progress) => {
          self.postMessage({ type: 'progress', progress })
        })
        self.postMessage({ type: 'result', result })
        break
      }
      default:
        self.postMessage({ type: 'error', error: `Unknown message type: ${type}` })
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

export {}