import { useApiConfigStore } from '@/api/config/store'
import { elevenLabsProvider, ELEVENLABS_PROVIDER_ID } from './elevenlabs'
import { nvidiaTtsProvider, NVIDIA_TTS_PROVIDER_ID } from './nvidia'
import { magpieTtsProvider, MAGPIE_TTS_PROVIDER_ID } from './magpie'
import type { TtsProvider } from './types'

export type { TtsProvider } from './types'
export { MAGPIE_VOICE_PRESETS, NVIDIA_MAGPIE_MODEL } from './magpie'

const ALL_PROVIDERS: TtsProvider[] = [elevenLabsProvider, nvidiaTtsProvider, magpieTtsProvider]

export const TTS_PROVIDER_IDS: Record<string, string> = {
  [ELEVENLABS_PROVIDER_ID]: 'ElevenLabs',
  [NVIDIA_TTS_PROVIDER_ID]: 'NVIDIA NIM TTS',
  [MAGPIE_TTS_PROVIDER_ID]: 'Magpie-TTS-zeroshot (NVIDIA)',
}

/** Every provider that has enough config to synthesize speech. */
export function getConfiguredTtsProviders(): TtsProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured())
}

/**
 * The provider the user prefers (via Settings → Voice provider), falling back
 * to the first provider that is configured. Returns null when none are usable.
 */
export function getActiveTtsProvider(): TtsProvider | null {
  const preferred = useApiConfigStore.getState().config.preferences.preferredVoice
  const configured = getConfiguredTtsProviders()
  if (!configured.length) return null
  if (preferred) {
    const chosen = configured.find((p) => p.id === preferred)
    if (chosen) return chosen
  }
  return configured[0]
}