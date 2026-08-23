import * as React from 'react'
import {
  ArrowLeftRight,
  Box,
  Captions,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Code,
  Crop,
  CopyPlus,
  Image,
  BarChart3,
  Layers,
  Loader2,
  Magnet,
  Maximize,
  MoreHorizontal,
  Music,
  Redo2,
  Scissors,
  ScrollText,
  Slice,
  Sparkles,
  Stamp,
  Trash2,
  Undo2,
  VolumeX,
  Wand2,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import type { Clip, Track } from '@/engine/types'
import { projectDuration, trackShortLabel } from '@/engine/types'
import { Track as TrackLane } from '@/components/timeline/Track'
import type { DragMode } from '@/components/timeline/Clip'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useDenoiseAction } from '@/hooks/useDenoiseAction'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { addTextAtTime, cycleRateTool } from '@/lib/shortcuts'
import { ShortcutHelpButton } from '@/components/shortcuts/ShortcutHelp'

const HEADER_WIDTH = 78
const RULER_HEIGHT = 24
const SECTION_HEIGHT = 24
const AUDIO_BAR_H = 34

function trackHeight(): number {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 48 : 44
}

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
    badge: 'bg-blue-500/20 text-blue-500',
    gradient: 'from-blue-500/25 to-blue-500/5',
  },
  audio: {
    label: 'Audio',
    badge: 'bg-green-500/20 text-green-500',
    gradient: 'from-green-500/25 to-green-500/5',
  },
  text: {
    label: 'Text',
    badge: 'bg-yellow-500/20 text-yellow-500',
    gradient: 'from-yellow-500/25 to-yellow-500/5',
  },
  fx: {
    label: 'FX',
    badge: 'bg-purple-500/20 text-purple-500',
    gradient: 'from-purple-500/25 to-purple-500/5',
  },
}

