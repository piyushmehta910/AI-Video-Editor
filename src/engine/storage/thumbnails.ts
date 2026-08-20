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

export async function generateThumbnail(
  _blob: Blob,
  _type: 'video' | 'image' | 'audio' | 'model',
): Promise<Thumbnail> {
  // Placeholder - full implementation in separate PR
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
  ctx.fillText('THUMBNAIL', 160, 90)
  const blobResult = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg'))
  const url = URL.createObjectURL(blobResult)
  return { url, width: 320, height: 180 }
}

export async function probeMedia(_blob: Blob, type: 'video' | 'image' | 'audio' | 'model'): Promise<MediaProbe> {
  const url = URL.createObjectURL(_blob)
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
      const img = await loadImageFromBlob(_blob)
      return { width: img.naturalWidth, height: img.naturalHeight }
    }
    return {}
  } finally {
    URL.revokeObjectURL(url)
  }
}

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