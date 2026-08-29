export interface TTSSynthesizeOptions {
  text: string
  voiceId?: string
  model?: string
  stability?: number
  similarity?: number
  style?: number
  speed?: number
  outputFormat?: string
  language?: string
}

export interface TTSResult {
  blob: Blob
  duration?: number
}

/**
 * A text-to-speech provider. Each provider reads its own settings from the API
 * config store; `isConfigured()` reflects whether it can actually synthesize.
 */
export interface TtsProvider {
  readonly id: string
  readonly name: string
  isConfigured(): boolean
  synthesize(options: TTSSynthesizeOptions): Promise<TTSResult>
}