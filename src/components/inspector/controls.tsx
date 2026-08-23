import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

/**
 * Shared inspector control atoms. Styling follows the inspector design spec:
 * inputs #0f0f1a on #334155 borders with #60a5fa focus, sliders with a
 * #334155 track and #3b82f6 fill, 14px bold uppercase section headers.
 */

export function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div className="border-b-border/70 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hover:text-foreground text-foreground flex w-full items-center justify-between py-2.5 text-left"
      >
        <span className="text-[14px] leading-none font-bold tracking-widest uppercase">{title}</span>
        <svg
          viewBox="0 0 24 24"
          className={cn('text-muted-foreground size-4 transition-transform', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="space-y-3 pt-1 pb-3">{children}</div>}
    </div>
  )
}

export function Row({
  label,
  children,
  right,
  stack,
}: {
  label?: string
  children: React.ReactNode
  right?: React.ReactNode
  /** Stack the label above full-width children (sliders). */
  stack?: boolean
}) {
  if (stack || !label) {
    return (
      <div className="space-y-1">
        {(label || right) && (
          <div className="flex items-center justify-between">
            {label && <span className="text-muted-foreground text-[11px]">{label}</span>}
            {right}
          </div>
        )}
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16 shrink-0 truncate text-[11px]" title={label}>
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  )
}

/** Numeric input with local editing state, committing on each keystroke. */
export function NumInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const shown = draft ?? String(Math.round(value * 100) / 100)
  return (
    <div className={cn('relative flex-1', disabled && 'opacity-40')}>
      <input
        type="number"
        value={shown}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value)
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(clamp(v, min, max))
        }}
        onBlur={() => setDraft(null)}
        className="focus:border-[#60a5fa] bg-[#0f0f1a] border-border/80 h-7 w-full rounded-md border px-2 font-mono text-[11px] outline-none"
      />
      {suffix && (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[10px]">
          {suffix}
        </span>
      )}
    </div>
  )
}

function clamp(v: number, min?: number, max?: number): number {
  let out = v
  if (min != null) out = Math.max(min, out)
  if (max != null) out = Math.min(max, out)
  return out
}

/** Radix slider restyled per spec: #334155 track, #3b82f6 fill, compact thumb. */
export function PanelSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
}) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-4 w-full touch-none items-center select-none', disabled && 'opacity-40')}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(vals) => onChange(vals[0])}
    >
      <SliderPrimitive.Track className="bg-[#334155] relative h-1 w-full grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-[#3b82f6] absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="border-[#60a5fa] bg-background block size-3 rounded-full border shadow transition-colors hover:bg-[#60a5fa]/20 focus-visible:outline-none" />
    </SliderPrimitive.Root>
  )
}

/** Slider + live value readout stacked under a label row. */
export function LabeledSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  right,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  right?: React.ReactNode
}) {
  return (
    <Row label={label} right={right} stack>
      <div className="flex items-center gap-2">
        <PanelSlider value={value} min={min} max={max} step={step} onChange={onChange} />
        <span className="w-14 shrink-0 text-right font-mono text-[10px] text-neutral-400">
          {format ? format(value) : value}
        </span>
      </div>
    </Row>
  )
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Color swatch + hex field in one control. */
export function ColorInput({
  value,
  onChange,
  allowAlphaNote,
}: {
  value: string
  onChange: (hex: string) => void
  allowAlphaNote?: boolean
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const hex = HEX_RE.test(value) ? value : '#000000'
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="size-7 shrink-0 cursor-pointer rounded border border-neutral-700 bg-transparent p-0.5"
        title={allowAlphaNote ? 'Color (alpha is controlled separately)' : undefined}
      />
      <input
        value={draft ?? value}
        onChange={(e) => {
          setDraft(e.target.value)
          if (HEX_RE.test(e.target.value)) onChange(e.target.value.toLowerCase())
        }}
        onBlur={() => setDraft(null)}
        spellCheck={false}
        className="focus:border-[#60a5fa] bg-[#0f0f1a] border-border/80 h-7 w-full min-w-0 rounded-md border px-2 font-mono text-[11px] outline-none"
      />
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export function SelectInput({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#0f0f1a] border-border/80 focus:border-[#60a5fa] h-7 w-full min-w-0 rounded-md border px-1.5 text-[11px] outline-none disabled:opacity-40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Small icon toggle used for mute / bold / enable states. */
export function MiniToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-4 w-7 shrink-0 rounded-full transition-colors',
        checked ? 'bg-[#3b82f6]' : 'bg-[#334155]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-3 rounded-full bg-white transition-all',
          checked ? 'left-3.5' : 'left-0.5',
        )}
      />
    </button>
  )
}

/** Compact icon button row for alignment-style choices. */
export function IconButtonGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; node: React.ReactNode; title: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="border-border/80 flex overflow-hidden rounded-md border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-label={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-7 flex-1 items-center justify-center transition-colors',
            value === o.value
              ? 'bg-[#3b82f6]/25 text-[#60a5fa]'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {o.node}
        </button>
      ))}
    </div>
  )
}
