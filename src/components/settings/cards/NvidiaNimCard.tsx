import * as React from 'react'
import { Bot, RefreshCcw, Mic, Volume2 } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultNvidiaNimConfig, type NvidiaNimConfig } from '@/api/config/types'
import { fetchNvidiaNimModels, testNvidiaNim } from '@/api/config/validation'
import { MAGPIE_VOICE_PRESETS } from '@/api/tts/magpie'
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

const NIM_VOICE_MODELS = [
  { id: 'nvidia/magpie-tts-zeroshot', label: 'Magpie TTS Zero-Shot (Expressive & Cloned)' },
  { id: 'nvidia/fastpitch-hifigan', label: 'FastPitch + HiFi-GAN (Ultra-Fast)' },
  { id: 'nvidia/riva-tts', label: 'NVIDIA Riva Enterprise TTS' },
]

export function NvidiaNimCard() {
  const { config, update } = useApiConfigStore()
  const cfg: NvidiaNimConfig = config.nvidiaNim
  const apiKey = cfg.apiKey ?? ''
  const baseUrl = cfg.baseUrl ?? 'https://integrate.api.nvidia.com/v1'
  const model = cfg.model ?? 'meta/llama-3.3-70b-instruct'
  const voiceModel = cfg.voiceModel ?? 'nvidia/magpie-tts-zeroshot'
  const voice = cfg.voice ?? 'Aaliyah'
  const voiceSpeed = cfg.voiceSpeed ?? 1.0
  const temperature = cfg.temperature ?? 0.7
  const maxTokens = cfg.maxTokens ?? 2048
  const timeoutMs = cfg.timeoutMs ?? 30000
  const priority = cfg.priority ?? 1
  const [models, setModels] = React.useState<string[]>(NIM_FREE_MODELS)
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshMessage, setRefreshMessage] = React.useState<string | null>(null)
  const [testingVoice, setTestingVoice] = React.useState(false)
  const [voiceAudioUrl, setVoiceAudioUrl] = React.useState<string | null>(null)
  const voiceUrlRef = React.useRef<string | null>(null)
  const [voiceTestError, setVoiceTestError] = React.useState<string | null>(null)

  // This card owns the voice-preview URL — revoke on replace/unmount.
  React.useEffect(() => () => {
    if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current)
  }, [])

  const set = (patch: Partial<NvidiaNimConfig>) => {
    update((draft) => ({ ...draft, nvidiaNim: { ...draft.nvidiaNim, ...patch } }))
  }

  const refresh = async () => {
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      const catalog = await fetchNvidiaNimModels(apiKey, baseUrl, timeoutMs)
      setModels(Array.from(new Set([...NIM_FREE_MODELS, ...catalog])))
      setRefreshMessage(`Catalog returned ${catalog.length} models`)
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const handleTestVoice = async () => {
    if (!apiKey.trim()) {
      setVoiceTestError('Enter an NVIDIA API key first')
      return
    }
    setTestingVoice(true)
    setVoiceTestError(null)
    try {
      const { magpieTtsProvider } = await import('@/api/tts/magpie')
      const result = await magpieTtsProvider.synthesize({
        text: 'Hello! NVIDIA NIM voice synthesis is working on this route.',
        voiceId: voice,
        model: voiceModel,
        speed: voiceSpeed,
      })
      if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current)
      const url = URL.createObjectURL(result.blob)
      voiceUrlRef.current = url
      setVoiceAudioUrl(url)
    } catch (err) {
      setVoiceTestError(err instanceof Error ? err.message : String(err))
    } finally {
      setTestingVoice(false)
    }
  }

  return (
    <ProviderCard
      icon={<Bot className="size-4.5" />}
      title="NVIDIA NIM (Unified AI & Voice)"
      description="Single API key & route for both LLM Chat Reasoning and Zero-Shot Voice Synthesis"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, nvidiaNim: { ...defaultNvidiaNimConfig } }))}
    >
      <div className="rounded-md border border-violet-500/30 bg-violet-500/10 p-2.5 text-xs text-violet-600 dark:text-violet-400 md:col-span-2">
        <span className="font-semibold">Unified Provider:</span> One NVIDIA key powers both the <strong>AI Director</strong> and <strong>Voice Over Studio</strong>. Just select your chat model and voice model below.
      </div>

      <FieldRow label="NVIDIA API Key" htmlFor="nim-api-key" className="md:col-span-2">
        <ApiKeyInput id="nim-api-key" value={apiKey} placeholder="nvapi-..." onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow label="Base URL (Shared Route)" htmlFor="nim-base-url" className="md:col-span-2">
        <Input id="nim-base-url" value={baseUrl} placeholder="https://integrate.api.nvidia.com/v1" onChange={(e) => set({ baseUrl: e.target.value })} />
      </FieldRow>

      {/* ── Section: LLM Model ── */}
      <div className="md:col-span-2 border-t border-border/60 pt-3 mt-1">
        <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-foreground">
          <Bot className="size-3.5 text-violet-500" />
          AI Director & Scripting Model
        </div>
      </div>

      <FieldRow label="Chat Model" htmlFor="nim-model" className="md:col-span-2">
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

      {/* ── Section: Voice Model ── */}
      <div className="md:col-span-2 border-t border-border/60 pt-3 mt-1">
        <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-foreground">
          <Mic className="size-3.5 text-pink-500" />
          Voice Over Studio Model (Same Route: /audio/speech)
        </div>
      </div>

      <FieldRow label="Voice Model" htmlFor="nim-voice-model">
        <Select value={voiceModel} onValueChange={(val) => set({ voiceModel: val })}>
          <SelectTrigger id="nim-voice-model" className="w-full"><SelectValue placeholder="Select voice model" /></SelectTrigger>
          <SelectContent>
            {NIM_VOICE_MODELS.map((vm) => (
              <SelectItem key={vm.id} value={vm.id}>{vm.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Default Voice Preset" htmlFor="nim-voice">
        <Select value={voice} onValueChange={(val) => set({ voice: val })}>
          <SelectTrigger id="nim-voice" className="w-full"><SelectValue placeholder="Select voice" /></SelectTrigger>
          <SelectContent>
            {MAGPIE_VOICE_PRESETS.map((vp) => (
              <SelectItem key={vp.id} value={vp.id}>{vp.label} ({vp.style})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Speech Speed" hint={`${voiceSpeed.toFixed(2)}x`}>
        <Slider min={0.5} max={2.0} step={0.05} value={[voiceSpeed]} onValueChange={([val]) => set({ voiceSpeed: val })} />
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

      {/* ── Dual Testing Row ── */}
      <div className="md:col-span-2 border-t border-border/60 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1">
          <ApiTester
            run={() =>
              testNvidiaNim(apiKey, baseUrl, model, timeoutMs).then((result) => {
                set({ status: result.ok ? 'connected' : 'disconnected' })
                return result
              })
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleTestVoice()}
            disabled={testingVoice || !apiKey.trim()}
            className="gap-1.5 text-xs font-semibold"
          >
            {testingVoice ? <RefreshCcw className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5 text-pink-500" />}
            Test Voice Synthesis
          </Button>
          {voiceAudioUrl && (
            <audio src={voiceAudioUrl} controls autoPlay className="h-8 max-w-[160px]" />
          )}
        </div>
      </div>

      {voiceTestError && (
        <div className="md:col-span-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
          Voice test error: {voiceTestError}
        </div>
      )}
    </ProviderCard>
  )
}
