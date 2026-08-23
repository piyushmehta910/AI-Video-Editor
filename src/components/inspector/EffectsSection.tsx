import { Plus, Trash2 } from 'lucide-react'
import type { Effect, EffectType } from '@/engine/types'
import { createEffect } from '@/engine/types'
import type { InspectorApi } from '@/hooks/useInspector'
import { LabeledSlider, MiniToggle, Row, Section, SelectInput } from './controls'

/** Effects addable from this section (color basics live under Appearance). */
const ADDABLE: Array<{ type: EffectType; label: string }> = [
  { type: 'temperature', label: 'Color temperature' },
  { type: 'tint', label: 'Tint' },
  { type: 'vibrance', label: 'Vibrance' },
  { type: 'grayscale', label: 'Grayscale' },
  { type: 'chromatic-aberration', label: 'Chromatic aberration' },
  { type: 'vignette', label: 'Vignette' },
  { type: 'grain', label: 'Film grain' },
  { type: 'glitch', label: 'Glitch' },
]

const LABELS: Record<string, string> = Object.fromEntries(ADDABLE.map((a) => [a.type, a.label]))

/** Per-effect controls rendered beneath each list row. */
function EffectControls({ effect, onChange }: { effect: Effect; onChange: (patch: Partial<Effect>) => void }) {
  switch (effect.type) {
    case 'temperature':
      return (
        <LabeledSlider
          label="Warm/Cool"
          value={effect.value}
          min={-1}
          max={1}
          step={0.05}
          format={(v) => (v > 0 ? `+${Math.round(v * 100)}` : String(Math.round(v * 100)))}
          onChange={(v) => onChange({ value: v })}
        />
      )
    case 'tint':
      return (
        <LabeledSlider
          label="Green/Magenta"
          value={effect.value}
          min={-1}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => onChange({ value: v })}
        />
      )
    case 'vibrance':
      return (
        <LabeledSlider
          label="Amount"
          value={effect.value}
          min={-1}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ value: v })}
        />
      )
    case 'grayscale':
      return (
        <LabeledSlider
          label="Mix"
          value={effect.value}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ value: v })}
        />
      )
    case 'chromatic-aberration':
      return (
        <LabeledSlider
          label="Intensity"
          value={effect.aberrationOffset ?? 2}
          min={0}
          max={12}
          step={0.5}
          format={(v) => `${v.toFixed(1)}px`}
          onChange={(v) => onChange({ aberrationOffset: v })}
        />
      )
    case 'vignette':
      return (
        <>
          <LabeledSlider
            label="Amount"
            value={effect.value}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange({ value: v })}
          />
          <LabeledSlider
            label="Radius"
            value={effect.radius ?? 0.35}
            min={0.05}
            max={0.8}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange({ radius: v })}
          />
        </>
      )
    case 'grain':
      return (
        <LabeledSlider
          label="Intensity"
          value={effect.value}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ value: v })}
        />
      )
    case 'glitch':
      return (
        <>
          <LabeledSlider
            label="Intensity"
            value={effect.glitchIntensity ?? 0.3}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange({ glitchIntensity: v })}
          />
          <LabeledSlider
            label="Scanlines"
            value={effect.scanlines ?? 8}
            min={1}
            max={32}
            format={(v) => `${v}`}
            onChange={(v) => onChange({ scanlines: Math.round(v) })}
          />
        </>
      )
    default:
      return null
  }
}

