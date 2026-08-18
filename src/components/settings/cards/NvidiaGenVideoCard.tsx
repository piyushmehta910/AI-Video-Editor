import * as React from 'react'
import { Film, RefreshCcw } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultNvidiaGenVideoConfig, type NvidiaGenVideoConfig } from '@/api/config/types'
import { testNvidiaGenVideo, fetchNvidiaNimModels } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const VIDEO_MODELS = [
  'Cosmos-Predict1-7B-Text2World',
  'Cosmos-Predict2.5-2B',
  'Cosmos3-Generator',
  'nvidia/cosmos-predict1-7b-text2world',
  'nvidia/consistory-paste-anything',
]

const RESOLUTIONS = ['480_16_9', '480_9_16', '720_16_9', '720_9_16', '1080_16_9', '1080_9_16']

export function NvidiaGenVideoCard() {
  const { config, update, save } = useApiConfigStore()
  const cfg: NvidiaGenVideoConfig = config.nvidiaGenVideo
  const [models, setModels] = React.useState<string[]>(VIDEO_MODELS)
  const [refreshing, setRefreshing] = React.useState(false)
  const [refreshMessage, setRefreshMessage] = React.useState<string | null>(null)

  const set = (patch: Partial<NvidiaGenVideoConfig>) => {
    update((draft) => ({ ...draft, nvidiaGenVideo: { ...draft.nvidiaGenVideo, ...patch } }))
  }

  const refresh = async () => {
    if (!cfg.apiKey.trim()) {
      setRefreshMessage('Enter an API key to load the catalog')
      return
    }
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      const catalog = await fetchNvidiaNimModels(cfg.apiKey, cfg.baseUrl, cfg.timeoutMs)
      const video = catalog.filter((id) => /(cosmos|wan|video|svd|diffusion)/i.test(id))
      setModels(Array.from(new Set([...VIDEO_MODELS, ...video])))
      setRefreshMessage(`Catalog lists ${catalog.length} models (${video.length} video-capable)`)
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ProviderCard
      icon={<Film className="size-4.5" />}
      title="NVIDIA Video Generation"
      description="Text-to-video & image-to-video (Cosmos WFM, Wan2.2, SVD)"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onSave={save}
      onReset={() => update((draft) => ({ ...draft, nvidiaGenVideo: { ...defaultNvidiaGenVideoConfig } }))}
    >
      <FieldRow label="API Key" htmlFor="genvideo-api-key" className="md:col-span-2">
        <ApiKeyInput
          id="genvideo-api-key"
          value={cfg.apiKey}
          placeholder="nvapi-..."
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Base URL" htmlFor="genvideo-base-url" className="md:col-span-2">
        <Input
          id="genvideo-base-url"
          value={cfg.baseUrl}
          placeholder="https://ai.api.nvidia.com/v1/genai/nvidia/cosmos-wfm"
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
        <p className="text-muted-foreground text-xs">
          Hosted video endpoints use model-specific URLs (e.g. …/v1/genai/nvidia/cosmos-wfm). Self-hosted NIM uses http://localhost:8000/v1.
        </p>
      </FieldRow>

      <FieldRow label="API Style" htmlFor="genvideo-style">
        <Select value={cfg.apiStyle} onValueChange={(v) => set({ apiStyle: v as NvidiaGenVideoConfig['apiStyle'] })}>
          <SelectTrigger id="genvideo-style" className="w-full">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cosmos">Cosmos WFM (/v1/infer)</SelectItem>
            <SelectItem value="openai">OpenAI-compatible (/v1/videos)</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Model" htmlFor="genvideo-model">
        <div className="flex gap-2">
          <Select value={cfg.model} onValueChange={(v) => set({ model: v })}>
            <SelectTrigger id="genvideo-model" className="w-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => void refresh()} disabled={refreshing} title="Refresh models from NVIDIA catalog">
            <RefreshCcw className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {refreshMessage && <span className="text-violet-500">{refreshMessage}</span>}
        </p>
      </FieldRow>

      <FieldRow label="Resolution" htmlFor="genvideo-resolution">
        <Select value={cfg.resolution} onValueChange={(v) => set({ resolution: v })}>
          <SelectTrigger id="genvideo-resolution" className="w-full">
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

      <FieldRow label="Frames" htmlFor="genvideo-frames">
        <Input
          id="genvideo-frames"
          type="number"
          min={1}
          step={1}
          value={cfg.numFrames}
          onChange={(e) => set({ numFrames: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="FPS" htmlFor="genvideo-fps">
        <Input
          id="genvideo-fps"
          type="number"
          min={1}
          step={1}
          value={cfg.fps}
          onChange={(e) => set({ fps: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="Seed" htmlFor="genvideo-seed">
        <Input
          id="genvideo-seed"
          type="number"
          step={1}
          value={cfg.seed}
          onChange={(e) => set({ seed: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="Guidance Scale" htmlFor="genvideo-guidance">
        <Input
          id="genvideo-guidance"
          type="number"
          min={0}
          step={0.5}
          value={cfg.guidanceScale}
          onChange={(e) => set({ guidanceScale: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow label="Negative Prompt" htmlFor="genvideo-negative" className="md:col-span-2">
        <Input
          id="genvideo-negative"
          value={cfg.negativePrompt}
          onChange={(e) => set({ negativePrompt: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Timeout (ms)" htmlFor="genvideo-timeout">
        <Input
          id="genvideo-timeout"
          type="number"
          min={10000}
          step={10000}
          value={cfg.timeoutMs}
          onChange={(e) => set({ timeoutMs: Number(e.target.value) })}
        />
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester
          label="Test Connection"
          run={() =>
            testNvidiaGenVideo({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, timeoutMs: cfg.timeoutMs }).then(
              (result) => {
                if (result.ok) {
                  set({ status: 'connected' })
                } else if (result.status === 'disconnected') {
                  set({ status: 'disconnected' })
                }
                return result
              },
            )
          }
        />
      </FieldRow>
    </ProviderCard>
  )
}