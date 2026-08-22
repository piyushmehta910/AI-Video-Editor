// @ts-nocheck
import * as React from 'react'
import {
  ArrowLeftRight,
  ArrowRightLeft,
  Box,
  Captions,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Clapperboard,
  Code,
  Crop,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Image,
  BarChart3,
  Layers,
  Loader2,
  Lock,
  LockOpen,
  Maximize,
  Mic,
  MoreHorizontal,
  Music,
  Redo2,
  Scissors,
  ScrollText,
  Slice,
  Sparkles,
  Stamp,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, Clip, Track } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ModelSearch } from '@/ui/media/ModelSearch'
import { useDenoiseAction } from '@/hooks/useDenoiseAction'

const HEADER_WIDTH = 64
const MIN_CLIP_PX = 6
const RULER_HEIGHT = 24
const SECTION_HEIGHT = 24
const AUDIO_BAR_H = 34

function trackHeight(): number {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 48 : 44
}

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

function computeRowOffsets(tracks: Track[], collapsed: Record<string, boolean>): Record<string, number> {
  const offsets: Record<string, number> = {}
  let y = RULER_HEIGHT
  let prevType: Track['type'] | null = null
  for (const t of tracks) {
    if (prevType !== t.type) y += SECTION_HEIGHT
    if (!collapsed[t.type]) {
      offsets[t.id] = y
      y += trackHeight()
    }
    prevType = t.type
  }
  return offsets
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

const TYPE_META: Record<Track['type'], { label: string; badge: string; gradient: string }> = {
  video: {
    label: 'Video',
    badge: 'bg-sky-500/20 text-sky-500',
    gradient: 'from-sky-500/25 to-sky-500/5',
  },
  audio: {
    label: 'Audio',
    badge: 'bg-emerald-500/20 text-emerald-500',
    gradient: 'from-emerald-500/25 to-emerald-500/5',
  },
  text: {
    label: 'Overlays',
    badge: 'bg-violet-500/20 text-violet-500',
    gradient: 'from-violet-500/25 to-violet-500/5',
  },
}

export function Timeline({ height, fill, onOpenTool }: { height?: number; fill?: boolean; onOpenTool?: (tool: string) => void }) {
  const project = useTimelineStore((s) => s.project)
  const zoom = useTimelineStore((s) => s.zoom)
  const selection = useTimelineStore((s) => s.selection)
  const denoiseAction = useDenoiseAction()
  const playhead = useTimelineStore((s) => s.playhead)
  const assets = useTimelineStore((s) => s.assets)
  const clipboard = useTimelineStore((s) => s.clipboard)
  const [dragActive, setDragActive] = React.useState(false)
  const [trimMode, setTrimMode] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    const counts: Partial<Record<Track['type'], number>> = {}
    for (const t of useTimelineStore.getState().project.tracks) {
      counts[t.type] = (counts[t.type] ?? 0) + t.clips.length
    }
    for (const type of Object.keys(counts) as Track['type'][]) {
      if (counts[type] === 0) init[type] = true
    }
    return init
  })
  const collapsedRef = React.useRef(collapsed)
  collapsedRef.current = collapsed
  const denoise = useDenoiseAction()
  const lastFitRef = React.useRef(0)

  const duration = projectDuration(project.tracks)
  const contentWidth = Math.max((duration + 5) * zoom, 0)

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const playheadRef = React.useRef<HTMLDivElement>(null)
  const audioBarRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<DragState | null>(null)

  const assetById = React.useCallback(
    (id: string) => assets.find((a) => a.id === id),
    [assets],
  )

  const movePlayheadDom = React.useCallback((time: number, z: number) => {
    const el = playheadRef.current
    if (!el) return
    const scrollLeft = viewportRef.current?.scrollLeft ?? 0
    el.style.transform = `translateX(${HEADER_WIDTH + time * z - scrollLeft}px)`
  }, [])

  const layoutAudioBar = React.useCallback(() => {
    const bar = audioBarRef.current
    const vp = viewportRef.current
    if (!bar || !vp) return
    const store = useTimelineStore.getState()
    const id = store.selection.clipIds.length === 1 ? store.selection.clipIds[0] : null
    if (!id) {
      bar.style.display = 'none'
      return
    }
    const offsets = computeRowOffsets(store.project.tracks, collapsedRef.current)
    for (const t of store.project.tracks) {
      if (t.type !== 'audio') continue
      if (collapsedRef.current.audio) {
        bar.style.display = 'none'
        return
      }
      const clip = t.clips.find((c) => c.id === id)
      if (!clip) continue
      const left = HEADER_WIDTH + clip.startTime * store.zoom - vp.scrollLeft
      const top = offsets[t.id] - vp.scrollTop - AUDIO_BAR_H - 8
      const barW = bar.offsetWidth || 210
      bar.style.display = 'flex'
      bar.style.transform = `translate(${Math.min(Math.max(8, left), Math.max(8, vp.clientWidth - barW - 8))}px, ${Math.max(8, top)}px)`
      return
    }
    bar.style.display = 'none'
  }, [])

  React.useEffect(() => {
    layoutAudioBar()
  }, [layoutAudioBar, selection, zoom, trimMode, denoise.busy])

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

  const handleViewportScroll = React.useCallback(() => {
    movePlayheadDom(useTimelineStore.getState().playhead, useTimelineStore.getState().zoom)
    layoutAudioBar()
  }, [movePlayheadDom, layoutAudioBar])

  const groups = React.useMemo(() => {
    const out: Array<{ type: Track['type']; tracks: Track[] }> = []
    for (const t of project.tracks) {
      const last = out[out.length - 1]
      if (last && last.type === t.type) last.tracks.push(t)
      else out.push({ type: t.type, tracks: [t] })
    }
    return out
  }, [project.tracks])

  const selectedClipInfo = React.useMemo(() => {
    if (selection.clipIds.length !== 1) return null
    const id = selection.clipIds[0]
    for (const t of project.tracks) {
      const c = t.clips.find((cc) => cc.id === id)
      if (c) return { clip: c, track: t }
    }
    return null
  }, [project.tracks, selection.clipIds])

  React.useEffect(() => {
    layoutAudioBar()
  }, [layoutAudioBar, selectedClipInfo?.clip?.startTime, selectedClipInfo?.track?.id])

  const selectedAsset = selectedClipInfo ? assetById(selectedClipInfo.clip.assetId) : null
  const canDenoise = Boolean(selectedAsset && selectedAsset.type === 'audio' && !denoise.busy)

  React.useEffect(() => {
    const n = assets.length
    if (n > lastFitRef.current && duration > 0) {
      const vp = viewportRef.current
      if (vp) {
        const w = Math.max(240, vp.clientWidth - HEADER_WIDTH)
        useTimelineStore.getState().setZoom(Math.max(15, Math.min(200, w / Math.max(duration, 1))))
      }
    }
    if (n !== lastFitRef.current) lastFitRef.current = n
  }, [assets.length, duration])

  React.useEffect(() => {
    const counts: Record<string, number> = {}
    for (const t of project.tracks) {
      if (t.clips.length > 0) counts[t.type] = (counts[t.type] ?? 0) + t.clips.length
    }
    setCollapsed((c) => {
      let changed = false
      const next = { ...c }
      for (const type of Object.keys(next)) {
        if (next[type] && (counts[type] ?? 0) > 0) {
          next[type] = false
          changed = true
        }
      }
      return changed ? next : c
    })
  }, [project.tracks])

  const startDrag = (e: React.PointerEvent, clip: Clip, mode: DragMode) => {
    if (dragRef.current) return
    if (trimMode && mode === 'move') return
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
    const rows = vp.querySelectorAll<HTMLElement>('[data-timeline-track]')
    let targetTrackIndex = -1
    rows.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      if (e.clientY >= r.top && e.clientY <= r.bottom) targetTrackIndex = i
    })
    const targetTrack = targetTrackIndex >= 0 ? project.tracks[targetTrackIndex] : undefined
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
    if (store.selection.clipIds.length) store.deleteClips(store.selection.clipIds)
  }

  const duplicateSelected = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) store.duplicateClips(store.selection.clipIds)
  }

  const copySelected = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) store.copyClips(store.selection.clipIds)
  }

  const cutSelected = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) store.cutClips(store.selection.clipIds)
  }

  const runDenoiseOnSelection = () => {
    const store = useTimelineStore.getState()
    for (const id of store.selection.clipIds) {
      for (const track of store.project.tracks) {
        const clip = track.clips.find((c) => c.id === id)
        if (clip && track.type === 'audio') {
          void denoiseAction.run(clip.id)
          break
        }
      }
    }
  }

  const paste = () => {
    useTimelineStore.getState().pasteClips()
  }

  const { step, labelEvery } = computeTicks(duration, zoom)
  const tickCount = Math.min(5000, Math.floor(duration / step) + 1)
  const ticks = Array.from({ length: tickCount }, (_, i) => i * step)

  return (
    <div
      className={cn(
        'flex flex-col border-t bg-muted/20',
        fill ? 'min-h-0 flex-1' : height ? 'shrink-0' : 'h-44 shrink-0 sm:h-56 md:h-64',
      )}
      style={height ? { height } : undefined}
      onPointerMove={handleDragMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Toolbar */}
      <div className="relative flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b px-1.5 sm:h-9 sm:gap-1 sm:px-2">
        {/* History */}
        <ToolbarButton label="Undo (Ctrl+Z)" onClick={() => useTimelineStore.getState().undo()} disabled={!useTimelineStore.getState().past.length}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo (Ctrl+Shift+Z)" onClick={() => useTimelineStore.getState().redo()} disabled={!useTimelineStore.getState().future.length}>
          <Redo2 className="size-4" />
        </ToolbarButton>
        <SeparatorLine />

        {/* Editing tools */}
        <ToolbarButton label="Cut (Ctrl+X)" onClick={cutSelected} disabled={!selection.clipIds.length}>
          <Scissors className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Split (Ctrl+K)" onClick={splitSelected} disabled={!selection.clipIds.length}>
          <Slice className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Duplicate (Ctrl+D)" onClick={duplicateSelected} disabled={!selection.clipIds.length}>
          <CopyPlus className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Delete (Del)" onClick={deleteSelected} disabled={!selection.clipIds.length}>
          <Trash2 className="size-4" />
        </ToolbarButton>
        <SeparatorLine />

        {/* Add tools */}
        <ToolbarButton label="Audio" onClick={() => onOpenTool?.('audio')}>
          <Music className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="3D Assets" onClick={() => onOpenTool?.('3d')}>
          <Box className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Slide Generator" onClick={() => onOpenTool?.('slide')}>
          <Layers className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Avatar Generator" onClick={() => onOpenTool?.('avatar')}>
          <Clapperboard className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Design" onClick={() => onOpenTool?.('design')}>
          <Code className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Script Generator" onClick={() => onOpenTool?.('script')}>
          <ScrollText className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Image Search" onClick={() => onOpenTool?.('images')}>
          <Image className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Denoise Audio" onClick={runDenoiseOnSelection} disabled={!selection.clipIds.length}>
          <VolumeX className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Avatar Lip-Sync" onClick={() => onOpenTool?.('avatar')}>
          <Mic className="size-4" />
        </ToolbarButton>
        <SeparatorLine />

        {/* Panel tools - open right panel */}
        <ToolbarButton label="Project Insights" onClick={() => onOpenTool?.('insights')}>
          <BarChart3 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Audio Settings" onClick={() => onOpenTool?.('audio')}>
          <Volume2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Captions" onClick={() => onOpenTool?.('captions')}>
          <Captions className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Effects" onClick={() => onOpenTool?.('effects')}>
          <Sparkles className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Crop" onClick={() => onOpenTool?.('crop')}>
          <Crop className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Transitions" onClick={() => onOpenTool?.('transitions')}>
          <Zap className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Stickers" onClick={() => onOpenTool?.('stickers')}>
          <Stamp className="size-4" />
        </ToolbarButton>
        <SeparatorLine />

        {/* Modifier tools */}
        <ToolbarButton label="Speed" onClick={() => onOpenTool?.('speed')}>
          <Loader2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Reverse" onClick={() => onOpenTool?.('speed')}>
          <ArrowRightLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Keyframe" onClick={() => onOpenTool?.('keyframe')}>
          <Wand2 className="size-4" />
        </ToolbarButton>
        <SeparatorLine />

        {/* Zoom */}
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
          <Maximize className="size-4" />
        </ToolbarButton>

        <span className="text-muted-foreground ml-auto pr-1 font-mono text-[10px]">
          {denoise.error ? (
            <span className="text-destructive">{denoise.error}</span>
          ) : selection.clipIds.length > 0 ? (
            `${selection.clipIds.length} selected`
          ) : null}
        </span>

        <div className="relative sm:hidden">
          <ToolbarButton label="More tools" onClick={() => setMoreOpen((o) => !o)}>
            <MoreHorizontal className="size-4" />
          </ToolbarButton>
          {moreOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMoreOpen(false)}
                aria-hidden
              />
              <div className="absolute top-full right-0 z-50 mt-1 flex w-52 flex-col gap-0.5 rounded-lg border bg-card p-1.5 shadow-xl">
                <p className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase">Add</p>
                <MenuRow icon={<Music className="size-4" />} label="Audio" onClick={() => { onOpenTool?.('audio'); setMoreOpen(false) }} />
                <MenuRow icon={<Box className="size-4" />} label="3D Assets" onClick={() => { onOpenTool?.('3d'); setMoreOpen(false) }} />
                <MenuRow icon={<Layers className="size-4" />} label="Slide Generator" onClick={() => { onOpenTool?.('slide'); setMoreOpen(false) }} />
                <MenuRow icon={<Clapperboard className="size-4" />} label="Avatar Generator" onClick={() => { onOpenTool?.('avatar'); setMoreOpen(false) }} />
                <div className="bg-border my-1 h-px" />
                <p className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase">Tools</p>
                <MenuRow icon={<BarChart3 className="size-4" />} label="Project Insights" onClick={() => { onOpenTool?.('insights'); setMoreOpen(false) }} />
                <MenuRow icon={<Sparkles className="size-4" />} label="Effects" onClick={() => { onOpenTool?.('effects'); setMoreOpen(false) }} />
                <MenuRow icon={<Crop className="size-4" />} label="Crop" onClick={() => { onOpenTool?.('crop'); setMoreOpen(false) }} />
                <MenuRow icon={<Zap className="size-4" />} label="Transitions" onClick={() => { onOpenTool?.('transitions'); setMoreOpen(false) }} />
                <MenuRow icon={<Stamp className="size-4" />} label="Stickers" onClick={() => { onOpenTool?.('stickers'); setMoreOpen(false) }} />
                <MenuRow icon={<Loader2 className="size-4" />} label="Speed" onClick={() => { onOpenTool?.('speed'); setMoreOpen(false) }} />
                <MenuRow icon={<Wand2 className="size-4" />} label="Keyframe" onClick={() => { onOpenTool?.('keyframe'); setMoreOpen(false) }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={viewportRef}
          className="timeline-scroll absolute inset-0 overflow-auto"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              useTimelineStore.getState().setZoom(zoom * (e.deltaY < 0 ? 1.15 : 0.87))
            }
          }}
          onScroll={handleViewportScroll}
          onClick={(e) => {
            const el = e.target as HTMLElement
            if (el.closest('[data-clip-id]')) return
            if (el.closest('[data-header-gutter]')) return
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const time = Math.max(0, (e.clientX - rect.left - HEADER_WIDTH) / zoom)
            useTimelineStore.getState().setPlayhead(time)
            useTimelineStore.getState().select([], null)
          }}
        >
          <div
            style={{ width: HEADER_WIDTH + contentWidth, minWidth: '100%' }}
            className="relative"
          >
            {/* Ruler (sticky top) */}
            <div
              className="sticky top-0 z-20 flex border-b border-border/60 bg-card"
              style={{ height: RULER_HEIGHT }}
            >
              <div
                data-header-gutter
                className="flex h-full w-16 shrink-0 items-center justify-center border-r bg-muted/50 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Track
              </div>
              <div className="relative h-full flex-1 bg-muted/20">
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

            {/* Tracks, grouped by type */}
            <div>
              {groups.map((group) => {
                const clipCount = group.tracks.reduce((sum, t) => sum + t.clips.length, 0)
                const isCollapsed = Boolean(collapsed[group.type])
                return (
                  <div key={group.type}>
                    <SectionHeader
                      label={TYPE_META[group.type].label}
                      color={TYPE_META[group.type].badge}
                      count={clipCount}
                      trackCount={group.tracks.length}
                      collapsed={isCollapsed}
                      onToggle={() => setCollapsed((c) => ({ ...c, [group.type]: !c[group.type] }))}
                    />
                    {!isCollapsed &&
                      group.tracks.map((track) => (
                        <TrackRow
                          key={track.id}
                          track={track}
                          zoom={zoom}
                          assetById={assetById}
                          selected={selection.clipIds}
                          playhead={playhead}
                          trimMode={trimMode}
                          onPointerDownClip={startDrag}
                        />
                      ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Playhead (fixed overlay, never escapes the timeline) */}
        <div
          ref={playheadRef}
          className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500"
          style={{ left: 0, willChange: 'transform' }}
        >
          <div className="absolute -left-1 top-0 border-x-[7px] border-t-[6px] border-x-transparent border-t-red-500" />
        </div>

        {dragActive && <div className="pointer-events-none absolute inset-0 z-40 cursor-grabbing" />}

        {/* Contextual audio-clip action bar */}
        {selectedClipInfo && selectedClipInfo.track.type === 'audio' && (
          <div
            ref={audioBarRef}
            data-audio-bar
            className="absolute top-0 left-0 z-50 hidden items-center gap-0.5 rounded-lg border bg-card/95 py-0.5 pr-1 shadow-xl backdrop-blur"
          >
            <ToolbarButton
              label={canDenoise ? 'Denoise audio (RNNoise)' : 'Denoise unavailable'}
              onClick={() => selectedClipInfo && void denoise.run(selectedClipInfo.clip.id)}
              disabled={!canDenoise}
            >
              {denoise.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-emerald-400" />}
            </ToolbarButton>
            <ToolbarButton label="Split at playhead" onClick={splitSelected}>
              <Slice className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Cut (Ctrl+X)" onClick={cutSelected}>
              <Scissors className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Duplicate (Ctrl+D)" onClick={duplicateSelected}>
              <CopyPlus className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label={trimMode ? 'Trim mode on — drag the clip edges' : 'Trim (drag the clip edges)'}
              onClick={() => setTrimMode((m) => !m)}
            >
              <ArrowLeftRight className={cn('size-3.5', trimMode && 'text-violet-500')} />
            </ToolbarButton>
            <ToolbarButton label="Delete (Del)" onClick={deleteSelected}>
              <Trash2 className="size-3.5" />
            </ToolbarButton>
            <span className="text-muted-foreground max-w-[140px] truncate pl-1 font-mono text-[10px]">
              {trimMode ? 'Drag edges to trim' : selectedClipInfo.clip.name}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({
  label,
  color,
  count,
  trackCount,
  collapsed,
  onToggle,
}: {
  label: string
  color: string
  count: number
  trackCount: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="bg-card/90 sticky left-0 z-10 flex items-center gap-2 px-2 backdrop-blur"
      style={{ height: SECTION_HEIGHT }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex shrink-0 items-center gap-1.5"
        title={collapsed ? `Expand ${label} section` : `Collapse ${label} section`}
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        <span className={cn('font-semibold tracking-widest uppercase', color, 'text-[10px]')}>{label}</span>
        <span className="text-muted-foreground font-mono text-[10px]">
          {collapsed ? `${trackCount} tracks · ${count} clips` : `${count} clip${count === 1 ? '' : 's'}`}
        </span>
      </button>
      <div className="flex-1 border-t border-border/40" />
    </div>
  )
}

function TrackRow({
  track,
  zoom,
  assetById,
  selected,
  playhead,
  trimMode,
  onPointerDownClip,
}: {
  track: Track
  zoom: number
  assetById: (id: string) => Asset | undefined
  selected: string[]
  playhead: number
  trimMode: boolean
  onPointerDownClip: (e: React.PointerEvent, clip: Clip, mode: DragMode) => void
}) {
  const meta = TYPE_META[track.type]


  const handleClipFocus = (clipId: string) => {
    setFocusedClipId(clipId)
  }

  const handleClipBlur = () => {
    setFocusedClipId(null)
  }

  const handleClipKeyDown = (e: React.KeyboardEvent, clip: Clip, track: Track) => {
    const store = useTimelineStore.getState()
    const allClips = store.project.tracks.flatMap(t => t.clips)
    const clipIndex = allClips.findIndex(c => c.id === clip.id)

    switch (e.key) {
      case 'Tab':
        if (e.shiftKey) {
          // Shift+Tab: previous clip
          e.preventDefault()
          const prevClip = allClips[Math.max(0, clipIndex - 1)]
          if (prevClip) {
            store.select([prevClip.id], prevClip.trackId)
            const prevClipEl = document.querySelector(`[data-clip-id="${prevClip.id}"]`)
            (prevClipEl as HTMLElement | null)?.focus()
          }
        } else {
          // Tab: next clip
          e.preventDefault()
          const nextClip = allClips[Math.min(allClips.length - 1, clipIndex + 1)]
          if (nextClip) {
            store.select([nextClip.id], nextClip.trackId)
            const nextClipEl = document.querySelector(`[data-clip-id="${nextClip.id}"]`)
            nextClipEl?.focus()
          }
        }
        break
      case 'ArrowLeft':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // ArrowLeft: previous clip
          e.preventDefault()
          const prevClip = allClips[Math.max(0, clipIndex - 1)]
          if (prevClip) {
            store.select([prevClip.id], prevClip.trackId)
            const prevClipEl = document.querySelector(`[data-clip-id="${prevClip.id}"]`)
            (prevClipEl as HTMLElement | null)?.focus()
          }
        }
        break
      case 'ArrowRight':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // ArrowRight: next clip
          e.preventDefault()
          const nextClip = allClips[Math.min(allClips.length - 1, clipIndex + 1)]
          if (nextClip) {
            store.select([nextClip.id], nextClip.trackId)
            const nextClipEl = document.querySelector(`[data-clip-id="${nextClip.id}"]`)
            nextClipEl?.focus()
          }
        }
        break
      case 'ArrowUp':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // ArrowUp: clip on track above
          e.preventDefault()
          const currentTrackIndex = store.project.tracks.findIndex(t => t.id === track.id)
          if (currentTrackIndex > 0) {
            const upperTrack = store.project.tracks[currentTrackIndex - 1]
            const upperClip = upperTrack.clips.find(c => 
              c.startTime <= clip.startTime && c.startTime + c.duration >= clip.startTime
            )
            if (upperClip) {
              store.select([upperClip.id], upperTrack.id)
              const clipEl = document.querySelector(`[data-clip-id="${upperClip.id}"]`)
              clipEl?.focus()
            }
          }
        }
        break
      case 'ArrowDown':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // ArrowDown: clip on track below
          e.preventDefault()
          const currentTrackIndex = store.project.tracks.findIndex(t => t.id === track.id)
          if (currentTrackIndex < store.project.tracks.length - 1) {
            const lowerTrack = store.project.tracks[currentTrackIndex + 1]
            const lowerClip = lowerTrack.clips.find(c => 
              c.startTime <= clip.startTime && c.startTime + c.duration >= clip.startTime
            )
            if (lowerClip) {
              store.select([lowerClip.id], lowerTrack.id)
              const clipEl = document.querySelector(`[data-clip-id="${lowerClip.id}"]`)
              clipEl?.focus()
            }
          }
        }
        break
      case 'Enter':
      case ' ':
        // Enter/Space: toggle selection
        e.preventDefault()
        if (selected.includes(clip.id)) {
          store.select(selected.filter(id => id !== clip.id), track.id)
        } else {
          store.select([...selected, clip.id], track.id)
        }
        break
      case 'Delete':
      case 'Backspace':
        if (selected.length) {
          e.preventDefault()
          const state = useTimelineStore.getState()
          if (e.shiftKey) {
            store.deleteClips(state.selection.clipIds, true)
          } else {
            store.deleteClips(state.selection.clipIds, false)
          }
        }
        break
    }
  }

  return (
    <div
      className="relative flex border-b"
      style={{ height: trackHeight() }}
      data-timeline-track={track.id}
    >
      <div
        data-header-gutter
        className="bg-card sticky left-0 z-10 flex w-16 shrink-0 items-center gap-0.5 border-r px-1.5"
        style={{ height: trackHeight() }}
      >
        <span className={cn('w-6 shrink-0 rounded text-center font-mono text-[11px] font-semibold', meta.badge)}>
          {track.name}
        </span>
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

      <div className="bg-muted/30 relative flex-1">
        {track.clips.map((clip) => {
          const asset = assetById(clip.assetId)
          const isSelected = selected.includes(clip.id)
          const isUnderPlayhead = playhead >= clip.startTime && playhead < clip.startTime + clip.duration
          const left = clip.startTime * zoom
          const width = Math.max(MIN_CLIP_PX, clip.duration * zoom)
          return (
            <div
              key={clip.id}
              data-clip-id={clip.id}
              tabIndex={0}
              className={cn(
                'absolute top-1 bottom-1 overflow-hidden rounded-md border transition-shadow',
                isSelected
                  ? 'border-violet-500 ring-2 ring-violet-500/40'
                  : isUnderPlayhead
                    ? 'border-red-400/60'
                    : 'border-black/40 shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-muted',
              )}
              style={{ left, width, background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                if (trimMode && isSelected) return
                onPointerDownClip(e, clip, 'move')
              }}
              onKeyDown={(e) => handleClipKeyDown(e, clip, track)}
              onFocus={() => handleClipFocus(clip)}
              onBlur={() => handleClipBlur(clip)}
            >
              {asset?.filmstrip ? (
                <div
                  className="absolute inset-0 opacity-50"
                  style={{
                    backgroundImage: `url(${asset.filmstrip.imageUrl})`,
                    backgroundSize: `${asset.filmstrip.frameCount * asset.filmstrip.frameWidth}px 100%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: `${-clip.sourceStart * (asset.filmstrip.frameCount / asset.filmstrip.duration) * asset.filmstrip.frameWidth}px 0`,
                  }}
                />
              ) : asset?.waveform ? (
                <div
                  className="absolute inset-0 opacity-60"
                  style={{
                    backgroundImage: `url(${asset.waveform.imageUrl})`,
                    backgroundSize: `${asset.waveform.frameCount * asset.waveform.frameWidth}px 100%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: `${-clip.sourceStart * (asset.waveform.frameCount / asset.waveform.duration) * asset.waveform.frameWidth}px 0`,
                  }}
                />
              ) : asset?.thumbnailUrl ? (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: `url(${asset.thumbnailUrl})`,
                    backgroundSize: 'auto 100%',
                    backgroundRepeat: 'repeat-x',
                    backgroundPosition: 'center',
                  }}
                />
              ) : null}
              <div className={cn('absolute inset-0 bg-gradient-to-b', meta.gradient)} />
              <div className="relative z-10 flex h-full items-center gap-1 px-1.5">
                {clip.volume < 1 && track.type === 'audio' && <Volume2 className="size-3 text-white/70" />}
                {clip.opacity < 1 && <Eye className="size-3 text-white/70" />}
                <span className="truncate text-[11px] font-medium text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                  {clip.name}
                  {clip.speed !== 1 ? ` ×${clip.speed}` : ''}
                </span>
              </div>
              <div
                className={cn(
                  'absolute top-0 bottom-0 left-0 cursor-ew-resize',
                  trimMode && isSelected ? 'w-2 bg-white/50' : 'w-1.5 hover:bg-white/30',
                )}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onPointerDownClip(e, clip, 'trim-start')
                }}
              />
              <div
                className={cn(
                  'absolute top-0 right-0 bottom-0 cursor-ew-resize',
                  trimMode && isSelected ? 'w-2 bg-white/50' : 'w-1.5 hover:bg-white/30',
                )}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onPointerDownClip(e, clip, 'trim-end')
                }}
              />
            </div>
          )
        })}
      </div>
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
      aria-pressed={active}
      className={cn(
        'text-muted-foreground flex size-5 items-center justify-center rounded hover:bg-muted hover:text-foreground relative',
        active && 'bg-violet-500/20 text-violet-500 dark:bg-violet-500/30 dark:text-violet-400 ring-2 ring-violet-500/50',
      )}
      aria-label={active ? `${title} (enabled)` : title}
    >
      {children}
      {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-violet-500" aria-hidden="true" />}
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
        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 sm:h-7 sm:w-7" onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function MenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  )
}

function SeparatorLine({ className }: { className?: string }) {
  return <div className={cn('bg-border mx-1 h-5 w-px shrink-0', className)} />
}