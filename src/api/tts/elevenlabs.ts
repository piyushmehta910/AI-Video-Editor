import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface TTSOptions {
  text: string
  voiceId?: string
  model?: string
  stability?: number
  similarity?: number
  style?: number
  speed?: number
  outputFormat?: string
}

export interface TTSResult {
  blob: Blob
  url: string
  duration?: number
}

export function isElevenLabsConfigured(): boolean {
  const cfg = useApiConfigStore.getState().config.elevenLabs
  return Boolean(cfg.enabled && cfg.apiKey)
}

export async function generateVoiceover(options: TTSOptions): Promise<TTSResult> {
  const cfg = useApiConfigStore.getState().config.elevenLabs
  const base = (cfg.endpoint ?? 'https://api.elevenlabs.io').replace(/\/$/, '')
  const voiceId = options.voiceId ?? cfg.voiceId ?? '21m00Tcm4TlvDq8ikWAM'
  const model = options.model ?? cfg.model ?? 'eleven_multilingual_v2'
  const format = options.outputFormat ?? cfg.outputFormat ?? 'mp3_44100_128'

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'xi-api-key': cfg.apiKey ?? '',
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: options.text,
      model_id: model,
      voice_settings: {
        stability: options.stability ?? cfg.stability ?? 0.5,
        similarity_boost: options.similarity ?? cfg.similarity ?? 0.75,
        style: options.style ?? cfg.style ?? 0.3,
        speed: options.speed ?? cfg.speed ?? 1.0,
      },
    }),
  }
  const timeoutMs = cfg.timeoutMs ?? 60000
  const url = `${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(format)}`
  const res = needsProxy(url)
    ? await proxyFetch(url, { ...init, signal: undefined }, timeoutMs)
    : await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`ElevenLabs TTS error ${res.status}: ${text.slice(0, 200)}`)
  }
  const blob = await res.blob()
  return { blob, url: URL.createObjectURL(blob) }
}