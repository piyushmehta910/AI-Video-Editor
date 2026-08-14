import { MessageSquareText } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultWav2LipConfig, type Wav2LipConfig } from '@/api/config/types'
import { testReachability } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MODELS = ['wav2lip_gan', 'wav2lip', 'wav2lip_s3fd']
const FORMATS = ['mp4', 'mov', 'webm']

export function Wav2LipCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: Wav2LipConfig = config.wav2Lip

  const set = (patch: Partial<Wav2LipConfig>) => {
    update((draft) => ({ ...draft, wav2Lip: { ...draft.wav2Lip, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<MessageSquareText className="size-4.5" />}
      title="Lip Sync (Wav2Lip)"
      description="Synchronize avatar lips with generated audio"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onSave={save}
      onReset={() => update((draft) => ({ ...draft, wav2Lip: { ...defaultWav2LipConfig } }))}
    >
      <FieldRow label="Endpoint" htmlFor="wav2lip-endpoint" className="md:col-span-2">
        <Input
          id="wav2lip-endpoint"
          value={cfg.endpoint}
          placeholder="http://localhost:8000"
          onChange={(e) => set({ endpoint: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="API Key" htmlFor="wav2lip-api-key" className="md:col-span-2">
        <ApiKeyInput
          id="wav2lip-api-key"
          value={cfg.apiKey}
          placeholder="Optional"
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Model" htmlFor="wav2lip-model">
        <Select value={cfg.model} onValueChange={(v) => set({ model: v })}>
          <SelectTrigger id="wav2lip-model" className="w-full">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Resolution" htmlFor="wav2lip-resolution">
        <Select value={String(cfg.resolution)} onValueChange={(v) => set({ resolution: Number(v) })}>
          <SelectTrigger id="wav2lip-resolution" className="w-full">
            <SelectValue placeholder="Resolution" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="512">512</SelectItem>
            <SelectItem value="720">720</SelectItem>
            <SelectItem value="1080">1080</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Input Format" htmlFor="wav2lip-in">
        <Select value={cfg.inputFormat} onValueChange={(v) => set({ inputFormat: v })}>
          <SelectTrigger id="wav2lip-in" className="w-full">
            <SelectValue placeholder="Input" />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {f.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Output Format" htmlFor="wav2lip-out">
        <Select value={cfg.outputFormat} onValueChange={(v) => set({ outputFormat: v })}>
          <SelectTrigger id="wav2lip-out" className="w-full">
            <SelectValue placeholder="Output" />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {f.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="FPS" htmlFor="wav2lip-fps">
        <Input id="wav2lip-fps" type="number" min={15} max={60} value={cfg.fps} onChange={(e) => set({ fps: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester
          run={() =>
            testReachability({
              label: 'Wav2Lip',
              url: cfg.endpoint,
              timeoutMs: 15000,
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