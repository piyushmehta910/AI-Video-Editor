import * as React from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip, EffectType } from '@/engine/types'
import { createEffect } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

export type ToolSection =
  | 'transform'
  | 'effects'
  | 'audio'
  | 'captions'
  | '3d'
  | 'transitions'
  | 'stickers'
  | 'speed'
  | 'keyframe'
  | 'crop'
  | 'slide'
  | 'avatar'

export const TOOL_SECTIONS: { id: ToolSection; label: string }[] = [
  { id: 'transform', label: 'Transform' },
  { id: 'effects', label: 'Effects' },
  { id: 'audio', label: 'Audio' },
  { id: 'captions', label: 'Captions' },
  { id: '3d', label: '3D' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'speed', label: 'Speed' },
  { id: 'keyframe', label: 'Keyframe' },
  { id: 'crop', label: 'Crop' },
  { id: 'slide', label: 'Slide' },
  { id: 'avatar', label: 'Avatar' },
]

function getSelectedClip(): Clip | null {
  const { selection, project } = useTimelineStore.getState()
  const id = selection.clipIds[0]
  if (!id) return null
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === id)
    if (clip) return clip
  }
  return null
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <p className="text-muted-foreground text-center text-xs">{text}</p>
    </div>
  )
}

function EffectSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-muted-foreground font-mono text-[10px]">{value.toFixed(2)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step ?? 0.01}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

function TransformSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to adjust its transform" />

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Position X</Label>
        <Slider
          min={-1920}
          max={1920}
          step={1}
          value={[clip.position.x]}
          onValueChange={([v]) => updateClip(clip.id, { position: { ...clip.position, x: v } })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Position Y</Label>
        <Slider
          min={-1080}
          max={1080}
          step={1}
          value={[clip.position.y]}
          onValueChange={([v]) => updateClip(clip.id, { position: { ...clip.position, y: v } })}
        />
      </div>
      <EffectSlider
        label="Scale"
        value={clip.scale.x}
        min={0.1}
        max={5}
        onChange={(v) => updateClip(clip.id, { scale: { x: v, y: v } })}
      />
      <EffectSlider
        label="Rotation"
        value={clip.rotation}
        min={-360}
        max={360}
        onChange={(v) => updateClip(clip.id, { rotation: v })}
      />
      <EffectSlider
        label="Opacity"
        value={clip.opacity}
        min={0}
        max={1}
        onChange={(v) => updateClip(clip.id, { opacity: v })}
      />
    </div>
  )
}

function EffectsSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to adjust its effects" />

  const getEffect = (type: EffectType): number => {
    const e = clip.effects.find((fx) => fx.type === type)
    return e?.value ?? 0
  }

  const setEffect = (type: EffectType, value: number) => {
    const existing = clip.effects.findIndex((fx) => fx.type === type)
    const effects = [...clip.effects]
    if (existing >= 0) {
      effects[existing] = { ...effects[existing], value }
    } else {
      effects.push(createEffect(type, value))
    }
    updateClip(clip.id, { effects })
  }

  return (
    <div className="space-y-3 p-3">
      <EffectSlider label="Brightness" value={getEffect('brightness')} min={-1} max={1} onChange={(v) => setEffect('brightness', v)} />
      <EffectSlider label="Contrast" value={getEffect('contrast')} min={-1} max={1} onChange={(v) => setEffect('contrast', v)} />
      <EffectSlider label="Saturation" value={getEffect('saturation')} min={-1} max={1} onChange={(v) => setEffect('saturation', v)} />
      <EffectSlider label="Blur" value={getEffect('blur')} min={0} max={20} step={0.5} onChange={(v) => setEffect('blur', v)} />
      <EffectSlider label="Grayscale" value={getEffect('grayscale')} min={0} max={1} onChange={(v) => setEffect('grayscale', v)} />
      <EffectSlider label="Vignette" value={getEffect('vignette')} min={0} max={1} onChange={(v) => setEffect('vignette', v)} />
    </div>
  )
}

function AudioSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to adjust its audio" />

  return (
    <div className="space-y-3 p-3">
      <EffectSlider
        label="Volume"
        value={clip.volume}
        min={0}
        max={2}
        onChange={(v) => updateClip(clip.id, { volume: v })}
      />
      <EffectSlider
        label="Speed"
        value={clip.speed}
        min={0.25}
        max={4}
        step={0.25}
        onChange={(v) => updateClip(clip.id, { speed: v })}
      />
    </div>
  )
}

function CaptionsSection() {
  return <EmptyHint text="AI-generated captions will appear here once you enable them in project settings." />
}

function ThreeDSection() {
  return <EmptyHint text="Import .glb or .gltf files to use 3D models in your project." />
}

function TransitionsSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to set transitions" />

  const inTypes: Array<'cut' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'slide' | 'zoom'> = ['cut', 'dissolve', 'wipe-left', 'wipe-right', 'slide', 'zoom']

  return (
    <div className="space-y-4 p-3">
      <div>
        <Label className="text-xs mb-2 block">In Transition</Label>
        <div className="grid grid-cols-2 gap-1">
          {inTypes.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={clip.transitions.in?.type === t ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() =>
                updateClip(clip.id, {
                  transitions: { ...clip.transitions, in: { type: t, duration: 0.5 } },
                })
              }
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs mb-2 block">Out Transition</Label>
        <div className="grid grid-cols-2 gap-1">
          {inTypes.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={clip.transitions.out?.type === t ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() =>
                updateClip(clip.id, {
                  transitions: { ...clip.transitions, out: { type: t, duration: 0.5 } },
                })
              }
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StickersSection() {
  return <EmptyHint text="Browse stickers and overlays in the media panel." />
}

function SpeedSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to adjust its speed" />

  const presets = [0.25, 0.5, 1, 1.5, 2, 4]

  return (
    <div className="space-y-3 p-3">
      <EffectSlider
        label="Speed"
        value={clip.speed}
        min={0.25}
        max={4}
        step={0.25}
        onChange={(v) => updateClip(clip.id, { speed: v })}
      />
      <div className="grid grid-cols-6 gap-1">
        {presets.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={clip.speed === p ? 'default' : 'outline'}
            className="h-7 text-[10px]"
            onClick={() => updateClip(clip.id, { speed: p })}
          >
            {p}x
          </Button>
        ))}
      </div>
    </div>
  )
}

function KeyframeSection() {
  return <EmptyHint text="Add keyframes to animate clip properties over time." />
}

function CropSection() {
  return <EmptyHint text="Select a clip to crop its visible area." />
}

function SlideSection() {
  return <EmptyHint text="Configure slide-in and slide-out animations." />
}

function AvatarSection() {
  return <EmptyHint text="Add and configure AI avatar presenters." />
}

interface RightToolPanelProps {
  section: ToolSection
  onCollapse: () => void
}

const SECTION_COMPONENTS: Record<ToolSection, React.FC> = {
  transform: TransformSection,
  effects: EffectsSection,
  audio: AudioSection,
  captions: CaptionsSection,
  '3d': ThreeDSection,
  transitions: TransitionsSection,
  stickers: StickersSection,
  speed: SpeedSection,
  keyframe: KeyframeSection,
  crop: CropSection,
  slide: SlideSection,
  avatar: AvatarSection,
}

export function RightToolPanel({ section, onCollapse }: RightToolPanelProps) {
  const sectionMeta = TOOL_SECTIONS.find((s) => s.id === section)
  const SectionContent = SECTION_COMPONENTS[section]

  return (
    <div className="flex h-full w-64 flex-col border-l bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-xs font-semibold">{sectionMeta?.label ?? section}</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCollapse}>
          <ChevronLeft className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {SectionContent && <SectionContent />}
      </div>
    </div>
  )
}
