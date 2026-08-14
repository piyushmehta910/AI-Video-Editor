import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import { readMediaFile } from '@/engine/storage/opfs'
import { effectFilter, effectVignette } from '@/engine/render/filters'
import type { Asset, Clip, Track } from '@/engine/types'

interface ElementRef {
  clipId: string | null
  element: HTMLVideoElement | HTMLAudioElement
  assetId: string
}

export function usePlayback() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const videoPool = React.useRef<ElementRef[]>([])
  const audioPool = React.useRef<ElementRef[]>([])
  const urlCache = React.useRef<Map<string, string>>(new Map())

  const [isPlaying, setIsPlaying] = React.useState(false)
  const [masterVolume, setMasterVolumeState] = React.useState(1)
  const [muted, setMuted] = React.useState(false)

  const storeRef = React.useRef(useTimelineStore.getState())
  React.useEffect(() => {
    storeRef.current = useTimelineStore.getState()
    const unsub = useTimelineStore.subscribe((state) => {
      storeRef.current = state
      // Project/clip changes must force a repaint even when paused, otherwise a
      // newly added clip would never be drawn (its video element only exists
      // once paint() runs).
      repaintToken.current++
    })
    return unsub
  }, [])

  const clock = React.useRef({ base: 0, startAt: 0 })
  const repaintToken = React.useRef(0)

  const requestPaint = React.useCallback(() => {
    repaintToken.current++
  }, [])

  const getAssetUrl = React.useCallback(async (asset: Asset): Promise<string> => {
    const cached = urlCache.current.get(asset.id)
    if (cached) return cached
    const file = await readMediaFile(asset.filePath)
    const url = URL.createObjectURL(file)
    urlCache.current.set(asset.id, url)
    return url
  }, [])

  const acquireVideo = React.useCallback(
    (asset: Asset): HTMLVideoElement => {
      const existing = videoPool.current.find((r) => r.assetId === asset.id)
      if (existing) return existing.element as HTMLVideoElement
      const el = document.createElement('video')
      el.preload = 'auto'
      el.crossOrigin = 'anonymous'
      el.playsInline = true
      el.addEventListener('loadedmetadata', requestPaint)
      el.addEventListener('loadeddata', requestPaint)
      void getAssetUrl(asset).then((url) => {
        el.src = url
      })
      videoPool.current.push({ clipId: null, element: el, assetId: asset.id })
      return el
    },
    [getAssetUrl, requestPaint],
  )

  const acquireAudio = React.useCallback(
    (asset: Asset): HTMLAudioElement => {
      const existing = audioPool.current.find((r) => r.assetId === asset.id)
      if (existing) return existing.element as HTMLAudioElement
      const el = document.createElement('audio')
      el.preload = 'auto'
      void getAssetUrl(asset).then((url) => {
        el.src = url
      })
      audioPool.current.push({ clipId: null, element: el, assetId: asset.id })
      return el
    },
    [getAssetUrl],
  )

  const loadImage = React.useCallback(
    (asset: Asset): Promise<HTMLImageElement> =>
      new Promise((resolve) => {
        void getAssetUrl(asset).then((url) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(img)
          img.src = url
        })
      }),
    [getAssetUrl],
  )

  const loadThumbnail = React.useCallback(
    (asset: Asset): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        if (!asset.thumbnailUrl) {
          resolve(null)
          return
        }
        const img = new Image()
        img.onload = () => resolve(img.width > 0 ? img : null)
        img.onerror = () => resolve(null)
        img.src = asset.thumbnailUrl
      }),
    [],
  )

  const activeClipsAt = React.useCallback((time: number) => {
    const { project } = storeRef.current
    const video: Array<{ clip: Clip; track: Track; z: number }> = []
    const audio: Array<{ clip: Clip; track: Track }> = []
    project.tracks.forEach((track, trackIndex) => {
      if (track.hidden || track.locked) return
      const clip = track.clips.find((c) => time >= c.startTime && time < c.startTime + c.duration)
      if (!clip) return
      if (track.type === 'video') video.push({ clip, track, z: trackIndex })
      else if (track.type === 'audio') audio.push({ clip, track })
    })
    video.sort((a, b) => b.z - a.z)
    return { video, audio }
  }, [])

  const paint = React.useCallback(
    async (time: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const { project } = storeRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = project.width
      const h = project.height
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.clearRect(0, 0, w, h)

      const { video } = activeClipsAt(time)
      let vignette = 0
      for (const { clip, track } of video) {
        void track
        const asset = storeRef.current.assets.find((a) => a.id === clip.assetId)
        if (!asset) continue
        vignette = Math.max(vignette, effectVignette(clip.effects))
        const srcTime = (time - clip.startTime) * clip.speed + clip.sourceStart

        ctx.globalAlpha = clip.opacity
        ctx.filter = effectFilter(clip.effects)
        ctx.save()
        ctx.translate(w / 2, h / 2)
        ctx.rotate((clip.rotation * Math.PI) / 180)
        ctx.scale(clip.scale.x, clip.scale.y)

        if (asset.type === 'video') {
          const el = acquireVideo(asset)
          const elTime = Math.min(srcTime, Math.max(0, (asset.duration ?? srcTime) - 0.05))
          if (el.readyState >= 1 && Math.abs(el.currentTime - elTime) > 0.06) el.currentTime = elTime
          if (el.videoWidth > 0) {
            const scale = Math.max(w / el.videoWidth, h / el.videoHeight)
            ctx.drawImage(el, -el.videoWidth * scale / 2, -el.videoHeight * scale / 2, el.videoWidth * scale, el.videoHeight * scale)
          } else {
            // Video not decodable/ready yet — show its thumbnail so the preview isn't blank.
            const thumb = await loadThumbnail(asset)
            if (thumb) {
              const scale = Math.max(w / thumb.width, h / thumb.height)
              ctx.drawImage(thumb, -thumb.width * scale / 2, -thumb.height * scale / 2, thumb.width * scale, thumb.height * scale)
            }
          }
        } else if (asset.type === 'image') {
          const img = await loadImage(asset)
          if (img.width > 0) {
            const scale = Math.max(w / img.width, h / img.height)
            ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale)
          }
        }
        ctx.restore()
        ctx.filter = 'none'
        ctx.globalAlpha = 1
      }

      if (vignette > 0) {
        const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, vignette)})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }
    },
    [activeClipsAt, acquireVideo, loadImage, loadThumbnail],
  )

  const syncAudio = React.useCallback(
    (time: number, playing: boolean) => {
      const { project } = storeRef.current
      const { audio } = activeClipsAt(time)

      // Ensure elements exist for all active audio clips
      for (const active of audio) {
        const asset = storeRef.current.assets.find((a) => a.id === active.clip.assetId)
        if (asset && !audioPool.current.find((r) => r.assetId === asset.id)) {
          acquireAudio(asset)
        }
      }

      for (const ref of audioPool.current) {
        const active = audio.find((a) => a.clip.assetId === ref.assetId)
        if (!active) {
          if (!ref.element.paused) ref.element.pause()
          ref.clipId = null
          continue
        }
        ref.clipId = active.clip.id
        const el = ref.element as HTMLAudioElement
        const srcTime = (time - active.clip.startTime) * active.clip.speed + active.clip.sourceStart
        if (Math.abs(el.currentTime - srcTime) > 0.08) el.currentTime = srcTime
        const vol =
          active.clip.volume *
          (active.track.muted ? 0 : 1) *
          masterVolume *
          (muted ? 0 : 1)
        el.volume = Math.min(1, Math.max(0, vol))
        if (playing && vol > 0 && el.paused) {
          void el.play().catch(() => undefined)
        } else if ((!playing || vol === 0) && !el.paused) {
          el.pause()
        }
      }

      for (const ref of videoPool.current) {
        const active = activeClipsAt(time).video.find((v) => v.clip.assetId === ref.assetId)
        if (!active) {
          if (!ref.element.paused) ref.element.pause()
          ref.clipId = null
          continue
        }
        ref.clipId = active.clip.id
        const el = ref.element as HTMLVideoElement
        const srcTime = (time - active.clip.startTime) * active.clip.speed + active.clip.sourceStart
        if (Math.abs(el.currentTime - srcTime) > 0.08) el.currentTime = srcTime
        const vol =
          active.clip.volume *
          (active.track.muted ? 0 : 1) *
          masterVolume *
          (muted ? 0 : 1)
        el.volume = Math.min(1, Math.max(0, vol))
        if (playing && el.paused) {
          void el.play().catch(() => undefined)
        } else if (!playing && !el.paused) {
          el.pause()
        }
      }
      void project
    },
    [acquireAudio, activeClipsAt, masterVolume, muted],
  )

  React.useEffect(() => {
    let raf = 0
    let last = -1
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const state = storeRef.current
      let time = state.playhead
      if (isPlaying) {
        time = clock.current.base + (performance.now() - clock.current.startAt) / 1000
        const duration = state.duration()
        if (time >= duration) {
          time = 0
          clock.current = { base: 0, startAt: performance.now() }
        }
        storeRef.current.setPlayhead(time)
      }
      if (Math.abs(time - last) > 0.001 || repaintToken.current > 0) {
        repaintToken.current = 0
        void paint(time)
        last = time
      }
      syncAudio(time, isPlaying)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, paint, syncAudio])

  const startPlayback = React.useCallback(() => {
    clock.current = { base: storeRef.current.playhead, startAt: performance.now() }
    setIsPlaying(true)
  }, [])

  const stopPlayback = React.useCallback(() => {
    setIsPlaying(false)
  }, [])

  const toggle = React.useCallback(() => {
    if (isPlaying) stopPlayback()
    else startPlayback()
  }, [isPlaying, startPlayback, stopPlayback])

  const seek = React.useCallback(
    (time: number) => {
      const clamped = Math.max(0, time)
      storeRef.current.setPlayhead(clamped)
      void paint(clamped)
      syncAudio(clamped, false)
    },
    [paint, syncAudio],
  )

  const frameStep = React.useCallback(
    (dir: 1 | -1) => {
      const frame = 1 / storeRef.current.project.fps
      seek(storeRef.current.playhead + dir * frame)
    },
    [seek],
  )

  return {
    canvasRef,
    isPlaying,
    masterVolume,
    setMasterVolume: setMasterVolumeState,
    muted,
    toggleMuted: () => setMuted((m) => !m),
    toggle,
    seek,
    frameStep,
    stopPlayback,
  }
}

export type PlaybackApi = ReturnType<typeof usePlayback>