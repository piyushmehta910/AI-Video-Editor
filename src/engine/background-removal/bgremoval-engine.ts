// @ts-nocheck
import * as ort from 'onnxruntime-web'

export interface BackgroundRemovalConfig {
  modelUrl: string
  inputSize: [number, number]
  backgroundBlur?: number
  backgroundColor?: string
  backgroundImage?: string
}

export interface BackgroundRemovalInput {
  videoFrames: ImageData[]
  backgroundType: 'transparent' | 'blur' | 'color' | 'image'
  backgroundValue?: string
  backgroundBlur?: number
}

export interface BackgroundRemovalResult {
  frames: ImageData[]
  fps: number
  duration: number
}

const DEFAULT_CONFIG: BackgroundRemovalConfig = {
  modelUrl: '/models/modnet.onnx',
  inputSize: [512, 512],
}

export class BackgroundRemovalEngine {
  private session: ort.InferenceSession | null = null
  private config: BackgroundRemovalConfig
  private initialized = false

  constructor(config: Partial<BackgroundRemovalConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.session = await ort.InferenceSession.create(this.config.modelUrl, {
        executionProviders: ['wasm', 'webgl', 'webgpu'],
        graphOptimizationLevel: 'all',
      })

      this.initialized = true
      console.log('Background removal engine initialized')
    } catch (err) {
      console.error('Failed to initialize background removal engine:', err)
      throw new Error(`Background removal initialization failed: ${err}`)
    }
  }

  private preprocessFrame(frame: ImageData): ort.Tensor {
    const [h, w] = this.config.inputSize
    const data = new Float32Array(h * w * 3)
    const scaleX = frame.width / w
    const scaleY = frame.height / h

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcX = Math.min(Math.floor(x * scaleX), frame.width - 1)
        const srcY = Math.min(Math.floor(y * scaleY), frame.height - 1)
        const idx = (srcY * frame.width + srcX) * 4
        const dstIdx = (y * w + x) * 3
        // Normalize to [-1, 1] range as expected by MODNet
        data[dstIdx] = (frame.data[idx] / 127.5) - 1
        data[dstIdx + 1] = (frame.data[idx + 1] / 127.5) - 1
        data[dstIdx + 2] = (frame.data[idx + 2] / 127.5) - 1
      }
    }
    return new ort.Tensor('float32', data, [1, 3, h, w])
  }

  private postprocessMatte(matte: ort.Tensor, originalW: number, originalH: number): ImageData {
    const [, , h, w] = matte.dims
    const data = matte.data as Float32Array
    const canvas = document.createElement('canvas')
    canvas.width = originalW
    canvas.height = originalH
    const ctx = canvas.getContext('2d')!
    const output = ctx.createImageData(originalW, originalH)
    const outData = output.data

    const scaleX = originalW / w
    const scaleY = originalH / h

    for (let y = 0; y < originalH; y++) {
      for (let x = 0; x < originalW; x++) {
        const srcX = Math.min(Math.floor(x / scaleX), w - 1)
        const srcY = Math.min(Math.floor(y / scaleY), h - 1)
        const srcIdx = srcY * w + srcX
        const alpha = Math.round(Math.max(0, Math.min(255, data[srcIdx] * 255)))
        const dstIdx = (y * originalW + x) * 4
        outData[dstIdx] = 255
        outData[dstIdx + 1] = 255
        outData[dstIdx + 2] = 255
        outData[dstIdx + 3] = alpha
      }
    }

    return output
  }

  async processFrame(frame: ImageData, backgroundType: BackgroundRemovalInput['backgroundType'], backgroundValue?: string, backgroundBlur?: number): Promise<ImageData> {
    if (!this.session) throw new Error('Engine not initialized')

    const inputTensor = this.preprocessFrame(frame)
    const results = await this.session.run({ input: inputTensor })
    const matte = Array.from(results.values())[0] as ort.Tensor

    // Get the alpha matte
    const alphaFrame = this.postprocessMatte(matte, frame.width, frame.height)

    // Composite with background
    const canvas = document.createElement('canvas')
    canvas.width = frame.width
    canvas.height = frame.height
    const ctx = canvas.getContext('2d')!

    // Draw original frame
    ctx.putImageData(frame, 0, 0)

    // Apply alpha matte
    ctx.globalCompositeOperation = 'destination-in'
    ctx.putImageData(alphaFrame, 0, 0)
    ctx.globalCompositeOperation = 'source-over'

    // Draw background
    switch (backgroundType) {
      case 'blur':
        ctx.filter = `blur(${backgroundBlur ?? 20}px)`
        ctx.drawImage(canvas, 0, 0)
        ctx.filter = 'none'
        break
      case 'color':
        ctx.globalCompositeOperation = 'destination-over'
        ctx.fillStyle = backgroundValue ?? '#000000'
        ctx.fillRect(0, 0, frame.width, frame.height)
        ctx.globalCompositeOperation = 'source-over'
        break
      case 'image':
        if (backgroundValue) {
          const bgImg = new Image()
          bgImg.src = backgroundValue
          await new Promise<void>((resolve, reject) => {
            bgImg.onload = () => resolve()
            bgImg.onerror = () => reject(new Error('Failed to load background image'))
          })
          ctx.globalCompositeOperation = 'destination-over'
          ctx.drawImage(bgImg, 0, 0, frame.width, frame.height)
          ctx.globalCompositeOperation = 'source-over'
        }
        break
      case 'transparent':
      default:
        // Already transparent from destination-in
        break
    }

    return ctx.getImageData(0, 0, frame.width, frame.height)
  }

  async process(frames: ImageData[], backgroundType: BackgroundRemovalInput['backgroundType'], backgroundValue?: string, backgroundBlur?: number, onProgress?: (progress: number) => void): Promise<ImageData[]> {
    if (!this.initialized) await this.initialize()

    const outputFrames: ImageData[] = []
    for (let i = 0; i < frames.length; i++) {
      const frame = await this.processFrame(frames[i], backgroundType, backgroundValue, backgroundBlur)
      outputFrames.push(frame)
      onProgress?.((i + 1) / frames.length)
    }
    return outputFrames
  }
}

export async function createBackgroundRemovalEngine(config?: Partial<BackgroundRemovalConfig>): Promise<BackgroundRemovalEngine> {
  const engine = new BackgroundRemovalEngine(config)
  await engine.initialize()
  return engine
}