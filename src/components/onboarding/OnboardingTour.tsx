import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const TOUR_DISMISSED_KEY = 'clipforge-tour-dismissed'

interface TourStep {
  /** CSS selector for the highlighted element. */
  target: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  { target: '[data-testid="timeline-root"]', title: 'This is your timeline', body: 'Media lives on tracks — video on V, audio on A, text on T, effects on FX. The sample project already has clips on every type.' },
  { target: '[data-testid="playhead"]', title: 'Scrub through time', body: 'Click and drag the red playhead to move around. Click the preview to play or pause.' },
  { target: '[data-clip-id]', title: 'Select a clip to edit it', body: 'Click any clip — the Inspector on the right shows its transform, audio and text properties.' },
  { target: '[data-testid="ai-director-button"]', title: 'Let the AI Director edit for you', body: 'Describe what you want in plain language and the AI Director proposes cuts, structure and fixes you can apply with one click.' },
  { target: '[data-testid="export-button"]', title: 'Export when ready', body: 'Render your timeline to a video file entirely on your machine — nothing is uploaded.' },
]

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

function rectFor(selector: string): Rect | null {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/**
 * First-run guided tour. Custom overlay (no external dependency): a cutout
 * highlight via an enormous box-shadow, step card anchored below/above the
 * target, "don't show again" persisted to localStorage.
 */
export function OnboardingTour({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = React.useState(0)
  const [rect, setRect] = React.useState<Rect | null>(null)
  const [doNotShowAgain, setDoNotShowAgain] = React.useState(false)

  React.useEffect(() => {
    const update = () => setRect(rectFor(STEPS[step].target))
    update()
    // Targets can mount late (lazy chunks) — retry briefly.
    const retries = window.setInterval(() => {
      if (rectFor(STEPS[step].target)) {
        update()
        window.clearInterval(retries)
      }
    }, 150)
    window.setTimeout(() => window.clearInterval(retries), 4000)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.clearInterval(retries)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  const finish = () => {
    try {
      if (doNotShowAgain) localStorage.setItem(TOUR_DISMISSED_KEY, '1')
    } catch {
      // ignore storage errors
    }
    onFinish()
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else finish()
  }

  const current = STEPS[step]
  const cardBelow = rect ? rect.top + rect.height + 180 < window.innerHeight : true

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Getting started tour">
      {/* Cutout overlay */}
      {rect && (
        <div
          className="absolute transition-all duration-300 ease-out"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(5,5,10,0.72)',
            border: '2px solid #a855f7',
            pointerEvents: 'none',
          }}
        />
      )}
      {!rect && <div className="absolute inset-0 bg-black/70" />}

      {/* Step card */}
      <div
        className={cn(
          'bg-card absolute z-10 w-[min(24rem,calc(100vw-2rem))] rounded-xl border p-4 shadow-2xl',
        )}
        style={
          rect
            ? {
                left: Math.min(Math.max(16, rect.left), window.innerWidth - 416),
                ...(cardBelow ? { top: rect.top + rect.height + 20 } : { bottom: window.innerHeight - rect.top + 20 }),
              }
            : { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-violet-500 dark:text-violet-400 text-[10px] font-semibold tracking-widest uppercase">
              Step {step + 1} of {STEPS.length}
            </p>
            <h3 className="mt-1 text-sm font-semibold">{current.title}</h3>
          </div>
          <button onClick={finish} aria-label="Skip tour" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{current.body}</p>

        <label className="text-muted-foreground mt-3 flex cursor-pointer items-center gap-1.5 text-[11px] select-none">
          <input
            type="checkbox"
            checked={doNotShowAgain}
            onChange={(e) => setDoNotShowAgain(e.target.checked)}
            className="accent-violet-500 size-3"
          />
          Don't show again
        </label>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={cn('size-1.5 rounded-full transition-colors', i === step ? 'bg-violet-500' : 'bg-muted-foreground/30')} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {step > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button variant="secondary" size="sm" className="h-7 bg-violet-600 px-3 text-xs text-white hover:bg-violet-500" onClick={next}>
              {step === STEPS.length - 1 ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
