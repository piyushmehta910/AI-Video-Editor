import * as React from 'react'
import { RefreshCcw, Route } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultOpenRouterConfig, type OpenRouterConfig } from '@/api/config/types'
import { fetchOpenRouterFreeModels, testBearerEndpoint } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Free model roster verified against https://openrouter.ai/api/v1/models on
 * 2026-08-17 (models whose id ends with `:free`). `openrouter/free` is
 * OpenRouter's official auto-router that picks a free model per request.
 */
const OPENROUTER_FREE_MODELS = [
  'openrouter/free',
  'cohere/north-mini-code:free',
  'dots-studio/dots-3-note-preview:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'liquid/lfm-2.5-2.6b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'openai/gpt-oss-20b:free',
  'poolside/laguna-s-2.1:free',
  'poolside/laguna-xs-2.1:free',
  'z-ai/glm-5.2:free',
]

export function OpenRouterCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: OpenRouterConfig = config.openRouter
  const [models, setModels] = React.useState<string[]>(OPENROUTER_FREE_MODELS)
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshMessage, setRefreshMessage] = React.useState<string | null>(null)

  const set = (patch: Partial<OpenRouterConfig>) => {
    update((draft) => ({ ...draft, openRouter: { ...draft.openRouter, ...patch } }))
  }

  const refresh = async () => {
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      const free = await fetchOpenRouterFreeModels(cfg.baseUrl, cfg.timeoutMs)
      setModels(Array.from(new Set(['openrouter/free', ...free])))
      if (!free.includes(cfg.model) && cfg.model !== 'openrouter/free') {
        set({ model: 'openrouter/free' })
      }
      setRefreshMessage(`Found ${free.length} free models`)
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ProviderCard
      icon={<Route className="size-4.5" />}
      title="OpenRouter"
      description="Free models only — routed to https://openrouter.ai/api/v1"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onSave={save}
      onReset={() => update((draft) => ({ ...draft, openRouter: { ...defaultOpenRouterConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="or-api-key" className="md:col-span-2">
        <ApiKeyInput
          id="or-api-key"
          value={cfg.apiKey}
          placeholder="sk-or-v1-..."
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Base URL" htmlFor="or-base-url" className="md:col-span-2">
        <Input
          id="or-base-url"
          value={cfg.baseUrl}
          placeholder="https://openrouter.ai/api/v1"
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Model" htmlFor="or-model" className="md:col-span-2">
        <div className="flex gap-2">
          <Select value={cfg.model} onValueChange={(v) => set({ model: v })}>
            <SelectTrigger id="or-model" className="w-full">
              <SelectValue placeholder="Select free model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => void refresh()} disabled={refreshing} title="Refresh free models from OpenRouter">
            <RefreshCcw className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Free models only. {refreshMessage && <span className="text-violet-500">{refreshMessage}</span>}
        </p>
      </FieldRow>

      <FieldRow label="Temperature" hint={`Current: ${cfg.temperature.toFixed(2)}`}>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={[cfg.temperature]}
          onValueChange={([value]) => set({ temperature: value })}
        />
      </FieldRow>

      <FieldRow label="Max Tokens" htmlFor="or-max-tokens">
        <Input
          id="or-max-tokens"
          type="number"
          min={256}
          step={256}
          value={cfg.maxTokens}
          onChange={(e) => set({ maxTokens: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="or-timeout">
        <Input
          id="or-timeout"
          type="number"
          min={1000}
          step={1000}
          value={cfg.timeoutMs}
          onChange={(e) => set({ timeoutMs: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="Priority" hint="Lower number = higher priority">
        <Select value={String(cfg.priority)} onValueChange={(v) => set({ priority: Number(v) as 1 | 2 | 3 })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 — Primary</SelectItem>
            <SelectItem value="2">2 — Secondary</SelectItem>
            <SelectItem value="3">3 — Fallback</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester
          run={() =>
            testBearerEndpoint({
              label: 'OpenRouter',
              url: `${cfg.baseUrl.replace(/\/$/, '')}/models`,
              apiKey: cfg.apiKey,
              timeoutMs: cfg.timeoutMs,
            }).then((result) => {
              if (result.ok) {
                set({ status: 'connected' })
              } else if (result.status === 'disconnected') {
                set({ status: 'disconnected' })
              }
              return result
            })
          }
        />
      </FieldRow>
    </ProviderCard>
  )
}
