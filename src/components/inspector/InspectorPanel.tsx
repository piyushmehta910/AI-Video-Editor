import * as React from 'react'
import {
  ChevronRight,
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
  SlidersHorizontal,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react'
import type { CropEdges, TrackType } from '@/engine/types'
import { formatSeconds } from '@/engine/types'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import { useInspector, type InspectorApi, type InspectorTarget } from '@/hooks/useInspector'
import { upsertKeyframe, removeKeyframe } from '@/lib/keyframes'
import { Button } from '@/components/ui/button'
import { CaptionsPanel } from '@/ui/inspector/CaptionsPanel'
import { MultiClipInspector } from './MultiClipInspector'
import { cn } from '@/lib/utils'
import { LabeledSlider, MiniToggle, Row, Section } from './controls'
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

/** Resolves clip capabilities & generates relevant property categories & active badges */
function getClipPropertiesState(target: InspectorTarget) {
  const { clip, track, asset } = target
  const isAudio =
    track.type === 'audio' ||
    clip.clipType === 'audio' ||
    clip.clipType === 'music' ||
    clip.clipType === 'voice' ||
    clip.clipType === 'sfx' ||
    asset?.type === 'audio'

  const isText = track.type === 'text' || clip.text != null || clip.textType != null
  const isImage = asset?.type === 'image' || (clip.clipType as string) === 'image' || (clip.clipType as string) === 'sticker'
  const isVideo = (track.type === 'video' || asset?.type === 'video') && !isImage
  const isCaptions =
    track.name.toLowerCase().includes('caption') || track.name.toLowerCase().includes('subtitle')

  const hasAudio = isAudio || isVideo
  const hasVisual = !isAudio
  const hasEffects = hasVisual
  const hasTransitions = true
  const hasText = isText || clip.text != null

  // Active property summaries for clickable quick-jump chips
  const activeChips: Array<{ id: string; label: string; tabId: string; color: string }> = []

  if (hasAudio) {
    if (clip.volume === 0 || clip.muted) {
      activeChips.push({
        id: 'muted',
        label: 'Muted',
        tabId: 'audio',
        color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      })
    } else if (clip.volume !== 1) {
      activeChips.push({
        id: 'volume',
        label: `Vol ${Math.round(clip.volume * 100)}%`,
        tabId: 'audio',
        color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      })
    }
  }

  if (clip.speed !== 1) {
    activeChips.push({
      id: 'speed',
      label: `${clip.speed}× Speed`,
      tabId: 'speed',
      color: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    })
  }

  if (hasVisual && clip.opacity !== 1) {
    activeChips.push({
      id: 'opacity',
      label: `Opacity ${Math.round(clip.opacity * 100)}%`,
      tabId: 'appearance',
      color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    })
  }

  if (hasVisual && clip.blendMode && clip.blendMode !== 'normal') {
    activeChips.push({
      id: 'blend',
      label: `Blend: ${clip.blendMode}`,
      tabId: 'appearance',
      color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    })
  }

  const enabledEffects = clip.effects?.filter((e) => e.enabled !== false) ?? []
  if (hasEffects && enabledEffects.length > 0) {
    activeChips.push({
      id: 'fx',
      label: `${enabledEffects.length} FX`,
      tabId: 'effects',
      color: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    })
  }

  if (clip.transitions?.in || clip.transitions?.out) {
    const tName = clip.transitions.in?.type ?? clip.transitions.out?.type ?? 'active'
    activeChips.push({
      id: 'transition',
      label: `Transition: ${tName}`,
      tabId: 'transitions',
      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    })
  }

  if (clip.text) {
    activeChips.push({
      id: 'text',
      label: 'Text Overlay',
      tabId: 'text',
      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    })
  }

  if (clip.crop && (clip.crop.top > 0 || clip.crop.bottom > 0 || clip.crop.left > 0 || clip.crop.right > 0)) {
    activeChips.push({
      id: 'crop',
      label: 'Cropped',
      tabId: 'crop',
      color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    })
  }

  const kfCount = clip.keyframes?.length ?? 0
  if (kfCount > 0) {
    activeChips.push({
      id: 'keyframe',
      label: `${kfCount} Keyframes`,
      tabId: 'keyframe',
      color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    })
  }

  // Dynamic tabs tailored specifically to this clip's properties & each tool
  const categories: Array<{ id: string; label: string; badge?: string }> = [
    { id: 'all', label: 'All' },
  ]

  if (isText) {
    categories.push({ id: 'text', label: 'Text', badge: clip.text ? 'Set' : undefined })
  }

  if (hasVisual) {
    categories.push({ id: 'transform', label: 'Transform' })
    categories.push({
      id: 'crop',
      label: 'Crop',
      badge:
        clip.crop && (clip.crop.top > 0 || clip.crop.bottom > 0 || clip.crop.left > 0 || clip.crop.right > 0)
          ? 'Active'
          : undefined,
    })
    categories.push({
      id: 'appearance',
      label: 'Color & Look',
      badge: clip.blendMode && clip.blendMode !== 'normal' ? clip.blendMode : undefined,
    })
  }

  if (hasAudio) {
    categories.push({
      id: 'audio',
      label: 'Audio',
      badge:
        clip.volume === 0 || clip.muted
          ? 'Muted'
          : clip.volume !== 1
            ? `${Math.round(clip.volume * 100)}%`
            : undefined,
    })
  }

  // Speed is applicable to video and audio clips
  categories.push({
    id: 'speed',
    label: 'Speed',
    badge: clip.speed !== 1 ? `${clip.speed.toFixed(2)}×` : undefined,
  })

  // Keyframes for all animated/media clips
  if (hasVisual || hasAudio) {
    categories.push({
      id: 'keyframe',
      label: 'Keyframes',
      badge: kfCount > 0 ? String(kfCount) : undefined,
    })
  }

  if (!isText && hasVisual && clip.text != null) {
    categories.push({ id: 'text', label: 'Text', badge: 'Active' })
  }

  if (hasEffects) {
    categories.push({
      id: 'effects',
      label: 'Effects',
      badge: enabledEffects.length > 0 ? String(enabledEffects.length) : undefined,
    })
  }

  if (hasTransitions) {
    categories.push({
      id: 'transitions',
      label: 'Transitions',
      badge: clip.transitions?.in || clip.transitions?.out ? 'Active' : undefined,
    })
  }

  if (isCaptions) {
    categories.push({ id: 'captions', label: 'Captions' })
  }

  return {
    isAudio,
    isText,
    isImage,
    isVideo,
    isCaptions,
    hasAudio,
    hasVisual,
    hasEffects,
    hasTransitions,
    hasText,
    activeChips,
    categories,
  }
}

/** Speed tool properties section */
function SpeedSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  const speed = clip.speed ?? 1
  const [rippleDuration, setRippleDuration] = React.useState(true)

  const sourceDuration = Math.max(0.1, clip.sourceEnd - clip.sourceStart)

  const handleSetSpeed = (newSpeed: number) => {
    const safeSpeed = Math.max(0.05, Math.min(16, Math.round(newSpeed * 100) / 100))
    const patch: Partial<typeof clip> = { speed: safeSpeed }
    if (rippleDuration) {
      patch.duration = Math.max(0.1, sourceDuration / safeSpeed)
    }
    insp.batched(patch, `Set speed of '${clip.name}' to ${safeSpeed}x`)
  }

  const quickPresets = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4]
  const timelineAfter = rippleDuration
    ? `${(sourceDuration / speed).toFixed(2)}s`
    : `${clip.duration.toFixed(2)}s (fixed)`

  return (
    <Section title="Speed">
      <LabeledSlider
        label="Playback Multiplier"
        value={speed}
        min={0.25}
        max={4}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={handleSetSpeed}
      />

      {/* Quick Presets */}
      <div className="grid grid-cols-4 gap-1 pt-1">
        {quickPresets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleSetSpeed(preset)}
            className={cn(
              'rounded-md py-1 text-[10px] font-semibold transition border border-border/50',
              Math.abs(speed - preset) < 0.02
                ? 'bg-violet-600 text-white font-bold border-violet-500 shadow-xs'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {preset}×
          </button>
        ))}
      </div>

      {/* Style Presets */}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        {[
          { label: 'Slow-Mo', val: 0.5, desc: '50% Smooth Slow' },
          { label: 'Ultra Slow', val: 0.25, desc: '25% Dramatic Slow' },
          { label: 'Fast Forward', val: 2, desc: '2× Quick Pace' },
          { label: 'Time-Lapse', val: 4, desc: '4× Fast Motion' },
        ].map((style) => (
          <button
            key={style.label}
            type="button"
            onClick={() => handleSetSpeed(style.val)}
            className={cn(
              'flex flex-col items-start p-2 rounded-lg border text-left transition text-[10px]',
              Math.abs(speed - style.val) < 0.02
                ? 'bg-violet-500/15 border-violet-500/50 text-violet-400 font-bold'
                : 'bg-muted/20 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40',
            )}
          >
            <span className="font-semibold text-foreground">{style.label}</span>
            <span className="text-[9px] text-muted-foreground">{style.desc}</span>
          </button>
        ))}
      </div>

      {/* Ripple duration toggle */}
      <Row label="Ripple Duration">
        <MiniToggle
          checked={rippleDuration}
          onChange={setRippleDuration}
          label="Adjust timeline duration when speed changes"
        />
      </Row>

      {/* Preserve Pitch Toggle */}
      <Row label="Preserve Pitch">
        <MiniToggle
          checked={clip.preservePitch ?? true}
          onChange={(on) => insp.update({ preservePitch: on }, `Toggle preserve pitch on '${clip.name}'`)}
          label="Keep original audio pitch at altered speeds"
        />
      </Row>

      {/* Duration Readout */}
      <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-1 text-[11px]">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Source Duration</span>
          <span className="font-mono text-foreground">{sourceDuration.toFixed(2)}s</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Timeline Duration</span>
          <span className="font-mono text-foreground font-semibold text-violet-400">{timelineAfter}</span>
        </div>
      </div>
    </Section>
  )
}

