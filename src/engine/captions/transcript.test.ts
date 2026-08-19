import { describe, expect, it } from 'vitest'
import { groupWordsIntoSentences } from './transcript'

describe('groupWordsIntoSentences', () => {
  it('groups words into sentences by punctuation', () => {
    const words = [
      { word: 'Hello', start: 0, end: 0.3 },
      { word: 'world.', start: 0.3, end: 0.6 },
      { word: 'This', start: 0.6, end: 0.8 },
      { word: 'is', start: 0.8, end: 1.0 },
      { word: 'next.', start: 1.0, end: 1.4 },
    ]
    const sentences = groupWordsIntoSentences(words)
    expect(sentences).toHaveLength(2)
    expect(sentences[0].text).toBe('Hello world.')
    expect(sentences[0].start).toBe(0)
    expect(sentences[0].end).toBe(0.6)
    expect(sentences[1].text).toBe('This is next.')
  })

  it('splits long run-on speech by max chars', () => {
    const words = Array.from({ length: 60 }, (_, i) => ({ word: 'word', start: i, end: i + 1 }))
    const sentences = groupWordsIntoSentences(words, 50)
    expect(sentences.length).toBeGreaterThan(1)
  })

  it('skips empty words', () => {
    const sentences = groupWordsIntoSentences([
      { word: '', start: 0, end: 0.1 },
      { word: 'Hi.', start: 0.1, end: 0.4 },
    ])
    expect(sentences).toHaveLength(1)
    expect(sentences[0].text).toBe('Hi.')
  })
})