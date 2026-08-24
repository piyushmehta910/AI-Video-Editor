import { describe, it, expect } from 'vitest'
import {
  mapWordToViseme,
  mapWordToGesture,
  createWordTimelineFromTranscript,
  getWordTimelineStateAt,
} from './WordTimeline'
import type { StoredTranscript } from '@/engine/analysis/types'

describe('WordTimeline Master Clock Engine', () => {
  it('maps words accurately to mouth viseme shapes', () => {
    expect(mapWordToViseme('fun')).toBe('F_V')
    expect(mapWordToViseme('think')).toBe('TH')
    expect(mapWordToViseme('sun')).toBe('S_Z')
    expect(mapWordToViseme('let')).toBe('L')
    expect(mapWordToViseme('blue')).toBe('U')
    expect(mapWordToViseme('go')).toBe('O')
    expect(mapWordToViseme('eat')).toBe('E')
    expect(mapWordToViseme('cat')).toBe('A')
    expect(mapWordToViseme('')).toBe('REST')
  })

  it('maps semantic cues to avatar gesture types', () => {
    expect(mapWordToGesture('first')).toBe('count_fingers')
    expect(mapWordToGesture('crucial')).toBe('emphasize')
    expect(mapWordToGesture('why')).toBe('think')
    expect(mapWordToGesture('breakthrough')).toBe('celebrate')
    expect(mapWordToGesture('yes')).toBe('nod')
    expect(mapWordToGesture('never')).toBe('shake_head')
    expect(mapWordToGesture('standard')).toBe('neutral')
  })

  it('builds master clock word timeline and queries timestamp states', () => {
    const mockTranscript: StoredTranscript = {
      assetId: 'test-asset-1',
      text: 'Hello world. This is a crucial breakthrough.',
      language: 'en',
      words: [
        { word: 'Hello', start: 0.0, end: 0.5 },
        { word: 'world.', start: 0.6, end: 1.0 },
        { word: 'This', start: 1.2, end: 1.5 },
        { word: 'is', start: 1.6, end: 1.8 },
        { word: 'a', start: 1.9, end: 2.0 },
        { word: 'crucial', start: 2.1, end: 2.7 },
        { word: 'breakthrough.', start: 2.8, end: 3.5 },
      ],
      sentences: [
        { text: 'Hello world.', start: 0.0, end: 1.0 },
        { text: 'This is a crucial breakthrough.', start: 1.2, end: 3.5 },
      ],
      segments: [],
      updatedAt: Date.now(),
    }

    const clock = createWordTimelineFromTranscript(mockTranscript)
    expect(clock.words).toHaveLength(7)
    expect(clock.sentences).toHaveLength(2)
    expect(clock.totalDuration).toBe(3.5)

    // Check emphasis detection
    const crucialEntry = clock.words.find((w) => w.word === 'crucial')
    expect(crucialEntry?.isEmphasis).toBe(true)
    expect(crucialEntry?.gesture).toBe('emphasize')

    // Query active state at 0.3s
    const state1 = getWordTimelineStateAt(clock, 0.3)
    expect(state1.activeWord?.word).toBe('Hello')
    expect(state1.activeSentence?.text).toBe('Hello world.')
    expect(state1.currentViseme).not.toBe('REST')

    // Query active state during silence at 1.1s
    const stateSilence = getWordTimelineStateAt(clock, 1.1)
    expect(stateSilence.activeWord).toBeNull()
    expect(stateSilence.currentViseme).toBe('REST')
  })
})
