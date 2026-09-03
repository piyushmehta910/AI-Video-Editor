import { useApiConfigStore } from '@/api/config/store'
import { elevenLabsProvider, ELEVENLABS_PROVIDER_ID } from './elevenlabs'
import { nvidiaTtsProvider, NVIDIA_TTS_PROVIDER_ID } from './nvidia'
import { magpieTtsProvider, MAGPIE_TTS_PROVIDER_ID } from './magpie'
import { browserTtsProvider, BROWSER_TTS_PROVIDER_ID } from './browserTts'
import type { TtsProvider } from './types'

export type { TtsProvider } from './types'
export { MAGPIE_VOICE_PRESETS, NVIDIA_MAGPIE_MODEL, MAGPIE_TTS_PROVIDER_ID } from './magpie'
export { browserTtsProvider, BROWSER_TTS_PROVIDER_ID } from './browserTts'

const CLOUD_PROVIDERS: TtsProvider[] = [elevenLabsProvider, magpieTtsProvider, nvidiaTtsProvider]
const ALL_PROVIDERS: TtsProvider[] = [...CLOUD_PROVIDERS, browserTtsProvider]

export const TTS_PROVIDER_IDS: Record<string, string> = {
  [ELEVENLABS_PROVIDER_ID]: 'ElevenLabs',
  [MAGPIE_TTS_PROVIDER_ID]: 'NVIDIA Magpie-TTS-zeroshot',
  [NVIDIA_TTS_PROVIDER_ID]: 'NVIDIA NIM FastConformer',
  [BROWSER_TTS_PROVIDER_ID]: 'Browser Speech Synthesis (Free & Offline)',
}

/** Every provider that has enough config to synthesize speech. */
export function getConfiguredTtsProviders(): TtsProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured())
}

/**
 * The provider the user prefers (via Settings → Voice provider), falling back
 * to the first configured cloud provider, and finally to browser-native synthesis.
 */
export function getActiveTtsProvider(): TtsProvider {
  const preferred = useApiConfigStore.getState().config.preferences.preferredVoice
  const configuredCloud = CLOUD_PROVIDERS.filter((p) => p.isConfigured())
  if (preferred) {
    const chosen = ALL_PROVIDERS.find((p) => p.id === preferred && p.isConfigured())
    if (chosen) return chosen
  }
  if (configuredCloud.length > 0) {
    return configuredCloud[0]
  }
  return browserTtsProvider
}