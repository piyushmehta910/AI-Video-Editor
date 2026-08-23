import * as React from 'react'
import { Film, Maximize, Pause, Play } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Center preview: responsive canvas at the project aspect ratio (16:9 by
 * default), black when empty. Click toggles play/pause; double-click enters
 * fullscreen; timecode sits bottom-left, resolution bottom-right.
 */
export function PreviewCanvas({
  playback,
  onOpenMedia,
}: {
  playback: PlaybackApi
  onOpenMedia?: () => void
}) {
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)
  const duration = useTimelineStore((s) => s.duration())
  const containerRef = React.useRef<HTMLDivElement>(null)
  const areaRef = React.useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [canvasCssSize, setCanvasCssSize] = React.useState<{ w: number; h: number } | null>(null)

  React.useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // Fit the project-aspect stage inside the available area.
  React.useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const compute = () => {
      const rect = el.getBoundingClientRect()
      const availW = rect.width - 24
      const availH = rect.height - 24
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
    const el = containerRef.current
    if (!document.fullscreenElement) void el?.requestFullscreen?.().catch(() => undefined)
    else void document.exitFullscreen?.()
  }

  const empty = duration === 0

  return (
    <div
      ref={containerRef}
      className={cn('relative flex min-h-0 flex-1 flex-col bg-black', fullscreen && 'max-h-none')}
      style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #14141b 100%)' }}
      onClick={() => {
        if (!empty) playback.toggle()
      }}
      onDoubleClick={() => {
        if (!empty) toggleFullscreen()
      }}
      data-testid="preview-canvas"
    >
      <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
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

        {/* Empty state */}
        {empty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm text-white/80">
              Nothing on the timeline yet
            </p>
            {onOpenMedia && (
              <Button
                variant="secondary"
                className="gap-2 bg-white/90 text-black hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenMedia()
                }}
              >
                <Film className="size-4" />
                Add media
              </Button>
            )}
          </div>
        )}

        {/* Centered large play/pause overlay */}
        {!empty && !playback.isPlaying && (
          <button
            type="button"
            aria-label="Play"
            className="pointer-events-none absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform active:scale-95"
          >
            <Play className="ml-1 size-9" />
          </button>
        )}
      </div>

      {/* Overlays */}
      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-white/80">
        {formatSeconds(playhead)} / {formatSeconds(duration)}
      </div>
      <div className="pointer-events-none absolute right-3 bottom-2 font-mono text-[11px] text-white/60">
        {project.width}×{project.height}
      </div>
      {!fullscreen && (
        <button
          type="button"
          aria-label="Fullscreen"
          title="Fullscreen (double-click)"
          className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-md bg-black/50 text-white/70 backdrop-blur hover:text-white"
          onClick={(e) => {
            e.stopPropagation()
            toggleFullscreen()
          }}
        >
          <Maximize className="size-3.5" />
        </button>
      )}
      {!empty && playback.isPlaying && (
        <button
          type="button"
          aria-label="Pause"
          className="absolute top-2 left-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white/80 opacity-0 backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <Pause className="size-4" />
        </button>
      )}
    </div>
  )
}
