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

const NIM_FREE_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3-nano-30b-a3b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'nvidia/nemotron-4-340b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'nvidia/llama-3.1-nemotron-51b-instruct',
  'nvidia/llama-3.1-nemotron-nano-8b-v1',
  'nvidia/nvidia-nemotron-nano-9b-v2',
  'nvidia/nemotron-nano-3-30b-a3b',
  'nvidia/mistral-nemo-minitron-8b-8k-instruct',
  'nv-mistralai/mistral-nemo-12b-instruct',
  'deepseek-ai/deepseek-v4-flash-0731',
  'deepseek-ai/deepseek-coder-6.7b-instruct',
  'google/codegemma-1.1-7b',
  'google/codegemma-7b',
  'google/gemma-3-12b-it',
  'google/gemma-3-4b-it',
  'google/gemma-4-31b-it',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.2-1b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.3-70b-instruct',
  'microsoft/phi-3.5-moe-instruct',
  'mistralai/mistral-nemotron',
  'mistralai/mistral-large-2-instruct',
  'mistralai/mixtral-8x22b-v0.1',
  'moonshotai/kimi-k2.6',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'poolside/laguna-xs-2.1',
  'stepfun-ai/step-3.7-flash',
  'thinkingmachines/inkling',
  'writer/palmyra-creative-122b',
  'z-ai/glm-5.2',
  'zyphra/zamba2-7b-instruct',
  'ai21labs/jamba-1.5-large-instruct',
  'bigcode/starcoder2-15b',
  '01-ai/yi-large',
]

export function NvidiaNimCard() {
  const { config, update } = useApiConfigStore()
  const cfg: NvidiaNimConfig = config.nvidiaNim
  const apiKey = cfg.apiKey ?? ''
  const baseUrl = cfg.baseUrl ?? 'https://integrate.api.nvidia.com/v1'
  const model = cfg.model ?? 'meta/llama-3.1-8b-instruct'
  const temperature = cfg.temperature ?? 0.7
  const maxTokens = cfg.maxTokens ?? 2048
  const timeoutMs = cfg.timeoutMs ?? 30000
  const priority = cfg.priority ?? 1
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
      const catalog = await fetchNvidiaNimModels(apiKey, baseUrl, timeoutMs)
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
      onReset={() => update((draft) => ({ ...draft, nvidiaNim: { ...defaultNvidiaNimConfig } }))}
    >
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-500 md:col-span-2">
        <span className="font-semibold">Notice:</span> Hosted endpoint (<code>integrate.api.nvidia.com</code>) retires on <strong>August 26, 2026</strong>. Please set OpenRouter as your primary provider or connect a self-hosted NIM instance.
      </div>

      <FieldRow label="API Key" htmlFor="nim-api-key" className="md:col-span-2">
        <ApiKeyInput id="nim-api-key" value={apiKey} placeholder="nvapi-..." onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow label="Base URL" htmlFor="nim-base-url" className="md:col-span-2">
        <Input id="nim-base-url" value={baseUrl} placeholder="https://integrate.api.nvidia.com/v1" onChange={(e) => set({ baseUrl: e.target.value })} />
      </FieldRow>

      <FieldRow label="Model" htmlFor="nim-model" className="md:col-span-2">
        <div className="flex gap-2">
          <Select value={model} onValueChange={(value) => set({ model: value })}>
            <SelectTrigger id="nim-model" className="w-full"><SelectValue placeholder="Select model" /></SelectTrigger>
            <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => void refresh()} disabled={refreshing} title="Refresh chat models from NVIDIA catalog">
            <RefreshCcw className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">Prefilled with free hosted models. {refreshMessage && <span className="text-violet-500">{refreshMessage}</span>}</p>
      </FieldRow>

      <FieldRow label="Temperature" hint={`Current: ${temperature.toFixed(2)}`}>
        <Slider min={0} max={2} step={0.1} value={[temperature]} onValueChange={([value]) => set({ temperature: value })} />
      </FieldRow>

      <FieldRow label="Max Tokens" htmlFor="nim-max-tokens">
        <Input id="nim-max-tokens" type="number" min={256} step={256} value={maxTokens} onChange={(e) => set({ maxTokens: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="nim-timeout">
        <Input id="nim-timeout" type="number" min={1000} step={1000} value={timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
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
        <ApiTester run={() => testNvidiaNim(apiKey, baseUrl, model, timeoutMs).then((result) => { set({ status: result.ok ? 'connected' : 'disconnected' }); return result })} />
      </FieldRow>
    </ProviderCard>
  )
}
