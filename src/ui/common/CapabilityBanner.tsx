import * as React from 'react'
import { TriangleAlert, X } from 'lucide-react'
import type { EngineCapabilities } from '@/engine/capabilities'

const DISMISS_KEY = 'clipforge-capability-banner-dismissed'

export function CapabilityBanner({ caps }: { caps: EngineCapabilities }) {
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const missing: string[] = []
  if (!caps.webCodecsVideo) missing.push('WebCodecs video encode/decode')
  if (!caps.webgpu) missing.push('WebGPU')

  if (dismissed || missing.length === 0) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore storage errors
    }
  }

  return (
    <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <p className="min-w-0 flex-1">
        {missing.join(' and ')} {missing.length > 1 ? 'are' : 'is'} not available in this browser. The editor
        will use fallbacks where possible; for full functionality try the latest Chrome, Edge, or Safari.
      </p>
      <button onClick={dismiss} aria-label="Dismiss" className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200">
        <X className="size-3.5" />
      </button>
    </div>
  )
}