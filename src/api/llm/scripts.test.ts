import { describe, expect, it } from 'vitest'
import {
  WORDS_PER_SECOND,
  HOOK_SECONDS,
  CTA_SECONDS,
  MIN_SCENE_SECONDS,
  wordCount,
  estimateSceneDuration,
  normalizeScenes,
  normalizeScript,
  scriptDuration,
  CREATOR_STYLES,
  formatTeleprompter,
  calculateScriptMetrics,
} from './scripts'

describe('wordCount / estimateSceneDuration', () => {
  it('counts whitespace-separated words', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('one two three')).toBe(3)
  })

  it('estimates duration from the 2.5 wps rate, never below the floor', () => {
    expect(estimateSceneDuration('a b c d e')).toBeCloseTo(5 / WORDS_PER_SECOND)
    expect(estimateSceneDuration('hi')).toBe(MIN_SCENE_SECONDS)
  })
})

describe('normalizeScenes', () => {
  it('fills the available budget, weighting longer scenes', () => {
    const scenes = normalizeScenes(
      [
        { title: 'a', text: Array.from({ length: 40 }, () => 'w').join(' ') },
        { title: 'b', text: Array.from({ length: 10 }, () => 'w').join(' ') },
      ],
      12,
    )
    const total = scenes.reduce((s, c) => s + c.durationSeconds, 0)
    expect(total).toBeCloseTo(12, 5)
    expect(scenes[0].durationSeconds).toBeGreaterThan(scenes[1].durationSeconds)
  })

  it('never drops a scene below the floor', () => {
    const scenes = normalizeScenes([{ title: 'a', text: 'hi' }], 100)
    expect(scenes[0].durationSeconds).toBeGreaterThanOrEqual(MIN_SCENE_SECONDS)
  })

  it('drops empty scenes', () => {
    expect(normalizeScenes([{ title: '', text: '' }, { title: 'ok', text: 'hello world' }], 10).length).toBe(1)
  })
})

describe('normalizeScript / scriptDuration', () => {
  it('reserves hook + cta seconds and fills scenes to the remainder', () => {
    const script = normalizeScript(
      {
        title: 'T',
        hook: 'Did you know?',
        scenes: [
          { title: 's1', text: 'a b c d e f g h' },
          { title: 's2', text: 'a b c d e f g h' },
        ],
        cta: 'Subscribe!',
      },
      20,
      'topic',
    )
    expect(script.targetDurationSeconds).toBe(20)
    expect(scriptDuration(script)).toBeCloseTo(20, 5)
    expect(scriptDuration(script)).toBe(HOOK_SECONDS + script.scenes.reduce((a, s) => a + s.durationSeconds, 0) + CTA_SECONDS)
  })

  it('falls back to the topic as title when missing', () => {
    const script = normalizeScript({ scenes: [] }, 12, 'heart')
    expect(script.title).toBe('heart')
    expect(script.scenes).toEqual([])
  })

  it('normalizes scenes with visual cues and onScreenText', () => {
    const script = normalizeScript(
      {
        title: 'Tech Video',
        hook: 'Watch this now',
        hookVisual: 'Close-up macro lens of phone',
        scenes: [
          {
            title: 'Design',
            text: 'Look at the aluminum frame and titanium edges.',
            visual: 'Slow pan across edges',
            onScreenText: 'TITANIUM FRAME',
          },
        ],
        cta: 'Drop a comment below!',
        ctaVisual: 'Channel logo animation',
      },
      30,
      'Tech Video',
      'MKBHD',
    )
    expect(script.creatorStyle).toBe('MKBHD')
    expect(script.hookVisual).toBe('Close-up macro lens of phone')
    expect(script.scenes[0].visualCue).toBe('Slow pan across edges')
    expect(script.scenes[0].onScreenText).toBe('TITANIUM FRAME')
    expect(script.ctaVisual).toBe('Channel logo animation')
  })
})

describe('CREATOR_STYLES & Teleprompter', () => {
  it('defines popular YouTube creator style presets', () => {
    expect(CREATOR_STYLES.mrbeast).toBeDefined()
    expect(CREATOR_STYLES.veritasium).toBeDefined()
    expect(CREATOR_STYLES.ali_abdaal).toBeDefined()
    expect(CREATOR_STYLES.mkbhd).toBeDefined()
    expect(CREATOR_STYLES.vox).toBeDefined()
    expect(CREATOR_STYLES.alex_hormozi).toBeDefined()
    expect(CREATOR_STYLES.magnates).toBeDefined()
    expect(CREATOR_STYLES.shorts_viral).toBeDefined()
    expect(CREATOR_STYLES.dhruv_rathee).toBeDefined()
    expect(CREATOR_STYLES.tech_burner).toBeDefined()
    expect(CREATOR_STYLES.tanmay_bhat).toBeDefined()
    expect(CREATOR_STYLES.sandeep_maheshwari).toBeDefined()
    expect(CREATOR_STYLES.custom).toBeDefined()
    expect(CREATOR_STYLES.off).toBeDefined()
  })

  it('formats teleprompter text cleanly and calculates metrics', () => {
    const script = {
      topic: 'Space',
      title: 'Journey to Mars',
      hook: 'Can humans survive on Mars?',
      scenes: [
        { title: 'Atmosphere', text: 'The atmosphere is razor thin.', durationSeconds: 5 },
        { title: 'Radiation', text: 'Radiation shields are critical.', durationSeconds: 5 },
      ],
      cta: 'Subscribe for more space discoveries.',
      targetDurationSeconds: 18,
    }
    const readout = formatTeleprompter(script)
    expect(readout).toContain('Can humans survive on Mars?')
    expect(readout).toContain('The atmosphere is razor thin.')
    expect(readout).toContain('Subscribe for more space discoveries.')

    const metrics = calculateScriptMetrics(script)
    expect(metrics.totalWords).toBeGreaterThan(10)
    expect(metrics.wpm).toBe(150)
  })
})