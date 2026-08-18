// @ts-nocheck
import * as ort from 'onnxruntime-web'

export interface Wav2LipConfig {
  modelUrl: string
  faceDetectorUrl?: string
  inputSize: [number, number]
  fps: number
  batchSize: number
}

export interface LipSyncInput {
  videoFrames?: ImageData[]
  image?: ImageData
  audioBuffer: Float32Array
  sampleRate: number
  fps?: number
}

export interface LipSyncResult {
  frames: ImageData[]
  fps: number
  duration: number
}

export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_CONFIG: Wav2LipConfig = {
  modelUrl: '/models/wav2lip.onnx',
  inputSize: [96, 96],
  fps: 25,
  batchSize: 8,
}

export class Wav2LipEngine {
  private session: ort.InferenceSession | null = null
  private faceDetector: ort.InferenceSession | null = null
  private config: Wav2LipConfig
  private initialized = false

  constructor(config: Partial<Wav2LipConfig> = {}) {
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
      console.log('Wav2Lip engine initialized')
    } catch (err) {
      console.error('Failed to initialize Wav2Lip engine:', err)
      throw new Error(`Wav2Lip initialization failed: ${err}`)
    }
  }

  async detectFaces(frame: ImageData): Promise<FaceBox[]> {
    if (!this.faceDetector) {
      return this.simpleFaceDetection(frame)
    }

    const inputTensor = this.preprocessForFaceDetection(frame)
    const results = await this.faceDetector.run({ input: inputTensor })
    return this.parseFaceBoxes(results, frame.width, frame.height)
  }

  private simpleFaceDetection(frame: ImageData): FaceBox[] {
    const centerX = frame.width / 2
    const centerY = frame.height / 2
    const size = Math.min(frame.width, frame.height) * 0.6
    return [{
      x: centerX - size / 2,
      y: centerY - size / 2,
      width: size,
      height: size,
    }]
  }

  private preprocessForFaceDetection(frame: ImageData): ort.Tensor {
    const [h, w] = [320, 320]
    const data = new Float32Array(h * w * 3)
    const scaleX = frame.width / w
    const scaleY = frame.height / h

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcX = Math.min(Math.floor(x * scaleX), frame.width - 1)
        const srcY = Math.min(Math.floor(y * scaleY), frame.height - 1)
        const idx = (srcY * frame.width + srcX) * 4
        const dstIdx = (y * w + x) * 3
        data[dstIdx] = frame.data[idx] / 255
        data[dstIdx + 1] = frame.data[idx + 1] / 255
        data[dstIdx + 2] = frame.data[idx + 2] / 255
      }
    }
    return new ort.Tensor('float32', data, [1, 3, h, w])
  }

  private parseFaceBoxes(results: Map<string, ort.Tensor>, imgW: number, imgH: number): FaceBox[] {
    const boxes: FaceBox[] = []
    const output = Array.from(results.values())[0]
    const data = output.data as Float32Array
    const [, , numDetections] = output.dims

    for (let i = 0; i < numDetections; i++) {
      const confidence = data[i * 7 + 2]
      if (confidence > 0.5) {
        const x1 = data[i * 7 + 3] * imgW
        const y1 = data[i * 7 + 4] * imgH
        const x2 = data[i * 7 + 5] * imgW
        const y2 = data[i * 7 + 6] * imgH
        boxes.push({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 })
      }
    }
    return boxes.length ? boxes : this.simpleFaceDetection({ width: imgW, height: imgH, data: new Uint8ClampedArray() })
  }

  private cropAndResizeFace(frame: ImageData, face: FaceBox): ImageData {
    const [targetW, targetH] = this.config.inputSize
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')!

    const padding = 0.3
    const cropX = Math.max(0, face.x - face.width * padding)
    const cropY = Math.max(0, face.y - face.height * padding)
    const cropW = Math.min(frame.width - cropX, face.width * (1 + 2 * padding))
    const cropH = Math.min(frame.height - cropY, face.height * (1 + 2 * padding))

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = cropW
    tempCanvas.height = cropH
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.putImageData(
      new ImageData(new Uint8ClampedArray(frame.data.buffer.slice(
        (cropY * frame.width + cropX) * 4,
        (cropY * frame.width + cropX) * 4 + cropW * cropH * 4
      )), cropW, cropH),
      0, 0
    )

    ctx.drawImage(tempCanvas, 0, 0, targetW, targetH)
    return ctx.getImageData(0, 0, targetW, targetH)
  }

  private imageDataToTensor(frame: ImageData): ort.Tensor {
    const [h, w] = this.config.inputSize
    const data = new Float32Array(h * w * 3)
    for (let i = 0; i < h * w; i++) {
      data[i] = frame.data[i * 4] / 255
      data[i + h * w] = frame.data[i * 4 + 1] / 255
      data[i + 2 * h * w] = frame.data[i * 4 + 2] / 255
    }
    return new ort.Tensor('float32', data, [1, 3, h, w])
  }

  private melSpectrogram(audio: Float32Array, sampleRate: number): Float32Array {
    const nFft = 800
    const hopLength = 200
    const nMels = 80
    const numFrames = Math.floor((audio.length - nFft) / hopLength) + 1
    const melBasis = this.createMelBasis(nFft, sampleRate, nMels)
    const window = this.hannWindow(nFft)
    const spec = new Float32Array(nMels * numFrames)

    for (let t = 0; t < numFrames; t++) {
      const start = t * hopLength
      const frame = new Float32Array(nFft)
      for (let i = 0; i < nFft; i++) {
        frame[i] = (start + i < audio.length ? audio[start + i] : 0) * window[i]
      }
      const fft = this.rfft(frame)
      const mag = new Float32Array(nFft / 2 + 1)
      for (let i = 0; i < mag.length; i++) {
        mag[i] = Math.sqrt(fft[2 * i] ** 2 + fft[2 * i + 1] ** 2)
      }
      for (let m = 0; m < nMels; m++) {
        let sum = 0
        for (let k = 0; k < mag.length; k++) {
          sum += mag[k] * melBasis[m * mag.length + k]
        }
        spec[m * numFrames + t] = Math.log(Math.max(sum, 1e-10))
      }
    }
    return spec
  }

  private createMelBasis(nFft: number, sampleRate: number, nMels: number): Float32Array {
    const basis = new Float32Array(nMels * (nFft / 2 + 1))
    const fMin = 0
    const fMax = sampleRate / 2
    const melMin = this.hzToMel(fMin)
    const melMax = this.hzToMel(fMax)
    for (let m = 0; m < nMels; m++) {
      const mel = melMin + (melMax - melMin) * m / (nMels - 1)
      const hz = this.melToHz(mel)
      const bin = Math.round(hz * nFft / sampleRate)
      for (let k = 0; k <= nFft / 2; k++) {
        const freq = k * sampleRate / nFft
        const melFreq = this.hzToMel(freq)
        if (melFreq >= melMin && melFreq <= melMax) {
          const weight = Math.max(0, 1 - Math.abs(melFreq - mel) / (melMax - melMin) * nMels)
          basis[m * (nFft / 2 + 1) + k] = weight
        }
      }
    }
    return basis
  }

  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700)
  }

  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1)
  }

  private hannWindow(n: number): Float32Array {
    const window = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)))
    }
    return window
  }

  private rfft(input: Float32Array): Float32Array {
    const n = input.length
    const output = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      let re = 0, im = 0
      for (let t = 0; t < n; t++) {
        const angle = -2 * Math.PI * k * t / n
        re += input[t] * Math.cos(angle)
        im += input[t] * Math.sin(angle)
      }
      output[2 * k] = re
      output[2 * k + 1] = im
    }
    return output
  }

  async process(input: LipSyncInput, onProgress?: (progress: number) => void): Promise<LipSyncResult> {
    if (!this.initialized) await this.initialize()

    const { videoFrames, image, audioBuffer, sampleRate, fps = this.config.fps } = input
    const mel = this.melSpectrogram(audioBuffer, sampleRate)
    const melFrames = Math.floor(mel.length / 80)

    // If image is provided instead of videoFrames, repeat it for all mel frames
    let videoFramesToProcess: ImageData[]
    if (image) {
      videoFramesToProcess = new Array(melFrames).fill(null).map(() => image)
    } else if (videoFrames && videoFrames.length > 0) {
      videoFramesToProcess = videoFrames
    } else {
      throw new Error('Either videoFrames or image must be provided')
    }

    const videoFrameCount = videoFramesToProcess.length
    const outputFrames: ImageData[] = []

    const batchSize = this.config.batchSize
    const totalBatches = Math.ceil(videoFrameCount / batchSize)

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const startFrame = batchIdx * batchSize
      const endFrame = Math.min(startFrame + batchSize, videoFrameCount)
      const batchFrames = videoFramesToProcess.slice(startFrame, endFrame)
      const batchMel = mel.slice(startFrame * 80, endFrame * 80)

      if (batchFrames.length === 0) continue

      const faceBoxes = await Promise.all(batchFrames.map(f => this.detectFaces(f)))
      const croppedFaces = batchFrames.map((frame, i) => this.cropAndResizeFace(frame, faceBoxes[i]))
      const faceTensors = croppedFaces.map(f => this.imageDataToTensor(f))

      const melTensor = new ort.Tensor('float32', batchMel, [batchFrames.length, 80, 16])
      const faceTensor = new ort.Tensor('float32', new Float32Array(faceTensors.flatMap(t => t.data)), [batchFrames.length, 3, 96, 96])

      const results = await this.session!.run({
        face: faceTensor,
        mel: melTensor,
      })

      const outputTensor = Array.from(results.values())[0]
      const outputData = outputTensor.data as Float32Array
      const [, c, h, w] = outputTensor.dims

      for (let i = 0; i < batchFrames.length; i++) {
        const frameData = new Uint8ClampedArray(h * w * 4)
        const frameOffset = i * c * h * w
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4
            const srcIdx = frameOffset + y * w + x
            frameData[idx] = Math.round(Math.max(0, Math.min(255, outputData[srcIdx] * 255)))
            frameData[idx + 1] = Math.round(Math.max(0, Math.min(255, outputData[srcIdx + h * w] * 255)))
            frameData[idx + 2] = Math.round(Math.max(0, Math.min(255, outputData[srcIdx + 2 * h * w] * 255)))
            frameData[idx + 3] = 255
          }
        }
        outputFrames.push(new ImageData(frameData, w, h))
      }

      if (onProgress) onProgress((batchIdx + 1) / totalBatches)
    }

    return {
      frames: outputFrames,
      fps,
      duration: outputFrames.length / fps,
    }
  }
}

export async function createWav2LipEngine(config?: Partial<Wav2LipConfig>): Promise<Wav2LipEngine> {
  const engine = new Wav2LipEngine(config)
  await engine.initialize()
  return engine
}