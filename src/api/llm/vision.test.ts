import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  analyzeImageWithNvidiaVision,
  extractOcrWithNemotron,
  generateSceneCaptionWithNemotron,
  DEFAULT_NVIDIA_VISION_MODEL,
  NVIDIA_VISION_MODELS,
} from './vision'
import { useApiConfigStore } from '@/api/config/store'

describe('NVIDIA Vision & Nemotron Omni Reasoning', () => {
  beforeEach(() => {
    useApiConfigStore.setState({
      config: {
        ...useApiConfigStore.getState().config,
        nvidiaNim: {
          ...useApiConfigStore.getState().config.nvidiaNim,
          apiKey: 'nvapi-test-key',
          enabled: true,
        },
      },
    })
    vi.restoreAllMocks()
  })

  it('contains nemotron-3-nano-omni-30b-a3b-reasoning as the default vision model', () => {
    expect(DEFAULT_NVIDIA_VISION_MODEL).toBe('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning')
    expect(NVIDIA_VISION_MODELS.some((m) => m.id === 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning')).toBe(true)
  })

  it('sends vision request with image_url and correct model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'A golden sunset over a mountain lake with vibrant orange reflections.',
            },
          },
        ],
      }),
    })
    globalThis.fetch = fetchMock

    const res = await analyzeImageWithNvidiaVision('data:image/jpeg;base64,12345678', {
      prompt: 'Describe the mood and colors',
    })

    expect(res.text).toContain('golden sunset')
    expect(res.modelUsed).toBe('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning')
    expect(fetchMock).toHaveBeenCalled()
    const outerBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    const callBody = outerBody.body ? JSON.parse(outerBody.body) : outerBody
    expect(callBody.model).toBe('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning')
    expect(callBody.messages[0].content[1].image_url.url).toBe('data:image/jpeg;base64,12345678')
  })

  it('extracts OCR text with Nemotron Omni reasoning', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '1. "SUMMER SALE 50% OFF" - Center Banner\n2. "SHOP NOW" - Bottom Right Button',
            },
          },
        ],
      }),
    })
    globalThis.fetch = fetchMock

    const text = await extractOcrWithNemotron('data:image/jpeg;base64,sample')
    expect(text).toContain('SUMMER SALE')
  })

  it('generates scene caption with Nemotron', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'A high-speed sports car drifting through neon-lit city streets at night.',
            },
          },
        ],
      }),
    })
    globalThis.fetch = fetchMock

    const caption = await generateSceneCaptionWithNemotron('data:image/jpeg;base64,sample')
    expect(caption).toContain('sports car')
  })
})
