import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionProps {
  id?: string
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ id, eyebrow, title, subtitle, children, className }: SectionProps) {
  return (
    <section id={id} className={cn('relative scroll-mt-20 py-20', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase dark:text-violet-400">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-sm sm:text-base">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}