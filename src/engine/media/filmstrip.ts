const FILMSTRIP_FRAME_HEIGHT = 68
const FILMSTRIP_MAX_FRAMES = 40

function createVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video')
    el.preload = 'auto'
    el.muted = true
    el.playsInline = true
    el.crossOrigin = 'anonymous'
    el.onloadedmetadata = () => resolve(el)
    el.onerror = () => reject(new Error('Failed to load video for filmstrip'))
    el.src = url
  })
}

function waitForSeek(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(el.currentTime - time) < 0.02) {
      resolve()
      return
    }
    const onSeeked = () => {
      el.removeEventListener('seeked', onSeeked)
      resolve()
    }
    el.addEventListener('seeked', onSeeked)
    el.currentTime = time
    window.setTimeout(resolve, 3000)
  })
}

export interface FilmstripResult {
  imageUrl: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  duration: number
}

export async function generateFilmstrip(blob: Blob, type: 'video' | 'image'): Promise<FilmstripResult | null> {
  if (type === 'image') return null

  const url = URL.createObjectURL(blob)
  let el: HTMLVideoElement | null = null

  try {
    el = await createVideoElement(url)
    const srcW = el.videoWidth || 0
    const srcH = el.videoHeight || 0
    const duration = el.duration || 0
    if (!isFinite(duration) || duration <= 0.5 || srcW === 0 || srcH === 0) return null

    const scale = FILMSTRIP_FRAME_HEIGHT / srcH
    const frameW = Math.round(srcW * scale)
    const frameH = FILMSTRIP_FRAME_HEIGHT
    const interval = Math.max(0.5, duration / FILMSTRIP_MAX_FRAMES)
    const times: number[] = []
    for (let t = interval / 2; t < duration; t += interval) {
      times.push(t)
      if (times.length >= FILMSTRIP_MAX_FRAMES) break
    }

    const stripCanvas = document.createElement('canvas')
    stripCanvas.width = frameW * times.length
    stripCanvas.height = frameH
    const stripCtx = stripCanvas.getContext('2d')
    if (!stripCtx) return null

    stripCtx.fillStyle = '#0f172a'
    stripCtx.fillRect(0, 0, stripCanvas.width, stripCanvas.height)

    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = frameW
    frameCanvas.height = frameH
    const frameCtx = frameCanvas.getContext('2d')
    if (!frameCtx) return null

    for (let i = 0; i < times.length; i++) {
      await waitForSeek(el, times[i])
      frameCtx.drawImage(el, 0, 0, frameW, frameH)
      stripCtx.drawImage(frameCanvas, i * frameW, 0, frameW, frameH)
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0))
    }

    const dataUrl = stripCanvas.toDataURL('image/jpeg', 0.6)
    return {
      imageUrl: dataUrl,
      frameWidth: frameW,
      frameHeight: frameH,
      frameCount: times.length,
      duration,
    }
  } catch {
    return null
  } finally {
    if (el) el.src = ''
    URL.revokeObjectURL(url)
  }
}

export function filmstripFrameAt(
  filmstrip: FilmstripResult,
  time: number,
): { x: number; width: number } {
  const t = Math.max(0, Math.min(time, filmstrip.duration))
  const idx = Math.floor((t / filmstrip.duration) * filmstrip.frameCount)
  return {
    x: idx * filmstrip.frameWidth,
    width: filmstrip.frameWidth,
  }
}
