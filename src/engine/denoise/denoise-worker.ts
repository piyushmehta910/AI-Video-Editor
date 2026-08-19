// @ts-nocheck
import type { DenoiseResult, RNNoiseConfig } from './rnnoise-engine'
import { RNNoiseEngine } from './rnnoise-engine'

interface WorkerMessage {
  type: 'init' | 'denoise' | 'progress' | 'result' | 'error'
  config?: RNNoiseConfig
  audioBuffer?: Float32Array
  sampleRate?: number
  progress?: number
  result?: DenoiseResult
  error?: string
}

let engine: RNNoiseEngine | null = null

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, config, audioBuffer, sampleRate } = event.data

  try {
    switch (type) {
      case 'init': {
        engine = new RNNoiseEngine(config)
        await engine.initialize()
        self.postMessage({ type: 'init', payload: { success: true } })
        break
      }
      case 'denoise': {
        if (!engine) {
          self.postMessage({ type: 'error', error: 'Engine not initialized' })
          break
        }
        if (!audioBuffer) {
          self.postMessage({ type: 'error', error: 'No audio buffer provided' })
          break
        }
        const result = await engine.denoise(audioBuffer, sampleRate!, (progress) => {
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