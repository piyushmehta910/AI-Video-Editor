import { Rnnoise, DenoiseState } from '@shiguredo/rnnoise-wasm'

export interface RNNoiseConfig {
  sampleRate: number
  frameSize: number
}

export interface DenoiseResult {
  denoisedAudio: Float32Array
  sampleRate: number
}

const DEFAULT_CONFIG: RNNoiseConfig = {
  sampleRate: 48000,
  frameSize: 480,
}

export class RNNoiseEngine {
  private denoiser: DenoiseState | null = null
  private rnnoise: Rnnoise | null = null
  private config: RNNoiseConfig
  private initialized = false

  constructor(config: Partial<RNNoiseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.rnnoise = await Rnnoise.load()
      this.denoiser = this.rnnoise.createDenoiseState()
      this.config.frameSize = this.rnnoise.frameSize
      this.initialized = true
      console.log('RNNoise engine initialized, frameSize:', this.config.frameSize)
    } catch (err) {
      console.error('Failed to initialize RNNoise:', err)
      throw new Error(`RNNoise initialization failed: ${err}`)
    }
  }

  async denoise(audioBuffer: Float32Array, sampleRate: number): Promise<DenoiseResult> {
    if (!this.initialized) await this.initialize()
    if (!this.denoiser) throw new Error('Denoiser not initialized')

    const resampled = this.resampleAudio(audioBuffer, sampleRate, this.config.sampleRate)
    const output = new Float32Array(resampled.length)

    for (let i = 0; i < resampled.length; i += this.config.frameSize) {
      let frame = resampled.slice(i, i + this.config.frameSize)
      if (frame.length < this.config.frameSize) {
        // Pad last frame if needed
        const padded = new Float32Array(this.config.frameSize)
        padded.set(frame)
        frame = padded
      }
      this.denoiser!.processFrame(frame)
      output.set(frame, i)
    }

    return {
      denoisedAudio: output,
      sampleRate: this.config.sampleRate,
    }
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

  getConfig(): RNNoiseConfig {
    return { ...this.config }
  }

  destroy(): void {
    this.denoiser?.destroy()
    this.denoiser = null
    this.rnnoise = null
    this.initialized = false
  }
}

export async function createRNNoiseEngine(config?: Partial<RNNoiseConfig>): Promise<RNNoiseEngine> {
  const engine = new RNNoiseEngine(config)
  await engine.initialize()
  return engine
}