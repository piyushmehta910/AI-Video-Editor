import { UserRound } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultAvatarConfig, type AvatarConfig } from '@/api/config/types'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
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
      title="Avatar & Lip Sync"
      description="On-device talking avatar — rendered in your browser, no API"
      enabled={cfg.enabled}
      status={
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          Browser · no API
        </span>
      }
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'connected' : 'disabled' })}
      onSave={save}
      onReset={() => update((draft) => ({ ...draft, avatar: { ...defaultAvatarConfig } }))}
    >
      <p className="text-muted-foreground md:col-span-2 text-xs">
        Lip-sync avatars are generated entirely on-device: the speech audio is analyzed with the Web Audio API
        and a mouth is animated frame-by-frame over your avatar image. Nothing leaves your computer — no API key,
        no external service.
      </p>

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
        <Input
          id="avatar-fps"
          type="number"
          min={15}
          max={60}
          value={cfg.fps}
          onChange={(e) => set({ fps: Number(e.target.value) })}
        />
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

      <FieldRow label="Mouth Position X" hint={`Current: ${Math.round(cfg.mouthX * 100)}%`}>
        <Slider
          min={0.2}
          max={0.8}
          step={0.01}
          value={[cfg.mouthX]}
          onValueChange={([value]) => set({ mouthX: value })}
        />
      </FieldRow>

      <FieldRow label="Mouth Position Y" hint={`Current: ${Math.round(cfg.mouthY * 100)}%`}>
        <Slider
          min={0.5}
          max={0.95}
          step={0.01}
          value={[cfg.mouthY]}
          onValueChange={([value]) => set({ mouthY: value })}
        />
      </FieldRow>

      <FieldRow label="Mouth Width" hint={`Current: ${Math.round(cfg.mouthWidth * 100)}%`}>
        <Slider
          min={0.05}
          max={0.35}
          step={0.01}
          value={[cfg.mouthWidth]}
          onValueChange={([value]) => set({ mouthWidth: value })}
        />
      </FieldRow>

      <FieldRow label="Max Mouth Open" hint={`Current: ${Math.round(cfg.mouthMaxOpen * 100)}%`}>
        <Slider
          min={0.02}
          max={0.2}
          step={0.01}
          value={[cfg.mouthMaxOpen]}
          onValueChange={([value]) => set({ mouthMaxOpen: value })}
        />
      </FieldRow>
    </ProviderCard>
  )
}
