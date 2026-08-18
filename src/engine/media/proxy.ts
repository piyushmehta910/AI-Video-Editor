import { writeMediaFile } from '@/engine/storage/opfs'

const PROXY_HEIGHT = 360
const PROXY_MIME = 'video/webm;codecs=vp8'
const PROXY_BITRATE = 1_000_000
const PROXY_MAX_DURATION = 30

function createVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video')
    el.preload = 'auto'
    el.muted = true
    el.playsInline = true
    el.crossOrigin = 'anonymous'
    el.onloadedmetadata = () => resolve(el)
    el.onerror = () => reject(new Error('Failed to load video for proxy'))
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

export async function generateProxy(assetId: string, file: File): Promise<string | null> {
  if (!('MediaRecorder' in window) || !('VideoFrame' in window)) return null

  const url = URL.createObjectURL(file)
  let el: HTMLVideoElement | null = null

  try {
    el = await createVideoElement(url)
    const srcW = el.videoWidth || 1920
    const srcH = el.videoHeight || 1080
    const duration = el.duration || 0
    if (!isFinite(duration) || duration <= 0 || srcW === 0 || srcH === 0) return null
    if (duration > PROXY_MAX_DURATION) return null

    const scale = PROXY_HEIGHT / srcH
    const dstW = Math.round(srcW * scale)
    const dstH = PROXY_HEIGHT

    const canvas = document.createElement('canvas')
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const stream = canvas.captureStream(30)
    const audioTracks = stream.getAudioTracks()
    for (const t of audioTracks) stream.removeTrack(t)

    const recorder = new MediaRecorder(stream, {
      mimeType: PROXY_MIME,
      videoBitsPerSecond: PROXY_BITRATE,
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })

    recorder.start(100)

    const fps = 30
    const totalFrames = Math.ceil(duration * fps)
    const frameInterval = 1 / fps
    const recordingStart = performance.now()

    for (let i = 0; i < totalFrames; i++) {
      const time = Math.min(i * frameInterval, duration - 0.01)
      await waitForSeek(el, time)
      // MediaRecorder captures in real time, so pace the loop to match the
      // source duration or the proxy will come out shorter than the clip.
      const targetElapsed = i * frameInterval * 1000
      const wait = targetElapsed - (performance.now() - recordingStart)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      ctx.drawImage(el, 0, 0, dstW, dstH)
    }

    recorder.stop()
    await done

    if (!chunks.length) return null

    const blob = new Blob(chunks, { type: 'video/webm' })
    if (blob.size < 1024) return null

    return writeMediaFile(assetId, new File([blob], `proxy.webm`, { type: 'video/webm' }), 'proxy.webm')
  } catch {
    return null
  } finally {
    if (el) el.src = ''
    URL.revokeObjectURL(url)
  }
}

export async function readProxy(assetId: string): Promise<File | null> {
  try {
    const root = await (navigator.storage as any).getDirectory()
    const dir = await root.getDirectoryHandle('clipforge-media')
    const assetDir = await dir.getDirectoryHandle(assetId)
    const fileHandle = await assetDir.getFileHandle('proxy.webm')
    return fileHandle.getFile()
  } catch {
    return null
  }
}

export function getProxyUrl(file: File): string {
  return URL.createObjectURL(file)
}
