import { describe, it, expect, beforeEach } from 'vitest'
import { getDirectorProvider, getProjectContextSystemPrompt } from './director'
import { useApiConfigStore } from '@/api/config/store'
import { defaultApiConfig } from '@/api/config/types'

describe('AI Director provider selection', () => {
  beforeEach(() => {
    useApiConfigStore.setState({
      config: JSON.parse(JSON.stringify(defaultApiConfig)),
    })
  })

  it('returns null when no candidate has an API key', () => {
    const provider = getDirectorProvider()
    expect(provider).toBeNull()
  })

  it('selects OpenRouter when configured and preferred', () => {
    useApiConfigStore.setState((s) => ({
      config: {
        ...s.config,
        openRouter: {
          ...s.config.openRouter,
          enabled: true,
          apiKey: 'sk-or-test-key',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'nvidia/nemotron-3.5-lightning:free',
        },
        preferences: {
          ...s.config.preferences,
          preferredAiProvider: 'openRouter',
        },
      },
    }))

    const provider = getDirectorProvider()
    expect(provider).not.toBeNull()
    expect(provider?.name).toBe('OpenRouter')
    expect(provider?.config.apiKey).toBe('sk-or-test-key')
  })

  it('selects OpenCode Zen when preferred even if OpenRouter has key', () => {
    useApiConfigStore.setState((s) => ({
      config: {
        ...s.config,
        openRouter: {
          ...s.config.openRouter,
          enabled: true,
          apiKey: 'sk-or-test-key',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'nvidia/nemotron-3.5-lightning:free',
        },
        opencodeZen: {
          ...s.config.opencodeZen,
          enabled: true,
          apiKey: 'zen-key-123',
          baseUrl: 'https://opencode.ai/zen/v1',
          model: 'deepseek-v4-flash-free',
        },
        preferences: {
          ...s.config.preferences,
          preferredAiProvider: 'opencodeZen',
        },
      },
    }))

    const provider = getDirectorProvider()
    expect(provider).not.toBeNull()
    expect(provider?.name).toBe('OpenCode Zen')
    expect(provider?.config.apiKey).toBe('zen-key-123')
  })

  it('falls back to first available valid provider in priority order', () => {
    useApiConfigStore.setState((s) => ({
      config: {
        ...s.config,
        opencodeZen: {
          ...s.config.opencodeZen,
          enabled: true,
          apiKey: 'zen-fallback',
          baseUrl: 'https://opencode.ai/zen/v1',
          model: 'deepseek-v4-flash-free',
        },
        preferences: {
          ...s.config.preferences,
          preferredAiProvider: 'nvidiaNim', // no key
        },
      },
    }))

    const provider = getDirectorProvider()
    expect(provider?.name).toBe('OpenCode Zen')
  })

  it('generates system prompt containing project dimensions and instructions', () => {
    const prompt = getProjectContextSystemPrompt(['What is the title?'])
    expect(prompt).toContain('You are the AI Director inside ClipForge')
    expect(prompt).toContain('Already asked: What is the title?')
    expect(prompt).toContain('MIDDLE TOOLBAR & TIMELINE FEATURE MAPPING')
    expect(prompt).toContain('PROFESSIONAL KNOWLEDGE & ACTION MANUAL')
  })
})
