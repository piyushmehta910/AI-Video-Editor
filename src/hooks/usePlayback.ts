import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import { readMediaFile } from '@/engine/storage/opfs'
import { compositeFrame } from '@/engine/render/composite'
import { makeCaptionsProvider } from '@/engine/captions/render'
import { assetTimeAt, topmostVideoClip } from '@/engine/captions/captions'
import { wrapSourceTime } from '@/engine/media/sourceTime'
import type { Asset, Clip, Project, Track } from '@/engine/types'
import { defaultCameraRig } from '@/engine/types'
import { isExportActive } from '@/engine/export/exportSession'

interface ElementRef {
  clipId: string | null
  element: HTMLVideoElement | HTMLAudioElement
  assetId: string
}

/**
 * Preview-time ducking: a clip with `duckUnderTrackId` plays at reduced volume
 * while any clip on the trigger track is active (mirrors export mixing).
 */
function duckFactor(project: Project, clip: Clip, time: number): number {
  if (!clip.duckUnderTrackId) return 1
  const track = project.tracks.find((t) => t.id === clip.duckUnderTrackId)
  if (!track) return 1
  const triggered = track.clips.some(
    (c) => c.id !== clip.id && time >= c.startTime && time < c.startTime + c.duration,
  )
  return triggered ? 0.2 : 1
}

export function usePlayback() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const videoPool = React.useRef<ElementRef[]>([])
  const audioPool = React.useRef<ElementRef[]>([])
  const imageCache = React.useRef<Map<string, HTMLImageElement>>(new Map())
  const urlCache = React.useRef<Map<string, string>>(new Map())
  const poolHostRef = React.useRef<HTMLDivElement | null>(null)

  // Chrome does not load or play media on <video>/<audio> elements that are not
  // in the document, so pooled elements must be attached. They must stay fully
  // opaque, in-viewport and at least 2px — Chrome stops presenting updated
  // frames to drawImage() for display:none, opacity:0, offscreen or 1px elements.
  const ensurePoolHost = () => {
    if (!poolHostRef.current) {
      const host = document.createElement('div')
      host.setAttribute('aria-hidden', 'true')
      document.body.appendChild(host)
      poolHostRef.current = host
    }
    return poolHostRef.current
  }

  const stylePooledElement = (el: HTMLVideoElement | HTMLAudioElement) => {
    el.style.cssText =
      'position:fixed;left:0;top:0;width:2px;height:2px;opacity:1;pointer-events:none;z-index:-1000'
    return el
  }

  const [isPlaying, setIsPlaying] = React.useState(false)
  const [masterVolume, setMasterVolumeState] = React.useState(1)
  const [muted, setMuted] = React.useState(false)
  const [speed, setSpeedState] = React.useState(1)

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
  const speedRef = React.useRef(1)
  const playingRef = React.useRef(false)
React.useEffect(() => {
  speedRef.current = speed
}, [speed])

