import * as React from 'react'
import { CheckCircle2, Loader2, PlugZap, XCircle } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { testNvidiaNim, testElevenLabs, testPexels, testUnsplash, testPixabay, testDeezer, testMusicBrainz, testFreesound, testFirecrawl } from '@/api/config/validation'
import type { TestConnectionResult } from '@/api/config/validation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type OverviewItem = {
  id: string
  label: string
  run: () => Promise<TestConnectionResult>
}

export function ConnectionOverview() {
  const { config } = useApiConfigStore()
  const [results, setResults] = React.useState<Record<string, TestConnectionResult | null>>({})
  const [busy, setBusy] = React.useState(false)

  const items: OverviewItem[] = React.useMemo(() => {
    const n = config.nvidiaNim
    const e = config.elevenLabs
    const s = config.stockImages
    const m = config.music
    return [
      {
        id: 'nvidia',
        label: 'NVIDIA NIM',
        run: () => testNvidiaNim(n.apiKey, n.baseUrl, n.model, n.timeoutMs),
      },
      {
        id: 'elevenlabs',
        label: 'ElevenLabs',
        run: () => testElevenLabs(e.apiKey, e.timeoutMs, e.endpoint),
      },
      {
        id: 'unsplash',
        label: 'Unsplash',
        run: () => testUnsplash(s.unsplash.accessKey || s.unsplash.apiKey, s.unsplash.timeoutMs),
      },
      {
        id: 'pexels',
        label: 'Pexels',
        run: () => testPexels(s.pexels.apiKey, s.pexels.timeoutMs),
      },
      {
        id: 'pixabay',
        label: 'Pixabay',
        run: () => testPixabay(s.pixabay.apiKey, s.pixabay.timeoutMs),
      },
      {
        id: 'deezer',
        label: 'Deezer',
        run: () => testDeezer(m.deezer.endpoint, m.deezer.timeoutMs),
      },
      {
        id: 'musicbrainz',
        label: 'MusicBrainz',
        run: () => testMusicBrainz(m.musicbrainz.baseUrl, m.musicbrainz.userAgent, m.musicbrainz.timeoutMs),
      },
      {
        id: 'freesound',
        label: 'Freesound',
        run: () => testFreesound(m.freesound.apiKey, m.freesound.endpoint, m.freesound.timeoutMs),
      },
      {
        id: 'firecrawl',
        label: 'Firecrawl',
        run: () => testFirecrawl(config.firecrawl.apiKey, config.firecrawl.endpoint, config.firecrawl.timeoutMs),
      },
    ]
  }, [config])

  const testAll = async () => {
    setBusy(true)
    const out: Record<string, TestConnectionResult | null> = {}
    for (const item of items) {
      out[item.id] = null
      setResults({ ...out })
      try {
        out[item.id] = await item.run()
      } catch (err) {
        out[item.id] = {
          ok: false,
          status: 'disconnected',
          message: err instanceof Error ? err.message : String(err),
          latencyMs: 0,
        }
      }
      setResults({ ...out })
    }
    setBusy(false)
  }

  const done = Object.values(results).filter((r) => r !== null && r !== undefined).length
  const passed = Object.values(results).filter((r) => r?.ok).length
  const allDone = done === items.length

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <PlugZap className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Connection Overview</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Test every configured provider at once
          </p>
        </div>
        {allDone && (
          <span className={cn('flex items-center gap-1.5 text-xs font-medium', passed === items.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
            {passed === items.length ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {passed}/{items.length} connected
          </span>
        )}
        <Button type="button" size="sm" onClick={() => void testAll()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <PlugZap />}
          {busy ? 'Testing...' : 'Test All'}
        </Button>
      </div>

      <CardContent className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => {
          const r = results[item.id]
          return (
            <div
              key={item.id}
              className={cn(
                'flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 py-2',
                !r && 'border-border bg-muted/30',
                r?.ok && 'border-emerald-500/30 bg-emerald-500/5',
                r && !r.ok && 'border-amber-500/30 bg-amber-500/5',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{item.label}</p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {!r ? (busy ? 'Testing…' : 'Not tested') : r.ok ? 'Connected' : r.message.replace(`${item.label}: `, '')}
                </p>
              </div>
              {r?.ok ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              ) : r ? (
                <XCircle className="size-4 shrink-0 text-amber-500" />
              ) : busy ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}