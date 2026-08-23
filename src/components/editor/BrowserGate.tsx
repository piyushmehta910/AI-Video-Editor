import * as React from 'react'
import { Cpu, RotateCcw, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GPUAdapterContext, useWebGPUStatus, type WebGPUStatus } from '@/hooks/useWebGPUStatus'

function DetectingState() {
  return (
    <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-background p-8">
      <div className="relative flex size-14 items-center justify-center">
        <LoaderCircle className="text-violet-500 size-10 animate-spin" />
      </div>
      <p className="text-sm font-semibold">Detecting GPU capabilities…</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-lg">
        <h2 className="text-sm font-semibold">GPU detection failed</h2>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          We couldn't query your graphics adapter. This can be a transient driver or browser issue.
        </p>
        <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
          <RotateCcw className="mr-1.5 size-3.5" />
          Retry
        </Button>
      </div>
    </div>
  )
}

function FallbackBanner({ message }: { message?: string }) {
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
    >
      <Cpu className="size-3.5 shrink-0" />
      {message ?? 'WebGPU unavailable — using Canvas/WebGL compositing fallback. Editing fully functional.'}
    </div>
  )
}

/**
 * Editor entry gate: runs the WebGPU compatibility check before heavy
 * operations, providing hardware acceleration or smooth canvas/WebGL fallback.
 */
export function BrowserGate({ children }: { children: React.ReactNode }) {
  const { status, adapterDetails, recheck } = useWebGPUStatus()

  if (status === 'checking') return <DetectingState />
  if (status === 'error') return <ErrorState onRetry={recheck} />

  const content =
    status === 'fallback' || status === 'unsupported' ? (
      <div className="flex min-h-0 flex-1 flex-col">
        <FallbackBanner
          message={
            status === 'unsupported'
              ? 'For GPU-accelerated preview, use Chrome/Edge. Canvas/WebGL fallback active.'
              : 'WebGPU adapter unavailable — Canvas/WebGL preview active.'
          }
        />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    ) : (
      children
    )

  return <GPUAdapterContext.Provider value={adapterDetails}>{content}</GPUAdapterContext.Provider>
}

export type { WebGPUStatus }
