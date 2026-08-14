import { BookOpenText, Clapperboard, Globe, UserRound, ArrowRight } from 'lucide-react'
import { Section } from './Section'

const WORKFLOWS = [
  {
    icon: Clapperboard,
    title: 'Video → Reel',
    trigger: 'Make this 10-min video a 30-sec Reel',
    steps: [
      'Detect scenes & find highlights',
      'Trim, remove silence, auto-reframe to 9:16',
      'Whisper captions burned in',
      'Music ducked under speech',
    ],
  },
  {
    icon: BookOpenText,
    title: 'PDF → Lesson',
    trigger: 'Make a 1-min Hindi video from this PDF',
    steps: [
      'Extract text from the PDF',
      'Generate script with NVIDIA NIM',
      'Voiceover with ElevenLabs',
      'Avatar + lip-sync on presentation slides',
    ],
  },
  {
    icon: Globe,
    title: 'Article → Video',
    trigger: 'Turn this article into a video',
    steps: [
      'Scrape & fact-check with Firecrawl',
      'Script per section',
      'Stock B-roll from Unsplash/Pexels',
      'Voice, captions and music assembled',
    ],
  },
  {
    icon: UserRound,
    title: 'Avatar sales video',
    trigger: 'Create a 30-sec sales video with my avatar',
    steps: [
      'Sales script generated',
      'Voice cloned/selected',
      'Avatar renders + lipsyncs',
      'B-roll, captions and export',
    ],
  },
]

export function Workflows() {
  return (
    <Section
      id="workflows"
      eyebrow="AI Pipelines"
      title="One instruction, a full production"
      subtitle="Built-in pipelines chain local tools and optional APIs into a finished export."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {WORKFLOWS.map((workflow) => (
          <div
            key={workflow.title}
            className="group flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-violet-600 dark:text-violet-400">
                <workflow.icon className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{workflow.title}</h3>
                <p className="text-muted-foreground font-mono text-xs italic">“{workflow.trigger}”</p>
              </div>
            </div>
            <ol className="flex flex-col gap-2">
              {workflow.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-2 text-sm">
                  <span className="text-violet-600 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-violet-500/10 font-mono text-[10px] font-semibold dark:text-violet-400">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400">
              Run pipeline
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}