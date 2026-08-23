import { Diamond } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Keyframe toggle shown beside inspector properties. Filled diamond = a
 * keyframe exists at the playhead for that property.
 */
export function KeyframeButton({
  active,
  onToggle,
  title,
}: {
  active: boolean
  onToggle: () => void
  title: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={`${title} — add/remove keyframe at playhead`}
      onClick={onToggle}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded transition-colors',
        active ? 'text-[#60a5fa]' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Diamond
        className="size-3"
        fill={active ? 'currentColor' : 'none'}
        strokeWidth={active ? 1 : 2}
      />
    </button>
  )
}
