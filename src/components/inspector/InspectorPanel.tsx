import * as React from 'react'
import {
  ChevronRight,
  Clapperboard,
  MousePointerClick,
  Music,
  Sparkles,
  Type,
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

  // Text-track clips always carry an overlay so the Text section is editable.
  React.useEffect(() => {
    if (!target || target.track.type !== 'text') return
    if (!target.clip.text) {
      useTimelineStore.getState().updateClip(target.clip.id, { text: defaultTextOverlay() })
    }
  }, [target])

  if (!target || !clip) {
    return (
      <div className="flex h-full w-full flex-col bg-muted/30">
        <PanelHeader title="Inspector" onCollapse={onCollapse} />
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-6 text-center">
          <div>
            <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-xl">
              <MousePointerClick className="text-muted-foreground size-6" />
            </div>
            <p className="mt-3 text-sm font-semibold">No clip selected</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Select a clip in the timeline to edit its transform, appearance, audio, effects and
              transitions here.
            </p>
          </div>
          {onOpenMedia && (
            <Button size="sm" variant="outline" onClick={onOpenMedia}>
              Browse media
            </Button>
          )}
          <div className="w-full pt-2 text-left">
            <CaptionsPanel />
          </div>
        </div>
      </div>
    )
  }

  const meta = TYPE_META[target.track.type]
  const Icon = meta.icon

  return (
    <div className="flex h-full w-full flex-col bg-muted/30">
      <PanelHeader title={insp.selectionCount > 1 ? `${insp.selectionCount} clips selected` : 'Inspector'} onCollapse={onCollapse} />

      <div className="flex items-center gap-2.5 border-b px-3 py-2">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.className)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{clip.name}</p>
          <p className="text-muted-foreground font-mono text-[10px]">{formatSeconds(clip.duration)}</p>
        </div>
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', meta.className)}>
          {meta.label}
        </span>
      </div>

      {insp.selectionCount > 1 ? (
        <MultiSelectEdits />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          {target.track.type !== 'audio' && <TransformSection insp={insp} />}
          <TextSection insp={insp} />
          <AppearanceSection insp={insp} />
          <AudioSection insp={insp} />
          <EffectsSection insp={insp} />
          <TransitionsSection insp={insp} />
          <ModelCameraSection clip={clip} />
          <Section title="Captions" defaultOpen={false}>
            <CaptionsPanel />
          </Section>
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
