import { Smile } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultGiphyConfig, type GiphyConfig } from '@/api/config/types'
import { testGiphy } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RATINGS = ['g', 'pg', 'pg-13', 'r'] as const

export function GiphyCard() {
  const { config, update } = useApiConfigStore()
  const cfg: GiphyConfig = config.giphy
  const apiKey = cfg.apiKey ?? ''
  const rating = cfg.rating ?? 'g'
  const limit = cfg.limit ?? 24
  const timeoutMs = cfg.timeoutMs ?? 30000

  const set = (patch: Partial<GiphyConfig>) => {
    update((draft) => ({ ...draft, giphy: { ...draft.giphy, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<Smile className="size-4.5" />}
      title="Giphy"
      description="Animated stickers for your timeline — powered by the Giphy API"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, giphy: { ...defaultGiphyConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="giphy-api-key" className="md:col-span-2">
        <ApiKeyInput id="giphy-api-key" value={apiKey} placeholder="Giphy API key" onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow label="Content Rating" hint="Maximum MPAA-style rating for results">
        <Select value={rating} onValueChange={(v) => set({ rating: v })}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent>
            {RATINGS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Results per search" htmlFor="giphy-limit">
        <Input id="giphy-limit" type="number" min={1} max={50} value={limit} onChange={(e) => set({ limit: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="giphy-timeout">
        <Input id="giphy-timeout" type="number" min={1000} step={1000} value={timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester run={() => testGiphy(apiKey, timeoutMs, rating).then((r) => { set({ status: r.ok ? 'connected' : 'disconnected' }); return r })} />
      </FieldRow>
    </ProviderCard>
  )
}