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
} from 'lucide-react'
import type { TrackType } from '@/engine/types'
import { formatSeconds } from '@/engine/types'
import { useTimelineStore } from '@/stores/timelineStore'
import { useInspector, type InspectorApi, type InspectorTarget } from '@/hooks/useInspector'
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
      tabId: isAudio ? 'timing' : 'transform',
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
      tabId: 'appearance',
      color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    })
  }

  // Dynamic tabs tailored specifically to this clip's properties
  const categories: Array<{ id: string; label: string; badge?: string }> = [
    { id: 'all', label: 'All' },
  ]

  if (isText) {
    categories.push({ id: 'text', label: 'Text', badge: clip.text ? 'Set' : undefined })
  }

  if (hasVisual) {
    categories.push({ id: 'transform', label: 'Transform' })
    categories.push({
      id: 'appearance',
      label: 'Appearance',
      badge: clip.blendMode && clip.blendMode !== 'normal' ? clip.blendMode : undefined,
    })
  }

  if (hasAudio) {
    categories.push({
      id: 'audio',
      label: 'Audio',
      badge: clip.volume === 0 || clip.muted ? 'Muted' : clip.volume !== 1 ? `${Math.round(clip.volume * 100)}%` : undefined,
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

  if (isAudio) {
    categories.push({
      id: 'timing',
      label: 'Speed & Timing',
      badge: clip.speed !== 1 ? `${clip.speed}×` : undefined,
    })
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

/** Speed and timing inspector section for audio/media clips */
function SpeedTimingSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  const speed = clip.speed ?? 1

  const handleSpeedChange = (newSpeed: number) => {
    insp.batched({ speed: Math.max(0.25, Math.min(4, newSpeed)) }, `Set speed of '${clip.name}' to ${newSpeed}x`)
  }

  return (
    <Section title="Speed & Timing">
      <LabeledSlider
        label="Playback Speed"
        value={speed}
        min={0.25}
        max={4}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={handleSpeedChange}
      />
      {/* Quick Speed Preset Buttons */}
      <div className="flex items-center gap-1.5 pt-0.5">
        {[0.5, 1, 1.5, 2, 4].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleSpeedChange(preset)}
            className={cn(
              'flex-1 rounded-md py-1 text-[10px] font-semibold transition border border-border/50',
              Math.abs(speed - preset) < 0.02
                ? 'bg-violet-600 text-white font-bold border-violet-500 shadow-xs'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {preset}×
          </button>
        ))}
      </div>

      {/* Preserve Pitch Toggle */}
      <Row label="Preserve Pitch">
        <MiniToggle
          checked={clip.preservePitch ?? true}
          onChange={(on) => insp.update({ preservePitch: on }, `Toggle preserve pitch on '${clip.name}'`)}
          label="Keep audio pitch at altered speeds"
        />
      </Row>

      {/* Timing Info */}
      <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Timeline Position</span>
          <span className="font-mono text-foreground font-semibold">@ {formatSeconds(clip.startTime)}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Clip Duration</span>
          <span className="font-mono text-foreground font-semibold">{formatSeconds(clip.duration)}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Source Range</span>
          <span className="font-mono text-foreground font-semibold">
            {formatSeconds(clip.sourceStart)} – {formatSeconds(clip.sourceEnd)}
          </span>
        </div>
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

  const [activeTab, setActiveTab] = React.useState<string>('all')

  const clipProps = React.useMemo(() => {
    return target ? getClipPropertiesState(target) : null
  }, [target])

  // Auto-heal activeTab when selecting different clip types
  React.useEffect(() => {
    if (!clipProps) return
    const exists = clipProps.categories.some((c) => c.id === activeTab)
    if (!exists) {
      setActiveTab(clipProps.isText ? 'text' : 'all')
    }
  }, [clip?.id, clipProps, activeTab])

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
                onClick={() => setActiveTab(chip.tabId)}
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

      {/* ─── Category Tabs Filter (Tailored Specifically to this Clip) ─── */}
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
            onClick={() => setActiveTab(tab.id)}
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

      {/* ─── Property Sections (Rendered According to Clip Capabilities) ─── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 space-y-1">
        {/* Text Section (shown first if text clip) */}
        {(clipProps.isText || clipProps.hasText) && (activeTab === 'all' || activeTab === 'text') && (
          <TextSection insp={insp} showAddPrompt={activeTab === 'text' || clipProps.isText} />
        )}

        {/* Audio Section (rendered only for audio & video clips) */}
        {clipProps.hasAudio && (activeTab === 'all' || activeTab === 'audio') && (
          <AudioSection insp={insp} />
        )}

        {/* Speed & Timing Section (for audio clips) */}
        {clipProps.isAudio && (activeTab === 'all' || activeTab === 'timing') && (
          <SpeedTimingSection insp={insp} />
        )}

        {/* Transform Section (rendered only for visual clips) */}
        {clipProps.hasVisual && (activeTab === 'all' || activeTab === 'transform') && (
          <TransformSection insp={insp} />
        )}

        {/* Appearance Section (rendered only for visual clips) */}
        {clipProps.hasVisual && (activeTab === 'all' || activeTab === 'appearance') && (
          <AppearanceSection insp={insp} />
        )}

        {/* Effects Section (rendered only for visual clips) */}
        {clipProps.hasEffects && (activeTab === 'all' || activeTab === 'effects') && (
          <EffectsSection insp={insp} />
        )}

        {/* Transitions Section */}
        {clipProps.hasTransitions && (activeTab === 'all' || activeTab === 'transitions') && (
          <TransitionsSection insp={insp} />
        )}

        {/* Captions Section (rendered only for caption clips or explicit captions tab) */}
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
