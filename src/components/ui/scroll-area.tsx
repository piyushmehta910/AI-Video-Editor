import * as React from 'react'
import { cn } from '@/lib/utils'

function ScrollArea({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn('overflow-auto', className)} {...props}>
      {children}
    </div>
  )
}

export { ScrollArea }