import * as React from 'react'
import { Captions, Film, Maximize, Pause, Play, SkipBack, SkipForward, StepBack, StepForward, Volume2, VolumeX } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export function Preview({ playback, onOpenMedia }: { playback: PlaybackApi; onOpenMedia?: () => void }) {
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)
  const duration = useTimelineStore((s) => s.duration())
  const captionsEnabled = useTimelineStore((s) => s.project.captions?.enabled ?? false)
  const setCaptions = useTimelineStore((s) => s.setCaptions)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const previewAreaRef = React.useRef<HTMLDivElement>(null)
  const hideTimer = React.useRef<number | undefined>(undefined)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const [controlsVisible, setControlsVisible] = React.useState(true)
  const [canvasCssSize, setCanvasCssSize] = React.useState<{ w: number; h: number } | null>(null)

  const revealControls = React.useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  React.useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement)
      setFullscreen(isFs)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      setControlsVisible(true)
      if (isFs) revealControls()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [revealControls])

  React.useEffect(() => {
    const el = previewAreaRef.current
    if (!el) return
    const compute = () => {
      const rect = el.getBoundingClientRect()
      const availW = rect.width - 32
      const availH = rect.height - 32
      if (availW <= 0 || availH <= 0) return
      const aspect = project.width / project.height
      let w: number, h: number
      if (availW / availH >= aspect) {
        h = availH
        w = Math.round(h * aspect)
      } else {
        w = availW
        h = Math.round(w / aspect)
      }
      setCanvasCssSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [project.width, project.height])

  const toggleFullscreen = () => {
    const el = containerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null
    if (!document.fullscreenElement) {
      if (el?.requestFullscreen) {
        void el.requestFullscreen().catch(() => {
          el.webkitRequestFullscreen?.()
          setFullscreen(true)
        })
      } else {
        el?.webkitRequestFullscreen?.()
        setFullscreen(true)
      }
    } else {
      void document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  const scrub = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    playback.seek(ratio * (duration || 1))
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative flex min-h-0 flex-1 flex-col bg-black', fullscreen && 'max-h-none')}
      style={{ background: 'linear-gradient(180deg, #0b0b10 0%, #14141b 100%)' }}
      onPointerMove={fullscreen ? revealControls : undefined}
    >
      <div ref={previewAreaRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {canvasCssSize && (
          <div
            className={cn(
              'relative rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/60',
              fullscreen && 'rounded-none border-transparent shadow-none',
            )}
            style={{ width: canvasCssSize.w, height: canvasCssSize.h }}
          >
            <canvas ref={playback.canvasRef} className="block size-full" />
          </div>
        )}

        {!fullscreen && (
          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
            <span className="size-1.5 rounded-full bg-violet-400" />
            {project.width}×{project.height} · {project.fps} fps
          </div>
        )}

        {duration === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm text-white/80">
              Add media to your timeline to see the preview
            </p>
            {onOpenMedia && (
              <Button
                variant="secondary"
                className="gap-2 bg-white/90 text-black hover:bg-white"
                onClick={onOpenMedia}
              >
                <Film className="size-4" />
                Add media
              </Button>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          'flex flex-col gap-1.5 px-4 pb-3 transition-opacity duration-300',
          fullscreen && 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pb-2 pt-8',
          fullscreen && !controlsVisible && 'pointer-events-none opacity-0',
        )}
      >
        <div
          className="relative h-4 cursor-pointer"
          onPointerDown={(e) => {
            setDragging(true)
            scrub(e.clientX)
          }}
          onPointerMove={(e) => {
            if (dragging) scrub(e.clientX)
          }}
          onPointerUp={() => setDragging(false)}
          onPointerLeave={() => setDragging(false)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-violet-500"
            style={{ width: `${Math.min(100, (playhead / (duration || 1)) * 100)}%` }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `${Math.min(100, (playhead / (duration || 1)) * 100)}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.seek(0)} title="Go to start">
            <SkipBack className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.frameStep(-1)} title="Previous frame">
            <StepBack className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 text-white hover:bg-white/10 hover:text-white"
            onClick={playback.toggle}
            title="Play / pause (Space)"
          >
            {playback.isPlaying ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.frameStep(1)} title="Next frame">
            <StepForward className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.seek(duration)} title="Go to end">
            <SkipForward className="size-4" />
          </Button>

          <span className="ml-2 font-mono text-xs text-white/80">
            {formatSeconds(playhead)} / {formatSeconds(duration)}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-8 hover:bg-white/10 hover:text-white', captionsEnabled ? 'text-violet-400' : 'text-white/60')}
              onClick={() => setCaptions({ enabled: !captionsEnabled })}
              title="Toggle captions"
            >
              <Captions className="size-4" />
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={playback.toggleMuted}
                title="Mute"
              >
                {playback.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </Button>
              <Slider
                className="w-24"
                min={0}
                max={1}
                step={0.01}
                value={[playback.masterVolume]}
                onValueChange={([v]) => playback.setMasterVolume(v)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={toggleFullscreen}
              title="Fullscreen (F)"
            >
              <Maximize className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}