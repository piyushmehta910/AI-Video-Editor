import * as React from 'react'
import { AudioLines, Play, RefreshCcw } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultElevenLabsConfig, type ElevenLabsConfig } from '@/api/config/types'
import { testElevenLabs, fetchElevenLabsModels } from '@/api/config/validation'
import { synthesizeSpeech } from '@/api/generation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { SliderField } from '../SliderField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ELEVEN_MODELS = ['eleven_v3', 'eleven_ttv_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_flash_v2']
const OUTPUT_FORMATS = [
  'mp3_44100_128', 'mp3_44100_192', 'mp3_44100_96', 'mp3_44100_64', 'mp3_22050_32',
  'opus_48000_96', 'opus_48000_64', 'opus_48000_32', 'pcm_44100', 'pcm_24000', 'pcm_16000', 'pcm_8000',
  'wav_44100', 'wav_24000', 'wav_16000', 'alaw_8000', 'ulaw_8000',
]

export function ElevenLabsCard() {
  const { config, update } = useApiConfigStore()
  const cfg: ElevenLabsConfig = config.elevenLabs
  const apiKey = cfg.apiKey ?? ''
  const endpoint = cfg.endpoint ?? 'https://api.elevenlabs.io'
  const voiceId = cfg.voiceId ?? ''
  const model = cfg.model ?? 'eleven_multilingual_v2'
  const language = cfg.language ?? 'auto'
  const stability = cfg.stability ?? 0.5
  const similarity = cfg.similarity ?? 0.75
  const style = cfg.style ?? 0.3
  const speed = cfg.speed ?? 1.0
  const outputFormat = cfg.outputFormat ?? 'mp3_44100_128'
  const timeoutMs = cfg.timeoutMs ?? 30000
  const [models, setModels] = React.useState<string[]>(ELEVEN_MODELS)
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshMessage, setRefreshMessage] = React.useState<string | null>(null)
  const [previewing, setPreviewing] = React.useState(false)
  const [previewMessage, setPreviewMessage] = React.useState<string | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const set = (patch: Partial<ElevenLabsConfig>) => {
    update((draft) => ({ ...draft, elevenLabs: { ...draft.elevenLabs, ...patch } }))
  }

  const refresh = async () => {
    if (!apiKey.trim()) { setRefreshMessage('Enter an API key to load the model list'); return }
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      const roster = await fetchElevenLabsModels(apiKey, endpoint, timeoutMs)
      setModels(roster)
      if (!roster.includes(cfg.model ?? '')) set({ model: roster[0] })
      setRefreshMessage(`Loaded ${roster.length} models from your account`)
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const preview = async () => {
    if (!apiKey.trim() || !voiceId.trim()) { setPreviewMessage('Enter an API key and voice ID to preview'); return }
    setPreviewing(true)
    setPreviewMessage(null)
    try {
      const blob = await synthesizeSpeech({
        apiKey, endpoint, voiceId,
        text: 'Hi, this is a quick voiceover preview from ClipForge.',
        model, language, stability, similarity, style, speed, outputFormat, timeoutMs,
      })
      const url = URL.createObjectURL(blob)
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
      icon={<AudioLines className="size-4.5" />}
      title="ElevenLabs"
      description="Voiceover, text-to-speech & narration"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, elevenLabs: { ...defaultElevenLabsConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="eleven-api-key" className="md:col-span-2">
        <ApiKeyInput id="eleven-api-key" value={apiKey} placeholder="xi-api-key" onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow label="Endpoint" htmlFor="eleven-endpoint" className="md:col-span-2">
        <Input id="eleven-endpoint" value={endpoint} placeholder="https://api.elevenlabs.io" onChange={(e) => set({ endpoint: e.target.value })} />
      </FieldRow>

      <FieldRow label="Voice ID" htmlFor="eleven-voice" hint="Leave blank to use default voice">
        <Input id="eleven-voice" value={voiceId} placeholder="21m00Tcm4TlvDq8ikWAM" onChange={(e) => set({ voiceId: e.target.value })} />
      </FieldRow>

      <FieldRow label="Model" htmlFor="eleven-model">
        <div className="flex gap-2">
          <Select value={model} onValueChange={(v) => set({ model: v })}>
            <SelectTrigger id="eleven-model" className="w-full"><SelectValue placeholder="Model" /></SelectTrigger>
            <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => void refresh()} disabled={refreshing} title="Refresh models from your ElevenLabs account" aria-label="Refresh models from your ElevenLabs account">
            <RefreshCcw className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{refreshMessage && <span className="text-violet-500">{refreshMessage}</span>}</p>
      </FieldRow>

      <FieldRow label="Output Format" htmlFor="eleven-format">
        <Select value={outputFormat} onValueChange={(v) => set({ outputFormat: v })}>
          <SelectTrigger id="eleven-format" className="w-full"><SelectValue placeholder="Format" /></SelectTrigger>
          <SelectContent>{OUTPUT_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Language" htmlFor="eleven-language">
        <Select value={language} onValueChange={(v) => set({ language: v })}>
          <SelectTrigger id="eleven-language" className="w-full"><SelectValue placeholder="Language" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="hi">Hindi</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="de">German</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <SliderField label="Stability" value={stability} onChange={(v) => set({ stability: v })} />
      <SliderField label="Similarity" value={similarity} onChange={(v) => set({ similarity: v })} />
      <SliderField label="Style" value={style} onChange={(v) => set({ style: v })} />
      <SliderField label="Speed" value={speed} min={0.5} max={2} step={0.1} onChange={(v) => set({ speed: v })} />

      <FieldRow label="Timeout (ms)" htmlFor="eleven-timeout">
        <Input id="eleven-timeout" type="number" min={1000} step={1000} value={timeoutMs} onChange={(e) => set({ timeoutMs: Number(e.target.value) })} />
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
        <ApiTester run={() => testElevenLabs(apiKey, endpoint, timeoutMs, voiceId).then((r) => { set({ status: r.ok ? 'connected' : 'disconnected' }); return r })} />
      </FieldRow>
    </ProviderCard>
  )
}
