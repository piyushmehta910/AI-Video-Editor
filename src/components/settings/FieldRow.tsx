import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldRowProps {
  label?: string
  htmlFor?: string
  hint?: string
  children: ReactNode
  className?: string
}

export function FieldRow({ label, htmlFor, hint, children, className }: FieldRowProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}