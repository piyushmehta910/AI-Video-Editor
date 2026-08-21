import * as React from 'react'
import { ChevronLeft, FolderUp } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip, EffectType, TextOverlay } from '@/engine/types'
import { createEffect } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ToolSection =
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
  const importFiles = useTimelineStore((s) => s.importFiles)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    await importFiles(Array.from(files))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        multiple
        onChange={handleImport}
      />
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        <FolderUp className="mr-2 size-3.5" />
        Import Audio
      </Button>
      {clip ? (
        <>
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
        </>
      ) : (
        <EmptyHint text="Select a clip to adjust its audio" />
      )}
    </div>
  )
}

function CaptionsSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to edit its text overlay" />

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Text Content</Label>
        <Input
          value={clip.text?.text ?? ''}
          placeholder="Enter text overlay..."
          onChange={(e) => {
            const existing = clip.text
            const newText: TextOverlay = existing
              ? { ...existing, text: e.target.value }
              : {
                  text: e.target.value,
                  fontSize: 48,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 'bold',
                  fontStyle: 'normal',
                  color: '#ffffff',
                  backgroundColor: '#000000',
                  textAlign: 'center',
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 0,
                  shadow: false,
                  animation: 'none',
                  animationDuration: 0.5,
                }
            updateClip(clip.id, { text: newText })
          }}
        />
      </div>
    </div>
  )
}

function ThreeDSection() {
  return <EmptyHint text="Import .glb or .gltf files as media assets to use 3D models in your project." />
}

function TransitionsSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to set transitions" />

  const transitionTypes: Array<'cut' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'slide' | 'zoom'> = [
    'cut', 'dissolve', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down', 'slide', 'zoom',
  ]

  const duration = clip.transitions.in?.duration ?? 0.5

  return (
    <div className="space-y-4 p-3">
      <div>
        <Label className="text-xs mb-2 block">In Transition</Label>
        <div className="grid grid-cols-2 gap-1">
          {transitionTypes.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={clip.transitions.in?.type === t ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() =>
                updateClip(clip.id, {
                  transitions: { ...clip.transitions, in: { type: t, duration } },
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
          {transitionTypes.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={clip.transitions.out?.type === t ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() =>
                updateClip(clip.id, {
                  transitions: { ...clip.transitions, out: { type: t, duration } },
                })
              }
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
      <EffectSlider
        label="Transition Duration"
        value={duration}
        min={0.1}
        max={2}
        step={0.1}
        onChange={(v) => {
          const inT = clip.transitions.in ? { ...clip.transitions.in, duration: v } : undefined
          const outT = clip.transitions.out ? { ...clip.transitions.out, duration: v } : undefined
          updateClip(clip.id, { transitions: { in: inT, out: outT } })
        }}
      />
    </div>
  )
}

function StickersSection() {
  return <EmptyHint text="Use the AI Director to add stickers, or import images as media assets to use as stickers." />
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
  return <EmptyHint text="Select a clip and use the timeline to add keyframes for animating properties over time." />
}

function CropSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to crop or reframe it." />

  const aspectPresets = ['16:9', '9:16', '1:1', '4:5', 'free'] as const

  return (
    <div className="space-y-3 p-3">
      <Label className="text-xs">Aspect Ratio</Label>
      <div className="grid grid-cols-3 gap-1">
        {aspectPresets.map((preset) => {
          const isActive = clip.reframing?.targetAspect === preset || (!clip.reframing && preset === 'free')
          return (
            <Button
              key={preset}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() =>
                updateClip(clip.id, {
                  reframing: {
                    enabled: preset !== 'free',
                    targetAspect: preset,
                    followStrength: 0.6,
                  },
                })
              }
            >
              {preset}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function SlideSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to set entrance and exit animations." />

  const animations: Array<{ label: string; value: 'none' | 'fade-in' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' }> = [
    { label: 'None', value: 'none' },
    { label: 'Fade In', value: 'fade-in' },
    { label: 'Slide Left', value: 'slide-left' },
    { label: 'Slide Right', value: 'slide-right' },
    { label: 'Zoom In', value: 'zoom-in' },
    { label: 'Zoom Out', value: 'zoom-out' },
  ]

  const typeMap: Record<string, 'cut' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'slide' | 'zoom'> = {
    'none': 'cut',
    'fade-in': 'dissolve',
    'slide-left': 'wipe-left',
    'slide-right': 'wipe-right',
    'zoom-in': 'zoom',
    'zoom-out': 'zoom',
  }

  return (
    <div className="space-y-4 p-3">
      <div>
        <Label className="text-xs mb-2 block">Entrance Animation</Label>
        <div className="grid grid-cols-2 gap-1">
          {animations.map((a) => {
            const inType = clip.transitions.in?.type ?? 'cut'
            const isActive =
              (a.value === 'none' && inType === 'cut') ||
              (a.value !== 'none' && typeMap[a.value] === inType)
            return (
              <Button
                key={a.value}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                className="h-7 text-[10px]"
                onClick={() => {
                  const dur = clip.transitions.in?.duration ?? 0.5
                  updateClip(clip.id, {
                    transitions: {
                      ...clip.transitions,
                      in: { type: typeMap[a.value], duration: dur },
                    },
                  })
                }}
              >
                {a.label}
              </Button>
            )
          })}
        </div>
      </div>
      <div>
        <Label className="text-xs mb-2 block">Exit Animation</Label>
        <div className="grid grid-cols-2 gap-1">
          {animations.map((a) => {
            const outType = clip.transitions.out?.type ?? 'cut'
            const isActive =
              (a.value === 'none' && outType === 'cut') ||
              (a.value !== 'none' && typeMap[a.value] === outType)
            return (
              <Button
                key={a.value}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                className="h-7 text-[10px]"
                onClick={() => {
                  const dur = clip.transitions.out?.duration ?? 0.5
                  updateClip(clip.id, {
                    transitions: {
                      ...clip.transitions,
                      out: { type: typeMap[a.value], duration: dur },
                    },
                  })
                }}
              >
                {a.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AvatarSection() {
  return <EmptyHint text="Use the AI Director to generate AI avatar presenters for your video." />
}

interface RightToolPanelProps {
  section: ToolSection
  onCollapse: () => void
}

const SECTION_COMPONENTS: Record<ToolSection, React.FC> = {
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
