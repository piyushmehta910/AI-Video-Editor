import * as React from 'react'
import {
  Layers,
  Trash2,
  ArrowLeftRight,
  CopyPlus,
  Scissors,
  Volume2,
  VolumeX,
  Sliders,
  MoveHorizontal,
  Clock,
  Sparkles,
  Clapperboard,
  Music,
  Type,
  X,
  Gauge,
  RotateCw,
  Eye,
  Maximize2,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { formatSeconds, type Clip, type Track } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<Track['type'], React.FC<{ className?: string }>> = {
  video: Clapperboard,
  audio: Music,
  text: Type,
  fx: Sparkles,
}

const TYPE_BADGES: Record<Track['type'], string> = {
  video: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30',
  audio: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  text: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  fx: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
}

export function MultiClipInspector() {
  const selection = useTimelineStore((s) => s.selection)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)
  const deleteClips = useTimelineStore((s) => s.deleteClips)
  const duplicateClips = useTimelineStore((s) => s.duplicateClips)
  const updateClips = useTimelineStore((s) => s.updateClips)
  const shiftClips = useTimelineStore((s) => s.shiftClips)
  const alignClipsToTime = useTimelineStore((s) => s.alignClipsToTime)
  const splitClip = useTimelineStore((s) => s.splitClip)
  const select = useTimelineStore((s) => s.select)

  // Resolve all selected clips and their tracks
  const selectedItems = React.useMemo(() => {
    const ids = new Set(selection.clipIds)
    const items: Array<{ clip: Clip; track: Track }> = []
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (ids.has(clip.id)) {
          items.push({ clip, track })
        }
      }
    }
    return items
  }, [selection.clipIds, project.tracks])

  const clipIds = React.useMemo(() => selectedItems.map((i) => i.clip.id), [selectedItems])

  // Count by track type
  const typeCounts = React.useMemo(() => {
    const counts: Record<Track['type'], number> = { video: 0, audio: 0, text: 0, fx: 0 }
    for (const item of selectedItems) {
      counts[item.track.type] = (counts[item.track.type] ?? 0) + 1
    }
    return counts
  }, [selectedItems])

  const totalDuration = React.useMemo(
    () => selectedItems.reduce((acc, item) => acc + item.clip.duration, 0),
    [selectedItems],
  )

  const hasAudioOrVideo = typeCounts.audio > 0 || typeCounts.video > 0
  const hasVisual = typeCounts.video > 0 || typeCounts.text > 0 || typeCounts.fx > 0

  // Local state for batch sliders
  const [batchVolume, setBatchVolume] = React.useState<number>(100)
  const [batchOpacity, setBatchOpacity] = React.useState<number>(100)
  const [batchSpeed, setBatchSpeed] = React.useState<number>(1.0)
  const [batchScale, setBatchScale] = React.useState<number>(100)
  const [batchRotation, setBatchRotation] = React.useState<number>(0)

  if (selectedItems.length === 0) return null

  // Split selected clips at playhead
  const handleSplitAll = () => {
    for (const item of selectedItems) {
      if (playhead > item.clip.startTime + 0.05 && playhead < item.clip.startTime + item.clip.duration - 0.05) {
        splitClip(item.clip.id, playhead)
      }
    }
  }

  // Remove single clip from multi-selection
  const handleDeselectClip = (id: string) => {
    select(selection.clipIds.filter((cid) => cid !== id), selection.trackId)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-12 overflow-y-auto">
      {/* ── Top Multi-Selection Summary Card ── */}
      <div className="rounded-xl border border-violet-500/30 bg-gradient-to-b from-violet-500/10 to-transparent p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs font-bold text-xs">
              {selectedItems.length}
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">Clips Multi-Selected</h3>
              <p className="text-[10px] text-muted-foreground font-mono">
                Total Duration: ~{formatSeconds(totalDuration)}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => select([])}
          >
            <X className="size-3 mr-1" />
            Deselect
          </Button>
        </div>

        {/* Type Breakdown Badges */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {(['video', 'audio', 'text', 'fx'] as const).map((type) => {
            const count = typeCounts[type]
            if (count === 0) return null
            const Icon = TYPE_ICONS[type]
            return (
              <span
                key={type}
                className={cn(
                  'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                  TYPE_BADGES[type],
                )}
              >
                <Icon className="size-3" />
                {count} {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Primary Batch Actions ── */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1">
          <Layers className="size-3 text-violet-500" />
          Batch Clip Operations
        </span>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs justify-start gap-1.5 font-semibold shadow-xs"
            onClick={() => deleteClips(clipIds, false)}
            title="Delete all selected clips (Delete / Backspace)"
          >
            <Trash2 className="size-3.5" />
            Delete ({clipIds.length})
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs justify-start gap-1.5 font-semibold border-border hover:border-violet-500/50 hover:bg-violet-500/10 shadow-xs"
            onClick={() => deleteClips(clipIds, true)}
            title="Ripple delete all selected clips and shift following clips left (Shift+Delete)"
          >
            <ArrowLeftRight className="size-3.5 text-sky-400" />
            Ripple Delete
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs justify-start gap-1.5 font-semibold border-border hover:border-violet-500/50 hover:bg-violet-500/10 shadow-xs"
            onClick={() => duplicateClips(clipIds)}
            title="Duplicate all selected clips (Ctrl+D)"
          >
            <CopyPlus className="size-3.5 text-emerald-400" />
            Duplicate All
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs justify-start gap-1.5 font-semibold border-border hover:border-violet-500/50 hover:bg-violet-500/10 shadow-xs"
            onClick={handleSplitAll}
            title="Split selected clips where playhead intersects them (Ctrl+K)"
          >
            <Scissors className="size-3.5 text-amber-400" />
            Split at Playhead
          </Button>
        </div>
      </div>

      {/* ── Batch Timing & Time-Shift ── */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-blue-500" />
            Batch Time Shift & Align
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-mono font-semibold"
            onClick={() => shiftClips(clipIds, -1.0)}
            title="Shift all selected clips 1 second earlier"
          >
            -1.0s
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-mono font-semibold"
            onClick={() => shiftClips(clipIds, -0.5)}
            title="Shift all selected clips 0.5s earlier"
          >
            -0.5s
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-mono font-semibold"
            onClick={() => shiftClips(clipIds, 0.5)}
            title="Shift all selected clips 0.5s later"
          >
            +0.5s
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-mono font-semibold"
            onClick={() => shiftClips(clipIds, 1.0)}
            title="Shift all selected clips 1s later"
          >
            +1.0s
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px] font-semibold gap-1.5"
          onClick={() => alignClipsToTime(clipIds, playhead)}
          title="Align start times of all selected clips to current playhead"
        >
          <MoveHorizontal className="size-3 text-violet-500" />
          Align All Starts to Playhead ({playhead.toFixed(2)}s)
        </Button>
      </div>

      {/* ── Batch Audio Adjustments ── */}
      {hasAudioOrVideo && (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <Volume2 className="size-3.5 text-emerald-500" />
              Batch Audio Volume
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{batchVolume}%</span>
          </div>

          <Slider
            min={0}
            max={200}
            step={1}
            value={[batchVolume]}
            onValueChange={([v]) => {
              setBatchVolume(v)
              updateClips(clipIds, { volume: v / 100 })
            }}
          />

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-semibold gap-1"
              onClick={() => {
                setBatchVolume(0)
                updateClips(clipIds, { volume: 0 })
              }}
            >
              <VolumeX className="size-3 text-destructive" />
              Mute All
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-semibold gap-1"
              onClick={() => {
                setBatchVolume(100)
                updateClips(clipIds, { volume: 1 })
              }}
            >
              <Volume2 className="size-3 text-emerald-500" />
              Reset Volume (100%)
            </Button>
          </div>
        </div>
      )}

      {/* ── Batch Visual Adjustments ── */}
      {hasVisual && (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3 shadow-xs">
          <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
            <Sliders className="size-3.5 text-violet-500" />
            Batch Visuals & Transform
          </span>

          {/* Opacity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <Eye className="size-3" /> Opacity
              </span>
              <span className="font-mono text-foreground">{batchOpacity}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[batchOpacity]}
              onValueChange={([v]) => {
                setBatchOpacity(v)
                updateClips(clipIds, { opacity: v / 100 })
              }}
            />
          </div>

          {/* Playback Speed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <Gauge className="size-3" /> Playback Speed
              </span>
              <span className="font-mono text-foreground">{batchSpeed.toFixed(2)}×</span>
            </div>
            <Slider
              min={0.25}
              max={4.0}
              step={0.05}
              value={[batchSpeed]}
              onValueChange={([v]) => {
                setBatchSpeed(v)
                updateClips(clipIds, { speed: v })
              }}
            />
          </div>

          {/* Scale */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <Maximize2 className="size-3" /> Scale
              </span>
              <span className="font-mono text-foreground">{batchScale}%</span>
            </div>
            <Slider
              min={10}
              max={300}
              step={5}
              value={[batchScale]}
              onValueChange={([v]) => {
                setBatchScale(v)
                const factor = v / 100
                updateClips(clipIds, { scale: { x: factor, y: factor } })
              }}
            />
          </div>

          {/* Rotation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <RotateCw className="size-3" /> Rotation
              </span>
              <span className="font-mono text-foreground">{batchRotation}°</span>
            </div>
            <Slider
              min={0}
              max={360}
              step={15}
              value={[batchRotation]}
              onValueChange={([v]) => {
                setBatchRotation(v)
                updateClips(clipIds, { rotation: v })
              }}
            />
          </div>
        </div>
      )}

      {/* ── Selected Clips List ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Selected Items ({selectedItems.length})
          </span>
          <span className="text-[9px] text-muted-foreground">Click ✕ to unselect</span>
        </div>

        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
          {selectedItems.map(({ clip, track }) => {
            const Icon = TYPE_ICONS[track.type]
            return (
              <div
                key={clip.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card p-2 text-xs shadow-xs hover:border-violet-500/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border',
                      TYPE_BADGES[track.type],
                    )}
                  >
                    <Icon className="size-3" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate text-[11px]">
                      {clip.name || 'Untitled Clip'}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-mono">
                      {clip.startTime.toFixed(1)}s – {(clip.startTime + clip.duration).toFixed(1)}s (
                      {clip.duration.toFixed(1)}s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteClips([clip.id])}
                    title="Delete this clip"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDeselectClip(clip.id)}
                    title="Remove from selection"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
