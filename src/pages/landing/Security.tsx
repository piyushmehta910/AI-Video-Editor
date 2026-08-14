import { CloudOff, KeyRound, MonitorUp, ShieldCheck } from 'lucide-react'
import { Section } from './Section'

const POINTS = [
  {
    icon: CloudOff,
    title: 'Never uploads video',
    description: 'Processing is 100% client-side. Raw media stays on your device.',
  },
  {
    icon: KeyRound,
    title: 'Zero hard-coded keys',
    description: 'API keys are entered by you and encrypted at rest with AES-256-GCM.',
  },
  {
    icon: ShieldCheck,
    title: 'Approval-first AI',
    description: 'Destructive or paid operations pause for your confirmation.',
  },
  {
    icon: MonitorUp,
    title: 'Works offline',
    description: 'Core editing needs no network. AI models load once, then run locally.',
  },
]

export function Security() {
  return (
    <Section
      id="security"
      eyebrow="Private by design"
      title="Your footage never leaves your machine"
      subtitle="A video editor that respects the source material it edits."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map((point) => (
          <div key={point.title} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <point.icon className="size-5" />
            </div>
            <h3 className="text-sm font-semibold">{point.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{point.description}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}