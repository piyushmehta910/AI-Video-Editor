import { UserRound } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultAvatarConfig, type AvatarConfig } from '@/api/config/types'
import { testBearerEndpoint } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RESOLUTIONS = ['512x512', '768x768', '1024x1024']
const BACKGROUNDS = ['transparent', 'solid', 'blurred']

export function AvatarCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: AvatarConfig = config.avatar

  const set = (patch: Partial<AvatarConfig>) => {
    update((draft) => ({ ...draft, avatar: { ...draft.avatar, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<UserRound className="size-4.5" />}
      title="Avatar Generation"
      description="AI presenter avatars"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onSave={save}
      onReset={() => update((draft) => ({ ...draft, avatar: { ...defaultAvatarConfig } }))}
    >
      <FieldRow label="Provider" htmlFor="avatar-provider" className="md:col-span-2">
        <Select value={cfg.provider} onValueChange={(v) => set({ provider: v })}>
          <SelectTrigger id="avatar-provider" className="w-full">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NVIDIA NIM">NVIDIA NIM</SelectItem>
            <SelectItem value="Custom">Custom endpoint</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="API Key" htmlFor="avatar-api-key" className="md:col-span-2">
        <ApiKeyInput
          id="avatar-api-key"
          value={cfg.apiKey}
          placeholder="API key"
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Endpoint" htmlFor="avatar-endpoint" className="md:col-span-2">
        <Input id="avatar-endpoint" value={cfg.endpoint} placeholder="https://..." onChange={(e) => set({ endpoint: e.target.value })} />
      </FieldRow>

      <FieldRow label="Model" htmlFor="avatar-model">
        <Input id="avatar-model" value={cfg.model} placeholder="model" onChange={(e) => set({ model: e.target.value })} />
      </FieldRow>

      <FieldRow label="Avatar ID" htmlFor="avatar-id">
        <Input id="avatar-id" value={cfg.avatarId} placeholder="avatar-id" onChange={(e) => set({ avatarId: e.target.value })} />
      </FieldRow>

      <FieldRow label="Voice" htmlFor="avatar-voice">
        <Input id="avatar-voice" value={cfg.voice} placeholder="voice id" onChange={(e) => set({ voice: e.target.value })} />
      </FieldRow>

      <FieldRow label="Resolution" htmlFor="avatar-resolution">
        <Select value={cfg.resolution} onValueChange={(v) => set({ resolution: v })}>
          <SelectTrigger id="avatar-resolution" className="w-full">
            <SelectValue placeholder="Resolution" />
          </SelectTrigger>
          <SelectContent>
            {RESOLUTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="FPS" htmlFor="avatar-fps">
        <Input id="avatar-fps" type="number" min={15} max={60} value={cfg.fps} onChange={(e) => set({ fps: Number(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Background" htmlFor="avatar-background">
        <Select value={cfg.background} onValueChange={(v) => set({ background: v })}>
          <SelectTrigger id="avatar-background" className="w-full">
            <SelectValue placeholder="Background" />
          </SelectTrigger>
          <SelectContent>
            {BACKGROUNDS.map((b) => (
              <SelectItem key={b} value={b}>
                {b.charAt(0).toUpperCase() + b.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester
          run={() => {
            if (!cfg.endpoint) {
              return Promise.resolve({
                ok: false,
                status: 'disconnected' as const,
                message: 'Avatar: endpoint not configured',
                latencyMs: 0,
              })
            }
            return testBearerEndpoint({
              label: 'Avatar',
              url: cfg.endpoint,
              apiKey: cfg.apiKey,
              timeoutMs: 15000,
            }).then((result) => {
              if (result.ok) {
                set({ status: 'connected' })
              } else if (result.status === 'disconnected') {
                set({ status: 'disconnected' })
              }
              return result
            })
          }}
        />
      </FieldRow>
    </ProviderCard>
  )
}