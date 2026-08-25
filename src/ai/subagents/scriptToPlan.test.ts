import { describe, it, expect, beforeEach } from 'vitest'
import { planScenesFromScript, renderSceneCardSvg, runSceneSequence } from './scriptToPlan'
import { setScript } from '@/stores/scriptStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { DEFAULT_VIDEO_BRIEF } from '@/ai/videoBrief'

const briefBase = { ...DEFAULT_VIDEO_BRIEF, topic: 'Coffee brewing', durationSeconds: 30 }

beforeEach(() => {
  setScript(null)
  useTimelineStore.setState({
    project: {
      id: 'p',
      name: 't',
      width: 1920,
      height: 1080,
      fps: 30,
      aspectRatio: '16:9',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      tracks: [
        { id: 'v1', name: 'Video', type: 'video', clips: [], locked: false, muted: false, hidden: false, index: 0 },
        { id: 'a1', name: 'Audio', type: 'audio', clips: [], locked: false, muted: false, hidden: false, index: 1 },
        { id: 't1', name: 'Text', type: 'text', clips: [], locked: false, muted: false, hidden: false, index: 2 },
      ],
    },
    assets: [],
  })
})

describe('planScenesFromScript', () => {
  it('returns empty when there is no script', () => {
    expect(planScenesFromScript(briefBase)).toEqual([])
  })

  it('maps hook, scenes and CTA onto ordered scene plans', () => {
    setScript({
      topic: 'Coffee brewing',
      title: 'Better Coffee',
      hook: 'Stop making bitter coffee.',
      hookVisual: 'pour over coffee',
      scenes: [
        { title: 'Grind size', text: 'Grind decides extraction.', durationSeconds: 6, visualCue: 'coffee grinder', onScreenText: 'Grind matters' },
        { title: 'Water temp', text: 'Use 92 degrees water.', durationSeconds: 5 },
      ],
      cta: 'Follow for more brewing tips.',
      targetDurationSeconds: 30,
    })

    const plans = planScenesFromScript({ ...briefBase, sourceStrategy: 'mixed' })
    expect(plans).toHaveLength(4) // hook + 2 scenes + CTA
    expect(plans[0].title).toBe('Hook')
    expect(plans[0].narration).toContain('bitter')
    expect(plans[0].onScreenText).toBe('Better Coffee')
    expect(plans[3].title).toBe('Call to action')
    // mixed strategy: cue present → stock, cue absent → card
    expect(plans[0].visualKind).toBe('stock')
    expect(plans[2].visualKind).toBe('card')
    // scripted durations are respected
    expect(plans[1].plannedSeconds).toBe(6)
  })

  it('distributes fallback durations evenly for scenes without scripted timing', () => {
    setScript({
      topic: 'Coffee',
      title: 'T',
      hook: 'Hook line',
      scenes: [
        { title: 'A', text: 'Alpha.', durationSeconds: 0 },
        { title: 'B', text: 'Beta.', durationSeconds: 0 },
      ],
      cta: '',
      targetDurationSeconds: 30,
    })
    const plans = planScenesFromScript(briefBase)
    expect(plans).toHaveLength(3) // hook + A + B (empty CTA dropped)
    expect(plans.every((p) => p.plannedSeconds > 0)).toBe(true)
  })

  it('maps strategies to visual kinds deterministically', () => {
    setScript({
      topic: 'X',
      title: 'X',
      hook: 'h',
      scenes: [{ title: 's', text: 'body', durationSeconds: 4 }],
      cta: 'c',
      targetDurationSeconds: 10,
    })
    expect(planScenesFromScript({ ...briefBase, sourceStrategy: 'stock' }).every((p) => p.visualKind === 'stock')).toBe(true)
    expect(planScenesFromScript({ ...briefBase, sourceStrategy: 'user_media' }).every((p) => p.visualKind === 'user_media')).toBe(true)
    expect(planScenesFromScript({ ...briefBase, sourceStrategy: 'slides' }).every((p) => p.visualKind === 'card')).toBe(true)
  })
})

describe('renderSceneCardSvg', () => {
  it('produces an SVG containing the escaped title and style palette', () => {
    const svg = renderSceneCardSvg(
      { title: 'Grind & <Size>', visualQuery: 'q', onScreenText: 'Grind matters' },
      { aspect: '16:9', style: 'tech' },
    )
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Grind &amp; &lt;Size&gt;')
    expect(svg).toContain('#06b6d4') // tech palette second stop
    expect(svg).toContain('Grind matters')
  })
})

describe('runSceneSequence failure paths', () => {
  it('fails cleanly when no script exists', async () => {
    const results = await runSceneSequence({
      brief: briefBase,
      runId: 'run-1',
      signal: new AbortController().signal,
      onStage: () => {},
    })
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(false)
    expect(results[0].message).toMatch(/No script found/i)
  })

  it('fails cleanly when the project has no video track', async () => {
    setScript({
      topic: 'X',
      title: 'X',
      hook: 'h',
      scenes: [{ title: 's', text: 'body', durationSeconds: 4 }],
      cta: 'c',
      targetDurationSeconds: 10,
    })
    useTimelineStore.setState({
      project: {
        id: 'p',
        name: 't',
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        tracks: [{ id: 'a1', name: 'Audio', type: 'audio', clips: [], locked: false, muted: false, hidden: false, index: 0 }],
      },
    })
    const results = await runSceneSequence({
      brief: briefBase,
      runId: 'run-1',
      signal: new AbortController().signal,
      onStage: () => {},
    })
    expect(results[0].ok).toBe(false)
    expect(results[0].message).toMatch(/No video track/i)
  })
})
