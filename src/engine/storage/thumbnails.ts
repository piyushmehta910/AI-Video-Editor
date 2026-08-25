export interface Thumbnail {
  url: string
  width: number
  height: number
}

export interface MediaProbe {
  width?: number
  height?: number
  duration?: number
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

const THUMB_BOX = 320

function canvasToThumbnail(canvas: HTMLCanvasElement): Promise<Thumbnail> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve({ url: URL.createObjectURL(b!), width: canvas.width, height: canvas.height }), 'image/jpeg', 0.82)
  })
}

async function imageThumbnail(blob: Blob): Promise<Thumbnail> {
  const img = await loadImageFromBlob(blob)
  const scale = Math.min(THUMB_BOX / img.naturalWidth, THUMB_BOX / img.naturalHeight)
  const width = Math.max(2, Math.round(img.naturalWidth * scale))
  const height = Math.max(2, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
  return canvasToThumbnail(canvas)
}

async function videoThumbnail(blob: Blob): Promise<Thumbnail> {
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Video decode failed'))
      setTimeout(() => reject(new Error('Video thumbnail timeout')), 10000)
    })
    // Grab a representative frame near the start instead of the usual black first frame.
    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1
    const target = Math.min(duration * 0.1, Math.max(duration - 0.1, 0))
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      video.currentTime = target
      setTimeout(resolve, 3000)
    })
    if (!video.videoWidth || !video.videoHeight) throw new Error('No video frame available')
    const scale = Math.min(THUMB_BOX / video.videoWidth, THUMB_BOX / video.videoHeight)
    const width = Math.max(2, Math.round(video.videoWidth * scale))
    const height = Math.max(2, Math.round(video.videoHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(video, 0, 0, width, height)
    return canvasToThumbnail(canvas)
  } finally {
    video.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}

export async function generateThumbnail(
  blob: Blob,
  type: 'video' | 'image' | 'audio' | 'model',
): Promise<Thumbnail> {
  if (type === 'image') {
    try {
      return await imageThumbnail(blob)
    } catch {
      // fall through to placeholder
    }
  }
  if (type === 'video') {
    try {
      return await videoThumbnail(blob)
    } catch {
      // fall through to placeholder
    }
  }
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
  ctx.fillText(type === 'audio' ? 'AUDIO' : type.toUpperCase(), 160, 90)
  return canvasToThumbnail(canvas)
}

export async function probeMedia(_blob: Blob, type: 'video' | 'image' | 'audio' | 'model'): Promise<MediaProbe> {
  const url = URL.createObjectURL(_blob)
  try {
    if (type === 'video' || type === 'audio') {
      const media = document.createElement(type === 'video' ? 'video' : 'audio')
      media.preload = 'metadata'
      media.muted = true
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
      const img = await loadImageFromBlob(_blob)
      return { width: img.naturalWidth, height: img.naturalHeight }
    }
    return {}
  } finally {
    URL.revokeObjectURL(url)
  }
}