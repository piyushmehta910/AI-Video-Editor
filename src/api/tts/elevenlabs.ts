import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'
import type { TTSResult, TTSSynthesizeOptions, TtsProvider } from './types'

export const ELEVENLABS_PROVIDER_ID = 'elevenlabs'

function elevenLabsConfig() {
  return useApiConfigStore.getState().config.elevenLabs
}

export const elevenLabsProvider: TtsProvider = {
  id: ELEVENLABS_PROVIDER_ID,
  name: 'ElevenLabs',

  isConfigured() {
    const cfg = elevenLabsConfig()
    return Boolean(cfg.enabled && cfg.apiKey)
  },

  async synthesize(options) {
    const cfg = elevenLabsConfig()
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
  },
}

/** @deprecated Use getActiveTtsProvider() from @/api/tts instead. */
export async function generateVoiceover(options: TTSSynthesizeOptions): Promise<TTSResult> {
  return elevenLabsProvider.synthesize(options)
}

/** @deprecated Use getActiveTtsProvider() from @/api/tts instead. */
export function isElevenLabsConfigured(): boolean {
  return elevenLabsProvider.isConfigured()
}