/** Crop tool properties section */
function CropSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  const crop = clip.crop ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const reframing = clip.reframing
  const aspectPresets = ['16:9', '9:16', '1:1', '4:5', '21:9', 'free'] as const

  const setCropEdge = (edge: keyof CropEdges, val: number) => {
    const next = { ...crop, [edge]: Math.max(0, Math.min(45, val)) }
    insp.batched({ crop: next }, `Crop '${clip.name}'`)
  }

  const setTargetAspect = (aspect: string) => {
    insp.update(
      {
        reframing: {
          enabled: aspect !== 'free',
          targetAspect: aspect,
          followStrength: reframing?.followStrength ?? 0.6,
        },
      },
      `Set crop aspect of '${clip.name}' to ${aspect}`,
    )
  }

  const handleRotate90 = () => {
    const current = clip.rotation ?? 0
    insp.update({ rotation: (current + 90) % 360 }, `Rotated '${clip.name}' by 90°`)
  }

  const handleFlipH = () => {
    const sx = clip.scale?.x ?? 1
    const sy = clip.scale?.y ?? 1
    insp.update({ scale: { x: -sx, y: sy } }, `Flipped '${clip.name}' horizontally`)
  }

  const handleFlipV = () => {
    const sx = clip.scale?.x ?? 1
    const sy = clip.scale?.y ?? 1
    insp.update({ scale: { x: sx, y: -sy } }, `Flipped '${clip.name}' vertically`)
  }

  return (
    <Section title="Crop & Framing">
      {/* Aspect Ratio Presets */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Target Aspect Ratio</span>
        <div className="grid grid-cols-3 gap-1">
          {aspectPresets.map((preset) => {
            const isActive =
              reframing?.targetAspect === preset || (!reframing?.enabled && preset === 'free')
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetAspect(preset)}
                className={cn(
                  'h-7 rounded-md text-[10px] font-semibold transition border',
                  isActive
                    ? 'bg-violet-600 text-white font-bold border-violet-500 shadow-xs'
                    : 'bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {preset}
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual Margin Crop Sliders */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] font-semibold text-muted-foreground">Manual Crop Margins (%)</span>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/20 p-2.5">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <label key={side} className="flex items-center gap-2">
              <span className="w-10 text-[10px] font-medium capitalize text-muted-foreground">{side}</span>
              <input
                type="range"
                min={0}
                max={45}
                value={crop[side]}
                onChange={(e) => setCropEdge(side, Number(e.target.value))}
                className="accent-violet-500 h-1 flex-1 cursor-pointer"
              />
              <span className="w-6 text-right font-mono text-[9px] text-foreground">{crop[side]}%</span>
            </label>
          ))}
        </div>
      </div>

      {/* Quick Transform Orientations */}
      <div className="flex items-center gap-1.5 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-[10px] font-semibold gap-1"
          onClick={handleRotate90}
          title="Rotate 90° Clockwise"
        >
          <RotateCw className="size-3" />
          <span>Rotate 90°</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-[10px] font-semibold gap-1"
          onClick={handleFlipH}
          title="Flip Horizontal"
        >
          <FlipHorizontal className="size-3" />
          <span>Flip H</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-[10px] font-semibold gap-1"
          onClick={handleFlipV}
          title="Flip Vertical"
        >
          <FlipVertical className="size-3" />
          <span>Flip V</span>
        </Button>
      </div>
    </Section>
  )
}

