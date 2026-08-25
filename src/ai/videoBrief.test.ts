import { describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_BRIEF, VIDEO_BRIEF_QUESTIONS, applyBriefAnswer, isVideoCreationPrompt } from './videoBrief'

describe('video creation brief', () => {
  it('recognizes topic-to-video requests without capturing ordinary edit requests', () => {
    expect(isVideoCreationPrompt('Create a 30 second video about solar energy')).toBe(true)
    expect(isVideoCreationPrompt('Make a YouTube short about the moon')).toBe(true)
    expect(isVideoCreationPrompt('Trim the first clip by two seconds')).toBe(false)
  })

  it('collects the six brief answers into a production-ready brief', () => {
    let brief = { ...DEFAULT_VIDEO_BRIEF }
    brief = applyBriefAnswer(brief, 0, 'Explain solar energy savings for homes')
    brief = applyBriefAnswer(brief, 1, 'beginners and students')
    brief = applyBriefAnswer(brief, 2, 'YouTube|60|16:9')
    brief = applyBriefAnswer(brief, 3, 'educational|moderate')
    brief = applyBriefAnswer(brief, 4, 'Hindi|voiceover|cinematic')
    brief = applyBriefAnswer(brief, 5, 'mixed|true')

    expect(VIDEO_BRIEF_QUESTIONS).toHaveLength(6)
    expect(brief).toMatchObject({ topic: 'Explain solar energy savings for homes', durationSeconds: 60, aspectRatio: '16:9', style: 'educational', pace: 'moderate', language: 'Hindi', narration: 'voiceover', music: 'cinematic', sourceStrategy: 'mixed', useResearch: true })
  })
})
