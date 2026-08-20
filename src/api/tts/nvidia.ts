import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'
import type { TtsProvider } from './types'

export const NVIDIA_TTS_PROVIDER_ID = 'nvidia-nim-tts'

function nvidiaTtsConfig() {
  return useApiConfigStore.getState().config.nvidiaTts
}

/**
 * NVIDIA NIM voice provider. NVIDIA exposes TTS models as OpenAI-compatible
 * `/v1/audio/speech` endpoints on the same base URL as its chat models, so the
 * provider is fully configurable: set the base URL, model id and voice in
 * Settings. No hardcoded catalog model — whatever endpoint the account serves
 * is used as-is.
 */
export const nvidiaTtsProvider: TtsProvider = {
  id: NVIDIA_TTS_PROVIDER_ID,
  name: 'NVIDIA NIM',

  isConfigured() {
    const cfg = nvidiaTtsConfig()
    return Boolean(cfg.enabled && cfg.apiKey && cfg.model)
  },

  async synthesize(options) {
    const cfg = nvidiaTtsConfig()
    const base = (cfg.baseUrl ?? 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')
    const model = options.model ?? cfg.model
    const format = options.outputFormat ?? cfg.format ?? 'mp3'
    const url = `${base}/audio/speech`

    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model,
        input: options.text,
        voice: options.voiceId ?? cfg.voice ?? 'default',
        response_format: format,
        speed: options.speed ?? cfg.speed ?? 1.0,
      }),
    }
    const timeoutMs = cfg.timeoutMs ?? 60000
    const res = needsProxy(url)
      ? await proxyFetch(url, { ...init, signal: undefined }, timeoutMs)
      : await fetch(url, init)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`NVIDIA TTS error ${res.status}: ${text.slice(0, 200)}`)
    }
    const blob = await res.blob()
    return { blob, url: URL.createObjectURL(blob) }
  },
}