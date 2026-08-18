import * as React from 'react'
import { Code } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultOpenCodeZenConfig, type OpenCodeZenConfig } from '@/api/config/types'
import { testOpenCodeZen } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const OPENCODE_MODELS = [
  'deepseek-v4-flash-free',
  'deepseek-v4-pro',
  'deepseek-coder-6.7b-instruct',
  'nemotron-3-ultra',
  'nemotron-3-super',
]

export function OpenCodeZenCard() {
  const { config, update } = useApiConfigStore()
  const cfg: OpenCodeZenConfig = config.opencodeZen
  const apiKey = cfg.apiKey ?? ''
  const baseUrl = cfg.baseUrl ?? 'https://opencode.ai/zen/v1'
  const model = cfg.model ?? 'deepseek-v4-flash-free'
  const reasoningLevel = cfg.reasoningLevel ?? 'standard'
  const temperature = cfg.temperature ?? 0.7
  const maxTokens = cfg.maxTokens ?? 2048
  const timeoutMs = cfg.timeoutMs ?? 30000
  const priority = cfg.priority ?? 2
  const [models] = React.useState<string[]>(OPENCODE_MODELS)

  const set = (patch: Partial<OpenCodeZenConfig>) => {
    update((draft) => ({ ...draft, opencodeZen: { ...draft.opencodeZen, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<Code className="size-4.5" />}
      title="OpenCode Zen"
      description="OpenCode AI models for reasoning & coding"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, opencodeZen: { ...defaultOpenCodeZenConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="zen-api-key" className="md:col-span-2">
        <ApiKeyInput id="zen-api-key" value={apiKey} placeholder="sk-..." onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow label="Base URL" htmlFor="zen-base-url" className="md:col-span-2">
        <Input id="zen-base-url" value={baseUrl} placeholder="https://opencode.ai/zen/v1" onChange={(e) => set({ baseUrl: e.target.value })} />
      </FieldRow>

      <FieldRow label="Model" htmlFor="zen-model" className="md:col-span-2">
        <Select value={model} onValueChange={(v) => set({ model: v })}>
          <SelectTrigger id="zen-model" className="w-full"><SelectValue placeholder="Select model" /></SelectTrigger>
          <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Reasoning Level" htmlFor="zen-reasoning">
        <Select value={reasoningLevel} onValueChange={(v) => set({ reasoningLevel: v })}>
          <SelectTrigger id="zen-reasoning" className="w-full"><SelectValue placeholder="Reasoning level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Temperature" hint={`Current: ${temperature.toFixed(2)}`}>
        <Slider min={0} max={2} step={0.1} value={[temperature]} onValueChange={([v]) => set({ temperature: v })} />
      </FieldRow>

      <FieldRow label="Max Tokens" htmlFor="zen-max-tokens">
        <Input id="zen-max-tokens" type="number" min={256} step={256} value={maxTokens} onChange={(e) => set({ maxTokens: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="zen-timeout">
        <Input id="zen-timeout" type="number" min={1000} step={1000} value={timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Priority" hint="Lower number = higher priority">
        <Select value={String(priority)} onValueChange={(v) => set({ priority: Number(v) as 1 | 2 | 3 })}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 — Primary</SelectItem>
            <SelectItem value="2">2 — Secondary</SelectItem>
            <SelectItem value="3">3 — Fallback</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester run={() => testOpenCodeZen(apiKey, baseUrl, model, timeoutMs).then((r) => { set({ status: r.ok ? 'connected' : 'disconnected' }); return r })} />
      </FieldRow>
    </ProviderCard>
  )
}