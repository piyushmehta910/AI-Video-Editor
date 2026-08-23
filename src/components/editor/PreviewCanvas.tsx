import * as React from 'react'
import { Film, Maximize, Pause, Play, Scan, Move } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { formatSeconds, type Clip } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Center preview: responsive canvas at the project aspect ratio (16:9 by
 * default), black when empty. Supports interactive on-canvas positioning,
 * transform bounding box, quick-placement alignment dock, and drag & drop.
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
  const selectedClipIds = useTimelineStore((s) => s.selection.clipIds)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const areaRef = React.useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [showSafeZones, setShowSafeZones] = React.useState(false)
  const [canvasCssSize, setCanvasCssSize] = React.useState<{ w: number; h: number } | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  // Drag-to-place state
  const [isDraggingClip, setIsDraggingClip] = React.useState(false)
  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; initialPos: { x: number; y: number } } | null>(null)

  // Selected active clip
  const selectedClip: Clip | null = React.useMemo(() => {
    if (!selectedClipIds.length) return null
    for (const t of project.tracks) {
      const found = t.clips.find((c) => c.id === selectedClipIds[0])
      if (found) return found
    }
    return null
  }, [project.tracks, selectedClipIds])

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

  // Pointer event handlers for On-Canvas Drag-to-Place
  const handlePointerDownTransform = (e: React.PointerEvent) => {
    if (!selectedClip || !canvasCssSize) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setIsDraggingClip(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialPos: { x: selectedClip.position?.x ?? 0, y: selectedClip.position?.y ?? 0 },
    }
  }

  const handlePointerMoveTransform = (e: React.PointerEvent) => {
    if (!isDraggingClip || !dragStartRef.current || !selectedClip || !canvasCssSize) return
    e.stopPropagation()

    // Scale pixel movement to project coordinates
    const scaleFactorX = project.width / canvasCssSize.w
    const scaleFactorY = project.height / canvasCssSize.h
    const deltaX = (e.clientX - dragStartRef.current.mouseX) * scaleFactorX
    const deltaY = (e.clientY - dragStartRef.current.mouseY) * scaleFactorY

    const newX = Math.round(dragStartRef.current.initialPos.x + deltaX)
    const newY = Math.round(dragStartRef.current.initialPos.y + deltaY)

    updateClip(selectedClip.id, { position: { x: newX, y: newY } })
  }

  const handlePointerUpTransform = (e: React.PointerEvent) => {
    if (isDraggingClip) {
      e.stopPropagation()
      setIsDraggingClip(false)
      dragStartRef.current = null
    }
  }

  // Quick Alignment Presets
  const applyAlignment = (preset: 'center' | 'top-left' | 'top-right' | 'bottom-center' | 'pip' | 'fill' | 'reset') => {
    if (!selectedClip) return
    const pw = project.width
    const ph = project.height

    switch (preset) {
      case 'center':
        updateClip(selectedClip.id, { position: { x: 0, y: 0 } })
        break
      case 'top-left':
        updateClip(selectedClip.id, { position: { x: -pw * 0.25, y: -ph * 0.25 } })
        break
      case 'top-right':
        updateClip(selectedClip.id, { position: { x: pw * 0.25, y: -ph * 0.25 } })
        break
      case 'bottom-center':
        updateClip(selectedClip.id, { position: { x: 0, y: ph * 0.3 } })
        break
      case 'pip':
        updateClip(selectedClip.id, { position: { x: pw * 0.3, y: ph * 0.28 }, scale: { x: 0.38, y: 0.38 } })
        break
      case 'fill':
        updateClip(selectedClip.id, { position: { x: 0, y: 0 }, scale: { x: 1.0, y: 1.0 } })
        break
      case 'reset':
        updateClip(selectedClip.id, { position: { x: 0, y: 0 }, scale: { x: 1.0, y: 1.0 }, rotation: 0 })
        break
    }
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

  // Calculate transform overlay box coordinates on screen
  const getTransformBoxStyle = () => {
    if (!selectedClip || !canvasCssSize) return null
    const posX = selectedClip.position?.x ?? 0
    const posY = selectedClip.position?.y ?? 0
    const scaleX = selectedClip.scale?.x ?? 1
    const scaleY = selectedClip.scale?.y ?? 1
    const rot = selectedClip.rotation ?? 0

    // Canvas CSS scale
    const scaleToCssX = canvasCssSize.w / project.width
    const scaleToCssY = canvasCssSize.h / project.height

    const cssCenterX = canvasCssSize.w / 2 + posX * scaleToCssX
    const cssCenterY = canvasCssSize.h / 2 + posY * scaleToCssY
    const cssBoxW = Math.max(40, canvasCssSize.w * scaleX * 0.7)
    const cssBoxH = Math.max(30, canvasCssSize.h * scaleY * 0.7)

    return {
      left: `${cssCenterX - cssBoxW / 2}px`,
      top: `${cssCenterY - cssBoxH / 2}px`,
      width: `${cssBoxW}px`,
      height: `${cssBoxH}px`,
      transform: `rotate(${rot}deg)`,
    }
  }

  const transformStyle = getTransformBoxStyle()

  return (
    <div
      ref={containerRef}
      className={cn('relative flex min-h-0 flex-1 flex-col bg-black', fullscreen && 'max-h-none')}
      style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #14141b 100%)' }}
      onClick={() => {
        if (!empty && !isDraggingClip) playback.toggle()
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
      {/* ── Quick Placement Dock (Floating above canvas) ── */}
      {selectedClip && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full border border-violet-500/30 bg-black/80 px-2.5 py-1 backdrop-blur-md shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold text-violet-300 mr-1 flex items-center gap-1">
            <Move className="size-3" /> Place:
          </span>
          {[
            { id: 'top-left' as const, label: '↖ Top-L' },
            { id: 'center' as const, label: '⏺ Center' },
            { id: 'top-right' as const, label: '↗ Top-R' },
            { id: 'bottom-center' as const, label: '⬇ Lower-3rd' },
            { id: 'pip' as const, label: '🔲 PIP Corner' },
            { id: 'fill' as const, label: '⬛ Fill' },
            { id: 'reset' as const, label: '🔄 Reset' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              className="rounded px-1.5 py-0.5 text-[9px] font-medium text-white/80 hover:bg-violet-600/40 hover:text-white transition"
              onClick={() => applyAlignment(btn.id)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

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

            {/* ── Interactive On-Canvas Drag-to-Place Box ── */}
            {selectedClip && transformStyle && (
              <div
                className={cn(
                  'absolute z-25 cursor-move rounded-sm border-2 border-violet-500 bg-violet-500/10 transition-shadow',
                  isDraggingClip ? 'shadow-2xl shadow-violet-500/50 border-violet-400 ring-2 ring-violet-400/40' : 'hover:border-violet-400',
                )}
                style={transformStyle}
                onPointerDown={handlePointerDownTransform}
                onPointerMove={handlePointerMoveTransform}
                onPointerUp={handlePointerUpTransform}
                onPointerCancel={handlePointerUpTransform}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 4 Corner Scale Handles */}
                <div className="absolute -top-1.5 -left-1.5 size-3 rounded-full border border-white bg-violet-600" />
                <div className="absolute -top-1.5 -right-1.5 size-3 rounded-full border border-white bg-violet-600" />
                <div className="absolute -bottom-1.5 -left-1.5 size-3 rounded-full border border-white bg-violet-600" />
                <div className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full border border-white bg-violet-600" />

                {/* Center Move Indicator */}
                <div className="absolute inset-0 m-auto size-5 flex items-center justify-center rounded-full bg-violet-600/80 text-white pointer-events-none">
                  <Move className="size-3" />
                </div>

                {/* Coordinate Tag */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded bg-black/80 px-1 font-mono text-[8px] text-white/90 whitespace-nowrap pointer-events-none">
                  X: {selectedClip.position?.x ?? 0} · Y: {selectedClip.position?.y ?? 0}
                </div>
              </div>
            )}

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

