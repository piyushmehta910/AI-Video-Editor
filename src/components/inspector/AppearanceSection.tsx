import { useTimelineStore } from '@/stores/timelineStore'
import type { BlendMode, EffectType } from '@/engine/types'
import { BLEND_LABELS, BLEND_MODES, createEffect } from '@/engine/types'
import type { InspectorApi } from '@/hooks/useInspector'
import { ColorInput, LabeledSlider, Row, Section, SelectInput } from './controls'

/** Appearance: blend mode, color filters, border, drop shadow and crop. */
export function AppearanceSection({ insp }: { insp: InspectorApi }) {
  const clip = insp.target!.clip
  const assets = useTimelineStore((s) => s.assets)
  const asset = assets.find((a) => a.id === clip.assetId)
  const isVisual = asset ? asset.type !== 'audio' : true
  if (!isVisual) return null

  const setEffects = (effects: typeof clip.effects, label: string) => insp.batched({ effects }, label)

  const setEffectValue = (type: EffectType, value: number, label: string) => {
    const existing = clip.effects.find((e) => e.type === type)
    const next = existing
      ? clip.effects.map((e) => (e.type === type ? { ...e, value } : e))
      : [...clip.effects, createEffect(type, value)]
    setEffects(next, label)
  }

  const getVal = (type: EffectType): number => clip.effects.find((e) => e.type === type)?.value ?? 0

  return (
    <Section title="Appearance">
      <Row label="Blend">
        <SelectInput
          value={clip.blendMode ?? 'normal'}
          onChange={(v) => insp.update({ blendMode: v as BlendMode }, `Changed blend mode of '${clip.name}'`)}
          options={BLEND_MODES.map((m) => ({ value: m, label: BLEND_LABELS[m] }))}
        />
      </Row>

      <LabeledSlider
        label="Brightness"
        value={Math.round(getVal('brightness') * 100)}
        min={-100}
        max={100}
        format={(v) => `${v > 0 ? '+' : ''}${v}%`}
        onChange={(v) => setEffectValue('brightness', v / 100, `Adjusted brightness of '${clip.name}'`)}
      />
      <LabeledSlider
        label="Contrast"
        value={Math.round(getVal('contrast') * 100)}
        min={-100}
        max={100}
        format={(v) => `${v > 0 ? '+' : ''}${v}%`}
        onChange={(v) => setEffectValue('contrast', v / 100, `Adjusted contrast of '${clip.name}'`)}
      />
      <LabeledSlider
        label="Saturation"
        value={Math.round(getVal('saturation') * 100)}
        min={-100}
        max={100}
        format={(v) => `${v > 0 ? '+' : ''}${v}%`}
        onChange={(v) => setEffectValue('saturation', v / 100, `Adjusted saturation of '${clip.name}'`)}
      />
      <LabeledSlider
        label="Hue"
        value={getVal('hue')}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${v}°`}
        onChange={(v) => setEffectValue('hue', v, `Shifted hue of '${clip.name}'`)}
      />
      <LabeledSlider
        label="Blur"
        value={getVal('blur')}
        min={0}
        max={20}
        step={0.5}
        format={(v) => `${v.toFixed(1)}px`}
        onChange={(v) => setEffectValue('blur', v, `Blurred '${clip.name}'`)}
      />

      {/* Border */}
      <Row label="Border" stack>
        <div className="space-y-1.5 rounded-md border border-neutral-800 p-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 text-[10px]">Width</span>
            <input
              type="range"
              min={0}
              max={40}
              value={clip.border?.width ?? 0}
              onChange={(e) =>
                insp.batched(
                  { border: { width: Number(e.target.value), color: clip.border?.color ?? '#ffffff', radius: clip.border?.radius ?? 0 } },
                  `Styled '${clip.name}'`,
                )
              }
              className="accent-[#3b82f6] h-1 flex-1"
            />
            <span className="w-10 text-right font-mono text-[10px]">{clip.border?.width ?? 0}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 text-[10px]">Color</span>
            <ColorInput
              value={clip.border?.color ?? '#ffffff'}
              onChange={(hex) =>
                insp.update(
                  { border: { width: clip.border?.width ?? 0, color: hex, radius: clip.border?.radius ?? 0 } },
                  `Styled '${clip.name}'`,
                )
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 text-[10px]">Radius</span>
            <input
              type="range"
              min={0}
              max={200}
              value={clip.border?.radius ?? 0}
              onChange={(e) =>
                insp.batched(
                  { border: { width: clip.border?.width ?? 0, color: clip.border?.color ?? '#ffffff', radius: Number(e.target.value) } },
                  `Styled '${clip.name}'`,
                )
              }
              className="accent-[#3b82f6] h-1 flex-1"
            />
            <span className="w-10 text-right font-mono text-[10px]">{clip.border?.radius ?? 0}px</span>
          </div>
        </div>
      </Row>

      {/* Drop shadow */}
      <Row label="Shadow" stack>
        <div className="space-y-1.5 rounded-md border border-neutral-800 p-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 text-[10px]">Offset</span>
            <NumInline
              value={clip.dropShadow?.offsetX ?? 0}
              min={-100}
              max={100}
              onChange={(v) =>
                insp.batched(
                  {
                    dropShadow: {
                      offsetX: v,
                      offsetY: clip.dropShadow?.offsetY ?? 0,
                      blur: clip.dropShadow?.blur ?? 8,
                      color: clip.dropShadow?.color ?? 'rgba(0,0,0,0.6)',
                    },
                  },
                  `Shadowed '${clip.name}'`,
                )
              }
            />
            <NumInline
              value={clip.dropShadow?.offsetY ?? 0}
              min={-100}
              max={100}
              onChange={(v) =>
                insp.batched(
                  {
                    dropShadow: {
                      offsetX: clip.dropShadow?.offsetX ?? 0,
                      offsetY: v,
                      blur: clip.dropShadow?.blur ?? 8,
                      color: clip.dropShadow?.color ?? 'rgba(0,0,0,0.6)',
                    },
                  },
                  `Shadowed '${clip.name}'`,
                )
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 text-[10px]">Blur</span>
            <input
              type="range"
              min={0}
              max={60}
              value={clip.dropShadow?.blur ?? 0}
              onChange={(e) =>
                insp.batched(
                  {
                    dropShadow: {
                      offsetX: clip.dropShadow?.offsetX ?? 0,
                      offsetY: clip.dropShadow?.offsetY ?? 0,
                      blur: Number(e.target.value),
                      color: clip.dropShadow?.color ?? 'rgba(0,0,0,0.6)',
                    },
                  },
                  `Shadowed '${clip.name}'`,
                )
              }
              className="accent-[#3b82f6] h-1 flex-1"
            />
            <span className="w-10 text-right font-mono text-[10px]">{clip.dropShadow?.blur ?? 0}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 text-[10px]">Color</span>
            <ColorInput
              value={dropShadowHex(clip.dropShadow?.color ?? 'rgba(0,0,0,0.6)')}
              allowAlphaNote
              onChange={(hex) =>
                insp.update(
                  {
                    dropShadow: {
                      offsetX: clip.dropShadow?.offsetX ?? 0,
                      offsetY: clip.dropShadow?.offsetY ?? 0,
                      blur: clip.dropShadow?.blur ?? 8,
                      color: hexWithAlpha(hex, 0.6),
                    },
                  },
                  `Shadowed '${clip.name}'`,
                )
              }
            />
          </div>
        </div>
      </Row>

      {/* Crop */}
      <CropGroup insp={insp} />
    </Section>
  )
}

function CropGroup({ insp }: { insp: InspectorApi }) {
  const clip = insp.target!.clip
  const crop = clip.crop ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const setCrop = (patch: Partial<typeof crop>, label: string) =>
    insp.batched({ crop: { ...crop, ...patch } }, label)

  const edges: Array<{ key: keyof typeof crop; label: string }> = [
    { key: 'top', label: 'Top' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'left', label: 'Left' },
    { key: 'right', label: 'Right' },
  ]

  return (
    <Row label="Crop" stack>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-neutral-800 p-2">
        {edges.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5">
            <span className="text-muted-foreground w-11 shrink-0 text-[10px]">{label}</span>
            <input
              type="range"
              min={0}
              max={45}
              value={crop[key]}
              onChange={(e) => setCrop({ [key]: Number(e.target.value) }, `Cropped '${clip.name}'`)}
              className="accent-[#3b82f6] h-1 flex-1"
            />
            <span className="w-7 text-right font-mono text-[9px]">{crop[key]}%</span>
          </label>
        ))}
      </div>
    </Row>
  )
}

function NumInline({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)))
      }}
      className="bg-background border-border/80 focus:border-[#60a5fa] h-6 w-full min-w-0 rounded border px-1 font-mono text-[10px] outline-none"
    />
  )
}

function dropShadowHex(color: string): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`
  }
  return HEX_FALLBACK.test(color) ? color : '#000000'
}

const HEX_FALLBACK = /^#[0-9a-fA-F]{6}$/

function hexWithAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/)
  if (!m) return hex
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
