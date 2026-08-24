import * as React from 'react'
import {
  ChevronRight,
  Clapperboard,
  MousePointerClick,
  Music,
  Sparkles,
  Type,
  Copy,
  Scissors,
  Volume2,
  VolumeX,
  RotateCcw,
  Trash2,
  Film,
} from 'lucide-react'
import type { CameraMode, Clip, TextOverlay, TrackType } from '@/engine/types'
import { CAMERA_MODES, clampRig, formatSeconds } from '@/engine/types'
import { useTimelineStore } from '@/stores/timelineStore'
import { useInspector } from '@/hooks/useInspector'
import { Button } from '@/components/ui/button'
import { CaptionsPanel } from '@/ui/inspector/CaptionsPanel'
import { cn } from '@/lib/utils'
import { LabeledSlider, NumInput, Row, Section, SelectInput } from './controls'
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

function defaultTextOverlay(): TextOverlay {
  return {
    text: 'Your text here',
    fontSize: 48,
    fontFamily: 'sans-serif',
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#ffffff',
    backgroundColor: 'transparent',
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 0,
    shadow: true,
    animation: 'none',
    animationDuration: 1,
  }
}

/**
 * Right-rail inspector: collapsible property sections for the selected clip.
 * All edits apply in real time; slider drags collapse into single undo steps.
 */
