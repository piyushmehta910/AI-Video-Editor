import * as React from 'react'
import { Bold, Italic, TextAlignCenter, TextAlignEnd, TextAlignStart, Upload } from 'lucide-react'
import type { TextAnimation, TextOverlay } from '@/engine/types'
import { TEXT_ANIMATIONS } from '@/engine/types'
import { useCustomFonts, type InspectorApi } from '@/hooks/useInspector'
import { ColorInput, IconButtonGroup, LabeledSlider, MiniToggle, NumInput, Row, Section, SelectInput } from './controls'

const BASE_FONTS = [
  'Inter, system-ui, sans-serif',
  'Roboto, system-ui, sans-serif',
  'Oswald, Impact, sans-serif',
  'Montserrat, system-ui, sans-serif',
  'Poppins, system-ui, sans-serif',
  'Playfair Display, Georgia, serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
]

const ANIMATION_LABELS: Record<TextAnimation, string> = {
  none: 'None',
  'fade-in': 'Fade In',
  'slide-up': 'Slide Up',
  'slide-down': 'Slide Down',
  'slide-left': 'Slide Left',
  'slide-right': 'Slide Right',
  'zoom-in': 'Zoom In',
  'zoom-out': 'Zoom Out',
  pop: 'Pop',
  typewriter: 'Typewriter',
  bounce: 'Bounce',
}

/** Parse a stored color (hex or rgba()) into hex + alpha for editing. */
function parseColor(color: string): { hex: string; alpha: number } {
  const rgba = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/)
  if (rgba) {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')
    return {
      hex: `#${toHex(rgba[1])}${toHex(rgba[2])}${toHex(rgba[3])}`,
      alpha: rgba[4] != null ? Number(rgba[4]) : 1,
    }
  }
  const alpha = color === 'transparent' ? 0 : 1
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'
  return { hex, alpha }
}

