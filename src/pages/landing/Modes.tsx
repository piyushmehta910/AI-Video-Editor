import { Hand, Layers3, Sparkles } from 'lucide-react'
import { Section } from './Section'
import { cn } from '@/lib/utils'

const MODES = [
  {
    icon: Hand,
    name: 'Human Mode',
    tagline: 'You drive, frame by frame',
    points: [
      'Full timeline, trimming and keyframe control',
      'Effects, text, transitions and audio mixing',
      'Precise inspector for every property',
    ],
    accent: 'from-sky-500 to-emerald-500',
  },
  {
    icon: Sparkles,
    name: 'AI Mode',
    tagline: 'Describe it, the director builds it',
    points: [
      'Natural-language instructions, not menus',
      'Structured agent plans before it acts',
      'Every result stays fully editable',
    ],
    accent: 'from-violet-500 to-fuchsia-500',
    featured: true,
  },
  {
    icon: Layers3,
    name: 'Hybrid Mode',
    tagline: 'Automate the busywork, keep control',
    points: [
      '"Auto-generate everything, but let me fix captions"',
      'AI obeys the boundaries you set',
      'Approval levels for expensive or destructive steps',
    ],
    accent: 'from-amber-500 to-orange-500',
  },
]

export function Modes() {
  return (
    <Section
      id="modes"
      eyebrow="Three ways to work"
      title="Human, AI, or somewhere between"
      subtitle="The AI operates the editor — it never replaces it. You always stay in command."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODES.map((mode) => (
          <div
            key={mode.name}
            className={cn(
              'relative flex flex-col gap-4 rounded-2xl border p-6 transition-all',
              mode.featured
                ? 'border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-transparent shadow-lg shadow-violet-500/10'
                : 'bg-card hover:-translate-y-0.5 hover:shadow-lg',
            )}
          >
            {mode.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
                Recommended
              </span>
            )}
            <div
              className={cn(
                'flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
                mode.accent,
              )}
            >
              <mode.icon className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{mode.name}</h3>
              <p className="text-muted-foreground text-sm">{mode.tagline}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {mode.points.map((point) => (
                <li key={point} className="text-muted-foreground flex items-start gap-2 text-sm">
                  <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full bg-gradient-to-r', mode.accent)} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}