import * as React from 'react'
import { Bot, RefreshCcw } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultNvidiaNimConfig, type NvidiaNimConfig } from '@/api/config/types'
import { fetchNvidiaNimModels, testNvidiaNim } from '@/api/config/validation'
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
 * Free hosted chat models on the NVIDIA NIM catalog (build.nvidia.com) verified
 * against the official /v1/models catalog on 2026-08-17. Non-chat model
 * families (embeddings, safety, RAG, vision, OCR...) are excluded.
 */
const NIM_FREE_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3-nano-30b-a3b',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'nvidia/nvidia-nemotron-nano-9b-v2',
  'deepseek-ai/deepseek-v4-flash',
  'deepseek-ai/deepseek-v4-pro',
  'google/codegemma-7b',
  'google/gemma-7b',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.2-1b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.3-70b-instruct',
  'microsoft/phi-4-mini-instruct',
  'microsoft/phi-4-mini-flash-reasoning',
  'minimaxai/minimax-m2.5',
  'minimaxai/minimax-m2.7',
  'mistralai/mistral-nemotron',
  'moonshotai/kimi-k2-instruct',
  'moonshotai/kimi-k2-thinking',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'poolside/laguna-xs-2-1',
  'qwen/qwen2.5-coder-32b-instruct',
  'qwen/qwen3-coder-480b-a35b-instruct',
  'sarvamai/sarvam-m',
  'stepfun-ai/step-3.5-flash',
  'thinkingmachines/inkling',
  'upstage/solar-10.7b-instruct',
  'z-ai/glm4.7',
  'z-ai/glm5.1',
]

export function NvidiaNimCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: NvidiaNimConfig = config.nvidiaNim
  const [models, setModels] = React.useState<string[]>(NIM_FREE_MODELS)
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshMessage, setRefreshMessage] = React.useState<string | null>(null)

  const set = (patch: Partial<NvidiaNimConfig>) => {
    update((draft) => ({ ...draft, nvidiaNim: { ...draft.nvidiaNim, ...patch } }))
  }

  const refresh = async () => {
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      const catalog = await fetchNvidiaNimModels(cfg.apiKey, cfg.baseUrl, cfg.timeoutMs)
      setModels(Array.from(new Set([...NIM_FREE_MODELS, ...catalog])))
      setRefreshMessage(`Catalog returned ${catalog.length} chat models`)
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ProviderCard
      icon={<Bot className="size-4.5" />}
      title="NVIDIA NIM"
      description="Free hosted chat models — script generation & reasoning"
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

      <FieldRow label="Model" htmlFor="nim-model" className="md:col-span-2">
        <div className="flex gap-2">
          <Select value={cfg.model} onValueChange={(value) => set({ model: value })}>
            <SelectTrigger id="nim-model" className="w-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => void refresh()} disabled={refreshing} title="Refresh chat models from NVIDIA catalog">
            <RefreshCcw className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Prefilled with free hosted models. {refreshMessage && <span className="text-violet-500">{refreshMessage}</span>}
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
            testNvidiaNim(cfg.apiKey, cfg.baseUrl, cfg.model, cfg.timeoutMs).then((result) => {
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