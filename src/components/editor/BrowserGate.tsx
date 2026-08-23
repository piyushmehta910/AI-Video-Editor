import * as React from 'react'
import { Cpu, Download, RotateCcw, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GPUAdapterContext, useWebGPUStatus, type WebGPUStatus } from '@/hooks/useWebGPUStatus'

const BROWSER_LINKS = [
  { name: 'Chrome', href: 'https://www.google.com/chrome/' },
  { name: 'Microsoft Edge', href: 'https://www.microsoft.com/edge/download' },
  { name: 'Brave', href: 'https://brave.com/download/' },
]

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

function UnsupportedState() {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
          <Cpu className="text-violet-500 size-6" />
        </div>
        <h2 className="text-base font-semibold">Chrome or Edge Required</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-xs leading-relaxed">
          ClipForge's preview pipeline is GPU-accelerated via WebGPU, which this browser doesn't
          support yet (including current Firefox and most mobile browsers). Install a recent
          Chromium-based browser to open the editor.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BROWSER_LINKS.map(({ name, href }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors hover:border-violet-500/50 hover:bg-violet-500/5"
            >
              <Download className="size-4" />
              {name}
            </a>
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-[11px]">
          Already using Chrome/Edge? Make sure hardware acceleration is enabled in browser settings.
        </p>
      </div>
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

function FallbackBanner() {
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-yellow-500/40 bg-yellow-500/15 px-3 py-1.5 text-[11px] font-medium text-yellow-700 dark:text-yellow-400"
    >
      <Cpu className="size-3.5 shrink-0" />
      WebGPU unavailable — using CPU preview.
    </div>
  )
}

/**
 * Editor entry gate: runs the WebGPU compatibility check before any heavy
 * editor code is imported, then either blocks with an actionable screen or
 * admits the editor (with a banner when falling back to CPU compositing).
 */
export function BrowserGate({ children }: { children: React.ReactNode }) {
  const { status, adapterDetails, recheck } = useWebGPUStatus()

  if (status === 'checking') return <DetectingState />
  if (status === 'unsupported') return <UnsupportedState />
  if (status === 'error') return <ErrorState onRetry={recheck} />

  const content =
    status === 'fallback' ? (
      <div className="flex min-h-0 flex-1 flex-col">
        <FallbackBanner />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    ) : (
      children
    )

  return <GPUAdapterContext.Provider value={adapterDetails}>{content}</GPUAdapterContext.Provider>
}

export type { WebGPUStatus }
