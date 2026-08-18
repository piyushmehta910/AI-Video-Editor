import { Flame } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultFirecrawlConfig, type FirecrawlConfig } from '@/api/config/types'
import { testFirecrawl } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export function FirecrawlCard() {
  const { config, update } = useApiConfigStore()
  const cfg: FirecrawlConfig = config.firecrawl
  const apiKey = cfg.apiKey ?? ''
  const endpoint = cfg.endpoint ?? 'https://api.firecrawl.dev'
  const timeoutMs = cfg.timeoutMs ?? 30000
  const searchEngine = cfg.searchEngine ?? 'default'
  const maxResults = cfg.maxResults ?? 5

  const set = (patch: Partial<FirecrawlConfig>) => {
    update((draft) => ({ ...draft, firecrawl: { ...draft.firecrawl, ...patch } }))
  }

  const useFlags: Array<{ key: 'useForResearch' | 'useForFactCheck' | 'useForArticleExtraction'; label: string }> = [
    { key: 'useForResearch', label: 'Research' },
    { key: 'useForFactCheck', label: 'Fact-check' },
    { key: 'useForArticleExtraction', label: 'Article extraction' },
  ]

  return (
    <ProviderCard
      icon={<Flame className="size-4.5" />}
      title="Firecrawl"
      description="Web research, fact-checking & article extraction"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, firecrawl: { ...defaultFirecrawlConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="firecrawl-api-key" className="md:col-span-2">
        <ApiKeyInput id="firecrawl-api-key" value={apiKey} placeholder="fc-..." onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow label="Endpoint" htmlFor="firecrawl-endpoint" className="md:col-span-2">
        <Input id="firecrawl-endpoint" value={endpoint} placeholder="https://api.firecrawl.dev" onChange={(e) => set({ endpoint: e.target.value })} />
      </FieldRow>

      <FieldRow label="Search Engine" htmlFor="firecrawl-engine">
        <Input id="firecrawl-engine" value={searchEngine} onChange={(e) => set({ searchEngine: e.target.value })} />
      </FieldRow>

      <FieldRow label="Max Results" htmlFor="firecrawl-max" hint="Results per search">
        <Input id="firecrawl-max" type="number" min={1} max={20} value={maxResults} onChange={(e) => set({ maxResults: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="firecrawl-timeout">
        <Input id="firecrawl-timeout" type="number" min={1000} step={1000} value={timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Use for" className="md:col-span-2">
        <div className="flex flex-wrap gap-4">
          {useFlags.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox id={`firecrawl-${key}`} checked={cfg[key] ?? false} onCheckedChange={(checked) => set({ [key]: checked === true })} />
              <Label htmlFor={`firecrawl-${key}`} className="text-sm font-normal">{label}</Label>
            </div>
          ))}
        </div>
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester run={() => testFirecrawl(apiKey, endpoint, timeoutMs).then((r) => { set({ status: r.ok ? 'connected' : 'disconnected' }); return r })} />
      </FieldRow>
    </ProviderCard>
  )
}