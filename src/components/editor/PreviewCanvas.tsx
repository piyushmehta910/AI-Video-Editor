import * as React from 'react'
import {
  Film,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Scan,
  Repeat,
} from 'lucide-react'
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
  const [isLooping, setIsLooping] = React.useState(false)
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
      const availH = rect.height - 48
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
      className={cn('relative flex min-h-0 flex-1 flex-col bg-black select-none', fullscreen && 'max-h-none')}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #151522 0%, #09090e 100%)' }}
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
              'relative rounded-2xl border border-white/15 bg-black shadow-[0_20px_60px_0_rgba(0,0,0,0.8)] overflow-hidden transition-all',
              fullscreen && 'rounded-none border-transparent shadow-none',
              isDragOver && 'ring-2 ring-violet-500 bg-violet-950/20 scale-[1.01]',
            )}
            style={{ width: canvasCssSize.w, height: canvasCssSize.h }}
            onClick={() => {
              if (!empty) playback.toggle()
            }}
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
          <div className="pointer-events-none absolute inset-4 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-violet-400 bg-violet-950/70 backdrop-blur-md">
            <p className="font-bold text-sm text-violet-200">Drop media here to place directly on Canvas & Timeline</p>
          </div>
        )}

        {/* Empty state */}
        {empty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-black/60 px-6 py-4 text-center backdrop-blur-md shadow-2xl">
              <Film className="size-8 text-violet-400 opacity-80" />
              <p className="text-sm font-bold text-white">Timeline is Empty</p>
              <p className="text-xs text-white/60 max-w-xs">Drag and drop media files or click below to import and start editing</p>
              {onOpenMedia && (
                <Button
                  size="sm"
                  className="mt-2 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-white hover:from-violet-500 hover:to-indigo-500 shadow-md"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenMedia()
                  }}
                >
                  <Film className="size-3.5" />
                  Browse Media Bin
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Centered subtle play icon when paused */}
        {!empty && !playback.isPlaying && (
          <button
            type="button"
            aria-label="Play"
            onClick={(e) => {
              e.stopPropagation()
              playback.toggle()
            }}
            className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20 shadow-2xl transition-all hover:scale-110 active:scale-95 z-20"
          >
            <Play className="ml-1 size-7 fill-white text-white" />
          </button>
        )}
      </div>

      {/* Floating Glassmorphic Transport Controls Capsule */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-white/10 bg-black/40 backdrop-blur-xl">
        {/* Left: Timecode */}
        <div className="flex items-center gap-2 font-mono text-[11px] text-white/90">
          <span className="font-bold text-violet-400 bg-violet-500/15 px-2 py-0.5 rounded-md border border-violet-500/30">
            {formatSeconds(playhead)}
          </span>
          <span className="text-white/40">/</span>
          <span className="text-white/70 font-semibold">{formatSeconds(duration)}</span>
        </div>

        {/* Center: Playback Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Seek back 5s"
            title="Rewind 5s (J)"
            disabled={empty}
            className="flex size-7 items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
            onClick={() => useTimelineStore.getState().setPlayhead(Math.max(0, playhead - 5))}
          >
            <RotateCcw className="size-3.5" />
          </button>

          <button
            type="button"
            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
            title={playback.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            disabled={empty}
            className="flex size-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/30 hover:bg-violet-500 transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            onClick={() => playback.toggle()}
          >
            {playback.isPlaying ? (
              <Pause className="size-4 fill-white" />
            ) : (
              <Play className="ml-0.5 size-4 fill-white" />
            )}
          </button>

          <button
            type="button"
            aria-label="Seek forward 5s"
            title="Fast forward 5s (L)"
            disabled={empty}
            className="flex size-7 items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
            onClick={() => useTimelineStore.getState().setPlayhead(Math.min(duration, playhead + 5))}
          >
            <RotateCw className="size-3.5" />
          </button>

          <button
            type="button"
            aria-label="Loop playback"
            title={isLooping ? 'Looping active' : 'Toggle loop'}
            className={cn(
              'flex size-7 items-center justify-center rounded-lg transition',
              isLooping ? 'bg-violet-500/30 text-violet-300 border border-violet-500/40' : 'bg-white/5 text-white/70 hover:bg-white/15 hover:text-white',
            )}
            onClick={() => setIsLooping((l) => !l)}
          >
            <Repeat className="size-3.5" />
          </button>
        </div>

        {/* Right: Tools & Fullscreen */}
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline font-mono text-[10px] text-white/50 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
            {project.width}×{project.height}
          </span>

          <button
            type="button"
            aria-label="Toggle safe zones"
            title={showSafeZones ? 'Hide Safe Zones' : 'Show Safe Zones (9:16 / 16:9)'}
            className={cn(
              'flex size-7 items-center justify-center rounded-lg transition',
              showSafeZones ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-white/70 hover:bg-white/15 hover:text-white',
            )}
            onClick={() => setShowSafeZones((s) => !s)}
          >
            <Scan className="size-3.5" />
          </button>

          <button
            type="button"
            aria-label={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            title={fullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen (Double-click)'}
            className="flex size-7 items-center justify-center rounded-lg bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition"
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

