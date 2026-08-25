import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  magpieTtsProvider,
  MAGPIE_TTS_PROVIDER_ID,
  NVIDIA_MAGPIE_MODEL,
  MAGPIE_VOICE_PRESETS,
} from './magpie'
import { getActiveTtsProvider, getConfiguredTtsProviders } from './index'
import { useApiConfigStore } from '@/api/config/store'

describe('NVIDIA NIM Magpie TTS Zeroshot Provider', () => {
  beforeEach(() => {
    useApiConfigStore.getState().reset()
  })

  it('exports correct model identifier and presets', () => {
    expect(MAGPIE_TTS_PROVIDER_ID).toBe('nvidia-magpie-tts-zeroshot')
    expect(NVIDIA_MAGPIE_MODEL).toBe('magpie-tts-zeroshot')
    expect(MAGPIE_VOICE_PRESETS.length).toBeGreaterThanOrEqual(20)
    expect(MAGPIE_VOICE_PRESETS.some((v) => v.id === 'Finn')).toBe(true)
    expect(MAGPIE_VOICE_PRESETS.some((v) => v.id === 'Aaliyah')).toBe(true)
  })

  it('detects when NVIDIA NIM or NVIDIA TTS API key is configured', () => {
    expect(magpieTtsProvider.isConfigured()).toBe(false)

    useApiConfigStore.getState().update((draft) => ({
      ...draft,
      nvidiaNim: { ...draft.nvidiaNim, apiKey: 'nvapi-test-key-123', enabled: true },
    }))
    expect(magpieTtsProvider.isConfigured()).toBe(true)
  })

  it('synthesizes speech using magpie-tts-zeroshot model on NVIDIA NIM', async () => {
    useApiConfigStore.getState().update((draft) => ({
      ...draft,
      nvidiaNim: { ...draft.nvidiaNim, apiKey: 'nvapi-test-key-123', enabled: true },
    }))

    const mockBlob = new Blob(['mock audio wav'], { type: 'audio/wav' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as unknown as Response)

    const result = await magpieTtsProvider.synthesize({
      text: 'Hello, welcome to our AI Video Editor!',
      voiceId: 'Finn',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/proxy')
    const proxyPayload = JSON.parse(String(init?.body))
    expect(proxyPayload.url).toContain('/audio/speech')
    const body = JSON.parse(String(proxyPayload.body))
    expect(body.model).toBe('magpie-tts-zeroshot')
    expect(body.input).toBe('Hello, welcome to our AI Video Editor!')
    expect(body.voice).toBe('Finn')
    expect(result.blob).toBe(mockBlob)

    fetchSpy.mockRestore()
  })

  it('selects Magpie TTS as the active provider when NVIDIA NIM is enabled', () => {
    useApiConfigStore.getState().update((draft) => ({
      ...draft,
      nvidiaNim: { ...draft.nvidiaNim, apiKey: 'nvapi-test-key-123', enabled: true },
    }))

    const configured = getConfiguredTtsProviders()
    expect(configured.some((p) => p.id === MAGPIE_TTS_PROVIDER_ID)).toBe(true)

    const active = getActiveTtsProvider()
    expect(active?.id).toBe(MAGPIE_TTS_PROVIDER_ID)
  })
})
