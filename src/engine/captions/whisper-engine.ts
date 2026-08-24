import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@xenova/transformers'
import { groupWordsIntoSentences } from './transcript'

env.allowLocalModels = false
env.useBrowserCache = true

export interface WhisperConfig {
  modelId: 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small' | 'Xenova/whisper-medium' | 'Xenova/whisper-large-v3'
  language?: string
  task: 'transcribe' | 'translate'
  chunkLengthSeconds: number
  strideLengthSeconds: number
  timestamps?: 'word' | 'segment'
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  tokens?: number[]
  avgLogprob?: number
  noSpeechProb?: number
}

export interface TranscriptionWord {
  word: string
  start: number
  end: number
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  words?: TranscriptionWord[]
  sentences: Array<{ start: number; end: number; text: string }>
  language: string
  duration: number
}

const DEFAULT_CONFIG: WhisperConfig = {
  modelId: 'Xenova/whisper-base',
  language: 'en',
  task: 'transcribe',
  chunkLengthSeconds: 30,
  strideLengthSeconds: 5,
  timestamps: 'word',
}

export interface TranscribeOptions {
  /** Progress 0..1 covering model load and per-chunk generation. */
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

interface PipelineProgress {
  progress?: number
  status?: string
  file?: string
}

export class WhisperEngine {
  private pipe: AutomaticSpeechRecognitionPipeline | null = null
  private config: WhisperConfig
  private initialized = false

  constructor(config: Partial<WhisperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async initialize(onProgress?: (p: number) => void): Promise<void> {
    if (this.initialized) return

    try {
      this.pipe = await pipeline(
        'automatic-speech-recognition',
        this.config.modelId,
        {
          quantized: true,
          progress_callback: (p: PipelineProgress) => {
            // Model download/load maps to 0.05..0.12 of the total job.
            const prog = typeof p?.progress === 'number' ? p.progress : 0
            onProgress?.(0.05 + prog * 0.07)
          },
        },
      )
      this.initialized = true
    } catch (err) {
      console.error('Failed to initialize Whisper:', err)
      throw new Error(`Whisper initialization failed: ${err}`)
    }
  }

  async transcribe(audioBuffer: Float32Array, sampleRate: number, options: TranscribeOptions = {}): Promise<TranscriptionResult> {
    const { onProgress, signal } = options
    if (!this.initialized) await this.initialize(onProgress)

    const audioData = this.resampleAudio(audioBuffer, sampleRate, 16000)

    const jumpSeconds = Math.max(0.1, this.config.chunkLengthSeconds - 2 * this.config.strideLengthSeconds)
    const durationSeconds = audioData.length / 16000
    const totalChunks = Math.max(1, Math.ceil(durationSeconds / jumpSeconds))
    let doneChunks = 0

    const baseArgs = {
      chunk_length_s: this.config.chunkLengthSeconds,
      stride_length_s: this.config.strideLengthSeconds,
      language: this.config.language,
      task: this.config.task,
    }

    const chunkCallback = (chunk: { is_last?: boolean }) => {
      if (signal?.aborted) throw new DOMException('Transcription aborted', 'AbortError')
      doneChunks++
      if (chunk.is_last) {
        onProgress?.(1)
      } else {
        // Chunk generation maps to 0.12..1 of the total job.
        onProgress?.(0.12 + (doneChunks / totalChunks) * 0.88)
      }
    }

    const callArgs = {
      ...baseArgs,
      return_timestamps: this.config.timestamps !== 'segment' ? ('word' as const) : true,
      chunk_callback: chunkCallback,
    }

    let result: unknown
    try {
      result = await this.pipe!(audioData, callArgs)
    } catch (err) {
      if (signal?.aborted) throw err
      // Word-level timestamps unsupported for this model â€” fall back to segment-level.
      result = await this.pipe!(audioData, { ...baseArgs, return_timestamps: true, chunk_callback: chunkCallback })
    }
    onProgress?.(1)

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
    const chunks = (r.chunks || []).map((chunk) => ({
      start: chunk.timestamp[0],
      end: chunk.timestamp[1],
      text: chunk.text.trim(),
    }))
    const wordLevel = chunks.length > 0 && chunks.every((c) => c.text && !c.text.includes(' '))
    const duration = chunks.length > 0 ? chunks[chunks.length - 1].end : 0

    let segments: TranscriptionSegment[]
    let words: TranscriptionWord[] | undefined

    if (wordLevel) {
      words = chunks.map((c) => ({ word: c.text, start: c.start, end: c.end }))
      segments = groupWordsIntoSentences(words).map((s) => ({ start: s.start, end: s.end, text: s.text }))
    } else {
      segments = chunks
    }

    const sentences = segments.map((s) => ({ start: s.start, end: s.end, text: s.text }))

    return {
      text: r.text.trim(),
      segments,
      words,
      sentences,
      language: r.language || this.config.language || 'en',
      duration,
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
