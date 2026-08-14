import * as React from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Redo2,
  Scissors,
  Undo2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, Clip, Track } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const HEADER_WIDTH = 64
const TRACK_HEIGHT = 44
const MIN_CLIP_PX = 6
const RULER_HEIGHT = 24

type DragMode = 'move' | 'trim-start' | 'trim-end'

interface DragState {
  clipIds: string[]
  mode: DragMode
  startClientX: number
  originals: Map<string, Clip>
  zoom: number
  snapping: boolean
  moved: boolean
}

function snapTo(value: number, zoom: number, candidates: number[]): number {
  const threshold = 8 / zoom
  for (const c of candidates) {
    if (Math.abs(c - value) < threshold) return c
  }
  return value
}

function computeTicks(duration: number, zoom: number): { step: number; labelEvery: number } {
  const targetPx = 120
  const raw = targetPx / zoom
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  let step = steps[steps.length - 1]
  for (const s of steps) {
    if (s >= raw) {
      step = s
      break
    }
  }
  void duration
  return { step, labelEvery: step <= 0.5 ? 5 : step <= 1 ? 5 : step <= 5 ? 2 : 1 }
}

export function Timeline() {
  const project = useTimelineStore((s) => s.project)
  const zoom = useTimelineStore((s) => s.zoom)
  const selection = useTimelineStore((s) => s.selection)
  const playhead = useTimelineStore((s) => s.playhead)
  const assets = useTimelineStore((s) => s.assets)
  const [ripple, setRipple] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)

  const duration = projectDuration(project.tracks)
  const contentWidth = Math.max((duration + 5) * zoom, 0)

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const playheadRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<DragState | null>(null)

  const assetById = React.useCallback(
    (id: string) => assets.find((a) => a.id === id),
    [assets],
  )

  const movePlayheadDom = React.useCallback(
    (time: number, z: number) => {
      if (!playheadRef.current) return
      playheadRef.current.style.transform = `translateX(${HEADER_WIDTH + time * z}px)`
    },
    [],
  )

  React.useEffect(() => {
    movePlayheadDom(playhead, zoom)
  }, [playhead, zoom, movePlayheadDom])

  React.useEffect(() => {
    const unsub = useTimelineStore.subscribe((state, prev) => {
      if (state.playhead !== prev.playhead || state.zoom !== prev.zoom) {
        movePlayheadDom(state.playhead, state.zoom)
      }
    })
    return unsub
  }, [movePlayheadDom])

  const startDrag = (e: React.PointerEvent, clip: Clip, mode: DragMode) => {
    if (dragRef.current) return
    const store = useTimelineStore.getState()
    const clipIds = selection.clipIds.includes(clip.id) ? selection.clipIds : [clip.id]
    store.select(clipIds, clip.trackId)
    store.begin()
    const originals = new Map<string, Clip>()
    for (const id of clipIds) {
      for (const t of store.project.tracks) {
        const c = t.clips.find((cc) => cc.id === id)
        if (c) originals.set(id, c)
      }
    }
    dragRef.current = {
      clipIds,
      mode,
      startClientX: e.clientX,
      originals,
      zoom,
      snapping: !e.shiftKey,
      moved: false,
    }
    setDragActive(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const handleDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startClientX
    const dt = dx / drag.zoom
    if (Math.abs(dx) > 2) drag.moved = true
    const store = useTimelineStore.getState()

    if (drag.mode === 'trim-start' || drag.mode === 'trim-end') {
      const clip = drag.originals.get(drag.clipIds[0])
      if (!clip) return
      store.trimClip(clip.id, drag.mode === 'trim-start' ? 'start' : 'end', dt)
      return
    }

    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const targetTrackIndex = Math.max(0, Math.min(project.tracks.length - 1, Math.floor((e.clientY - rect.top - RULER_HEIGHT) / TRACK_HEIGHT)))
    const targetTrack = project.tracks[targetTrackIndex]
    const firstOriginal = drag.originals.get(drag.clipIds[0])
    const origTrackType = firstOriginal ? project.tracks.find((t) => t.id === firstOriginal.trackId)?.type : undefined
    const sameType = targetTrack && targetTrack.type === origTrackType
    const trackId = sameType ? targetTrack.id : undefined

    const candidates: number[] = [0]
    if (drag.snapping) {
      const playheadTime = useTimelineStore.getState().playhead
      for (const t of project.tracks) {
        for (const c of t.clips) {
          if (drag.clipIds.includes(c.id)) continue
          candidates.push(c.startTime, c.startTime + c.duration)
        }
      }
      if (playheadTime > 0) candidates.push(playheadTime)
    }

    for (const id of drag.clipIds) {
      const orig = drag.originals.get(id)
      if (!orig) continue
      let newStart = orig.startTime + dt
      if (drag.snapping) newStart = snapTo(newStart, drag.zoom, candidates)
      newStart = Math.max(0, newStart)
      store.moveClip(id, newStart - orig.startTime, trackId)
    }
  }

  const endDrag = () => {
    if (dragRef.current) {
      if (dragRef.current.moved) void useTimelineStore.getState().save()
      dragRef.current = null
      setDragActive(false)
    }
  }

  const splitSelected = () => {
    const store = useTimelineStore.getState()
    const t = store.playhead
    for (const id of store.selection.clipIds) {
      for (const track of store.project.tracks) {
        const clip = track.clips.find((c) => c.id === id)
        if (clip && t > clip.startTime + 0.05 && t < clip.startTime + clip.duration - 0.05) {
          store.splitClip(id, t)
          break
        }
      }
    }
  }

  const deleteSelected = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) store.deleteClips(store.selection.clipIds, ripple)
  }

  const duplicateSelected = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) store.duplicateClips(store.selection.clipIds)
  }

  const { step, labelEvery } = computeTicks(duration, zoom)
  const tickCount = Math.min(5000, Math.floor(duration / step) + 1)
  const ticks = Array.from({ length: tickCount }, (_, i) => i * step)

  return (
    <div
      className="flex h-44 shrink-0 flex-col border-t bg-muted/20 sm:h-56 md:h-64"
      onPointerMove={handleDragMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2">
        <ToolbarButton label="Undo (Ctrl+Z)" onClick={() => useTimelineStore.getState().undo()} disabled={!useTimelineStore.getState().past.length}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo (Ctrl+Shift+Z)" onClick={() => useTimelineStore.getState().redo()} disabled={!useTimelineStore.getState().future.length}>
          <Redo2 className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <ToolbarButton label="Split at playhead (Ctrl+K)" onClick={splitSelected} disabled={!selection.clipIds.length}>
          <Scissors className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Delete selected (Del)" onClick={deleteSelected} disabled={!selection.clipIds.length}>
          <Minus className="size-4 rotate-45" />
        </ToolbarButton>
        <ToolbarButton label="Duplicate (Ctrl+D)" onClick={duplicateSelected} disabled={!selection.clipIds.length}>
          <Plus className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <ToolbarButton label="Zoom out" onClick={() => useTimelineStore.getState().setZoom(zoom * 0.75)}>
          <ZoomOut className="size-4" />
        </ToolbarButton>
        <span className="text-muted-foreground w-11 text-center font-mono text-[10px]">{Math.round(zoom)}px/s</span>
        <ToolbarButton label="Zoom in" onClick={() => useTimelineStore.getState().setZoom(zoom * 1.333)}>
          <ZoomIn className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Fit timeline"
          onClick={() =>
            useTimelineStore
              .getState()
              .setZoom(Math.max(15, Math.min(200, (viewportRef.current?.clientWidth ?? 1200) / Math.max(duration, 1))))
          }
        >
          <Minus className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <Button
          variant={ripple ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('h-7 gap-1.5 px-2 text-xs', ripple && 'text-violet-600 dark:text-violet-400')}
          onClick={() => setRipple((r) => !r)}
        >
          Ripple delete
        </Button>
        <span className="text-muted-foreground ml-auto font-mono text-[10px]">
          {selection.clipIds.length > 0
            ? `${selection.clipIds.length} selected`
            : 'Space = play · Ctrl+Z = undo · Shift+drag = no snap'}
        </span>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={viewportRef}
          className="absolute inset-0 overflow-x-auto overflow-y-auto"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              useTimelineStore.getState().setZoom(zoom * (e.deltaY < 0 ? 1.15 : 0.87))
            }
          }}
          onClick={(e) => {
            const el = e.target as HTMLElement
            if (el.closest('[data-clip-id]')) return
            if (el.closest('[data-header-gutter]')) return
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const time = Math.max(0, (e.clientX - rect.left) / zoom)
            useTimelineStore.getState().setPlayhead(time)
            useTimelineStore.getState().select([], null)
          }}
        >
          <div
            style={{ width: HEADER_WIDTH + contentWidth, minWidth: '100%', height: '100%', position: 'relative' }}
          >
            {/* Ruler */}
            <div className="absolute top-0" style={{ left: HEADER_WIDTH, width: contentWidth, height: RULER_HEIGHT }}>
              <div className="relative h-full">
                {ticks.map((t, i) => (
                  <div key={i} className="absolute top-0 h-full" style={{ left: t * zoom }}>
                    <div className={cn('bg-border w-px', i % labelEvery === 0 ? 'h-3' : 'h-1.5')} />
                    {i % labelEvery === 0 && (
                      <span className="text-muted-foreground absolute top-2 left-1 font-mono text-[9px]">
                        {t % 1 === 0 ? t : t.toFixed(1)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tracks */}
            <div style={{ marginTop: RULER_HEIGHT }}>
              {project.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  zoom={zoom}
                  headerWidth={HEADER_WIDTH}
                  assetById={assetById}
                  selected={selection.clipIds}
                  playhead={playhead}
                  onPointerDownClip={startDrag}
                />
              ))}
            </div>

            {/* Playhead (scrolls with content) */}
            <div
              ref={playheadRef}
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500"
              style={{ left: 0, transform: `translateX(${HEADER_WIDTH + playhead * zoom}px)`, willChange: 'transform' }}
            >
              <div className="absolute -left-1 top-0 border-x-[7px] border-t-[6px] border-x-transparent border-t-red-500" />
            </div>
          </div>
        </div>

        {/* Track header gutter (fixed) */}
        <div data-header-gutter className="absolute top-0 bottom-0 left-0 z-20 w-16 border-r bg-card">
          <div className="bg-border flex h-6 items-center px-2 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
            Track
          </div>
          {project.tracks.map((track) => (
            <TrackHeader key={track.id} track={track} />
          ))}
        </div>

        {dragActive && <div className="pointer-events-none absolute inset-0 z-40 cursor-grabbing" />}
      </div>
    </div>
  )
}

function TrackRow({
  track,
  zoom,
  headerWidth,
  assetById,
  selected,
  playhead,
  onPointerDownClip,
}: {
  track: Track
  zoom: number
  headerWidth: number
  assetById: (id: string) => Asset | undefined
  selected: string[]
  playhead: number
  onPointerDownClip: (e: React.PointerEvent, clip: Clip, mode: DragMode) => void
}) {
  const typeColor =
    track.type === 'video'
      ? 'from-sky-500/25 to-sky-500/5'
      : track.type === 'audio'
        ? 'from-emerald-500/25 to-emerald-500/5'
        : 'from-violet-500/25 to-violet-500/5'

  return (
    <div
      className="relative border-b bg-muted/30"
      style={{ height: TRACK_HEIGHT }}
      data-timeline-track={track.id}
    >
      {track.clips.map((clip) => {
        const asset = assetById(clip.assetId)
        const isSelected = selected.includes(clip.id)
        const isUnderPlayhead = playhead >= clip.startTime && playhead < clip.startTime + clip.duration
        const left = headerWidth + clip.startTime * zoom
        const width = Math.max(MIN_CLIP_PX, clip.duration * zoom)
        return (
          <div
            key={clip.id}
            data-clip-id={clip.id}
            className={cn(
              'absolute top-1 bottom-1 overflow-hidden rounded-md border transition-shadow',
              isSelected
                ? 'border-violet-500 ring-2 ring-violet-500/40'
                : isUnderPlayhead
                  ? 'border-red-400/60'
                  : 'border-white/10',
            )}
            style={{ left, width }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onPointerDownClip(e, clip, 'move')
            }}
          >
            {asset?.thumbnailUrl && (
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: `url(${asset.thumbnailUrl})`,
                  backgroundSize: 'auto 100%',
                  backgroundRepeat: 'repeat-x',
                  backgroundPosition: 'center',
                }}
              />
            )}
            <div className={cn('absolute inset-0 bg-gradient-to-b', typeColor)} />
            <div className="relative z-10 flex h-full items-center gap-1 px-1.5">
              {clip.volume < 1 && track.type === 'audio' && <Volume2 className="size-3 text-white/70" />}
              {clip.opacity < 1 && <Eye className="size-3 text-white/70" />}
              <span className="truncate text-[10px] font-medium text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                {clip.name}
                {clip.speed !== 1 ? ` ×${clip.speed}` : ''}
              </span>
            </div>
            <div
              className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize hover:bg-white/30"
              onPointerDown={(e) => {
                e.stopPropagation()
                onPointerDownClip(e, clip, 'trim-start')
              }}
            />
            <div
              className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30"
              onPointerDown={(e) => {
                e.stopPropagation()
                onPointerDownClip(e, clip, 'trim-end')
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

function TrackHeader({ track }: { track: Track }) {
  return (
    <div
      className={cn(
        'flex h-[44px] items-center gap-1 border-b px-1.5',
        track.locked && 'bg-amber-500/10',
      )}
      style={{ height: TRACK_HEIGHT }}
    >
      <span className="text-muted-foreground w-6 text-right font-mono text-[11px]">{track.name}</span>
      <TrackHeaderButton
        active={track.locked}
        onClick={() => useTimelineStore.getState().toggleTrackLock(track.id)}
        title="Lock track"
      >
        {track.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
      </TrackHeaderButton>
      <TrackHeaderButton
        active={track.muted}
        onClick={() => useTimelineStore.getState().toggleTrackMute(track.id)}
        title="Mute track"
      >
        {track.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
      </TrackHeaderButton>
      <TrackHeaderButton
        active={track.hidden}
        onClick={() => useTimelineStore.getState().toggleTrackHidden(track.id)}
        title="Hide track"
      >
        {track.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      </TrackHeaderButton>
    </div>
  )
}

function TrackHeaderButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      className={cn(
        'text-muted-foreground flex size-5 items-center justify-center rounded hover:bg-muted hover:text-foreground',
        active && 'text-violet-500 dark:text-violet-400',
      )}
    >
      {children}
    </button>
  )
}

function ToolbarButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function SeparatorLine() {
  return <div className="bg-border mx-1 h-5 w-px" />
}