import type { ProviderStatus } from '@/api/config/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<ProviderStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  disabled: 'Disabled',
}

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  return (
    <Badge
      variant={status === 'connected' ? 'success' : status === 'disconnected' ? 'warning' : 'secondary'}
      className={cn('gap-1.5')}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'connected' && 'bg-emerald-500',
          status === 'disconnected' && 'bg-amber-500',
          status === 'disabled' && 'bg-muted-foreground/50',
        )}
      />
      {STATUS_LABEL[status]}
    </Badge>
  )
}