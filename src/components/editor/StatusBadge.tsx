import { cn } from '@/lib/utils'

export type ProcessStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'error'

const VARIANTS: Record<ProcessStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'bg-destructive/10 text-destructive',
}

export function StatusBadge({ status, progress }: { status: ProcessStatus; progress?: number }) {
  const label =
    status === 'processing'
      ? `Processing ${Math.round((progress ?? 0) * 100)}%`
      : status === 'completed'
        ? 'Completed'
        : status === 'error'
          ? 'Error'
          : status === 'pending'
            ? 'Pending'
            : 'Idle'

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
        VARIANTS[status],
      )}
    >
      {status === 'processing' && (
        <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {status === 'completed' && <span className="size-1.5 rounded-full bg-current" />}
      {label}
    </span>
  )
}