import * as React from 'react'
import { Loader2, Plug, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TestConnectionResult } from '@/api/config/validation'

interface ApiTesterProps {
  run: () => Promise<TestConnectionResult>
  label?: string
  className?: string
}

export function ApiTester({ run, label = 'Test Connection', className }: ApiTesterProps) {
  const [state, setState] = React.useState<'idle' | 'testing' | 'done'>('idle')
  const [result, setResult] = React.useState<TestConnectionResult | null>(null)

  const handleClick = async () => {
    setState('testing')
    setResult(null)
    try {
      const res = await run()
      setResult(res)
    } catch (err) {
      setResult({
        ok: false,
        status: 'disconnected',
        message: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
      })
    } finally {
      setState('done')
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={state === 'testing'}>
        {state === 'testing' ? <Loader2 className="animate-spin" /> : <Plug />}
        {state === 'testing' ? 'Testing...' : label}
      </Button>
      {result && (
        <p
          className={cn(
            'flex items-start gap-1.5 text-xs',
            result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
          )}
        >
          {!result.ok && <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
          <span>
            {result.message}
            {result.latencyMs > 0 && ` (${result.latencyMs}ms)`}
          </span>
        </p>
      )}
    </div>
  )
}