export function InspectorPanel({
  onOpenMedia,
  onCollapse,
}: {
  onOpenMedia?: () => void
  onCollapse?: () => void
}) {
  const insp = useInspector()
  const target = insp.target
  const clip = target?.clip
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)
  const splitClip = useTimelineStore((s) => s.splitClip)
  const deleteClips = useTimelineStore((s) => s.deleteClips)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const addTextClip = useTimelineStore((s) => s.addTextClip)

  const [activeTab, setActiveTab] = React.useState<string>('all')

  // Text-track clips always carry an overlay so the Text section is editable.
  React.useEffect(() => {
    if (!target || target.track.type !== 'text') return
    if (!target.clip.text) {
      useTimelineStore.getState().updateClip(target.clip.id, { text: defaultTextOverlay() })
    }
  }, [target])

  if (!target || !clip) {
    const totalClips = project.tracks.reduce((sum, t) => sum + t.clips.length, 0)
    const duration = useTimelineStore.getState().duration()
    return (
      <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">
        <PanelHeader title="Project Inspector" onCollapse={onCollapse} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Project Summary Card */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground truncate max-w-[180px]">{project.name || 'Untitled Project'}</span>
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-violet-600 dark:text-violet-400">
                {project.width}×{project.height}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
              <div className="rounded-lg bg-background/50 p-1.5 border border-border/40">
                <span className="text-[9px] text-muted-foreground block font-sans font-medium">Duration</span>
                <span className="font-bold text-foreground">~{formatSeconds(duration)}</span>
              </div>
              <div className="rounded-lg bg-background/50 p-1.5 border border-border/40">
                <span className="text-[9px] text-muted-foreground block font-sans font-medium">Framerate</span>
                <span className="font-bold text-foreground">{project.fps} fps</span>
              </div>
              <div className="rounded-lg bg-background/50 p-1.5 border border-border/40">
                <span className="text-[9px] text-muted-foreground block font-sans font-medium">Clips / Tracks</span>
                <span className="font-bold text-foreground">{totalClips} / {project.tracks.length}</span>
              </div>
            </div>
          </div>

          {/* Quick Creation Shortcuts */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Quick Add & Tools</span>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs justify-start gap-1.5 border-border/60 hover:border-violet-500/40 hover:bg-violet-500/10 font-medium"
                onClick={() => {
                  const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks[0]
                  if (textTrack) addTextClip('New Title', textTrack.id, playhead ?? 0)
                }}
              >
                <Type className="size-3 text-sky-500" />
                Add Text Title
              </Button>
              {onOpenMedia && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs justify-start gap-1.5 border-border/60 hover:border-violet-500/40 hover:bg-violet-500/10 font-medium"
                  onClick={onOpenMedia}
                >
                  <Film className="size-3 text-emerald-500" />
                  Browse Media
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
            <div className="bg-violet-500/10 text-violet-500 mx-auto flex size-10 items-center justify-center rounded-xl">
              <MousePointerClick className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Select a Clip to Edit</p>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                Click any video, audio, text, or fx clip on the timeline below to inspect and customize properties.
              </p>
            </div>
          </div>

          <div className="w-full pt-1 text-left">
            <CaptionsPanel />
          </div>
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
      <PanelHeader title={insp.selectionCount > 1 ? `${insp.selectionCount} clips selected` : 'Inspector'} onCollapse={onCollapse} />

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
        <div className="flex items-center gap-1 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 gap-1 flex-1 font-semibold border-border/60 hover:bg-muted"
            onClick={handleDuplicate}
            title="Duplicate Clip"
          >
            <Copy className="size-3" /> Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 gap-1 flex-1 font-semibold border-border/60 hover:bg-muted"
            onClick={handleSplit}
            disabled={playhead == null || playhead <= clip.startTime || playhead >= clip.startTime + clip.duration}
            title="Split Clip at Playhead"
          >
            <Scissors className="size-3" /> Split
          </Button>
          {target.track.type !== 'text' && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                'h-6 text-[10px] px-2 gap-1 font-semibold border-border/60 hover:bg-muted',
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
            className="h-6 text-[10px] px-1.5 border-border/60 hover:bg-muted"
            onClick={handleResetTransform}
            title="Reset Transform (Position, Scale, Rotation)"
          >
            <RotateCcw className="size-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-1.5 text-red-500 hover:bg-red-500/10 hover:text-red-600"
            onClick={handleDelete}
            title="Delete Clip"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {/* Category Tabs Filter */}
      <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-border/60 bg-muted/10">
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
              'rounded-full px-2 py-0.5 text-[9px] font-semibold transition',
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
          {(activeTab === 'all' || activeTab === 'text') && <TextSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'appearance') && <AppearanceSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'audio') && <AudioSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'effects') && <EffectsSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'transitions') && <TransitionsSection insp={insp} />}
          {(activeTab === 'all' || activeTab === 'transform') && <ModelCameraSection clip={clip} />}
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

/** 3D camera rig editor, shown only for model clips (ported from the old inspector). */
function ModelCameraSection({ clip }: { clip: Clip }) {
  const rig = clip.modelRig
  if (!rig) return null

  const setRig = (patch: Parameters<typeof clampRig>[0]) =>
    useTimelineStore.getState().updateClip(clip.id, { modelRig: clampRig({ ...rig, ...patch }) })

  return (
    <Section title="3D Camera">
      <Row label="Mode">
        <SelectInput
          value={rig.mode}
          onChange={(v) => setRig({ mode: v as CameraMode })}
          options={CAMERA_MODES.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))}
        />
      </Row>
      <Row label="Azimuth">
        <NumInput value={rig.azimuthStart} onChange={(v) => setRig({ azimuthStart: v })} suffix="°" />
        <NumInput value={rig.azimuthEnd} onChange={(v) => setRig({ azimuthEnd: v })} suffix="°" />
      </Row>
      <LabeledSlider
        label="Elevation"
        value={rig.elevationStart}
        min={-89}
        max={89}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => setRig({ elevationStart: v, elevationEnd: v })}
      />
      <LabeledSlider
        label="Radius"
        value={rig.radiusStart}
        min={0.5}
        max={20}
        step={0.1}
        format={(v) => v.toFixed(1)}
        onChange={(v) => setRig({ radiusStart: v, radiusEnd: v })}
      />
      <LabeledSlider
        label="FOV"
        value={rig.fov}
        min={10}
        max={120}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => setRig({ fov: v })}
      />
      <LabeledSlider
        label="Sweep"
        value={rig.pan}
        min={0.05}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => setRig({ pan: v })}
      />
      <p className="text-muted-foreground text-[9px]">
        Azimuth start/end bracket the camera orbit; sweep controls how much plays over the clip.
      </p>
    </Section>
  )
}

function PanelHeader({ title, onCollapse }: { title: string; onCollapse?: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <span className="text-foreground min-w-0 truncate text-xs font-semibold tracking-wide uppercase">{title}</span>
      {onCollapse && (
        <button onClick={onCollapse} className="text-muted-foreground hover:text-foreground ml-auto" title="Hide panel">
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  )
}
