import { Bot } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultNvidiaNimConfig, type NvidiaNimConfig } from '@/api/config/types'
import { testBearerEndpoint } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const NIM_MODELS = [
  'meta/llama-3.1-405b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
  'deepseek-ai/deepseek-r1',
  'qwen/qwen-2.5-72b-instruct',
  'google/gemma-2-27b-it',
]

export function NvidiaNimCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: NvidiaNimConfig = config.nvidiaNim

  const set = (patch: Partial<NvidiaNimConfig>) => {
    update((draft) => ({ ...draft, nvidiaNim: { ...draft.nvidiaNim, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<Bot className="size-4.5" />}
      title="NVIDIA NIM"
      description="Script generation, reasoning, image & avatar generation"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onSave={save}
      onReset={() =>
        update((draft) => ({
          ...draft,
          nvidiaNim: { ...defaultNvidiaNimConfig },
        }))
      }
    >
      <FieldRow label="API Key" htmlFor="nim-api-key" className="md:col-span-2">
        <ApiKeyInput
          id="nim-api-key"
          value={cfg.apiKey}
          placeholder="nvapi-..."
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Base URL" htmlFor="nim-base-url" className="md:col-span-2">
        <Input
          id="nim-base-url"
          value={cfg.baseUrl}
          placeholder="https://integrate.api.nvidia.com/v1"
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Model" htmlFor="nim-model">
        <Select value={cfg.model} onValueChange={(value) => set({ model: value })}>
          <SelectTrigger id="nim-model" className="w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {NIM_MODELS.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
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

      <FieldRow label="Max Tokens" htmlFor="nim-max-tokens">
        <Input
          id="nim-max-tokens"
          type="number"
          min={256}
          step={256}
          value={cfg.maxTokens}
          onChange={(e) => set({ maxTokens: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="nim-timeout">
        <Input
          id="nim-timeout"
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
              label: 'NVIDIA NIM',
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