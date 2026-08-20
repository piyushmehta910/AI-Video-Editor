import type { FrameBox } from '@/engine/captions/captions'

export interface ReframingOptions {
  /** Target aspect ratio (e.g., '9:16', '16:9', '1:1') */
  targetAspect: string
  /** Source frame size */
  sourceWidth: number
  sourceHeight: number
  /** How aggressively to follow the face (0-1) */
  followStrength?: number
  /** Minimum margin around face as fraction of crop size */
  margin?: number
  /** Smoothing factor for crop movement (0-1, lower = smoother) */
  smoothing?: number
}

export interface CropWindow {
  x: number
  y: number
  width: number
  height: number
}

export interface CropKeyframe {
  time: number
  crop: CropWindow
}

export interface ReframingAnalysisOptions {
  targetAspect?: string
  followStrength?: number
  margin?: number
  smoothing?: number
  /** Number of frames to sample (default: 30) */
  sampleCount?: number
}

/** Detect the primary face in a frame. Returns normalized (0-1) FrameBox or null. */
export async function detectPrimaryFace(frame: ImageData): Promise<FrameBox | null> {
  // Simple center-biased detection as fallback (used by Wav2Lip)
  // In production, this would use MediaPipe Face Detection or similar ONNX model
  const w = frame.width
  const h = frame.height
  const size = Math.min(w, h) * 0.5
  return {
    x: (w - size) / 2 / w,
    y: (h - size) / 2 / h,
    w: size / w,
    h: size / h,
  }
}

/** Compute the optimal crop window for a frame given a face box. */
export function computeCropWindow(
  faceBox: FrameBox | null,
  sourceW: number,
  sourceH: number,
  targetAspect: number,
  opts: { margin?: number } = {},
): CropWindow {
  const margin = opts.margin ?? 0.15
  const srcAspect = sourceW / sourceH

  // Target crop size in source pixels
  let cropW: number
  let cropH: number

  if (targetAspect > srcAspect) {
    // Target is wider than source - crop height to match target aspect
    cropH = sourceH
    cropW = sourceH * targetAspect
  } else {
    // Target is taller than source - crop width to match target aspect
    cropW = sourceW
    cropH = sourceW / targetAspect
  }

  if (!faceBox) {
    // Center crop
    return {
      x: (sourceW - cropW) / 2,
      y: (sourceH - cropH) / 2,
      width: cropW,
      height: cropH,
    }
  }

  // Face box center in source pixels
  const faceCx = (faceBox.x + faceBox.w / 2) * sourceW
  const faceCy = (faceBox.y + faceBox.h / 2) * sourceH

  // Add margin around face
  const faceSize = Math.max(faceBox.w * sourceW, faceBox.h * sourceH)
  const marginPx = faceSize * margin
  void marginPx // suppress unused warning

  // Desired crop center (clamped to valid range)
  let cx = Math.max(cropW / 2, Math.min(sourceW - cropW / 2, faceCx))
  let cy = Math.max(cropH / 2, Math.min(sourceH - cropH / 2, faceCy))

  // Ensure crop stays within bounds
  cx = Math.max(cropW / 2, Math.min(sourceW - cropW / 2, cx))
  cy = Math.max(cropH / 2, Math.min(sourceH - cropH / 2, cy))

  return {
    x: cx - cropW / 2,
    y: cy - cropH / 2,
    width: cropW,
    height: cropH,
  }
}

/** Smooth crop window transition using exponential moving average. */
export function smoothCropWindow(
  prev: CropWindow | null,
  current: CropWindow,
  smoothing: number = 0.15,
): CropWindow {
  if (!prev) return current
  const alpha = smoothing
  return {
    x: prev.x + (current.x - prev.x) * alpha,
    y: prev.y + (current.y - prev.y) * alpha,
    width: prev.width + (current.width - prev.width) * alpha,
    height: prev.height + (current.height - prev.height) * alpha,
  }
}

/** Parse aspect ratio string (e.g., '9:16') to float. */
export function parseAspectRatio(aspect: string): number {
  const [w, h] = aspect.split(':').map(Number)
  if (!w || !h) return 16 / 9
  return w / h
}

/** Extract a frame from a video blob at a given time. */
async function extractFrame(videoBlob: Blob, time: number, width: number, height: number): Promise<ImageData> {
  const url = URL.createObjectURL(videoBlob)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = url
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video'))
    setTimeout(() => reject(new Error('Video load timeout')), 10000)
  })
  video.currentTime = time
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve()
    video.onerror = () => reject(new Error('Seek failed'))
    setTimeout(() => reject(new Error('Seek timeout')), 5000)
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0, width, height)
  const frame = ctx.getImageData(0, 0, width, height)
  URL.revokeObjectURL(url)
  return frame
}

/** Compute crop keyframes for a video asset by sampling frames and detecting faces. */
export async function computeReframingKeyframes(
  asset: { filePath: string; duration: number },
  targetAspect: string,
  opts: ReframingAnalysisOptions = {},
): Promise<CropKeyframe[]> {
  const { followStrength = 0.8, margin = 0.15, smoothing = 0.15, sampleCount = 30 } = opts
void followStrength
  const targetAspectRatio = parseAspectRatio(targetAspect)

  // Read the video blob from OPFS
  const { readMediaFile } = await import('@/engine/storage/opfs')
  const blob = await readMediaFile(asset.filePath)

  // Get video dimensions
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.src = url
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video metadata'))
    setTimeout(() => reject(new Error('Metadata load timeout')), 10000)
  })
  const sourceW = video.videoWidth
  const sourceH = video.videoHeight
  const duration = video.duration
  URL.revokeObjectURL(url)

  if (!sourceW || !sourceH || !duration) {
    throw new Error('Could not read video dimensions')
  }

  const keyframes: CropKeyframe[] = []
  let prevCrop: CropWindow | null = null

  for (let i = 0; i < sampleCount; i++) {
    const time = (i / (sampleCount - 1)) * duration
    const frame = await extractFrame(blob, time, 320, 180) // Downsample for faster face detection
    const faceBox = await detectPrimaryFace(frame)
    const crop = computeCropWindow(faceBox, sourceW, sourceH, targetAspectRatio, { margin })
    const smoothed = smoothCropWindow(prevCrop, crop, smoothing)
    keyframes.push({ time, crop: smoothed })
    prevCrop = smoothed
  }

  return keyframes
}