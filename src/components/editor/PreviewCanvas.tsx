import * as React from 'react'
import { Film, Maximize, Pause, Play, Scan } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Center preview: responsive canvas at the project aspect ratio (16:9 by
 * default), black when empty.
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
  const updateClip = useTimelineStore((s) => s.updateClip)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const areaRef = React.useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [showSafeZones, setShowSafeZones] = React.useState(false)
  const [canvasCssSize, setCanvasCssSize] = React.useState<{ w: number; h: number } | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

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

  // Handle Drag & Drop Files onto Canvas
  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return

    const { imported } = await importFiles(files)
    if (imported.length) {
      const videoTrack = project.tracks.find((t) => t.type === 'video')
      const audioTrack = project.tracks.find((t) => t.type === 'audio')

      for (const asset of imported) {
        const targetTrack = asset.type === 'audio' ? audioTrack : videoTrack
        if (targetTrack) {
          const newClip = addClip(asset.id, targetTrack.id, playhead)
          if (newClip) updateClip(newClip.id, { position: { x: 0, y: 0 } })
        }
      }
    }
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
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => void handleDropFiles(e)}
      data-testid="preview-canvas"
    >
      <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        {canvasCssSize && (
          <div
            className={cn(
              'relative rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/60 overflow-hidden',
              fullscreen && 'rounded-none border-transparent shadow-none',
              isDragOver && 'ring-2 ring-violet-500 bg-violet-950/20',
            )}
            style={{ width: canvasCssSize.w, height: canvasCssSize.h }}
          >
            <canvas ref={playback.canvasRef} className="block size-full" />

            {/* Safe Zone Guides Overlay */}
            {showSafeZones && (
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                {project.aspectRatio === '9:16' || project.width < project.height ? (
                  <>
                    <div className="absolute top-0 inset-x-0 h-[12%] border-b border-dashed border-cyan-400/50 bg-cyan-500/5">
                      <span className="absolute bottom-1 left-2 font-mono text-[9px] text-cyan-300/80">Top Safe Area</span>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 h-[22%] border-t border-dashed border-cyan-400/50 bg-cyan-500/5">
                      <span className="absolute top-1 left-2 font-mono text-[9px] text-cyan-300/80">Captions / Sound Area</span>
                    </div>
                    <div className="absolute top-[12%] bottom-[22%] right-0 w-[18%] border-l border-dashed border-amber-400/50 bg-amber-500/5">
                      <span className="absolute top-1 left-1 font-mono text-[8px] text-amber-300/80">Actions Area</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="size-8 border-t border-b border-white/20" />
                      <div className="size-8 border-l border-r border-white/20 -ml-8" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-[5%] border border-dashed border-cyan-400/40">
                      <span className="absolute top-0.5 left-1 font-mono text-[9px] text-cyan-300/70">Action Safe (90%)</span>
                    </div>
                    <div className="absolute inset-[10%] border border-dashed border-amber-400/40">
                      <span className="absolute top-0.5 left-1 font-mono text-[9px] text-amber-300/70">Title Safe (80%)</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="size-10 border-t border-b border-white/20" />
                      <div className="size-10 border-l border-r border-white/20 -ml-10" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Drag over notice */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-4 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-violet-400 bg-violet-950/60 backdrop-blur-sm">
            <p className="font-semibold text-sm text-violet-200">Drop media here to place directly on Canvas & Timeline</p>
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

      {/* Top right toolbar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Toggle safe zones"
          title={showSafeZones ? 'Hide Safe Zones' : 'Show Safe Zones (9:16 / 16:9)'}
          className={cn(
            'flex size-7 items-center justify-center rounded-md backdrop-blur transition',
            showSafeZones ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40' : 'bg-black/50 text-white/70 hover:text-white',
          )}
          onClick={(e) => {
            e.stopPropagation()
            setShowSafeZones((s) => !s)
          }}
        >
          <Scan className="size-3.5" />
        </button>
        {!fullscreen && (
          <button
            type="button"
            aria-label="Fullscreen"
            title="Fullscreen (double-click)"
            className="flex size-7 items-center justify-center rounded-md bg-black/50 text-white/70 backdrop-blur hover:text-white"
            onClick={(e) => {
              e.stopPropagation()
              toggleFullscreen()
            }}
          >
            <Maximize className="size-3.5" />
          </button>
        )}
      </div>

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

