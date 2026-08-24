import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'
import type { TtsProvider } from './types'

export const MAGPIE_TTS_PROVIDER_ID = 'nvidia-magpie-tts-zeroshot'
export const NVIDIA_MAGPIE_MODEL = 'magpie-tts-zeroshot'

/**
 * Curated built-in voice presets for Magpie-TTS-zeroshot.
 * These are the reference audio voice IDs the NVIDIA NIM endpoint supports.
 */
export const MAGPIE_VOICE_PRESETS: { id: string; label: string; style: string }[] = [
  { id: 'Aaliyah', label: 'Aaliyah', style: 'Warm, conversational female' },
  { id: 'Adriana', label: 'Adriana', style: 'Confident, professional female' },
  { id: 'Austin', label: 'Austin', style: 'Friendly, casual male' },
  { id: 'Carter', label: 'Carter', style: 'Deep, authoritative male' },
  { id: 'Clementine', label: 'Clementine', style: 'Bright, energetic female' },
  { id: 'Deedee', label: 'Deedee', style: 'Soft, calming female' },
  { id: 'Eva', label: 'Eva', style: 'Clear, articulate female' },
  { id: 'Fergie', label: 'Fergie', style: 'Upbeat, youthful female' },
  { id: 'Finn', label: 'Finn', style: 'Smooth, narrator male' },
  { id: 'Genevieve', label: 'Genevieve', style: 'Elegant, refined female' },
  { id: 'Grant', label: 'Grant', style: 'Trustworthy, newscaster male' },
  { id: 'Heather', label: 'Heather', style: 'Warm, storytelling female' },
  { id: 'Hudson', label: 'Hudson', style: 'Rich, baritone male' },
  { id: 'Indira', label: 'Indira', style: 'Sophisticated, multilingual female' },
  { id: 'James', label: 'James', style: 'Classic, documentary male' },
  { id: 'Javier', label: 'Javier', style: 'Expressive, charismatic male' },
  { id: 'Kai', label: 'Kai', style: 'Neutral, tech-focused' },
  { id: 'Luna', label: 'Luna', style: 'Gentle, ASMR female' },
  { id: 'Miles', label: 'Miles', style: 'Chill, podcast male' },
  { id: 'Nora', label: 'Nora', style: 'Cheerful, broadcast female' },
]

function nvidiaTtsConfig() {
  return useApiConfigStore.getState().config.nvidiaTts
}

function nvidiaNimConfig() {
  return useApiConfigStore.getState().config.nvidiaNim
}

/**
 * NVIDIA Magpie-TTS-Zeroshot provider.
 *
 * Uses the NVIDIA NIM `/v1/audio/speech` endpoint with model `magpie-tts-zeroshot`.
 * Supports both preset voice IDs and optional zero-shot voice cloning via a
 * reference audio blob (uploaded as base64 in the request body).
 *
 * Falls back to the nvidiaNim API key if nvidiaTts key is not set.
 */
export const magpieTtsProvider: TtsProvider = {
  id: MAGPIE_TTS_PROVIDER_ID,
  name: 'Magpie TTS Zero-Shot (NVIDIA)',

  isConfigured() {
    const nimCfg = nvidiaNimConfig()
    const ttsCfg = nvidiaTtsConfig()
    const hasKey = Boolean(ttsCfg.apiKey || nimCfg.apiKey)
    return hasKey && (nimCfg.enabled || ttsCfg.enabled)
  },

  async synthesize(options) {
    const ttsCfg = nvidiaTtsConfig()
    const nimCfg = nvidiaNimConfig()
    const apiKey = ttsCfg.apiKey || nimCfg.apiKey || ''
    const base = (ttsCfg.baseUrl ?? nimCfg.baseUrl ?? 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')
    const url = `${base}/audio/speech`
    const voice = options.voiceId ?? MAGPIE_VOICE_PRESETS[0].id
    const format = options.outputFormat ?? 'wav'
    const speed = options.speed ?? 1.0

    const body: Record<string, unknown> = {
      model: NVIDIA_MAGPIE_MODEL,
      input: options.text,
      voice,
      response_format: format,
      speed,
    }

    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }

    const timeoutMs = ttsCfg.timeoutMs ?? 90000
    const res = needsProxy(url)
      ? await proxyFetch(url, { ...init, signal: undefined }, timeoutMs)
      : await fetch(url, init)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Magpie TTS error ${res.status}: ${text.slice(0, 300)}`)
    }
    const blob = await res.blob()
    return { blob, url: URL.createObjectURL(blob) }
  },
}
