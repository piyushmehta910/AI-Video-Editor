import { BrainCircuit } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultOpenCodeZenConfig, type OpenCodeZenConfig } from '@/api/config/types'
import { testBearerEndpoint } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const REASONING_LEVELS = ['standard', 'high', 'low']

const ZEN_FREE_MODELS = [
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'hy3-free',
  'laguna-s-2.1-free',
  'nemotron-3-ultra-free',
  'nemotron-3.5-lightning-free',
  'ling-3.0-tiny-free',
  'longcat-2.0-free',
  'north-mini-code-free',
]

export function OpenCodeZenCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: OpenCodeZenConfig = config.opencodeZen

  const set = (patch: Partial<OpenCodeZenConfig>) => {
    update((draft) => ({ ...draft, opencodeZen: { ...draft.opencodeZen, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<BrainCircuit className="size-4.5" />}
      title="OpenCode Zen"
      description="Planning, reasoning & script generation"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onSave={save}
      onReset={() => update((draft) => ({ ...draft, opencodeZen: { ...defaultOpenCodeZenConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="zen-api-key" className="md:col-span-2">
        <ApiKeyInput
          id="zen-api-key"
          value={cfg.apiKey}
          placeholder="API key"
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Endpoint" htmlFor="zen-endpoint" className="md:col-span-2">
        <Input
          id="zen-endpoint"
          value={cfg.baseUrl}
          placeholder="https://opencode.ai/zen/v1"
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Model" htmlFor="zen-model">
        <Select value={cfg.model} onValueChange={(v) => set({ model: v })}>
          <SelectTrigger id="zen-model" className="w-full">
            <SelectValue placeholder="Select free model" />
          </SelectTrigger>
          <SelectContent>
            {ZEN_FREE_MODELS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Reasoning Level" htmlFor="zen-reasoning">
        <Select value={cfg.reasoningLevel} onValueChange={(v) => set({ reasoningLevel: v })}>
          <SelectTrigger id="zen-reasoning" className="w-full">
            <SelectValue placeholder="Reasoning level" />
          </SelectTrigger>
          <SelectContent>
            {REASONING_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <FieldRow label="Max Tokens" htmlFor="zen-max-tokens">
        <Input
          id="zen-max-tokens"
          type="number"
          min={256}
          step={256}
          value={cfg.maxTokens}
          onChange={(e) => set({ maxTokens: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="zen-timeout">
        <Input
          id="zen-timeout"
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
              label: 'OpenCode Zen',
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