import { UserRound, Mic, Brain, Sparkles, FileText } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultAvatarConfig, type AvatarConfig } from '@/api/config/types'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LipSyncTimelineIntegration } from '@/components/editor/LipSync'
import { CaptionsTimelineIntegration } from '@/components/editor/Captions'

const RESOLUTIONS = ['512x512', '768x768', '1024x1024']
const BACKGROUNDS = ['transparent', 'solid', 'blurred']

export function AvatarCard() {
  const { config, update } = useApiConfigStore()
  const cfg: AvatarConfig = config.avatar

  const set = (patch: Partial<AvatarConfig>) => {
    update((draft) => ({ ...draft, avatar: { ...draft.avatar, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<UserRound className="size-4.5" />}
      title="Avatar & Lip Sync"
      description="On-device talking avatar with Wav2Lip neural lip-sync"
      enabled={cfg.enabled}
      status={
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          Browser · no API
        </span>
      }
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'connected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, avatar: { ...defaultAvatarConfig } }))}
    >
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="simple" className="flex items-center gap-2">
            <Mic className="size-3.5" />
            Simple Mouth
          </TabsTrigger>
          <TabsTrigger value="wav2lip" className="flex items-center gap-2">
            <Brain className="size-3.5" />
            Wav2Lip Neural
          </TabsTrigger>
          <TabsTrigger value="captions" className="flex items-center gap-2">
            <FileText className="size-3.5" />
            Auto Captions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Simple mouth animation: analyzes speech audio with Web Audio API and animates a mouth shape
            over your avatar image. Lightweight, runs in real-time, no model download needed.
          </p>

          <FieldRow label="Resolution" htmlFor="avatar-resolution">
            <Select value={cfg.resolution} onValueChange={(v) => set({ resolution: v })}>
              <SelectTrigger id="avatar-resolution" className="w-full">
                <SelectValue placeholder="Resolution" />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="FPS" htmlFor="avatar-fps">
            <Input id="avatar-fps" type="number" min={15} max={60} value={cfg.fps} onChange={(e) => set({ fps: Number(e.target.value) })} />
          </FieldRow>

          <FieldRow label="Background" htmlFor="avatar-background">
            <Select value={cfg.background} onValueChange={(v) => set({ background: v })}>
              <SelectTrigger id="avatar-background" className="w-full"><SelectValue placeholder="Background" /></SelectTrigger>
              <SelectContent>
                {BACKGROUNDS.map((b) => <SelectItem key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Mouth Position X" hint={`Current: ${Math.round(cfg.mouthX * 100)}%`}>
            <Slider min={0.2} max={0.8} step={0.01} value={[cfg.mouthX]} onValueChange={([value]) => set({ mouthX: value })} />
          </FieldRow>

          <FieldRow label="Mouth Position Y" hint={`Current: ${Math.round(cfg.mouthY * 100)}%`}>
            <Slider min={0.5} max={0.95} step={0.01} value={[cfg.mouthY]} onValueChange={([value]) => set({ mouthY: value })} />
          </FieldRow>

          <FieldRow label="Mouth Width" hint={`Current: ${Math.round(cfg.mouthWidth * 100)}%`}>
            <Slider min={0.05} max={0.35} step={0.01} value={[cfg.mouthWidth]} onValueChange={([value]) => set({ mouthWidth: value })} />
          </FieldRow>

          <FieldRow label="Max Mouth Open" hint={`Current: ${Math.round(cfg.mouthMaxOpen * 100)}%`}>
            <Slider min={0.02} max={0.2} step={0.01} value={[cfg.mouthMaxOpen]} onValueChange={([value]) => set({ mouthMaxOpen: value })} />
          </FieldRow>
        </TabsContent>

        <TabsContent value="wav2lip" className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Wav2Lip neural lip-sync: uses a deep learning model (ONNX) to generate photorealistic lip movements
            that perfectly match speech. Downloads ~50MB model on first use. Runs on GPU via WebGL/WebGPU.
          </p>

          <div className="p-3 rounded-md border bg-muted/50">
            <div className="flex items-center gap-2 text-sm mb-2">
              <Sparkles className="size-4 text-primary" />
              <span className="font-medium">Wav2Lip Generator</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Create lip-synced videos by combining an avatar video with any audio. The model learns the mapping
              from audio features (mel spectrograms) to mouth movements, producing state-of-the-art results.
            </p>
            <LipSyncTimelineIntegration />
          </div>
        </TabsContent>

        <TabsContent value="captions" className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Whisper auto-captions: uses OpenAI Whisper (via Transformers.js) to transcribe speech to text with
            timestamps. Runs entirely in-browser, no API key needed. Supports 99+ languages.
          </p>

          <div className="p-3 rounded-md border bg-muted/50">
            <div className="flex items-center gap-2 text-sm mb-2">
              <Sparkles className="size-4 text-primary" />
              <span className="font-medium">Whisper Auto-Captions</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Generate accurate subtitles from any video audio. Downloads model on first use (~39-1500MB depending on size).
              Exports SRT/VTT for use in any video player.
            </p>
            <CaptionsTimelineIntegration />
          </div>
        </TabsContent>
      </Tabs>
    </ProviderCard>
  )
}