import { describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_BRIEF, VIDEO_BRIEF_QUESTIONS, applyBriefAnswer, extractCleanTopic, isVideoCreationPrompt } from './videoBrief'

describe('video creation brief', () => {
  it('recognizes topic-to-video requests without capturing ordinary edit requests', () => {
    expect(isVideoCreationPrompt('Create a 30 second video about solar energy')).toBe(true)
    expect(isVideoCreationPrompt('Make a YouTube short about the moon')).toBe(true)
    expect(isVideoCreationPrompt('I want a video on cryptocurrency basics')).toBe(true)
    expect(isVideoCreationPrompt('Video about space exploration')).toBe(true)
    expect(isVideoCreationPrompt('Trim the first clip by two seconds')).toBe(false)
    expect(isVideoCreationPrompt('Split clip at 5 seconds')).toBe(false)
    expect(isVideoCreationPrompt('Mute audio on track 2')).toBe(false)
    expect(isVideoCreationPrompt('Make the video louder')).toBe(false)
    expect(isVideoCreationPrompt('Turn this clip into a circle')).toBe(false)
    expect(isVideoCreationPrompt('Can you adjust the video opacity to 50%?')).toBe(false)
    expect(isVideoCreationPrompt('Make this clip faster')).toBe(false)
  })

  it('extracts clean semantic topics from conversational commands', () => {
    expect(extractCleanTopic('Create a 30 second video about solar energy savings')).toBe('solar energy savings')
    expect(extractCleanTopic('Make a reel explaining how planes fly')).toBe('how planes fly')
    expect(extractCleanTopic('I want a video about quantum computing for beginners')).toBe('quantum computing for beginners')
    expect(extractCleanTopic('Video about cooking Italian pasta')).toBe('cooking Italian pasta')
    expect(extractCleanTopic('Black holes and relativity')).toBe('Black holes and relativity')
  })

  it('collects the six brief answers into a production-ready brief using preset options', () => {
    let brief = { ...DEFAULT_VIDEO_BRIEF }
    brief = applyBriefAnswer(brief, 0, 'Explain solar energy savings for homes')
    brief = applyBriefAnswer(brief, 1, 'beginners and students')
    brief = applyBriefAnswer(brief, 2, 'YouTube|60|16:9')
    brief = applyBriefAnswer(brief, 3, 'educational|moderate')
    brief = applyBriefAnswer(brief, 4, 'Hindi|voiceover|cinematic')
    brief = applyBriefAnswer(brief, 5, 'mixed|true')

    expect(VIDEO_BRIEF_QUESTIONS).toHaveLength(6)
    expect(brief).toMatchObject({
      topic: 'Explain solar energy savings for homes',
      durationSeconds: 60,
      aspectRatio: '16:9',
      style: 'educational',
      pace: 'moderate',
      language: 'Hindi',
      narration: 'voiceover',
      music: 'cinematic',
      sourceStrategy: 'mixed',
      useResearch: true,
    })
  })

  it('parses natural language write-in custom answers without pipe delimiters', () => {
    let brief = { ...DEFAULT_VIDEO_BRIEF }
    brief = applyBriefAnswer(brief, 0, 'Create a 45 second video about Machine Learning')
    brief = applyBriefAnswer(brief, 1, 'Data science researchers')
    brief = applyBriefAnswer(brief, 2, 'Vertical TikTok reel 45 seconds 9:16')
    brief = applyBriefAnswer(brief, 3, 'Fast-paced and energetic creative direction')
    brief = applyBriefAnswer(brief, 4, 'French language with voiceover narration and ambient background music')
    brief = applyBriefAnswer(brief, 5, 'High quality stock footage with web research')

    expect(brief.topic).toBe('Machine Learning')
    expect(brief.audience).toBe('Data science researchers')
    expect(brief.durationSeconds).toBe(45)
    expect(brief.aspectRatio).toBe('9:16')
    expect(brief.style).toBe('energetic')
    expect(brief.pace).toBe('fast')
    expect(brief.language).toBe('French')
    expect(brief.narration).toBe('voiceover')
    expect(brief.music).toBe('ambient')
    expect(brief.sourceStrategy).toBe('stock')
    expect(brief.useResearch).toBe(true)
  })
})

