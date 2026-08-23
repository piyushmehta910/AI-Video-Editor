import type { Transition, TransitionEasing, TransitionType } from '@/engine/types'
import { TRANSITION_EASINGS } from '@/engine/types'
import type { InspectorApi } from '@/hooks/useInspector'
import { LabeledSlider, Row, Section, SelectInput } from './controls'

/**
 * "Fade" is exposed as a friendly alias of the dissolve transition (the
 * renderer models all transitions as alpha/transform curves). "Push" is not
 * offered because the engine composes transitions as alpha only.
 */
const TYPES: Array<{ value: TransitionType | ''; label: string }> = [
  { value: '', label: 'None' },
  { value: 'cut', label: 'Cut' },
  { value: 'dissolve', label: 'Fade (Dissolve)' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'wipe-left', label: 'Wipe Left' },
  { value: 'wipe-right', label: 'Wipe Right' },
  { value: 'wipe-up', label: 'Wipe Up' },
  { value: 'wipe-down', label: 'Wipe Down' },
]

const EASING_LABELS: Record<TransitionEasing, string> = {
  linear: 'Linear',
  'ease-in': 'Ease In',
  'ease-out': 'Ease Out',
  'ease-in-out': 'Ease In Out',
}

function TransitionEditor({
  which,
  transition,
  onChange,
}: {
  which: 'in' | 'out'
  transition: Transition | undefined
  onChange: (t: Transition | undefined, label: string) => void
}) {
  const type: TransitionType | '' = transition?.type ?? ''
  return (
    <div className="space-y-2 rounded-md border border-neutral-800 p-2" data-testid={`transition-${which}`}>
      <Row label="Type">
        <SelectInput
          value={type}
          onChange={(v) =>
            onChange(
              v ? { type: v as TransitionType, duration: transition?.duration ?? 0.5, easing: transition?.easing } : undefined,
              `Changed ${which} transition`,
            )
          }
          options={TYPES}
        />
      </Row>
      {transition && (
        <>
          <LabeledSlider
            label="Duration"
            value={transition.duration}
            min={0.1}
            max={5}
            step={0.1}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(v) => onChange({ ...transition, duration: v }, `Changed ${which} transition`)}
          />
          <Row label="Easing">
            <SelectInput
              value={transition.easing ?? 'ease-in-out'}
              onChange={(v) => onChange({ ...transition, easing: v as TransitionEasing }, `Changed ${which} transition curve`)}
              options={TRANSITION_EASINGS.map((e) => ({ value: e, label: EASING_LABELS[e] }))}
            />
          </Row>
        </>
      )}
    </div>
  )
}

/** Incoming/outgoing transitions for the selected clip. */
export function TransitionsSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  if (target.track.type === 'audio') return null

  const setTransitions = (patch: Partial<typeof clip.transitions>, label: string) =>
    insp.update({ transitions: { ...clip.transitions, ...patch } }, label)

  return (
    <Section title="Transitions">
      <Row label="In" stack>
        <TransitionEditor
          which="in"
          transition={clip.transitions.in}
          onChange={(t, label) => setTransitions({ in: t }, `${label} of '${clip.name}'`)}
        />
      </Row>
      <Row label="Out" stack>
        <TransitionEditor
          which="out"
          transition={clip.transitions.out}
          onChange={(t, label) => setTransitions({ out: t }, `${label} of '${clip.name}'`)}
        />
      </Row>
      <p className="text-muted-foreground text-[9px]">
        Transitions overlap the clip edges — the first/last few seconds blend in or out.
      </p>
    </Section>
  )
}
