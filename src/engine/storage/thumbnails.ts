export interface Thumbnail {
  url: string
  width: number
  height: number
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

async function makeThumbnail(source: CanvasImageSource, target = 320): Promise<Thumbnail> {
  const s = source as HTMLCanvasElement | ImageBitmap
  const sw = s.width
  const sh = s.height
  const scale = Math.min(1, target / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(source, 0, 0, w, h)
  return { url: out.toDataURL('image/jpeg', 0.7), width: w, height: h }
}

async function videoThumbnail(blob: Blob, at = 0.2): Promise<Thumbnail> {
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'metadata'
  video.src = url
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => resolve()
    setTimeout(resolve, 8000)
  })
  const duration = video.duration || 0
  const seekTo = Math.min(at, Math.max(0, duration - 0.1))
  if (seekTo > 0) {
    await new Promise<void>((resolve) => {
      video.currentTime = seekTo
      video.onseeked = () => resolve()
      setTimeout(resolve, 2000)
    })
  }
  URL.revokeObjectURL(url)
  if (!video.videoWidth) {
    return placeholderThumbnail()
  }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 16
  canvas.height = video.videoHeight || 9
  canvas.getContext('2d')!.drawImage(video, 0, 0)
  return makeThumbnail(canvas)
}

function placeholderThumbnail(): Thumbnail {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, 320, 180)
  ctx.fillStyle = '#475569'
  ctx.font = '600 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VIDEO', 160, 90)
  return { url: canvas.toDataURL('image/png'), width: 320, height: 180 }
}

async function imageThumbnail(blob: Blob): Promise<Thumbnail> {
  const img = await loadImageFromBlob(blob)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  return makeThumbnail(canvas)
}

async function audioWaveform(blob: Blob): Promise<Thumbnail> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
  const peaks: number[] = []
  const channel = buffer.getChannelData(0)
  const samplesPerBar = Math.max(1, Math.floor(channel.length / 240))
  for (let i = 0; i < 240; i++) {
    let max = 0
    for (let j = 0; j < samplesPerBar; j++) {
      const idx = i * samplesPerBar + j
      if (idx < channel.length) max = Math.max(max, Math.abs(channel[idx]))
    }
    peaks.push(max)
  }
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 90
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, 320, 90)
  const barW = 2
  const gap = 1.2
  for (let i = 0; i < peaks.length; i++) {
    const h = Math.max(2, peaks[i] * 80)
    ctx.fillStyle = i % 2 ? '#34d399' : '#6ee7b7'
    ctx.fillRect(i * (barW + gap), (90 - h) / 2, barW, h)
  }
  void audioCtx.close()
  return { url: canvas.toDataURL('image/png'), width: 320, height: 90 }
}

async function modelThumbnail(blob: Blob): Promise<Thumbnail> {
  const { defaultCameraRig } = await import('@/engine/types')
  const { renderBlobFrame, probeModel } = await import('@/engine/three/modelRenderer')
  const { radius } = await probeModel(blob)
  const rig = { ...defaultCameraRig(), radiusStart: radius * 2.5, radiusEnd: radius * 2.5, azimuthStart: 30, mode: 'turntable' as const }
  const canvas = await renderBlobFrame(blob, rig, 640, 360)
  if (!canvas) return placeholderThumbnail()
  return makeThumbnail(canvas)
}

export async function generateThumbnail(
  blob: Blob,
  type: 'video' | 'image' | 'audio' | 'model',
): Promise<Thumbnail> {
  switch (type) {
    case 'video':
      return videoThumbnail(blob)
    case 'image':
      return imageThumbnail(blob)
    case 'audio':
      return audioWaveform(blob)
    case 'model':
      return modelThumbnail(blob)
  }
}

export interface ThumbnailCandidate {
  thumbnail: Thumbnail
  score: number
  time: number
  metrics: {
    faceScore: number
    contrastScore: number
    compositionScore: number
    brightnessScore: number
  }
}