/** Keyframe tool properties section */
function KeyframeSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  const playhead = useTimelineStore((s) => s.playhead)

  const keyframes = clip.keyframes ?? []
  const clipLocalTime = Math.max(0, Math.min(clip.duration, playhead - clip.startTime))

  const addKeyframeFor = (prop: string, val: number) => {
    const updated = upsertKeyframe(keyframes, prop, clipLocalTime, val)
    insp.update({ keyframes: updated }, `Add ${prop} keyframe to '${clip.name}'`)
  }

  const handleDeleteKeyframe = (id: string) => {
    const updated = removeKeyframe(keyframes, id)
    insp.update({ keyframes: updated }, `Delete keyframe from '${clip.name}'`)
  }

  const handleClearAll = () => {
    insp.update({ keyframes: [] }, `Clear keyframes on '${clip.name}'`)
  }

  return (
    <Section title="Keyframes">
      {/* Playhead status */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-2 text-[11px]">
        <span className="text-muted-foreground">Clip Playhead</span>
        <span className="font-mono text-foreground font-semibold">
          {clipLocalTime.toFixed(2)}s / {clip.duration.toFixed(2)}s
        </span>
      </div>

      {/* Add Keyframe at Playhead */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Add Keyframe at Playhead</span>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-semibold justify-start"
            onClick={() => addKeyframeFor('opacity', clip.opacity ?? 1)}
          >
            + Opacity ({Math.round((clip.opacity ?? 1) * 100)}%)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-semibold justify-start"
            onClick={() => addKeyframeFor('rotation', clip.rotation ?? 0)}
          >
            + Rotation ({Math.round(clip.rotation ?? 0)}°)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-semibold justify-start"
            onClick={() => addKeyframeFor('scale.x', clip.scale?.x ?? 1)}
          >
            + Scale X ({(clip.scale?.x ?? 1).toFixed(2)})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] font-semibold justify-start"
            onClick={() => addKeyframeFor('position.x', clip.position?.x ?? 0)}
          >
            + Pos X ({Math.round(clip.position?.x ?? 0)}px)
          </Button>
        </div>
      </div>

      {/* Existing Keyframes List */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Active Keyframes ({keyframes.length})
          </span>
          {keyframes.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-destructive hover:underline"
            >
              Clear All
            </button>
          )}
        </div>

        {keyframes.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/70 py-2 text-center bg-muted/10 rounded-lg border border-border/30">
            No keyframes captured. Click a button above to add one at the playhead.
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
            {keyframes.map((kf) => (
              <div
                key={kf.id}
                className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-violet-400 font-semibold">{kf.time.toFixed(2)}s</span>
                  <span className="font-medium text-foreground">{kf.prop}</span>
                  <span className="font-mono text-muted-foreground">={kf.value}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteKeyframe(kf.id)}
                  className="text-muted-foreground hover:text-destructive transition p-0.5"
                  title="Delete keyframe"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

/**
 * Right-rail inspector: collapsible property sections adapted dynamically to the selected clip.
 * All edits apply in real time; slider drags collapse into single undo steps.
 */
export function InspectorPanel({
  onCollapse,
  onOpenMiddleTools,
  hideHeader = false,
}: {
  onOpenMedia?: () => void
  onCollapse?: () => void
  onOpenMiddleTools?: () => void
  hideHeader?: boolean
}) {
  const insp = useInspector()
  const target = insp.target
  const clip = target?.clip
  const selection = useTimelineStore((s) => s.selection)
  const playhead = useTimelineStore((s) => s.playhead)
  const splitClip = useTimelineStore((s) => s.splitClip)
  const deleteClips = useTimelineStore((s) => s.deleteClips)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)

  const toolPanelSection = useEditorStore((s) => s.toolPanelSection)
  const setToolPanelSection = useEditorStore((s) => s.setToolPanelSection)

  const [activeTab, setActiveTab] = React.useState<string>('all')

  const clipProps = React.useMemo(() => {
    return target ? getClipPropertiesState(target) : null
  }, [target])

  // Sync with selected tool from the top ribbon
  React.useEffect(() => {
    if (!clipProps || !toolPanelSection) return
    const TOOL_TO_TAB: Record<string, string> = {
      text: 'text',
      audio: 'audio',
      voiceover: 'audio',
      speed: 'speed',
      crop: 'crop',
      keyframe: 'keyframe',
      effects: 'effects',
      transitions: 'transitions',
      design: 'appearance',
      captions: 'captions',
    }
    const mapped = TOOL_TO_TAB[toolPanelSection]
    if (mapped && clipProps.categories.some((c) => c.id === mapped)) {
      setActiveTab(mapped)
    }
  }, [toolPanelSection, clipProps])

  // Auto-heal activeTab when selecting different clip types
  React.useEffect(() => {
    if (!clipProps) return
    const exists = clipProps.categories.some((c) => c.id === activeTab)
    if (!exists) {
      setActiveTab(clipProps.isText ? 'text' : 'all')
    }
  }, [clip?.id, clipProps, activeTab])

  // Tab click handler that also syncs toolPanelSection
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    const TAB_TO_TOOL: Record<string, string> = {
      text: 'text',
      audio: 'audio',
      speed: 'speed',
      crop: 'crop',
      keyframe: 'keyframe',
      effects: 'effects',
      transitions: 'transitions',
      appearance: 'design',
      captions: 'captions',
    }
    const tool = TAB_TO_TOOL[tabId]
    if (tool) setToolPanelSection(tool)
  }

  // Multi-selection mode
  if (selection.clipIds.length > 1) {
    return (
      <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">
        {!hideHeader && (
          <PanelHeader
            title={`Multi-Clip Inspector (${selection.clipIds.length})`}
            onCollapse={onCollapse}
            onOpenMiddleTools={onOpenMiddleTools}
          />
        )}
        <MultiClipInspector />
      </div>
    )
  }

  if (!target || !clip || !clipProps) {
    const allClips = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    const firstClip = allClips[0]
    return (
      <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">
        {!hideHeader && (
          <PanelHeader
            title="Inspector"
            onCollapse={onCollapse}
            onOpenMiddleTools={onOpenMiddleTools}
          />
        )}
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 mb-3 text-muted-foreground/60 border border-border/40">
            <SlidersHorizontal className="size-6" />
          </div>
          <p className="text-xs font-semibold text-foreground">No Clip Selected</p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px] leading-relaxed">
            Click any clip on the timeline to inspect and customize its properties.
          </p>
          {firstClip && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs gap-1.5 h-7"
              onClick={() => useTimelineStore.getState().select([firstClip.id], null)}
            >
              Select Clip
            </Button>
          )}
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

  const isMuted = clip.volume === 0 || clip.muted
  const toggleMute = () => {
    updateClip(clip.id, { volume: isMuted ? 1 : 0, muted: !isMuted })
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
    <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md select-none">
      {!hideHeader && (
        <PanelHeader
          title={insp.selectionCount > 1 ? `${insp.selectionCount} clips selected` : 'Inspector'}
          onCollapse={onCollapse}
          onOpenMiddleTools={onOpenMiddleTools}
        />
      )}

      {/* ─── Clip Info Header & Active Properties Summary ─── */}
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
              {clip.speed !== 1 && (
                <>
                  <span>·</span>
                  <span className="text-violet-400 font-bold">{clip.speed}×</span>
                </>
              )}
            </div>
          </div>
          <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider', meta.className)}>
            {meta.label}
          </span>
        </div>

        {/* Applied Properties Chips (Quick Jump) */}
        {clipProps.activeChips.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {clipProps.activeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleTabClick(chip.tabId)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border transition-all hover:opacity-80 active:scale-95 whitespace-nowrap shrink-0',
                  chip.color,
                )}
                title={`Click to inspect ${chip.label} properties`}
              >
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Action Buttons Toolbar (Context-Aware) */}
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
          {clipProps.hasAudio && (
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
          {clipProps.hasVisual && (
            <Button
              size="sm"
              variant="outline"
              className="size-7 shrink-0 p-0 border-border/60 hover:bg-muted flex items-center justify-center"
              onClick={handleResetTransform}
              title="Reset Transform (Position, Scale, Rotation)"
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
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

      {/* ─── Category Tabs Filter (Tailored to Each Tool in Clip Properties) ─── */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border/60 bg-muted/10 overflow-x-auto no-scrollbar scroll-smooth">
        {clipProps.categories.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition shrink-0 whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-xs font-bold'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
            onClick={() => handleTabClick(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider',
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-violet-500/20 text-violet-400',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Property Sections (Properties of Each Tool in Clip Properties) ─── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 space-y-1">
        {/* 1. Text Section (from Text tool) */}
        {(clipProps.isText || clipProps.hasText) && (activeTab === 'all' || activeTab === 'text') && (
          <TextSection insp={insp} showAddPrompt={activeTab === 'text' || clipProps.isText} />
        )}

        {/* 2. Transform Section */}
        {clipProps.hasVisual && (activeTab === 'all' || activeTab === 'transform') && (
          <TransformSection insp={insp} />
        )}

        {/* 3. Crop Section (from Crop tool) */}
        {clipProps.hasVisual && (activeTab === 'all' || activeTab === 'crop') && (
          <CropSection insp={insp} />
        )}

        {/* 4. Color & Look Section (from Design / Color Grade tool) */}
        {clipProps.hasVisual && (activeTab === 'all' || activeTab === 'appearance') && (
          <AppearanceSection insp={insp} />
        )}

        {/* 5. Audio Section (from Audio tool) */}
        {clipProps.hasAudio && (activeTab === 'all' || activeTab === 'audio') && (
          <AudioSection insp={insp} />
        )}

        {/* 6. Speed Section (from Speed tool) */}
        {(activeTab === 'all' || activeTab === 'speed') && (
          <SpeedSection insp={insp} />
        )}

        {/* 7. Keyframes Section (from Keyframe tool) */}
        {(clipProps.hasVisual || clipProps.hasAudio) && (activeTab === 'all' || activeTab === 'keyframe') && (
          <KeyframeSection insp={insp} />
        )}

        {/* 8. Effects Section (from Effects tool) */}
        {clipProps.hasEffects && (activeTab === 'all' || activeTab === 'effects') && (
          <EffectsSection insp={insp} />
        )}

        {/* 9. Transitions Section (from Transitions tool) */}
        {clipProps.hasTransitions && (activeTab === 'all' || activeTab === 'transitions') && (
          <TransitionsSection insp={insp} />
        )}

        {/* 10. Captions Section (from Captions tool) */}
        {(clipProps.isCaptions || activeTab === 'captions') && (activeTab === 'all' || activeTab === 'captions') && (
          <Section title="Captions" defaultOpen={activeTab === 'captions'}>
            <CaptionsPanel />
          </Section>
        )}
      </div>
    </div>
  )
}

function PanelHeader({
  title,
  onCollapse,
  onOpenMiddleTools,
}: {
  title: string
  onCollapse?: () => void
  onOpenMiddleTools?: () => void
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 bg-muted/20 gap-2">
      {onOpenMiddleTools ? (
        <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs font-semibold">
          <button
            type="button"
            className="rounded-md bg-card px-2 py-0.5 text-violet-600 dark:text-violet-400 font-bold shadow-xs text-[11px]"
          >
            Clip Properties
          </button>
          <button
            type="button"
            onClick={onOpenMiddleTools}
            className="rounded-md px-2 py-0.5 text-muted-foreground hover:text-foreground text-[11px] transition-colors"
          >
            Middle Tools
          </button>
        </div>
      ) : (
        <span className="text-foreground min-w-0 truncate text-xs font-bold tracking-wider uppercase">{title}</span>
      )}
      {onCollapse && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          className="size-7 text-muted-foreground hover:text-foreground rounded-lg ml-auto shrink-0"
          title="Collapse right panel"
          aria-label="Collapse right panel"
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  )
}
