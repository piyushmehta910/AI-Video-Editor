import * as React from 'react'
import { Check, ChevronDown, RotateCcw, Save } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface ProviderCardProps {
  icon: React.ReactNode
  title: string
  description?: string
  enabled: boolean
  status: React.ReactNode
  onToggleEnabled: (enabled: boolean) => void
  onSave: () => Promise<void> | void
  onReset?: () => void
  isSaving?: boolean
  children: React.ReactNode
  collapsible?: boolean
}

export function ProviderCard({
  icon,
  title,
  description,
  enabled,
  status,
  onToggleEnabled,
  onSave,
  onReset,
  isSaving = false,
  children,
  collapsible = true,
}: ProviderCardProps) {
  const [open, setOpen] = React.useState(true)
  const [saved, setSaved] = React.useState(false)

  const handleSave = async () => {
    await onSave()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <div className="flex w-full items-center gap-3">
          <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{title}</h3>
              {status}
            </div>
            {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
          </div>
          <Switch checked={enabled} onCheckedChange={onToggleEnabled} aria-label={`Toggle ${title}`} />
          {collapsible && (
            <CollapsibleTrigger
              asChild
              onClick={() => setOpen((o) => !o)}
              className="text-muted-foreground hover:text-foreground"
            >
              <button type="button" aria-label="Expand settings">
                <ChevronDown className={cn('size-4 transition-transform', open ? 'rotate-180' : '')} />
              </button>
            </CollapsibleTrigger>
          )}
        </div>
      </CardHeader>
      <Collapsible open={open} disabled={!collapsible} className="min-w-0">
        <CollapsibleContent>
          <Separator />
          <CardContent className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">{children}</CardContent>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              {saved && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" /> Saved
                </span>
              )}
              {isSaving && <span>Saving...</span>}
            </div>
            <div className="flex gap-2">
              {onReset && (
                <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                  <RotateCcw /> Reset
                </Button>
              )}
              <Button type="button" variant="default" size="sm" onClick={handleSave}>
                <Save /> Save
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}