/** Generate multiple smart thumbnail candidates from a video, ranked by quality score. */
export async function generateSmartThumbnails(
  videoBlob: Blob,
  options: { count?: number; targetWidth?: number } = {},
): Promise<ThumbnailCandidate[]> {
  const { count = 5, targetWidth = 320 } = options

  const { readMediaFile } = await import('@/engine/storage/opfs')
  const { detectPrimaryFace } = await import('@/engine/reframing')

  const blob = videoBlob
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = url
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video'))
    setTimeout(() => reject(new Error('Video load timeout')), 10000)
  })
  const duration = video.duration || 0
  const sourceW = video.videoWidth
  const sourceH = video.videoHeight
  URL.revokeObjectURL(url)

  if (!sourceW || !sourceH || !duration) {
    throw new Error('Could not read video dimensions')
  }

  // Sample frames at multiple time positions
  const sampleCount = Math.max(count * 3, 15) // Oversample for better selection
  const candidates: ThumbnailCandidate[] = []

  for (let i = 0; i < sampleCount; i++) {
    const time = (i / (sampleCount - 1)) * duration
    const frame = await extractVideoFrame(blob, time, 320, 180)

    // Analyze frame
    const metrics = await analyzeFrame(frame)

    // Create thumbnail from frame
    const canvas = document.createElement('canvas')
    canvas.width = frame.width
    canvas.height = frame.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(frame, 0, 0)
    const thumb = await makeThumbnailFromCanvas(canvas, targetWidth)

    // Calculate composite score
    const score = (
      metrics.faceScore * 0.4 +
      metrics.contrastScore * 0.25 +
      metrics.compositionScore * 0.2 +
      metrics.brightnessScore * 0.15
    )

    candidates.push({
      thumbnail: thumb,
      score,
      time,
      metrics,
    })
  }

  // Sort by score descending and return top N
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
}

async function extractVideoFrame(blob: Blob, time: number, width: number, height: number): Promise<ImageData> {
  const url = URL.createObjectURL(blob)
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
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
    setTimeout(resolve, 2000)
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

async function analyzeFrame(frame: ImageData): Promise<{
  faceScore: number
  contrastScore: number
  compositionScore: number
  brightnessScore: number
}> {
  // Face detection
  const { detectPrimaryFace } = await import('@/engine/reframing')
  const faceBox = await detectPrimaryFace(frame)
  const faceScore = faceBox ? 1.0 : 0.2

  // Contrast analysis (standard deviation of luminance)
  const contrastScore = calculateContrast(frame)

  // Composition score (rule of thirds - face position)
  const compositionScore = calculateComposition(frame)

  // Brightness score (avoid over/under exposure)
  const brightnessScore = calculateBrightness(frame)

  return { faceScore, contrastScore, compositionScore, brightnessScore }
}

function calculateContrast(frame: ImageData): number {
  const data = frame.data
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sum += lum
    sumSq += lum * lum
    count++
  }
  const mean = sum / count
  const variance = sumSq / count - mean * mean
  const stdDev = Math.sqrt(Math.max(0, variance))
  return Math.min(1, stdDev / 64)
}

function calculateComposition(frame: ImageData): number {
  // Check if face/bright region aligns with rule of thirds
  const { detectPrimaryFace } = await import('@/engine/reframing')
  const faceBox = await detectPrimaryFace(frame)
  if (!faceBox) return 0.5

  const cx = faceBox.x + faceBox.w / 2
  const cy = faceBox.y + faceBox.h / 2

  // Rule of thirds intersections
  let minDist = 1
  for (const tx of [1/3, 2/3]) {
    for (const ty of [1/3, 2/3]) {
      const dist = Math.sqrt((cx - tx) ** 2 + (cy - ty) ** 2)
      minDist = Math.min(minDist, dist)
    }
  return Math.max(0, 1 - minDist * 3)
}

function calculateBrightness(frame: ImageData): number {
  const data = frame.data
  let sum = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sum += lum
    count++
  }
  const mean = sum / (count * 255)
  return 1 - Math.abs(mean - 0.5) * 2
}

async function makeThumbnailFromCanvas(canvas: HTMLCanvasElement, targetWidth: number): Promise<Thumbnail> {
  const scale = Math.min(1, targetWidth / Math.max(canvas.width, canvas.height))
  const w = Math.max(1, Math.round(canvas.width * scale))
  const h = Math.max(1, Math.round(canvas.height * scale))
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(canvas, 0, 0, w, h)
  return { url: out.toDataURL('image/jpeg', 0.7), width: w, height: h }
}

export interface MediaProbe {
  width?: number
  height?: number
  duration?: number
}

export async function probeMedia(blob: Blob, type: 'video' | 'image' | 'audio' | 'model'): Promise<MediaProbe> {
  const url = URL.createObjectURL(blob)
  try {
    if (type === 'video' || type === 'audio') {
      const media = document.createElement(type === 'video' ? 'video' : 'audio')
      media.preload = 'metadata'
      media.src = url
      await new Promise<void>((resolve) => {
        media.onloadedmetadata = () => resolve()
        media.onerror = () => resolve()
        setTimeout(resolve, 8000)
      })
      const duration = media.duration && isFinite(media.duration) ? media.duration : 0
      if (type === 'video' && media instanceof HTMLVideoElement) {
        return { width: media.videoWidth, height: media.videoHeight, duration }
      }
      return { duration }
    }
    if (type === 'image') {
      const img = await loadImageFromBlob(blob)
      return { width: img.naturalWidth, height: img.naturalHeight }
    }
    return {}
  } finally {
    URL.revokeObjectURL(url)
  }
}
