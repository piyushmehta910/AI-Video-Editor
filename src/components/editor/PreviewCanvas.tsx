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
  Undo2,
  Move,
  CircleDot,
  ArrowDownRight,
  ArrowDownLeft,
  ArrowUpRight,
  X,
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
  const selectedClipId = useTimelineStore((s) => s.selection.clipIds[0])
  const assets = useTimelineStore((s) => s.assets)
  const select = useTimelineStore((s) => s.select)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const areaRef = React.useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [showSafeZones, setShowSafeZones] = React.useState(false)
  const [isLooping, setIsLooping] = React.useState(false)
  const [canvasCssSize, setCanvasCssSize] = React.useState<{ w: number; h: number } | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  // Find the selected visual clip (if on a video/visual track)
  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null
    for (const t of project.tracks) {
      if (t.type === 'video') {
        const found = t.clips.find((c) => c.id === selectedClipId)
        if (found) return found
      }
    }
    return null
  }, [project.tracks, selectedClipId])

  // Dragging & resizing state
  const [dragState, setDragState] = React.useState<{
    isDragging: boolean
    isResizing: boolean
    corner?: 'nw' | 'ne' | 'se' | 'sw'
    startX: number
    startY: number
    startPosX: number
    startPosY: number
    startScaleX: number
    startScaleY: number
    boxW: number
    boxH: number
    centerX: number
    centerY: number
    currentPosX: number
    currentPosY: number
    currentScale: number
  } | null>(null)

  // Calculate on-canvas bounding box for selected clip
  const clipTransform = React.useMemo(() => {
    if (!selectedClip || !canvasCssSize) return null
    const asset = assets.find((a) => a.id === selectedClip.assetId)
    const scaleFactor = canvasCssSize.w / (project.width || 1920)
    const assetW = asset?.width || project.width || 1920
    const assetH = asset?.height || project.height || 1080

    let fitW = assetW
    let fitH = assetH
    if (selectedClip.fitMode === 'contain') {
      const s = Math.min((project.width || 1920) / assetW, (project.height || 1080) / assetH)
      fitW = assetW * s
      fitH = assetH * s
    } else if (selectedClip.fitMode === 'fill') {
      fitW = project.width || 1920
      fitH = project.height || 1080
    } else if (selectedClip.fitMode === 'none') {
      fitW = assetW
      fitH = assetH
    } else {
      // cover
      const s = Math.max((project.width || 1920) / assetW, (project.height || 1080) / assetH)
      fitW = assetW * s
      fitH = assetH * s
    }

    const currentScaleX = Math.abs(selectedClip.scale?.x ?? 1)
    const currentScaleY = Math.abs(selectedClip.scale?.y ?? 1)
    const boxW = Math.max(32, fitW * currentScaleX * scaleFactor)
    const boxH = Math.max(32, fitH * currentScaleY * scaleFactor)

    const posX = selectedClip.position?.x ?? 0
    const posY = selectedClip.position?.y ?? 0

    const centerX = canvasCssSize.w / 2 + posX * scaleFactor
    const centerY = canvasCssSize.h / 2 + posY * scaleFactor

    const left = centerX - boxW / 2
    const top = centerY - boxH / 2

    const isCircle = (selectedClip.border?.radius ?? 0) >= 100 || (selectedClip.clipType === 'avatar' && (selectedClip.border?.radius ?? 0) > 20)

    return {
      left,
      top,
      width: boxW,
      height: boxH,
      centerX,
      centerY,
      posX,
      posY,
      scale: currentScaleX,
      isCircle,
      scaleFactor,
    }
  }, [selectedClip, canvasCssSize, assets, project.width, project.height])

  // Drag handlers
  const handleBoxPointerDown = (e: React.PointerEvent) => {
    if (!selectedClip || !clipTransform) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragState({
      isDragging: true,
      isResizing: false,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: selectedClip.position?.x ?? 0,
      startPosY: selectedClip.position?.y ?? 0,
      startScaleX: selectedClip.scale?.x ?? 1,
      startScaleY: selectedClip.scale?.y ?? 1,
      boxW: clipTransform.width,
      boxH: clipTransform.height,
      centerX: clipTransform.centerX,
      centerY: clipTransform.centerY,
      currentPosX: selectedClip.position?.x ?? 0,
      currentPosY: selectedClip.position?.y ?? 0,
      currentScale: selectedClip.scale?.x ?? 1,
    })
  }

  const handleHandlePointerDown = (e: React.PointerEvent, corner: 'nw' | 'ne' | 'se' | 'sw') => {
    if (!selectedClip || !clipTransform) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragState({
      isDragging: false,
      isResizing: true,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: selectedClip.position?.x ?? 0,
      startPosY: selectedClip.position?.y ?? 0,
      startScaleX: selectedClip.scale?.x ?? 1,
      startScaleY: selectedClip.scale?.y ?? 1,
      boxW: clipTransform.width,
      boxH: clipTransform.height,
      centerX: clipTransform.centerX,
      centerY: clipTransform.centerY,
      currentPosX: selectedClip.position?.x ?? 0,
      currentPosY: selectedClip.position?.y ?? 0,
      currentScale: selectedClip.scale?.x ?? 1,
    })
  }

  const handleBoxPointerMove = (e: React.PointerEvent) => {
    if (!dragState || !selectedClip || !clipTransform) return
    e.stopPropagation()
    e.preventDefault()

    if (dragState.isDragging) {
      const dx = (e.clientX - dragState.startX) / clipTransform.scaleFactor
      const dy = (e.clientY - dragState.startY) / clipTransform.scaleFactor
      const nextX = Math.round(dragState.startPosX + dx)
      const nextY = Math.round(dragState.startPosY + dy)
      setDragState((s) => (s ? { ...s, currentPosX: nextX, currentPosY: nextY } : null))
      updateClip(selectedClip.id, { position: { x: nextX, y: nextY } })
    } else if (dragState.isResizing) {
      const origRadius = Math.hypot(dragState.boxW / 2, dragState.boxH / 2)
      const rect = playback.canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const currentMouseX = e.clientX - rect.left
      const currentMouseY = e.clientY - rect.top
      const currentDist = Math.hypot(currentMouseX - dragState.centerX, currentMouseY - dragState.centerY)
      const ratio = currentDist / Math.max(10, origRadius)
      const nextScale = Math.max(0.1, Math.min(3.5, parseFloat((dragState.startScaleX * ratio).toFixed(2))))
      setDragState((s) => (s ? { ...s, currentScale: nextScale } : null))
      updateClip(selectedClip.id, { scale: { x: nextScale, y: nextScale } })
    }
  }

  const handleBoxPointerUp = (e: React.PointerEvent) => {
    if (!dragState) return
    e.stopPropagation()
    e.preventDefault()
    setDragState(null)
  }

  // Quick Preset Alignments
  const applyPresetPlacement = (posPreset: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'circle-webcam') => {
    if (!selectedClip) return
    const w = project.width || 1920
    const h = project.height || 1080
    if (posPreset === 'center') {
      updateClip(selectedClip.id, { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 } })
    } else if (posPreset === 'circle-webcam' || posPreset === 'bottom-right') {
      updateClip(selectedClip.id, {
        position: { x: Math.round(w * 0.32), y: Math.round(h * 0.28) },
        scale: { x: 0.35, y: 0.35 },
        border: posPreset === 'circle-webcam' ? { width: 4, color: '#8b5cf6', radius: 9999 } : selectedClip.border,
        dropShadow: { offsetX: 0, offsetY: 8, blur: 24, color: 'rgba(0,0,0,0.6)' },
      })
    } else if (posPreset === 'bottom-left') {
      updateClip(selectedClip.id, {
        position: { x: Math.round(-w * 0.32), y: Math.round(h * 0.28) },
        scale: { x: 0.35, y: 0.35 },
        border: { width: 4, color: '#8b5cf6', radius: 9999 },
        dropShadow: { offsetX: 0, offsetY: 8, blur: 24, color: 'rgba(0,0,0,0.6)' },
      })
    } else if (posPreset === 'top-right') {
      updateClip(selectedClip.id, {
        position: { x: Math.round(w * 0.32), y: Math.round(-h * 0.28) },
        scale: { x: 0.35, y: 0.35 },
      })
    } else if (posPreset === 'top-left') {
      updateClip(selectedClip.id, {
        position: { x: Math.round(-w * 0.32), y: Math.round(-h * 0.28) },
        scale: { x: 0.35, y: 0.35 },
      })
    }
  }

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
      const aspect = (project.width || 1920) / (project.height || 1080)
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
              if (!empty && !dragState) playback.toggle()
            }}
          >
            <canvas ref={playback.canvasRef} className="block size-full" />

            {/* Interactive On-Canvas Selection & Drag/Transform Bounding Box */}
            {selectedClip && clipTransform && (
              <div
                style={{
                  position: 'absolute',
                  left: `${clipTransform.left}px`,
                  top: `${clipTransform.top}px`,
                  width: `${clipTransform.width}px`,
                  height: `${clipTransform.height}px`,
                  transform: `rotate(${selectedClip.rotation ?? 0}deg)`,
                }}
                className={cn(
                  'group/bbox z-30 touch-none select-none cursor-move transition-shadow',
                  clipTransform.isCircle
                    ? 'rounded-full border-2 border-violet-500 ring-2 ring-violet-400/40 shadow-lg shadow-violet-500/20'
                    : 'rounded-xl border-2 border-violet-500 ring-2 ring-violet-400/40 shadow-lg shadow-violet-500/20',
                  dragState?.isDragging ? 'border-dashed border-cyan-400 ring-cyan-400/50' : '',
                )}
                onPointerDown={handleBoxPointerDown}
                onPointerMove={handleBoxPointerMove}
                onPointerUp={handleBoxPointerUp}
                onClick={(e) => e.stopPropagation()}
                title="Drag to place anywhere on screen"
              >
                {/* Center Move Target Icon */}
                <div className="absolute inset-0 m-auto flex size-7 items-center justify-center rounded-full bg-violet-600/80 text-white shadow-md backdrop-blur-sm pointer-events-none opacity-80 group-hover/bbox:opacity-100 transition-opacity">
                  <Move className="size-3.5" />
                </div>

                {/* Corner Resize Handles */}
                <div
                  className="absolute -top-1.5 -left-1.5 size-3.5 cursor-nwse-resize rounded-full bg-white border-2 border-violet-600 shadow-sm hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleHandlePointerDown(e, 'nw')}
                  onPointerMove={handleBoxPointerMove}
                  onPointerUp={handleBoxPointerUp}
                  title="Drag corner to scale"
                />
                <div
                  className="absolute -top-1.5 -right-1.5 size-3.5 cursor-nesw-resize rounded-full bg-white border-2 border-violet-600 shadow-sm hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleHandlePointerDown(e, 'ne')}
                  onPointerMove={handleBoxPointerMove}
                  onPointerUp={handleBoxPointerUp}
                  title="Drag corner to scale"
                />
                <div
                  className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize rounded-full bg-white border-2 border-violet-600 shadow-sm hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleHandlePointerDown(e, 'se')}
                  onPointerMove={handleBoxPointerMove}
                  onPointerUp={handleBoxPointerUp}
                  title="Drag corner to scale"
                />
                <div
                  className="absolute -bottom-1.5 -left-1.5 size-3.5 cursor-nesw-resize rounded-full bg-white border-2 border-violet-600 shadow-sm hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleHandlePointerDown(e, 'sw')}
                  onPointerMove={handleBoxPointerMove}
                  onPointerUp={handleBoxPointerUp}
                  title="Drag corner to scale"
                />

                {/* Floating Coordinate & Scale Badge */}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/85 border border-white/20 px-2 py-0.5 text-[9px] font-mono text-white shadow-lg backdrop-blur-md pointer-events-none whitespace-nowrap">
                  <span className="text-violet-400 font-bold">{selectedClip.name}</span>
                  <span className="text-white/40">•</span>
                  <span>
                    X: {dragState?.isDragging ? dragState.currentPosX : clipTransform.posX}px, Y:{' '}
                    {dragState?.isDragging ? dragState.currentPosY : clipTransform.posY}px
                  </span>
                  <span className="text-white/40">•</span>
                  <span className="text-cyan-300 font-bold">
                    {Math.round((dragState?.isResizing ? dragState.currentScale : clipTransform.scale) * 100)}%
                  </span>
                </div>

                {/* Floating Quick Action Placement Capsule above the box */}
                <div
                  className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/85 border border-white/20 p-0.5 shadow-xl backdrop-blur-md opacity-0 group-hover/bbox:opacity-100 transition-opacity z-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => applyPresetPlacement('center')}
                    className="flex size-6 items-center justify-center rounded-full hover:bg-white/20 text-white transition"
                    title="Center Stage (Full)"
                  >
                    <CircleDot className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetPlacement('circle-webcam')}
                    className="flex size-6 items-center justify-center rounded-full bg-violet-600/40 hover:bg-violet-600 text-violet-200 hover:text-white transition"
                    title="Bottom-Right PiP Circle Webcam"
                  >
                    <ArrowDownRight className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetPlacement('bottom-left')}
                    className="flex size-6 items-center justify-center rounded-full hover:bg-white/20 text-white transition"
                    title="Bottom-Left PiP Circle"
                  >
                    <ArrowDownLeft className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetPlacement('top-right')}
                    className="flex size-6 items-center justify-center rounded-full hover:bg-white/20 text-white transition"
                    title="Top-Right Corner"
                  >
                    <ArrowUpRight className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => select([])}
                    className="flex size-6 items-center justify-center rounded-full hover:bg-rose-500/40 text-white/70 hover:text-white transition ml-0.5"
                    title="Deselect clip"
                  >
                    <X className="size-3" />
                  </button>
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
            aria-label={playback.speed < 0 ? 'Play in reverse (click to go forward)' : 'Reverse playback'}
            title={playback.speed < 0 ? 'Reversing (J) — click for forward' : 'Reverse playback (J)'}
            disabled={empty}
            className={cn(
              'flex size-7 items-center justify-center rounded-lg border transition disabled:opacity-30 disabled:pointer-events-none',
              playback.speed < 0
                ? 'bg-violet-500/30 text-violet-300 border-violet-500/40'
                : 'bg-white/5 text-white/70 hover:bg-white/15 hover:text-white border-transparent',
            )}
            onClick={() => {
              playback.setSpeed(playback.speed < 0 ? 1 : -1)
              if (!playback.isPlaying) playback.toggle()
            }}
          >
            <Undo2 className="size-3.5" />
          </button>

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

          <span
            className="ml-1 inline-flex min-w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-white/80"
            title="Playback speed (J reverses, L fast-forwards)"
          >
            {`${playback.speed}×`}
          </span>
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