React.useEffect(() => {
  playingRef.current = isPlaying
}, [isPlaying])

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

  const getProxyUrl = React.useCallback(async (asset: Asset): Promise<string> => {
    if (!asset.proxyPath) return getAssetUrl(asset)
    const cacheKey = `${asset.id}:proxy`
    const cached = urlCache.current.get(cacheKey)
    if (cached) return cached
    try {
      const root = await (navigator.storage as any).getDirectory()
      const dir = await root.getDirectoryHandle('clipforge-media')
      const assetDir = await dir.getDirectoryHandle(asset.id)
      const fileHandle = await assetDir.getFileHandle('proxy.webm')
      const file = await fileHandle.getFile()
      const url = URL.createObjectURL(file)
      urlCache.current.set(cacheKey, url)
      return url
    } catch {
      return getAssetUrl(asset)
    }
  }, [getAssetUrl])

  const acquireVideo = React.useCallback(
    (asset: Asset): HTMLVideoElement => {
      const existing = videoPool.current.find((r) => r.assetId === asset.id)
      if (existing) return existing.element as HTMLVideoElement
      const el = document.createElement('video')
      el.preload = 'auto'
      el.muted = true
      el.crossOrigin = 'anonymous'
      el.playsInline = true
      // Short sources (sticker/GIF clips, stretched clips) loop natively while
      // playing; the paint provider wraps seek targets to stay in sync.
      el.loop = true
      el.addEventListener('loadedmetadata', requestPaint)
      el.addEventListener('loadeddata', requestPaint)
      el.addEventListener('canplay', requestPaint)
      el.addEventListener('seeked', requestPaint)
      el.addEventListener('playing', requestPaint)
      void getProxyUrl(asset).then((url) => {
        el.src = url
      })
      ensurePoolHost().appendChild(stylePooledElement(el))
      videoPool.current.push({ clipId: null, element: el, assetId: asset.id })
      return el
    },
    [getProxyUrl, requestPaint],
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
      ensurePoolHost().appendChild(stylePooledElement(el))
      audioPool.current.push({ clipId: null, element: el, assetId: asset.id })
      return el
    },
    [getAssetUrl],
  )

  const loadImage = React.useCallback(
    (asset: Asset): Promise<HTMLImageElement> => {
      const cached = imageCache.current.get(asset.id)
      if (cached && cached.complete && cached.naturalWidth > 0) return Promise.resolve(cached)
      return new Promise((resolve, reject) => {
        void getAssetUrl(asset).then((url) => {
          const img = new Image()
          img.onload = () => {
            imageCache.current.set(asset.id, img)
            resolve(img)
          }
          img.onerror = () => reject(new Error(`Failed to load image: ${asset.id}`))
          img.src = url
        })
      })
    },
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
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { project, assets } = storeRef.current
      if (canvas.width !== project.width || canvas.height !== project.height) {
        canvas.width = project.width
        canvas.height = project.height
      }
      await compositeFrame(ctx, project, assets, time, {
        video: async (clip, asset, srcTime) => {
          const el = acquireVideo(asset)
          // Loop short sources when the clip runs past their end (stickers).
          const elTime = wrapSourceTime(srcTime, asset.duration ?? el.duration)
          // While playing at 1x we let the element free-run and just drawImage
          // each frame; writing currentTime every frame freezes Chrome's frame
          // presentation. Only seek when paused or when the element drifts.
           const freeRun = playingRef.current && clip.speed === 1 && speedRef.current === 1
           const tolerance = freeRun ? 0.25 : 0.06
           if (el.readyState >= 1) {
             // Adjust playbackRate for non-1x speeds when playing
             if (playingRef.current && speedRef.current !== 1) {
               el.playbackRate = Math.min(4, Math.max(0.25, Math.abs(speedRef.current)));
             }
             if (Math.abs(el.currentTime - elTime) > tolerance) el.currentTime = elTime;
           }
           if (el.videoWidth > 0) return el
          return null
        },
        image: (asset) => loadImage(asset),
        thumbnail: (asset) => loadThumbnail(asset),
        model: async (clip, asset, time, size) => {
          const { renderModelFrame } = await import('@/engine/three/modelRenderer')
          return renderModelFrame({
            asset,
            rig: clip.modelRig ?? defaultCameraRig(),
            time,
            clipStart: clip.startTime,
            clipDuration: clip.duration,
            width: size.width,
            height: size.height,
          })
        },
        captions: makeCaptionsProvider(project),
      })

      // Preview-only overlay: draw detected protected regions so the user can
      // see what the captions layer is avoiding.
      const captionsCfg = project.captions
      if (captionsCfg?.showProtectedRegions) {
        const active = topmostVideoClip(project, assets, time)
        if (active) {
          const assetTime = assetTimeAt(active.clip, time)
          const regions = storeRef.current.ocr[active.asset.id]?.regions ?? []
          ctx.font = '11px monospace'
          for (const r of regions) {
            if (assetTime < r.start || assetTime > r.end) continue
            const x = r.x * project.width
            const y = r.y * project.height
            const bw = r.w * project.width
            const bh = r.h * project.height
            ctx.strokeStyle = 'rgba(255,70,70,0.9)'
            ctx.lineWidth = 2
            ctx.strokeRect(x, y, bw, bh)
            ctx.fillStyle = 'rgba(255,70,70,0.9)'
            ctx.fillText(r.text.slice(0, 40), x + 2, Math.max(12, y - 4))
          }
        }
      }
    },
    [acquireVideo, loadImage, loadThumbnail],
  )

  const syncAudio = React.useCallback(
    (time: number, playing: boolean) => {
      const { project } = storeRef.current
      const { audio } = activeClipsAt(time)
      const anySolo = project.tracks.some((t) => t.type === 'audio' && t.soloed)
      const soloGain = (track: Track) => (anySolo ? (track.soloed ? 1 : 0) : 1)

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
        if (Math.abs(el.currentTime - srcTime) > (playing ? 0.25 : 0.08)) el.currentTime = srcTime
        const vol =
          active.clip.volume *
          (active.clip.muted ? 0 : 1) *
          (active.track.muted ? 0 : 1) *
          soloGain(active.track) *
          masterVolume *
          (muted ? 0 : 1) *
          duckFactor(storeRef.current.project, active.clip, time)
        el.volume = Math.min(1, Math.max(0, vol))
        if (active.clip.speed !== 1 && 'preservesPitch' in el) {
          ;(el as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = active.clip.preservePitch !== false
        }
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
            // Adjust playbackRate for non-1x speeds when playing
            if (playing && speedRef.current !== 1) {
              el.playbackRate = Math.min(4, Math.max(0.25, Math.abs(speedRef.current)));
            }
            const freeRun = playing && active.clip.speed === 1 && speedRef.current === 1
            if (freeRun) {
              // Let the element play; only resync on significant drift.
              if (Math.abs(el.currentTime - srcTime) > 0.25) el.currentTime = srcTime
            } else if (Math.abs(el.currentTime - srcTime) > 0.08) {
              el.currentTime = srcTime
            }
        const vol =
          active.clip.volume *
          (active.clip.muted ? 0 : 1) *
          (active.track.muted ? 0 : 1) *
          soloGain(active.track) *
          masterVolume *
          (muted ? 0 : 1) *
          duckFactor(storeRef.current.project, active.clip, time)
        el.volume = Math.min(1, Math.max(0, vol))
        el.muted = vol <= 0
        if (active.clip.speed !== 1 && 'preservesPitch' in el) {
          ;(el as HTMLVideoElement & { preservesPitch: boolean }).preservesPitch = active.clip.preservePitch !== false
        }
        if (freeRun && vol > 0 && el.paused) {
          void el.play().catch(() => undefined)
        } else if ((!freeRun || !playing || vol === 0) && !el.paused) {
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
      if (isExportActive()) {
        if (isPlaying) setIsPlaying(false)
        return
      }
      if (isPlaying) {
        const duration = state.duration()
        if (duration <= 0) {
          setIsPlaying(false)
          storeRef.current.setPlayhead(0)
          time = 0
        } else {
          const elapsed = ((performance.now() - clock.current.startAt) / 1000) * speedRef.current
          time = clock.current.base + elapsed
          if (time >= duration) {
            // Reached the end of the video! Clamp at exact duration and pause cleanly
            time = duration
            setIsPlaying(false)
            storeRef.current.setPlayhead(duration)
          } else if (time < 0) {
            time = 0
            setIsPlaying(false)
            storeRef.current.setPlayhead(0)
          } else {
            storeRef.current.setPlayhead(time)
          }
        }
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
    const dur = storeRef.current.duration()
    if (dur <= 0) return
    let currentPlayhead = storeRef.current.playhead
    // If at or very close to the end, restart from beginning
    if (currentPlayhead >= dur - 0.05) {
      currentPlayhead = 0
      storeRef.current.setPlayhead(0)
    }
    clock.current = { base: currentPlayhead, startAt: performance.now() }
    setIsPlaying(true)
  }, [])

  const stopPlayback = React.useCallback(() => {
    setIsPlaying(false)
  }, [])

  const setSpeed = (newSpeed: number) => {
    const clamped = Math.max(-8, Math.min(8, newSpeed))
    setSpeedState(clamped)
    speedRef.current = clamped
    // Rebase clock when speed changes to prevent jumping
    clock.current = { base: storeRef.current.playhead, startAt: performance.now() }
  }

  const toggle = React.useCallback(() => {
    if (isPlaying) stopPlayback()
    else startPlayback()
  }, [isPlaying, startPlayback, stopPlayback])

  const seek = React.useCallback(
    (time: number) => {
      const dur = storeRef.current.duration()
      const clamped = dur > 0 ? Math.max(0, Math.min(time, dur)) : 0
      storeRef.current.setPlayhead(clamped)
      clock.current = { base: clamped, startAt: performance.now() }
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
    speed,
    setSpeed,
    stopPlayback,
  }
}

export type PlaybackApi = ReturnType<typeof usePlayback>