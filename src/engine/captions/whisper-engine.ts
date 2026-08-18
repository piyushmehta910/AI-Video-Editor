// @ts-nocheck
import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

export interface WhisperConfig {
  modelId: 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small' | 'Xenova/whisper-medium' | 'Xenova/whisper-large-v3'
  language?: string
  task: 'transcribe' | 'translate'
  chunkLengthSeconds: number
  strideLengthSeconds: number
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  tokens?: number[]
  avgLogprob?: number
  noSpeechProb?: number
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  language: string
  duration: number
}

const DEFAULT_CONFIG: WhisperConfig = {
  modelId: 'Xenova/whisper-base',
  language: 'en',
  task: 'transcribe',
  chunkLengthSeconds: 30,
  strideLengthSeconds: 5,
}

export class WhisperEngine {
  private pipe: ReturnType<typeof pipeline> | null = null
  private config: WhisperConfig
  private initialized = false

  constructor(config: Partial<WhisperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.pipe = await pipeline(
        'automatic-speech-recognition',
        this.config.modelId,
        { quantized: true }
      )
      this.initialized = true
      console.log(`Whisper model ${this.config.modelId} loaded`)
    } catch (err) {
      console.error('Failed to initialize Whisper:', err)
      throw new Error(`Whisper initialization failed: ${err}`)
    }
  }

  async transcribe(audioBuffer: Float32Array, sampleRate: number): Promise<TranscriptionResult> {
    if (!this.initialized) await this.initialize()

    const audioData = this.resampleAudio(audioBuffer, sampleRate, 16000)

    const result = await this.pipe!(audioData, {
      chunk_length_s: this.config.chunkLengthSeconds,
      stride_length_s: this.config.strideLengthSeconds,
      return_timestamps: true,
      language: this.config.language,
      task: this.config.task,
    })

    return this.parseResult(result)
  }

  private resampleAudio(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return input

    const ratio = fromRate / toRate
    const outputLength = Math.round(input.length / ratio)
    const output = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio
      const idx = Math.floor(srcIndex)
      const frac = srcIndex - idx
      output[i] = input[idx] * (1 - frac) + (input[idx + 1] || 0) * frac
    }

    return output
  }

  private parseResult(result: unknown): TranscriptionResult {
    const r = result as { text: string; chunks?: Array<{ timestamp: [number, number]; text: string }>; language?: string }
    const segments: TranscriptionSegment[] = (r.chunks || []).map((chunk) => ({
      start: chunk.timestamp[0],
      end: chunk.timestamp[1],
      text: chunk.text.trim(),
    }))

    return {
      text: r.text.trim(),
      segments,
      language: r.language || this.config.language || 'en',
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    }
  }

  setLanguage(language: string): void {
    this.config.language = language
  }

  setModel(modelId: WhisperConfig['modelId']): void {
    if (this.config.modelId !== modelId) {
      this.config.modelId = modelId
      this.initialized = false
      this.pipe = null
    }
  }
}

export async function createWhisperEngine(config?: Partial<WhisperConfig>): Promise<WhisperEngine> {
  const engine = new WhisperEngine(config)
  await engine.initialize()
  return engine
}