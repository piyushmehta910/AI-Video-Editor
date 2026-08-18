import { AudioLines } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultElevenLabsConfig, type ElevenLabsConfig } from '@/api/config/types'
import { testElevenLabs } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { SliderField } from '../SliderField'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ELEVEN_MODELS = ['eleven_v3', 'eleven_ttv_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_flash_v2']
const OUTPUT_FORMATS = [
  'mp3_44100_128',
  'mp3_44100_192',
  'mp3_44100_96',
  'mp3_44100_64',
  'mp3_22050_32',
  'opus_48000_96',
  'opus_48000_64',
  'opus_48000_32',
  'pcm_44100',
  'pcm_24000',
  'pcm_16000',
  'pcm_8000',
  'wav_44100',
  'wav_24000',
  'wav_16000',
  'alaw_8000',
  'ulaw_8000',
]

export function ElevenLabsCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: ElevenLabsConfig = config.elevenLabs

  const set = (patch: Partial<ElevenLabsConfig>) => {
    update((draft) => ({ ...draft, elevenLabs: { ...draft.elevenLabs, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<AudioLines className="size-4.5" />}
      title="ElevenLabs"
      description="Voiceover, text-to-speech & narration"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onSave={save}
      onReset={() => update((draft) => ({ ...draft, elevenLabs: { ...defaultElevenLabsConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="eleven-api-key" className="md:col-span-2">
        <ApiKeyInput
          id="eleven-api-key"
          value={cfg.apiKey}
          placeholder="xi-api-key"
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Endpoint" htmlFor="eleven-endpoint" className="md:col-span-2">
        <Input
          id="eleven-endpoint"
          value={cfg.endpoint}
          placeholder="https://api.elevenlabs.io"
          onChange={(e) => set({ endpoint: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Voice ID" htmlFor="eleven-voice" hint="Leave blank to use default voice">
        <Input id="eleven-voice" value={cfg.voiceId} placeholder="21m00Tcm4TlvDq8ikWAM" onChange={(e) => set({ voiceId: e.target.value })} />
      </FieldRow>

      <FieldRow label="Model" htmlFor="eleven-model">
        <Select value={cfg.model} onValueChange={(v) => set({ model: v })}>
          <SelectTrigger id="eleven-model" className="w-full">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            {ELEVEN_MODELS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Output Format" htmlFor="eleven-format">
        <Select value={cfg.outputFormat} onValueChange={(v) => set({ outputFormat: v })}>
          <SelectTrigger id="eleven-format" className="w-full">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            {OUTPUT_FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Language" htmlFor="eleven-language">
        <Select value={cfg.language} onValueChange={(v) => set({ language: v })}>
          <SelectTrigger id="eleven-language" className="w-full">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
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

      <SliderField label="Stability" value={cfg.stability} onChange={(v) => set({ stability: v })} />
      <SliderField label="Similarity" value={cfg.similarity} onChange={(v) => set({ similarity: v })} />
      <SliderField label="Style" value={cfg.style} onChange={(v) => set({ style: v })} />
      <SliderField label="Speed" value={cfg.speed} min={0.5} max={2} step={0.1} onChange={(v) => set({ speed: v })} />

      <FieldRow className="md:col-span-2">
        <ApiTester
          run={() =>
            testElevenLabs(cfg.apiKey, 15000).then((result) => {
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