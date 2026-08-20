import * as React from 'react'
import { Play, RefreshCcw } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultNvidiaTtsConfig, type NvidiaTtsConfig } from '@/api/config/types'
import { testNvidiaTts, fetchNvidiaNimModels } from '@/api/config/validation'
import { nvidiaTtsProvider } from '@/api/tts/nvidia'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mic } from 'lucide-react'

const TTS_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']

export function NvidiaTtsCard() {
  const { config, update } = useApiConfigStore()
  const cfg: NvidiaTtsConfig = config.nvidiaTts
  const apiKey = cfg.apiKey ?? ''
  const baseUrl = cfg.baseUrl ?? 'https://integrate.api.nvidia.com/v1'
  const model = cfg.model ?? ''
  const voice = cfg.voice ?? ''
  const format = cfg.format ?? 'mp3'
  const speed = cfg.speed ?? 1.0
  const timeoutMs = cfg.timeoutMs ?? 60000
  const [models, setModels] = React.useState<string[]>([])
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshMessage, setRefreshMessage] = React.useState<string | null>(null)
  const [previewing, setPreviewing] = React.useState(false)
  const [previewMessage, setPreviewMessage] = React.useState<string | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const set = (patch: Partial<NvidiaTtsConfig>) => {
    update((draft) => ({ ...draft, nvidiaTts: { ...draft.nvidiaTts, ...patch } }))
  }

  const refresh = async () => {
    if (!apiKey.trim()) { setRefreshMessage('Enter an API key to load the model list'); return }
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      const roster = await fetchNvidiaNimModels(apiKey, baseUrl, timeoutMs)
      setModels(roster)
      setRefreshMessage(`Loaded ${roster.length} models. TTS models may not be listed here — paste the model id manually if yours is missing.`)
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const preview = async () => {
    if (!apiKey.trim() || !model.trim()) { setPreviewMessage('Enter an API key and model to preview'); return }
    setPreviewing(true)
    setPreviewMessage(null)
    try {
      const result = await nvidiaTtsProvider.synthesize({
        text: 'Hi, this is a quick voiceover preview from ClipForge.',
        model,
        voiceId: voice || undefined,
        outputFormat: format,
        speed,
      })
      const url = URL.createObjectURL(result.blob)
      if (audioRef.current) { audioRef.current.src = url; await audioRef.current.play() }
      setPreviewMessage('Played voice preview')
    } catch (err) {
      setPreviewMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <ProviderCard
      icon={<Mic className="size-4.5" />}
      title="NVIDIA NIM Voice"
      description="OpenAI-compatible TTS (audio/speech) on the NVIDIA API"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, nvidiaTts: { ...defaultNvidiaTtsConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="nvidia-tts-key" className="md:col-span-2">
        <ApiKeyInput id="nvidia-tts-key" value={apiKey} placeholder="nvapi-…" onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow label="Base URL" htmlFor="nvidia-tts-url" className="md:col-span-2">
        <Input id="nvidia-tts-url" value={baseUrl} placeholder="https://integrate.api.nvidia.com/v1" onChange={(e) => set({ baseUrl: e.target.value })} />
      </FieldRow>

      <FieldRow label="Model" htmlFor="nvidia-tts-model" hint="TTS model id served by your account">
        <div className="flex gap-2">
          <Input id="nvidia-tts-model" value={model} placeholder="e.g. nvidia/…-tts-…" onChange={(e) => set({ model: e.target.value })} />
          <Button type="button" variant="outline" size="icon" onClick={() => void refresh()} disabled={refreshing} title="Refresh model catalog">
            <RefreshCcw className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{refreshMessage && <span className="text-violet-500">{refreshMessage}</span>}</p>
        {models.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ model: m })}
                className="rounded-full border border-violet-500/30 bg-violet-500/5 px-2 py-0.5 text-[11px] text-violet-600 transition-colors hover:bg-violet-500/15 dark:text-violet-400"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </FieldRow>

      <FieldRow label="Voice" htmlFor="nvidia-tts-voice" hint="Voice id or name the model accepts">
        <Input id="nvidia-tts-voice" value={voice} placeholder="default" onChange={(e) => set({ voice: e.target.value })} />
      </FieldRow>

      <FieldRow label="Output Format" htmlFor="nvidia-tts-format">
        <Select value={format} onValueChange={(v) => set({ format: v })}>
          <SelectTrigger id="nvidia-tts-format" className="w-full"><SelectValue placeholder="Format" /></SelectTrigger>
          <SelectContent>{TTS_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Speed" htmlFor="nvidia-tts-speed">
        <Input id="nvidia-tts-speed" type="number" min={0.5} max={2} step={0.1} value={speed} onChange={(e) => set({ speed: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="nvidia-tts-timeout">
        <Input id="nvidia-tts-timeout" type="number" min={1000} step={1000} value={timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void preview()} disabled={previewing}>
              <Play /> {previewing ? 'Generating…' : 'Preview Voice'}
            </Button>
            <audio ref={audioRef} className="h-8 w-full max-w-sm" controls />
          </div>
          {previewMessage && <p className="text-muted-foreground text-xs">{previewMessage}</p>}
        </div>
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester run={() => testNvidiaTts(apiKey, baseUrl, timeoutMs).then((r) => { set({ status: r.ok ? 'connected' : 'disconnected' }); return r })} />
      </FieldRow>
    </ProviderCard>
  )
}