/** Text properties — only rendered when the clip carries a TextOverlay. */
export function TextSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  // Ensure a text overlay exists on text-track clips so the section is usable.
  const t: TextOverlay | undefined = clip.text
  const fileRef = React.useRef<HTMLInputElement>(null)
  const customFonts = useCustomFonts()

  if (!t) return null

  const setText = (patch: Partial<TextOverlay>, label = `Edited text of '${clip.name}'`) =>
    insp.batched({ text: { ...t, ...patch } }, label)

  const bg = parseColor(t.backgroundColor)
  const families = [...BASE_FONTS, ...customFonts.families.filter((f) => !BASE_FONTS.some((b) => b.startsWith(f)))]

  return (
    <Section title="Text">
      <textarea
        rows={3}
        value={t.text}
        placeholder="Enter text…"
        onChange={(e) => setText({ text: e.target.value })}
        className="bg-[#0f0f1a] border-border/80 focus:border-[#60a5fa] w-full resize-y rounded-md border px-2 py-1.5 text-xs outline-none"
      />

      {/* Live preview of the current style */}
      <div
        className="flex min-h-10 items-center justify-center overflow-hidden rounded-md border border-neutral-800 p-2"
        style={{ backgroundColor: t.backgroundColor }}
      >
        <span
          style={{
            fontFamily: t.fontFamily,
            fontSize: Math.min(28, t.fontSize),
            fontWeight: t.fontWeight === 'bold' ? 700 : 400,
            fontStyle: t.fontStyle,
            color: t.color,
            textAlign: t.textAlign,
          }}
        >
          {t.text.split('\n')[0] || 'Preview'}
        </span>
      </div>

      <Row label="Font">
        <SelectInput value={t.fontFamily} onChange={(v) => setText({ fontFamily: v })} options={families.map((f) => ({ value: f, label: f.split(',')[0] }))} />
        <button
          type="button"
          title="Upload a custom font (.ttf, .otf, .woff, .woff2)"
          onClick={() => fileRef.current?.click()}
          className="text-muted-foreground hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-700"
        >
          <Upload className="size-3.5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void customFonts.upload(file).then((family) => setText({ fontFamily: family }))
            e.target.value = ''
          }}
        />
      </Row>

      <Row label="Size">
        <NumInput value={t.fontSize} min={8} max={200} onChange={(v) => setText({ fontSize: v }, `Resized text of '${clip.name}'`)} suffix="px" />
        <MiniToggle checked={t.fontWeight === 'bold'} onChange={(on) => setText({ fontWeight: on ? 'bold' : 'normal' })} label="Bold" />
        <Bold className="text-muted-foreground size-3.5" />
        <MiniToggle checked={t.fontStyle === 'italic'} onChange={(on) => setText({ fontStyle: on ? 'italic' : 'normal' })} label="Italic" />
        <Italic className="text-muted-foreground size-3.5" />
      </Row>

      <Row label="Color">
        <ColorInput value={t.color} onChange={(hex) => setText({ color: hex })} />
      </Row>

      {/* Background */}
      <Row label="Back" stack>
        <div className="space-y-1.5 rounded-md border border-neutral-800 p-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 text-[10px]">Color</span>
            <ColorInput
              value={bg.hex}
              onChange={(hex) => {
                const alpha = parseColor(t.backgroundColor).alpha
                setText({
                  backgroundColor: alpha <= 0 ? 'transparent' : hexToRgba(hex, alpha),
                })
              }}
              allowAlphaNote
            />
            <MiniToggle
              checked={parseColor(t.backgroundColor).alpha > 0}
              onChange={(on) => setText({ backgroundColor: on ? hexToRgba(bg.hex, 0.7) : 'transparent' })}
              label="Background on/off"
            />
          </div>
          <LabeledSlider
            label="Opacity"
            value={Math.round(bg.alpha * 100)}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={(v) => setText({ backgroundColor: v === 0 ? 'transparent' : hexToRgba(bg.hex, v / 100) })}
          />
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <PaddingField label="Pad X" value={[t.paddingLeft, t.paddingRight]} onChange={(l, r) => setText({ paddingLeft: l, paddingRight: r })} />
            <PaddingField label="Pad Y" value={[t.paddingTop, t.paddingBottom]} onChange={(tp, b) => setText({ paddingTop: tp, paddingBottom: b })} />
          </div>
          <LabeledSlider
            label="Radius"
            value={t.borderRadius}
            min={0}
            max={64}
            format={(v) => `${v}px`}
            onChange={(v) => setText({ borderRadius: v })}
          />
        </div>
      </Row>

      <Row label="Align">
        <IconButtonGroup<'left' | 'center' | 'right'>
          value={t.textAlign}
          onChange={(v) => setText({ textAlign: v })}
          options={[
            { value: 'left', node: <TextAlignStart className="size-4" />, title: 'Align left' },
            { value: 'center', node: <TextAlignCenter className="size-4" />, title: 'Align center' },
            { value: 'right', node: <TextAlignEnd className="size-4" />, title: 'Align right' },
          ]}
        />
      </Row>

      <Row label="Anim">
        <SelectInput
          value={t.animation ?? 'none'}
          onChange={(v) => setText({ animation: v as TextAnimation })}
          options={TEXT_ANIMATIONS.map((a) => ({ value: a, label: ANIMATION_LABELS[a] }))}
        />
      </Row>
      {(t.animation ?? 'none') !== 'none' && (
        <LabeledSlider
          label="Anim time"
          value={t.animationDuration ?? 1}
          min={0.2}
          max={3}
          step={0.1}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(v) => setText({ animationDuration: v })}
        />
      )}

      {/* Stroke */}
      <Row label="Stroke" stack>
        <div className="flex items-center gap-2">
          <NumInput
            value={t.stroke?.width ?? 0}
            min={0}
            max={20}
            onChange={(v) => setText({ stroke: { width: v, color: t.stroke?.color ?? '#000000' } })}
            suffix="px"
          />
          <ColorInput
            value={t.stroke?.color ?? '#000000'}
            onChange={(hex) => setText({ stroke: { width: Math.max(1, t.stroke?.width ?? 2), color: hex } })}
          />
        </div>
      </Row>

      {/* Shadow */}
      <Row label="Shadow" stack>
        <div className="space-y-1.5 rounded-md border border-neutral-800 p-2">
          <div className="flex items-center justify-between">
            <MiniToggle checked={t.shadow} onChange={(on) => setText({ shadow: on })} label="Text shadow" />
            <span className="text-muted-foreground text-[10px]">{t.shadow ? 'On' : 'Off'}</span>
          </div>
          {t.shadow && (
            <>
              <LabeledSlider
                label="Blur"
                value={t.shadowBlur ?? 6}
                min={0}
                max={30}
                format={(v) => `${v}px`}
                onChange={(v) => setText({ shadowBlur: v })}
              />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-12 text-[10px]">Color</span>
                <ColorInput
                  value={parseColor(t.shadowColor ?? 'rgba(0,0,0,0.7)').hex}
                  allowAlphaNote
                  onChange={(hex) => setText({ shadowColor: hexToRgba(hex, 0.7) })}
                />
              </div>
            </>
          )}
        </div>
      </Row>
    </Section>
  )
}

function PaddingField({
  label,
  value,
  onChange,
}: {
  label: string
  value: [number, number]
  onChange: (a: number, b: number) => void
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground w-11 shrink-0 text-[10px]">{label}</span>
      <input
        type="range"
        min={0}
        max={80}
        value={value[0]}
        onChange={(e) => onChange(Number(e.target.value), value[1])}
        className="accent-[#3b82f6] h-1 min-w-0 flex-1"
      />
      <input
        type="range"
        min={0}
        max={80}
        value={value[1]}
        onChange={(e) => onChange(value[0], Number(e.target.value))}
        className="accent-[#3b82f6] h-1 min-w-0 flex-1"
      />
      <span className="w-6 text-right font-mono text-[9px]">{value[0] + value[1]}</span>
    </label>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/)
  if (!m) return hex
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
