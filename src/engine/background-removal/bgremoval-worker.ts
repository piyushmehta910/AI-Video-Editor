import type { BackgroundRemovalConfig, BackgroundRemovalInput, BackgroundRemovalResult } from './bgremoval-engine'
import { BackgroundRemovalEngine } from './bgremoval-engine'

interface WorkerMessage {
  type: 'init' | 'process' | 'progress' | 'result' | 'error'
  config?: BackgroundRemovalConfig
  input?: BackgroundRemovalInput
  progress?: number
  result?: BackgroundRemovalResult
  error?: string
}

let engine: BackgroundRemovalEngine | null = null

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, config, input } = event.data

  try {
    switch (type) {
      case 'init': {
        engine = new BackgroundRemovalEngine(config)
        await engine.initialize()
        self.postMessage({ type: 'init', payload: { success: true } })
        break
      }
      case 'process': {
        if (!engine) {
          self.postMessage({ type: 'error', error: 'Engine not initialized' })
          break
        }
        if (!input) {
          self.postMessage({ type: 'error', error: 'No input provided' })
          break
        }
        const result = await engine.process(
          input.videoFrames,
          input.backgroundType,
          input.backgroundValue,
          input.backgroundBlur,
          (progress) => {
            self.postMessage({ type: 'progress', progress })
          }
        )
        self.postMessage({ type: 'result', result: { frames: result, fps: input.fps ?? 30, duration: input.duration ?? frames.length / (input.fps ?? 30) } })
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
