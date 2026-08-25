import * as React from 'react'
import {
  Bold,
  Italic,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Underline,
  Strikethrough,
  Upload,
  Type,
  Sparkles,
} from 'lucide-react'
import type { TextAnimation, TextOverlay } from '@/engine/types'
import { TEXT_ANIMATIONS } from '@/engine/types'
import { useCustomFonts, type InspectorApi } from '@/hooks/useInspector'
import { GOOGLE_FONTS, loadGoogleFont, FONT_CATEGORIES } from '@/lib/fonts'
import { ColorInput, IconButtonGroup, LabeledSlider, MiniToggle, NumInput, Row, Section } from './controls'
import { cn } from '@/lib/utils'

const QUICK_COLORS = [
  '#ffffff',
  '#000000',
  '#facc15',
  '#38bdf8',
  '#a855f7',
  '#4ade80',
  '#fb7185',
  '#f97316',
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

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/)
  if (!m) return hex
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function TextSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  const t: TextOverlay | undefined = clip.text
  const fileRef = React.useRef<HTMLInputElement>(null)
  const customFonts = useCustomFonts()
  const [fontCat, setFontCat] = React.useState<string>('All')

  const filteredFonts = React.useMemo(() => {
    const base = fontCat === 'All' ? GOOGLE_FONTS : GOOGLE_FONTS.filter((f) => f.category === fontCat)
    return base
  }, [fontCat])

  // Auto load active font
  React.useEffect(() => {
    if (t?.fontFamily) {
      loadGoogleFont(t.fontFamily)
    }
  }, [t?.fontFamily])

  if (!t) return null

  const setText = (patch: Partial<TextOverlay>, label = `Edited text of '${clip.name}'`) =>
    insp.batched({ text: { ...t, ...patch } }, label)

  const bg = parseColor(t.backgroundColor)

  return (
    <Section title="Text & Typography">
      {/* 1. Content Textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Content</label>
          {/* Quick Case Transforms */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setText({ text: t.text.toUpperCase() })}
              className="rounded bg-muted/40 px-1 py-0.5 text-[9px] font-mono hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Convert to UPPERCASE"
            >
              AA
            </button>
            <button
              type="button"
              onClick={() => setText({ text: t.text.toLowerCase() })}
              className="rounded bg-muted/40 px-1 py-0.5 text-[9px] font-mono hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Convert to lowercase"
            >
              aa
            </button>
            <button
              type="button"
              onClick={() => setText({ text: t.text.replace(/\b\w/g, (c) => c.toUpperCase()) })}
              className="rounded bg-muted/40 px-1 py-0.5 text-[9px] font-mono hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Convert to Title Case"
            >
              Aa
            </button>
          </div>
        </div>
        <textarea
          rows={3}
          value={t.text}
          placeholder="Enter text overlay…"
          onChange={(e) => setText({ text: e.target.value })}
          className="w-full resize-y rounded-lg border border-border bg-[#0f0f1a] px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-500 ring-1 ring-border/40 focus:ring-violet-500/30"
        />
      </div>

      {/* 2. Live Typography Preview */}
      <div
        className="flex min-h-12 items-center justify-center overflow-hidden rounded-xl border border-border/60 p-3 shadow-inner"
        style={{ backgroundColor: t.backgroundColor === 'transparent' ? 'rgba(0,0,0,0.3)' : t.backgroundColor }}
      >
        <span
          style={{
            fontFamily: t.fontFamily,
            fontSize: `${Math.min(26, Math.max(12, t.fontSize * 0.45))}px`,
            fontWeight: t.fontWeight === 'bold' ? 700 : typeof t.fontWeight === 'string' && /^\d+$/.test(t.fontWeight) ? Number(t.fontWeight) : 400,
            fontStyle: t.fontStyle,
            color: t.color,
            textAlign: t.textAlign,
            letterSpacing: `${(t.letterSpacing ?? 0) * 0.4}px`,
            textDecoration: t.textDecoration ?? 'none',
          }}
          className="max-w-full truncate"
        >
          {t.text.split('\n')[0] || 'Typography Preview'}
        </span>
      </div>

      {/* 3. Google Fonts & Custom Font Selector */}
      <div className="space-y-1.5 rounded-xl border border-border/70 bg-card/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Type className="size-3 text-violet-500" />
            Google Fonts
          </span>
          <button
            type="button"
            title="Upload custom font file (.ttf, .otf, .woff, .woff2)"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-400 font-semibold"
          >
            <Upload className="size-3" />
            Upload Font
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
        </div>

        {/* Font category filter chips */}
        <div className="flex flex-wrap gap-1 pb-1">
          {FONT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFontCat(cat)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-semibold transition border',
                fontCat === cat
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 font-bold'
                  : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Font select dropdown */}
        <select
          value={t.fontFamily}
          onChange={(e) => {
            const font = e.target.value
            loadGoogleFont(font)
            setText({ fontFamily: font })
          }}
          className="w-full rounded-lg border border-border bg-[#0f0f1a] px-2 py-1.5 text-xs text-foreground outline-none focus:border-violet-500"
        >
          <optgroup label="Google Fonts">
            {filteredFonts.map((f) => (
              <option key={f.family} value={f.family}>
                {f.name} ({f.category})
              </option>
            ))}
          </optgroup>
          {customFonts.families.length > 0 && (
            <optgroup label="Uploaded Custom Fonts">
              {customFonts.families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* 4. Font Size & Text Formatting */}
      <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-2.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Typography & Style</span>

        <Row label="Size">
          <NumInput
            value={t.fontSize}
            min={8}
            max={240}
            onChange={(v) => setText({ fontSize: v }, `Resized text of '${clip.name}'`)}
            suffix="px"
          />
        </Row>
        <LabeledSlider
          label="Size slider"
          value={t.fontSize}
          min={10}
          max={180}
          format={(v) => `${v}px`}
          onChange={(v) => setText({ fontSize: v })}
        />

        {/* Font Weight & Styles */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setText({ fontWeight: t.fontWeight === 'bold' || t.fontWeight === '700' ? 'normal' : 'bold' })}
              className={cn(
                'flex size-7 items-center justify-center rounded-lg border transition',
                t.fontWeight === 'bold' || t.fontWeight === '700' || t.fontWeight === '800' || t.fontWeight === '900'
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
              title="Bold"
            >
              <Bold className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setText({ fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' })}
              className={cn(
                'flex size-7 items-center justify-center rounded-lg border transition',
                t.fontStyle === 'italic'
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
              title="Italic"
            >
              <Italic className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setText({ textDecoration: t.textDecoration === 'underline' ? 'none' : 'underline' })}
              className={cn(
                'flex size-7 items-center justify-center rounded-lg border transition',
                t.textDecoration === 'underline'
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
              title="Underline"
            >
              <Underline className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setText({ textDecoration: t.textDecoration === 'line-through' ? 'none' : 'line-through' })}
              className={cn(
                'flex size-7 items-center justify-center rounded-lg border transition',
                t.textDecoration === 'line-through'
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
              title="Strikethrough"
            >
              <Strikethrough className="size-3.5" />
            </button>
          </div>

          {/* Alignment */}
          <IconButtonGroup<'left' | 'center' | 'right'>
            value={t.textAlign}
            onChange={(v) => setText({ textAlign: v })}
            options={[
              { value: 'left', node: <TextAlignStart className="size-3.5" />, title: 'Align Left' },
              { value: 'center', node: <TextAlignCenter className="size-3.5" />, title: 'Align Center' },
              { value: 'right', node: <TextAlignEnd className="size-3.5" />, title: 'Align Right' },
            ]}
          />
        </div>

        {/* Letter Spacing & Line Height */}
        <div className="space-y-1.5 pt-1">
          <LabeledSlider
            label="Spacing"
            value={t.letterSpacing ?? 0}
            min={-4}
            max={24}
            format={(v) => `${v}px`}
            onChange={(v) => setText({ letterSpacing: v })}
          />
          <LabeledSlider
            label="Line Height"
            value={Math.round((t.lineHeight ?? 1.2) * 10)}
            min={8}
            max={25}
            format={(v) => `${(v / 10).toFixed(1)}×`}
            onChange={(v) => setText({ lineHeight: v / 10 })}
          />
        </div>
      </div>

      {/* 5. Text Color & Palette */}
      <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-2.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Text Color</span>
        <div className="flex items-center gap-2">
          <ColorInput value={t.color} onChange={(hex) => setText({ color: hex })} />
        </div>
        <div className="flex items-center gap-1 pt-1">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setText({ color: c })}
              style={{ backgroundColor: c }}
              className={cn(
                'size-5 rounded-full border border-white/20 transition-transform hover:scale-110 shadow-xs',
                t.color === c && 'ring-2 ring-violet-500 scale-110',
              )}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* 6. Background Box */}
      <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Background Box</span>
          <MiniToggle
            checked={parseColor(t.backgroundColor).alpha > 0}
            onChange={(on) => setText({ backgroundColor: on ? hexToRgba(bg.hex || '#000000', 0.75) : 'transparent' })}
            label="Background Box"
          />
        </div>

        {parseColor(t.backgroundColor).alpha > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 text-[10px]">Color</span>
              <ColorInput
                value={bg.hex}
                onChange={(hex) => {
                  const alpha = parseColor(t.backgroundColor).alpha || 0.75
                  setText({ backgroundColor: hexToRgba(hex, alpha) })
                }}
                allowAlphaNote
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
              label="Corner Radius"
              value={t.borderRadius}
              min={0}
              max={48}
              format={(v) => `${v}px`}
              onChange={(v) => setText({ borderRadius: v })}
            />
          </div>
        )}
      </div>

      {/* 7. Outline / Stroke */}
      <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Outline / Stroke</span>
          <MiniToggle
            checked={Boolean(t.stroke && t.stroke.width > 0)}
            onChange={(on) => setText({ stroke: { width: on ? 2 : 0, color: t.stroke?.color ?? '#000000' } })}
            label="Stroke Outline"
          />
        </div>

        {Boolean(t.stroke && t.stroke.width > 0) && (
          <div className="space-y-2 pt-1">
            <LabeledSlider
              label="Width"
              value={t.stroke?.width ?? 2}
              min={1}
              max={16}
              format={(v) => `${v}px`}
              onChange={(v) => setText({ stroke: { width: v, color: t.stroke?.color ?? '#000000' } })}
            />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 text-[10px]">Color</span>
              <ColorInput
                value={t.stroke?.color ?? '#000000'}
                onChange={(hex) => setText({ stroke: { width: t.stroke?.width ?? 2, color: hex } })}
              />
            </div>
          </div>
        )}
      </div>

      {/* 8. Drop Shadow */}
      <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Drop Shadow</span>
          <MiniToggle checked={t.shadow} onChange={(on) => setText({ shadow: on })} label="Drop Shadow" />
        </div>

        {t.shadow && (
          <div className="space-y-2 pt-1">
            <LabeledSlider
              label="Blur"
              value={t.shadowBlur ?? 6}
              min={0}
              max={30}
              format={(v) => `${v}px`}
              onChange={(v) => setText({ shadowBlur: v })}
            />
            <LabeledSlider
              label="Offset X"
              value={t.shadowOffsetX ?? 2}
              min={-20}
              max={20}
              format={(v) => `${v}px`}
              onChange={(v) => setText({ shadowOffsetX: v })}
            />
            <LabeledSlider
              label="Offset Y"
              value={t.shadowOffsetY ?? 2}
              min={-20}
              max={20}
              format={(v) => `${v}px`}
              onChange={(v) => setText({ shadowOffsetY: v })}
            />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 text-[10px]">Color</span>
              <ColorInput
                value={parseColor(t.shadowColor ?? 'rgba(0,0,0,0.7)').hex}
                allowAlphaNote
                onChange={(hex) => setText({ shadowColor: hexToRgba(hex, 0.75) })}
              />
            </div>
          </div>
        )}
      </div>

      {/* 9. Motion Animation */}
      <div className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="size-3 text-violet-500" />
            Motion Animation
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {t.animation ?? 'none'}
          </span>
        </div>

        <select
          value={t.animation ?? 'none'}
          onChange={(v) => setText({ animation: v.target.value as TextAnimation })}
          className="w-full rounded-lg border border-border bg-[#0f0f1a] px-2 py-1.5 text-xs text-foreground outline-none focus:border-violet-500"
        >
          {TEXT_ANIMATIONS.map((a) => (
            <option key={a} value={a}>
              {ANIMATION_LABELS[a]}
            </option>
          ))}
        </select>

        {(t.animation ?? 'none') !== 'none' && (
          <LabeledSlider
            label="Duration"
            value={Math.round((t.animationDuration ?? 0.5) * 10)}
            min={1}
            max={30}
            format={(v) => `${(v / 10).toFixed(1)}s`}
            onChange={(v) => setText({ animationDuration: v / 10 })}
          />
        )}
      </div>
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
        className="accent-violet-500 h-1 min-w-0 flex-1 cursor-pointer"
      />
      <input
        type="range"
        min={0}
        max={80}
        value={value[1]}
        onChange={(e) => onChange(value[0], Number(e.target.value))}
        className="accent-violet-500 h-1 min-w-0 flex-1 cursor-pointer"
      />
      <span className="w-6 text-right font-mono text-[9px] text-muted-foreground">{value[0] + value[1]}</span>
    </label>
  )
}
