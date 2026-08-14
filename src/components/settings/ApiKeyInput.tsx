import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ApiKeyInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  showPasswordByDefault?: boolean
}

export function ApiKeyInput({ className, showPasswordByDefault = false, ...props }: ApiKeyInputProps) {
  const [visible, setVisible] = React.useState(showPasswordByDefault)
  return (
    <div className="relative flex-1">
      <Input
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        className={cn('pr-9', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? 'Hide API key' : 'Show API key'}
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}