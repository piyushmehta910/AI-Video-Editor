import { describe, it, expect } from 'vitest'
import { contextUnderstandingEngine } from './ContextUnderstandingEngine'

describe('ContextUnderstandingEngine', () => {
  it('classifies educational prompts accurately', () => {
    const res = contextUnderstandingEngine.analyzePrompt('Create a 60-second educational course explaining quantum physics to students')
    expect(res.videoType).toBe('educational')
    expect(res.targetAudience).toBe('students')
    expect(res.estimatedDurationSeconds).toBe(60)
    expect(res.visualStrategy.recommendedAspect).toBe('16:9')
  })

  it('classifies viral marketing shorts accurately', () => {
    const res = contextUnderstandingEngine.analyzePrompt('Make an energetic 15s TikTok reel promoting our new AI product')
    expect(res.videoType).toBe('marketing')
    expect(res.desiredTone).toBe('energetic')
    expect(res.estimatedDurationSeconds).toBe(15)
    expect(res.visualStrategy.recommendedAspect).toBe('9:16')
  })

  it('compresses context and prunes intermediate drafts properly', () => {
    const longConversation = [
      { role: 'user', content: 'Create a video about space exploration' },
      { role: 'assistant', content: 'intermediate draft 1 with extensive candidate assets...' },
      { role: 'assistant', content: 'search candidates for galaxy images...' },
      { role: 'assistant', content: 'Plan: Assemble scene 1 with Mars 3D asset.' },
      { role: 'user', content: 'Change color scheme to cyberpunk' },
      { role: 'assistant', content: 'Applied cyberpunk neon palette.' },
    ]

    const result = contextUnderstandingEngine.compressContext(longConversation, 20)
    expect(result.compressedSteps.length).toBeLessThanOrEqual(longConversation.length)
    expect(result.stats.summarizedMilestonesCount).toBeGreaterThan(0)
  })
})
