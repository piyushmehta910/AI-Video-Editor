import * as React from 'react'
import { Cpu, RefreshCw, Check, X, Loader2 } from 'lucide-react'
import { useCapabilities } from '@/hooks/useCapabilities'
import { checkAllWorkers, restartWorker } from '@/engine/engineWorkers'
import { WORKER_NAMES } from '@/workers/workerProtocol'
import type { WorkerName } from '@/workers/workerProtocol'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

type HealthMap = Record<WorkerName, boolean | null>

const EMPTY_HEALTH: HealthMap = { decode: null, render: null, encode: null, ai: null }

const WORKER_LABELS: Record<WorkerName, string> = {
  decode: 'Decode',
  render: 'Render',
  encode: 'Encode',
  ai: 'AI',
}

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
  return ok ? <Check className="size-3.5 text-emerald-500" /> : <X className="size-3.5 text-destructive" />
}

export function EngineCard() {
  const { caps, loading } = useCapabilities()
  const [health, setHealth] = React.useState<HealthMap>(EMPTY_HEALTH)
  const [busy, setBusy] = React.useState<Partial<Record<WorkerName, boolean>>>({})
  const [allBusy, setAllBusy] = React.useState(false)

  const runAll = React.useCallback(async () => {
    setAllBusy(true)
    const results = await checkAllWorkers()
    setHealth(results)
    setAllBusy(false)
  }, [])

  const restart = React.useCallback(async (name: WorkerName) => {
    setBusy((prev) => ({ ...prev, [name]: true }))
    const ok = await restartWorker(name)
    setHealth((prev) => ({ ...prev, [name]: ok }))
    setBusy((prev) => ({ ...prev, [name]: false }))
  }, [])

  React.useEffect(() => {
    void runAll()
  }, [runAll])

  const capabilityRows = caps
    ? [
        { label: 'WebCodecs video (encode + decode)', ok: caps.webCodecsVideo },
        { label: 'WebCodecs audio encoder', ok: caps.webCodecs.audioEncoder },
        { label: 'WebCodecs audio decoder', ok: caps.webCodecs.audioDecoder },
        { label: 'WebGPU', ok: caps.webgpu, detail: caps.webgpuRenderer ?? undefined },
        { label: 'OPFS storage', ok: caps.opfs },
        { label: 'EditContext', ok: caps.editContext },
        { label: 'Web Audio', ok: caps.webAudio },
        { label: 'Web Workers', ok: caps.webWorkers },
      ]
    : []

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Cpu className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Engine & Capabilities</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Browser capabilities and worker health for this device
          </p>
        </div>
      </div>

      <Separator />

      <CardContent className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {loading &&
            [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          {!loading &&
            capabilityRows.map((row) => (
              <div key={row.label} className="flex items-center gap-2 text-xs">
                <StatusIcon ok={row.ok} />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                {row.detail && <span className="text-muted-foreground truncate">{row.detail}</span>}
              </div>
            ))}
        </div>

        {!loading && caps && (
          <p className="text-muted-foreground text-xs">
            {caps.hardwareConcurrency > 0 ? `${caps.hardwareConcurrency} logical CPUs` : 'CPU count unknown'} ·{' '}
            {caps.userAgent.split(' ').slice(0, 2).join(' ')}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">Background workers</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void runAll()} disabled={allBusy}>
            {allBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Check health
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WORKER_NAMES.map((name) => (
            <div key={name} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
              <StatusIcon ok={health[name]} />
              <span className="flex-1 font-medium">{WORKER_LABELS[name]} worker</span>
              <span className="text-muted-foreground">
                {health[name] === null ? 'checking…' : health[name] ? 'ok' : 'unreachable'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                disabled={busy[name] === true}
                onClick={() => void restart(name)}
              >
                {busy[name] ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Restart
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}