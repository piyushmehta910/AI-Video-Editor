import { describe, expect, it } from 'vitest'
import { compressTranscript } from './context'

describe('compressTranscript', () => {
  it('returns short transcripts unchanged', () => {
    expect(compressTranscript('Hello world')).toBe('Hello world')
  })

  it('truncates long transcripts at a word boundary', () => {
    const text = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ')
    const out = compressTranscript(text, 50)
    expect(out.length).toBeLessThanOrEqual(51)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain(' word29') // cut before a full word
  })

  it('trims surrounding whitespace', () => {
    expect(compressTranscript('  padded  ')).toBe('padded')
  })
})