import * as React from 'react'
import { CheckCircle2, Loader2, PlugZap, XCircle } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { testNvidiaNim, testElevenLabs, testPexels, testUnsplash, testPixabay, testDeezer, testMusicBrainz, testFirecrawl, testGiphy, testSketchfab } from '@/api/config/validation'
import type { TestResult } from '@/api/config/validation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type OverviewItem = {
  id: string
  label: string
  run: () => Promise<TestResult>
}

export function ConnectionOverview() {
  const { config } = useApiConfigStore()
  const [results, setResults] = React.useState<Record<string, TestResult | null>>({})
  const [busy, setBusy] = React.useState(false)

  const n = config.nvidiaNim
  const nvidiaApiKey = n.apiKey ?? ''
  const nvidiaBaseUrl = n.baseUrl ?? 'https://integrate.api.nvidia.com/v1'
  const nvidiaModel = n.model ?? 'meta/llama-3.1-8b-instruct'
  const nvidiaTimeoutMs = n.timeoutMs ?? 30000

  const e = config.elevenLabs
  const elevenApiKey = e.apiKey ?? ''
  const elevenEndpoint = e.endpoint ?? 'https://api.elevenlabs.io'
  const elevenTimeoutMs = e.timeoutMs ?? 30000
  const elevenVoiceId = e.voiceId ?? ''

  const s = config.stockImages
  const unsplashAccessKey = s.unsplash.accessKey ?? s.unsplash.apiKey ?? ''
  const unsplashTimeoutMs = s.unsplash.timeoutMs ?? 30000
  const pexelsApiKey = s.pexels.apiKey ?? ''
  const pexelsTimeoutMs = s.pexels.timeoutMs ?? 30000
  const pixabayApiKey = s.pixabay.apiKey ?? ''
  const pixabayTimeoutMs = s.pixabay.timeoutMs ?? 30000

  const m = config.music
  const deezerEndpoint = m.deezer.endpoint ?? 'https://api.deezer.com'
  const deezerTimeoutMs = m.deezer.timeoutMs ?? 30000
  const mbBaseUrl = m.musicbrainz.baseUrl ?? 'https://musicbrainz.org'
  const mbUserAgent = m.musicbrainz.userAgent ?? 'ClipForgeAI/1.0'
  const mbTimeoutMs = m.musicbrainz.timeoutMs ?? 30000

  const fcApiKey = config.firecrawl.apiKey ?? ''
  const fcEndpoint = config.firecrawl.endpoint ?? 'https://api.firecrawl.dev'
  const fcTimeoutMs = config.firecrawl.timeoutMs ?? 30000

  const giphyApiKey = config.giphy.apiKey ?? ''
  const giphyRating = config.giphy.rating ?? 'g'
  const giphyTimeoutMs = config.giphy.timeoutMs ?? 30000

  const sfApiKey = config.sketchfab?.apiKey ?? ''
  const sfTimeoutMs = config.sketchfab?.timeoutMs ?? 30000

  const items: OverviewItem[] = React.useMemo(() => [
    {
      id: 'nvidia',
      label: 'NVIDIA NIM',
      run: () => testNvidiaNim(nvidiaApiKey, nvidiaBaseUrl, nvidiaModel, nvidiaTimeoutMs),
    },
    {
      id: 'elevenlabs',
      label: 'ElevenLabs',
      run: () => testElevenLabs(elevenApiKey, elevenEndpoint, elevenTimeoutMs, elevenVoiceId),
    },
    {
      id: 'unsplash',
      label: 'Unsplash',
      run: () => testUnsplash(unsplashAccessKey, unsplashTimeoutMs),
    },
    {
      id: 'pexels',
      label: 'Pexels',
      run: () => testPexels(pexelsApiKey, pexelsTimeoutMs),
    },
    {
      id: 'pixabay',
      label: 'Pixabay',
      run: () => testPixabay(pixabayApiKey, pixabayTimeoutMs),
    },
    {
      id: 'deezer',
      label: 'Deezer',
      run: () => testDeezer(deezerEndpoint, deezerTimeoutMs),
    },
    {
      id: 'musicbrainz',
      label: 'MusicBrainz',
      run: () => testMusicBrainz(mbBaseUrl, mbUserAgent, mbTimeoutMs),
    },
    {
      id: 'firecrawl',
      label: 'Firecrawl',
      run: () => testFirecrawl(fcApiKey, fcEndpoint, fcTimeoutMs),
    },
    {
      id: 'giphy',
      label: 'Giphy',
      run: () => testGiphy(giphyApiKey, giphyTimeoutMs, giphyRating),
    },
    {
      id: 'sketchfab',
      label: 'Sketchfab',
      run: () => testSketchfab(sfApiKey, sfTimeoutMs),
    },
  ], [config])

  const testAll = async () => {
    setBusy(true)
    const out: Record<string, TestResult | null> = {}
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
        } satisfies TestResult
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