export function Timeline({ height, fill, onOpenTool }: { height?: number; fill?: boolean; onOpenTool?: (tool: string) => void }) {
  const project = useTimelineStore((s) => s.project)
  const zoom = useTimelineStore((s) => s.zoom)
  const snapEnabled = useTimelineStore((s) => s.snapEnabled)
  const { canUndo, canRedo, undoLabel, redoLabel } = useUndoRedo()
  const selection = useTimelineStore((s) => s.selection)
  const denoiseAction = useDenoiseAction()
  const playhead = useTimelineStore((s) => s.playhead)
  const assets = useTimelineStore((s) => s.assets)
  const [dragActive, setDragActive] = React.useState(false)
  const trimMode = useEditorStore((s) => s.trimMode)
  const setTrimMode = useEditorStore((s) => s.setTrimMode)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const tool = useEditorStore((s) => s.tool)
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
  const lastFitRef = React.useRef(0)

  const duration = projectDuration(project.tracks)
  const contentWidth = Math.max((duration + 5) * zoom, 0)

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const playheadRef = React.useRef<HTMLDivElement>(null)
  const audioBarRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const [isScrubbingRuler, setIsScrubbingRuler] = React.useState(false)

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
  }, [layoutAudioBar, selection, zoom, trimMode, denoiseAction.busy])

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
  const canDenoise = Boolean(selectedAsset && selectedAsset.type === 'audio' && !denoiseAction.busy)

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

    // Active mouse tools act on pointer-down instead of dragging.
    const activeTool = useEditorStore.getState().tool
    if (mode === 'move' && (activeTool === 'razor' || activeTool === 'rate')) {
      const vp = viewportRef.current
      if (vp) {
        const rect = vp.getBoundingClientRect()
        const time = Math.max(0, (e.clientX - rect.left - HEADER_WIDTH) / zoom)
        if (activeTool === 'razor') useTimelineStore.getState().splitClip(clip.id, time)
        else cycleRateTool(clip.id)
      }
      return
    }

    const store = useTimelineStore.getState()
    const clipIds = selection.clipIds.includes(clip.id) ? selection.clipIds : [clip.id]
    store.select(clipIds, clip.trackId)
    // One undo step per drag: snapshot now, mutations stream inside the group,
    // endDrag closes it.
    store.beginHistoryGroup({
      type: 'move',
      description:
        mode === 'move'
          ? `Moved '${clip.name}'`
          : `Trimmed '${clip.name}'`,
      clipId: clip.id,
    })
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
      snapping: useTimelineStore.getState().snapEnabled !== e.shiftKey,
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
      const orig = drag.originals.get(drag.clipIds[0])
      if (!orig) return
      const minDuration = 0.1
      if (drag.mode === 'trim-start') {
        // Trimming start (left edge):
        // Moving right (dt > 0) increases startTime & sourceStart, decreases duration.
        // Moving left (dt < 0) decreases startTime & sourceStart, increases duration.
        const maxDelta = orig.duration - minDuration
        const safeDelta = Math.min(dt, maxDelta)
        const newSourceStart = Math.max(0, orig.sourceStart + safeDelta)
        const appliedDelta = newSourceStart - orig.sourceStart
        const newStartTime = Math.max(0, orig.startTime + appliedDelta)
        const newDuration = Math.max(minDuration, orig.duration - appliedDelta)
        store.updateClip(orig.id, {
          startTime: newStartTime,
          duration: newDuration,
          sourceStart: newSourceStart,
        })
      } else {
        // Trimming end (right edge):
        // Moving right (dt > 0) extends duration & sourceEnd.
        // Moving left (dt < 0) cuts duration & sourceEnd.
        const newDuration = Math.max(minDuration, orig.duration + dt)
        const durDiff = newDuration - orig.duration
        const newSourceEnd = Math.max(orig.sourceStart + minDuration, orig.sourceEnd + durDiff)
        store.updateClip(orig.id, {
          duration: newDuration,
          sourceEnd: newSourceEnd,
        })
      }
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
      useTimelineStore.getState().endHistoryGroup()
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

  const cutSelected = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) store.cutClips(store.selection.clipIds)
  }

  const runDenoiseOnSelection = () => {
    onOpenTool?.('audio')
    const store = useTimelineStore.getState()
    for (const id of store.selection.clipIds) {
      for (const track of store.project.tracks) {
        const clip = track.clips.find((c) => c.id === id)
        if (clip && (track.type === 'audio' || clip.clipType === 'voice' || clip.clipType === 'music')) {
          void denoiseAction.run(clip.id)
          break
        }
      }
    }
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
        <ToolbarButton label={undoLabel} onClick={() => useTimelineStore.getState().undo()} disabled={!canUndo}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label={redoLabel} onClick={() => useTimelineStore.getState().redo()} disabled={!canRedo}>
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
        <SeparatorLine />

        {/* Panel tools - open right panel */}
        <ToolbarButton label="Project Insights" onClick={() => onOpenTool?.('insights')}>
          <BarChart3 className="size-4" />
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
        <ToolbarButton label="Keyframe" onClick={() => onOpenTool?.('keyframe')}>
          <Wand2 className="size-4" />
        </ToolbarButton>
        <SeparatorLine />

        {/* Snap + Zoom */}
        <ToolbarButton
          label={snapEnabled ? 'Magnetic snap on (Shift inverts)' : 'Magnetic snap off (Shift inverts)'}
          active={snapEnabled}
          onClick={() => useTimelineStore.getState().setSnapEnabled(!snapEnabled)}
        >
          <Magnet className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <ToolbarButton label="Zoom out" onClick={() => useTimelineStore.getState().setZoom(zoom * 0.75)}>
          <ZoomOut className="size-4" />
        </ToolbarButton>
        <Slider
          className="w-20"
          min={15}
          max={400}
          step={1}
          value={[Math.round(zoom)]}
          onValueChange={([v]) => useTimelineStore.getState().setZoom(v)}
          title="Timeline zoom"
        />
        <span className="text-muted-foreground w-11 text-center font-mono text-[10px]">{Math.round(zoom)}px/s</span>
        <ToolbarButton label="Zoom in" onClick={() => useTimelineStore.getState().setZoom(zoom * 1.333)}>
          <ZoomIn className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Fit timeline (F)"
          onClick={() =>
            useTimelineStore
              .getState()
              .setZoom(Math.max(15, Math.min(200, (viewportRef.current?.clientWidth ?? 1200) / Math.max(duration, 1))))
          }
        >
          <Maximize className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <ShortcutHelpButton />

        <span className="text-muted-foreground ml-auto pr-1 font-mono text-[10px]">
          {denoiseAction.error ? (
            <span className="text-destructive">{denoiseAction.error}</span>
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
          data-testid="timeline-root"
          className={
            'timeline-scroll absolute inset-0 overflow-auto' +
            (tool === 'razor'
              ? ' cursor-crosshair'
              : tool === 'text'
                ? ' cursor-text'
                : tool === 'rate'
                  ? ' cursor-pointer'
                  : '')
          }
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              useTimelineStore.getState().setZoom(zoom * (e.deltaY < 0 ? 1.15 : 0.87))
            }
          }}
          onScroll={handleViewportScroll}
          onClick={(e) => {
            const el = e.target as HTMLElement

            // Text tool places a text clip wherever the timeline is clicked.
            if (useEditorStore.getState().tool === 'text') {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const maxTime = duration > 0 ? duration : 0
              const rawTime = (e.clientX - rect.left - HEADER_WIDTH) / zoom
              addTextAtTime(Math.max(0, Math.min(rawTime, maxTime)))
              return
            }

            if (el.closest('[data-clip-id]')) return
            if (el.closest('[data-header-gutter]')) return
            if (el.closest('[data-ruler-area]')) return
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const maxTime = duration > 0 ? duration : 0
            const rawTime = (e.clientX - rect.left - HEADER_WIDTH) / zoom
            const time = Math.max(0, Math.min(rawTime, maxTime))
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
              className="sticky top-0 z-20 flex border-b border-border/60 bg-card select-none"
              style={{ height: RULER_HEIGHT }}
            >
              <div
                data-header-gutter
                className="flex h-full w-[78px] shrink-0 items-center justify-center border-r bg-muted/50 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Track
              </div>
              <div
                data-ruler-area
                className="relative h-full flex-1 bg-muted/20 cursor-ew-resize"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                  setIsScrubbingRuler(true)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const dur = projectDuration(useTimelineStore.getState().project.tracks)
                  const raw = (e.clientX - rect.left) / zoom
                  const time = dur > 0 ? Math.max(0, Math.min(raw, dur)) : 0
                  useTimelineStore.getState().setPlayhead(time)
                }}
                onPointerMove={(e) => {
                  if (!isScrubbingRuler) return
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const dur = projectDuration(useTimelineStore.getState().project.tracks)
                  const raw = (e.clientX - rect.left) / zoom
                  const time = dur > 0 ? Math.max(0, Math.min(raw, dur)) : 0
                  useTimelineStore.getState().setPlayhead(time)
                }}
                onPointerUp={(e) => {
                  if (isScrubbingRuler) {
                    e.stopPropagation()
                    setIsScrubbingRuler(false)
                  }
                }}
                onPointerCancel={() => setIsScrubbingRuler(false)}
              >
                {ticks.map((t, i) => (
                  <div key={i} className="absolute top-0 h-full pointer-events-none" style={{ left: t * zoom }}>
                    <div className={cn('bg-border w-px', i % labelEvery === 0 ? 'h-3' : 'h-1.5')} />
                    {i % labelEvery === 0 && (
                      <span className="text-muted-foreground absolute top-2 left-1 font-mono text-[9px]">
                        {t % 1 === 0 ? t : t.toFixed(1)}s
                      </span>
                    )}
                  </div>
                ))}
                {(project.markers ?? []).map((m) => (
                  <div
                    key={`marker-${m}`}
                    className="absolute top-0 z-10 -left-[3px] flex flex-col items-center pointer-events-none"
                    style={{ left: m * zoom }}
                    title={`Marker ${m.toFixed(2)}s`}
                  >
                    <div className="h-2 w-[7px] rounded-b-sm bg-amber-400" />
                    <div className="h-full w-px bg-amber-400/70" />
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
                      group.tracks.map((track, i) => (
                        <TrackLane 
                          key={track.id}
                          track={track}
                          shortLabel={trackShortLabel(group.type, i + 1)}
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
          data-testid="playhead"
          className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500"
          style={{ left: 0, willChange: 'transform' }}
        >
          <div className="absolute -left-1 top-0 border-x-[7px] border-t-[6px] border-x-transparent border-t-red-500" />
        </div>

        {dragActive && <div className="pointer-events-none absolute inset-0 z-40 cursor-grabbing" />}

        {/* Announces the playhead position (throttled) for screen readers. */}
        <PlayheadAnnouncer />

        {/* Contextual audio-clip action bar */}
        {selectedClipInfo && selectedClipInfo.track.type === 'audio' && (
          <div
            ref={audioBarRef}
            data-audio-bar
            className="absolute top-0 left-0 z-50 hidden items-center gap-0.5 rounded-lg border bg-card/95 py-0.5 pr-1 shadow-xl backdrop-blur"
          >
            <ToolbarButton
              label={canDenoise ? 'Denoise audio (RNNoise)' : 'Denoise unavailable'}
              onClick={() => selectedClipInfo && void denoiseAction.run(selectedClipInfo.clip.id)}
              disabled={!canDenoise}
            >
              {denoiseAction.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-emerald-400" />}
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
              onClick={() => setTrimMode(!trimMode)}
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
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label} section`}
        className="flex shrink-0 items-center gap-1.5"
        title={collapsed ? `Expand ${label} section` : `Collapse ${label} section`}
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        <span className={cn('font-semibold tracking-widest uppercase', color, 'text-[10px]')}>{label}</span>
        <span className="text-muted-foreground font-mono text-[10px]">
          {collapsed ? `${trackCount} tracks Â· ${count} clips` : `${count} clip${count === 1 ? '' : 's'}`}
        </span>
      </button>
      <div className="flex-1 border-t border-border/40" />
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  label,
  disabled,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
  active?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          className={cn('h-8 w-8 shrink-0 p-0 sm:h-7 sm:w-7', active && 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30')}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Screen-reader playhead position. Updates at most once per second of
 * timeline movement so playing audio isn't drowned in chatter.
 */
function PlayheadAnnouncer() {
  const [message, setMessage] = React.useState('')
  const lastAnnounced = React.useRef(Number.NaN)
  React.useEffect(
    () =>
      useTimelineStore.subscribe((state) => {
        const t = state.playhead
        if (Number.isNaN(lastAnnounced.current) || Math.abs(t - lastAnnounced.current) >= 0.95) {
          lastAnnounced.current = t
          setMessage(`${Math.floor(t)} seconds`)
        }
      }),
    [],
  )
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
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
