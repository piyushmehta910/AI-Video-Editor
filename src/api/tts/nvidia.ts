import { useApiConfigStore } from '@/api/config/store'
import { defaultNvidiaNimConfig } from '@/api/config/types'
import { needsProxy, proxyFetch } from '@/api/proxy'
import type { TtsProvider } from './types'

export const NVIDIA_TTS_PROVIDER_ID = 'nvidia-nim-tts'

function getNvidiaNimConfig() {
  return useApiConfigStore.getState().config.nvidiaNim ?? defaultNvidiaNimConfig
}

/**
 * NVIDIA NIM voice provider. Uses the unified NVIDIA NIM API key and base URL
 * with OpenAI-compatible `/v1/audio/speech` endpoint.
 */
export const nvidiaTtsProvider: TtsProvider = {
  id: NVIDIA_TTS_PROVIDER_ID,
  name: 'NVIDIA NIM Voice',

  isConfigured() {
    const cfg = getNvidiaNimConfig()
    return Boolean(cfg.enabled && cfg.apiKey?.trim())
  },

  async synthesize(options) {
    const cfg = getNvidiaNimConfig()
    const base = (cfg.baseUrl ?? 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')
    const model = options.model ?? cfg.voiceModel ?? 'nvidia/magpie-tts-zeroshot'
    const format = options.outputFormat ?? 'wav'
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
        voice: options.voiceId ?? cfg.voice ?? 'Aaliyah',
        response_format: format,
        speed: options.speed ?? cfg.voiceSpeed ?? 1.0,
      }),
    }
    const timeoutMs = cfg.timeoutMs ?? 60000
    const res = needsProxy(url)
      ? await proxyFetch(url, init, timeoutMs)
      : await fetch(url, init)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`NVIDIA Voice error ${res.status}: ${text.slice(0, 250)}`)
    }
    const blob = await res.blob()
    return { blob }
  },
}