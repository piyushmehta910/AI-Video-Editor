import { Slider } from '@/components/ui/slider'
import { FieldRow } from './FieldRow'

interface SliderFieldProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  /** Display as an integer instead of a 2-decimal value. */
  integer?: boolean
}

export function SliderField({ label, value, min = 0, max = 1, step = 0.05, onChange, integer = false }: SliderFieldProps) {
  return (
    <FieldRow label={label} hint={`Current: ${integer ? value : value.toFixed(2)}`}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </FieldRow>
  )
}