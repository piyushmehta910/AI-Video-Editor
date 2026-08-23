import { AlertCircle, Info, X } from 'lucide-react'
import type { QualityIssue } from '@/ai/quality/checker'

/**
 * Proactive quality-check card. One-click fix, per-issue ignore and a
 * project-scoped "don't show again" dismissal.
 */

const SEVERITY_STYLES = {
  error: 'border-[#f87171]',
  warning: 'border-[#eab308]',
  info: 'border-neutral-700',
} as const

const SEVERITY_ICONS = {
  error: <AlertCircle className="size-3.5 shrink-0 text-[#f87171]" />,
  warning: <AlertCircle className="size-3.5 shrink-0 text-[#eab308]" />,
  info: <Info className="size-3.5 shrink-0 text-neutral-400" />,
} as const

export function SuggestionCard({
  issue,
  onFix,
  onIgnore,
  onHideForever,
}: {
  issue: QualityIssue
  onFix: (issue: QualityIssue) => void
  onIgnore: (issue: QualityIssue) => void
  onHideForever: (issue: QualityIssue) => void
}) {
  const fixable = issue.fix.kind !== 'none'

  return (
    <div
      className={`rounded-lg border bg-neutral-900/80 px-3 py-2 ${SEVERITY_STYLES[issue.severity]}`}
      data-testid="suggestion-card"
      data-severity={issue.severity}
    >
      <div className="flex items-start gap-2">
        {SEVERITY_ICONS[issue.severity]}
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-200">{issue.message}</p>
        {!fixable && (
          <button
            onClick={() => onIgnore(issue)}
            title="Dismiss"
            aria-label="Dismiss suggestion"
            className="shrink-0 rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {fixable && (
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <button
            onClick={() => onHideForever(issue)}
            className="text-[10px] text-neutral-500 underline-offset-2 hover:text-neutral-400 hover:underline"
          >
            Don't show again for this project
          </button>
          <button
            data-testid="suggestion-fix-button"
            onClick={() => onFix(issue)}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-blue-500"
          >
            Fix it
          </button>
          <button
            onClick={() => onIgnore(issue)}
            className="rounded-md border border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:bg-neutral-800"
          >
            Ignore
          </button>
        </div>
      )}
    </div>
  )
}