/** Effect stack plus clip speed with pitch preservation. */
export function EffectsSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip

  const setEffects = (effects: Effect[], label: string) => insp.batched({ effects }, label)

  const patchEffect = (id: string, patch: Partial<Effect>, label: string) =>
    setEffects(
      clip.effects.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      label,
    )

  const removeEffect = (id: string) =>
    insp.update({ effects: clip.effects.filter((e) => e.id !== id) }, `Removed effect from '${clip.name}'`)

  const missing = ADDABLE.filter((a) => !clip.effects.some((e) => e.type === a.type))

  const add = (type: EffectType) => {
    const defaults: Partial<Record<EffectType, Partial<Effect>>> = {
      temperature: { value: 0 },
      tint: { value: 0 },
      vibrance: { value: 0.2 },
      grayscale: { value: 1 },
      'chromatic-aberration': { aberrationOffset: 2 },
      vignette: { value: 0.4, radius: 0.35 },
      grain: { value: 0.3 },
      glitch: { glitchIntensity: 0.3, scanlines: 8 },
    }
    const base = createEffect(type, 0)
    setEffects([...clip.effects, { ...base, ...defaults[type] }], `Applied effect to '${clip.name}'`)
  }

  const isVisualClip =
    target.track.type !== 'audio'

  return (
    <Section title="Effects">
      {/* Add effect */}
      <Row>
        <SelectInput
          value=""
          onChange={(v) => v && add(v as EffectType)}
          options={[
            { value: '', label: isVisualClip ? 'Add effect…' : 'Add audio-safe effect…' },
            ...(isVisualClip ? missing.map((a) => ({ value: a.type as string, label: a.label })) : []),
          ]}
        />
        <span className="text-muted-foreground flex size-7 shrink-0 items-center justify-center">
          <Plus className="size-3.5" />
        </span>
      </Row>

      {clip.effects.length === 0 && (
        <p className="text-muted-foreground text-[10px]">
          No effects yet. Color basics (brightness, contrast, saturation, hue, blur) live in Appearance.
        </p>
      )}

      {/* Effect rows */}
      <div className="space-y-2">
        {clip.effects
          .filter((e) => e.type in LABELS || ['brightness', 'contrast', 'saturation', 'hue', 'blur'].includes(e.type))
          .map((effect) => (
            <div key={effect.id} className="rounded-md border border-neutral-800 p-2" data-testid={`effect-row-${effect.type}`}>
              <div className="flex items-center gap-2">
                <MiniToggle
                  checked={effect.enabled}
                  onChange={(on) => patchEffect(effect.id, { enabled: on }, `Toggled effect on '${clip.name}'`)}
                  label={`${LABELS[effect.type] ?? effect.type} enabled`}
                />
                <span className="flex-1 truncate text-[11px] font-medium">
                  {LABELS[effect.type] ?? (effect.type.charAt(0).toUpperCase() + effect.type.slice(1))}
                </span>
                <button
                  type="button"
                  onClick={() => removeEffect(effect.id)}
                  title="Delete effect"
                  aria-label={`Delete ${effect.type}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {effect.enabled && isVisualClip && (
                <div className="mt-1 space-y-2 pl-9">
                  <EffectControls effect={effect} onChange={(patch) => patchEffect(effect.id, patch, `Adjusted effect on '${clip.name}'`)} />
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Speed */}
      <div className="space-y-2 rounded-md border border-neutral-800 p-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide uppercase">Speed</span>
          <MiniToggle
            checked={clip.preservePitch !== false}
            onChange={(on) => insp.update({ preservePitch: on }, `Changed pitch handling of '${clip.name}'`)}
            label="Preserve pitch"
          />
        </div>
        <LabeledSlider
          label="Rate"
          value={clip.speed}
          min={0.25}
          max={4}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => insp.batched({ speed: v }, `Changed speed of '${clip.name}'`)}
        />
        <div className="grid grid-cols-4 gap-1">
          {[0.5, 1, 1.5, 2].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => insp.update({ speed: rate }, `Changed speed of '${clip.name}'`)}
              className={
                Math.abs(clip.speed - rate) < 0.001
                  ? 'bg-[#3b82f6]/25 text-[#60a5fa] rounded border border-[#3b82f6]/40 py-1 text-[10px] font-medium'
                  : 'hover:bg-muted rounded border border-neutral-700 py-1 text-[10px]'
              }
            >
              {rate}×
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-[9px]">Pitch preservation keeps voice natural at non-1x rates.</p>
      </div>
    </Section>
  )
}
