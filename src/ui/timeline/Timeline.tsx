import * as React from 'react'
import {
  ClipboardPaste,
  Clapperboard,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Keyboard,
  Loader2,
  Lock,
  LockOpen,
  Maximize,
  Music,
  Redo2,
  Scissors,
  Slice,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, Clip, Track } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { AvatarGeneratorDialog } from '@/ui/avatar/AvatarGeneratorDialog'
import { AddTextDialog } from '@/ui/media/AddTextDialog'
import { AddAudioDialog } from '@/ui/media/AddAudioDialog'
import { ShortcutsDialog } from '@/ui/common/ShortcutsDialog'
import { useDenoise } from '@/hooks/useDenoise'
import { readMediaFile } from '@/engine/storage/opfs'
import { float32ToWav } from '@/engine/audio/wav'

const HEADER_WIDTH = 64
const TRACK_HEIGHT = 44
const MIN_CLIP_PX = 6
const RULER_HEIGHT = 24
const SECTION_HEIGHT = 20

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

export function Timeline() {
  const project = useTimelineStore((s) => s.project)
  const zoom = useTimelineStore((s) => s.zoom)
  const selection = useTimelineStore((s) => s.selection)
  const playhead = useTimelineStore((s) => s.playhead)
  const assets = useTimelineStore((s) => s.assets)
  const clipboard = useTimelineStore((s) => s.clipboard)
  const [ripple, setRipple] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const [avatarOpen, setAvatarOpen] = React.useState(false)
  const [audioOpen, setAudioOpen] = React.useState(false)
  const [textOpen, setTextOpen] = React.useState(false)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  const [denoiseBusy, setDenoiseBusy] = React.useState(false)
  const [denoiseError, setDenoiseError] = React.useState<string | null>(null)

  const duration = projectDuration(project.tracks)
  const contentWidth = Math.max((duration + 5) * zoom, 0)

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const playheadRef = React.useRef<HTMLDivElement>(null)
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
  }, [movePlayheadDom])

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

  const selectedAsset = selectedClipInfo ? assetById(selectedClipInfo.clip.assetId) : null
  const canDenoise = Boolean(selectedAsset && selectedAsset.type === 'audio' && !denoiseBusy)

  const denoise = useDenoise(
    React.useMemo(
      () => ({
        onProgress: () => {},
        onError: (err: string) => setDenoiseError(err),
      }),
      [],
    ),
  )

  React.useEffect(() => {
    return () => denoise.terminate()
  }, [denoise])

  const runDenoise = async () => {
    if (!selectedClipInfo || !selectedAsset || denoiseBusy) return
    setDenoiseBusy(true)
    setDenoiseError(null)
    try {
      const file = await readMediaFile(selectedAsset.filePath)
      const result = await denoise.denoiseFromFile(file)
      const wav = float32ToWav(result.denoisedAudio, result.sampleRate)
      const outFile = new File([wav], `${selectedAsset.name}-denoised.wav`, { type: 'audio/wav' })
      const { imported, errors } = await useTimelineStore.getState().importFiles([outFile])
      if (imported.length) {
        const store = useTimelineStore.getState()
        const audioTrack = store.project.tracks.find((t) => t.type === 'audio')
        const autoClip = audioTrack?.clips.find((c) => c.assetId === imported[0].id)
        if (autoClip && audioTrack) {
          const targetStart = selectedClipInfo.clip.startTime + selectedClipInfo.clip.duration
          store.moveClip(autoClip.id, targetStart - autoClip.startTime)
          store.select([autoClip.id], audioTrack.id)
        }
      } else {
        setDenoiseError(errors[0] ?? 'Could not import denoised audio')
      }
    } catch (err) {
      setDenoiseError(err instanceof Error ? err.message : String(err))
    } finally {
      setDenoiseBusy(false)
    }
  }

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
    if (store.selection.clipIds.length) store.deleteClips(store.selection.clipIds, ripple)
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

  const paste = () => {
    useTimelineStore.getState().pasteClips()
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
      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
        <ToolbarButton label="Undo (Ctrl+Z)" onClick={() => useTimelineStore.getState().undo()} disabled={!useTimelineStore.getState().past.length}>
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo (Ctrl+Shift+Z)" onClick={() => useTimelineStore.getState().redo()} disabled={!useTimelineStore.getState().future.length}>
          <Redo2 className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <ToolbarButton label="Cut selected (Ctrl+X)" onClick={cutSelected} disabled={!selection.clipIds.length}>
          <Scissors className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Copy selected (Ctrl+C)" onClick={copySelected} disabled={!selection.clipIds.length}>
          <Copy className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Paste at playhead (Ctrl+V)" onClick={paste} disabled={!clipboard.length}>
          <ClipboardPaste className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Split at playhead (Ctrl+K)" onClick={splitSelected} disabled={!selection.clipIds.length}>
          <Slice className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Delete selected (Del)" onClick={deleteSelected} disabled={!selection.clipIds.length}>
          <Trash2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Duplicate (Ctrl+D)" onClick={duplicateSelected} disabled={!selection.clipIds.length}>
          <CopyPlus className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <ToolbarButton
          label={canDenoise ? 'Denoise selected audio (RNNoise)' : 'Select an audio clip to denoise'}
          onClick={() => void runDenoise()}
          disabled={!canDenoise}
        >
          {denoiseBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        </ToolbarButton>
        <SeparatorLine />
        <ToolbarButton label="Add avatar lip-sync" onClick={() => setAvatarOpen(true)}>
          <Clapperboard className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Add audio" onClick={() => setAudioOpen(true)}>
          <Music className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Add text" onClick={() => setTextOpen(true)}>
          <Type className="size-4" />
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
          <Maximize className="size-4" />
        </ToolbarButton>
        <SeparatorLine />
        <Button
          variant={ripple ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('h-7 gap-1.5 px-2 text-xs', ripple && 'text-violet-600 dark:text-violet-400')}
          onClick={() => setRipple((r) => !r)}
        >
          <Waves className="size-3.5" />
          Ripple
        </Button>
        <span className="text-muted-foreground ml-auto pr-1 font-mono text-[10px]">
          {denoiseError ? <span className="text-destructive">{denoiseError}</span> : selection.clipIds.length > 0 ? `${selection.clipIds.length} selected` : null}
        </span>
        <ToolbarButton label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}>
          <Keyboard className="size-4" />
        </ToolbarButton>
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
              {groups.map((group) => (
                <div key={group.type}>
                  <SectionHeader label={TYPE_META[group.type].label} color={TYPE_META[group.type].badge} />
                  {group.tracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      zoom={zoom}
                      assetById={assetById}
                      selected={selection.clipIds}
                      playhead={playhead}
                      onPointerDownClip={startDrag}
                    />
                  ))}
                </div>
              ))}
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
      </div>

      <AvatarGeneratorDialog open={avatarOpen} onClose={() => setAvatarOpen(false)} />
      <AddAudioDialog open={audioOpen} onClose={() => setAudioOpen(false)} />
      <AddTextDialog open={textOpen} onClose={() => setTextOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="sticky left-0 z-10 flex items-center gap-2 bg-card/90 px-2 backdrop-blur"
      style={{ height: SECTION_HEIGHT }}
    >
      <span className={cn('font-semibold tracking-widest uppercase', color, 'text-[9px]')}>{label}</span>
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
  onPointerDownClip,
}: {
  track: Track
  zoom: number
  assetById: (id: string) => Asset | undefined
  selected: string[]
  playhead: number
  onPointerDownClip: (e: React.PointerEvent, clip: Clip, mode: DragMode) => void
}) {
  const meta = TYPE_META[track.type]

  return (
    <div
      className="relative flex border-b"
      style={{ height: TRACK_HEIGHT }}
      data-timeline-track={track.id}
    >
      <div
        data-header-gutter
        className="bg-card sticky left-0 z-10 flex w-16 shrink-0 items-center gap-0.5 border-r px-1.5"
        style={{ height: TRACK_HEIGHT }}
      >
        <span className={cn('w-6 shrink-0 rounded text-center font-mono text-[10px] font-semibold', meta.badge)}>
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
              className={cn(
                'absolute top-1 bottom-1 overflow-hidden rounded-md border transition-shadow',
                isSelected
                  ? 'border-violet-500 ring-2 ring-violet-500/40'
                  : isUnderPlayhead
                    ? 'border-red-400/60'
                    : 'border-black/40 shadow-sm',
              )}
              style={{ left, width, background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onPointerDownClip(e, clip, 'move')
              }}
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
        <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function SeparatorLine() {
  return <div className="bg-border mx-1 h-5 w-px shrink-0" />
}