import * as React from 'react'
import {
  Clapperboard,
  Music,
  Sparkles,
  Type,
  Copy,
  Scissors,
  Volume2,
  VolumeX,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import type { Clip, TrackType } from '@/engine/types'
import { formatSeconds } from '@/engine/types'
import { useTimelineStore } from '@/stores/timelineStore'
import { useInspector } from '@/hooks/useInspector'
import { Button } from '@/components/ui/button'
import { CaptionsPanel } from '@/ui/inspector/CaptionsPanel'
import { MultiClipInspector } from './MultiClipInspector'
import { cn } from '@/lib/utils'
import { LabeledSlider, Section } from './controls'
import { TransformSection } from './TransformSection'
import { AppearanceSection } from './AppearanceSection'
import { TextSection } from './TextSection'
import { AudioSection } from './AudioSection'
import { EffectsSection } from './EffectsSection'
import { TransitionsSection } from './TransitionsSection'

const TYPE_META: Record<TrackType, { label: string; icon: typeof Clapperboard; className: string }> = {
  video: { label: 'Video', icon: Clapperboard, className: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  audio: { label: 'Audio', icon: Music, className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  text: { label: 'Text', icon: Type, className: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  fx: { label: 'FX', icon: Sparkles, className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
}

/**
 * Right-rail inspector: collapsible property sections for the selected clip.
 * All edits apply in real time; slider drags collapse into single undo steps.
 */
export function InspectorPanel() {
  const insp = useInspector()
  const target = insp.target
  const clip = target?.clip
  const selection = useTimelineStore((s) => s.selection)
  const playhead = useTimelineStore((s) => s.playhead)
  const splitClip = useTimelineStore((s) => s.splitClip)
  const deleteClips = useTimelineStore((s) => s.deleteClips)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)

  const [activeTab, setActiveTab] = React.useState<string>('all')

  // Multi-selection mode
  if (selection.clipIds.length > 1) {
    return (
      <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">
        <div className="flex h-9 shrink-0 items-center px-3 border-b bg-muted/20">
          <span className="text-xs font-bold text-foreground">{selection.clipIds.length} Clips Selected</span>
        </div>
        <MultiClipInspector />
      </div>
    )
  }

  if (!target || !clip) {
    return (
      <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <p className="text-xs font-semibold text-foreground">No Clip Selected</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
            Click any clip on the timeline to inspect and customize properties.
          </p>
        </div>
      </div>
    )
  }

  const meta = TYPE_META[target.track.type]
  const Icon = meta.icon

  // Quick Action Handlers
  const handleDuplicate = () => {
    const newStart = clip.startTime + clip.duration
    addClip(clip.assetId, target.track.id, newStart)
  }

  const handleSplit = () => {
    if (playhead != null && playhead > clip.startTime && playhead < clip.startTime + clip.duration) {
      splitClip(clip.id, playhead)
    }
  }

  const isMuted = clip.volume === 0
  const toggleMute = () => {
    updateClip(clip.id, { volume: isMuted ? 1 : 0 })
  }

  const handleResetTransform = () => {
    updateClip(clip.id, {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
    })
  }

  const handleDelete = () => {
    deleteClips([clip.id])
  }

  return (
    <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">

      {/* Clip Info Header */}
      <div className="border-b border-border/80 px-3 py-2.5 space-y-2 bg-muted/15">
        <div className="flex items-center gap-2.5">
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg shadow-xs', meta.className)}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-foreground">{clip.name}</p>
            <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[10px]">
              <span>{formatSeconds(clip.duration)}</span>
              <span>·</span>
              <span>@ {formatSeconds(clip.startTime)}</span>
            </div>
          </div>
          <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider', meta.className)}>
            {meta.label}
          </span>
        </div>

        {/* Quick Action Buttons Toolbar */}
        <div className="flex items-center gap-1 pt-0.5 min-w-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-1.5 gap-1 flex-1 min-w-0 font-semibold border-border/60 hover:bg-muted"
            onClick={handleDuplicate}
            title="Duplicate Clip"
          >
            <Copy className="size-3 shrink-0" />
            <span className="truncate">Duplicate</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-1.5 gap-1 flex-1 min-w-0 font-semibold border-border/60 hover:bg-muted"
            onClick={handleSplit}
            disabled={playhead == null || playhead <= clip.startTime || playhead >= clip.startTime + clip.duration}
            title="Split Clip at Playhead"
          >
            <Scissors className="size-3 shrink-0" />
            <span className="truncate">Split</span>
          </Button>
          {target.track.type !== 'text' && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                'size-7 shrink-0 p-0 font-semibold border-border/60 hover:bg-muted flex items-center justify-center',
                isMuted && 'text-red-500 border-red-500/40 bg-red-500/10',
              )}
              onClick={toggleMute}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="size-7 shrink-0 p-0 border-border/60 hover:bg-muted flex items-center justify-center"
            onClick={handleResetTransform}
            title="Reset Transform (Position, Scale, Rotation)"
          >
            <RotateCcw className="size-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="size-7 shrink-0 p-0 text-red-500 hover:bg-red-500/10 hover:text-red-600 flex items-center justify-center"
            onClick={handleDelete}
            title="Delete Clip"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Category Tabs Filter */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border/60 bg-muted/10 overflow-x-auto no-scrollbar scroll-smooth">
        {[
          { id: 'all', label: 'All' },
          { id: 'transform', label: 'Transform' },
          { id: 'appearance', label: 'Appearance' },
          { id: 'audio', label: 'Audio' },
          { id: 'text', label: 'Text' },
          { id: 'effects', label: 'Effects' },
          { id: 'transitions', label: 'Transitions' },
          { id: 'captions', label: 'Captions' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold transition shrink-0 whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-xs font-bold'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {insp.selectionCount > 1 ? (
        <MultiSelectEdits />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 space-y-1">
          {(activeTab === 'all' || activeTab === 'transform') && target.track.type !== 'audio' && (
            <TransformSection insp={insp} />
          )}
          {((activeTab === 'all' && (clip.text || target.track.type === 'text')) || activeTab === 'text') && (
            <TextSection insp={insp} showAddPrompt={activeTab === 'text' || target.track.type === 'text'} />
          )}
          {(activeTab === 'all' || activeTab === 'appearance') && <AppearanceSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'audio') && <AudioSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'effects') && <EffectsSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'transitions') && <TransitionsSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'captions') && (
            <Section title="Captions" defaultOpen={activeTab === 'captions'}>
              <CaptionsPanel />
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

/** Volume/opacity applied to every selected clip as a single undo step. */
function MultiSelectEdits() {
  const selection = useTimelineStore((s) => s.selection)
  const project = useTimelineStore((s) => s.project)
  const first = React.useMemo(() => {
    for (const track of project.tracks) {
      const clip = track.clips.find((c) => c.id === selection.clipIds[0])
      if (clip) return clip
    }
    return null
  }, [project, selection.clipIds])
  if (!first) return null

  const applyToAll = (patch: Partial<Clip>, description: string) => {
    const store = useTimelineStore.getState()
    store.beginHistoryGroup({ type: 'edit', description })
    try {
      for (const id of store.selection.clipIds) store.updateClip(id, patch)
    } finally {
      store.endHistoryGroup()
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      <p className="text-muted-foreground text-xs">
        Editing {selection.clipIds.length} clips — changes apply to all of them.
      </p>
      <LabeledSlider
        label="Volume"
        value={Math.round(first.volume * 100)}
        min={0}
        max={200}
        format={(v) => `${v}%`}
        onChange={(v) => applyToAll({ volume: v / 100 }, 'Changed volume of selected clips')}
      />
      <LabeledSlider
        label="Opacity"
        value={Math.round(first.opacity * 100)}
        min={0}
        max={100}
        format={(v) => `${v}%`}
        onChange={(v) => applyToAll({ opacity: v / 100 }, 'Changed opacity of selected clips')}
      />
    </div>
  )
}

