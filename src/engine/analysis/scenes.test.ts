import { describe, expect, it } from 'vitest'
import {
  diffSignatures,
  extractKeywords,
  frameSignature,
  groupFramesIntoScenes,
  summarizeScenes,
} from './scenes'

function solidPixels(width: number, height: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  return data
}

describe('frameSignature', () => {
  it('fingerprints a solid frame and returns identical signatures for identical pixels', () => {
    const a = frameSignature(solidPixels(32, 32, 10, 200, 50), 32, 32)
    const b = frameSignature(solidPixels(32, 32, 10, 200, 50), 32, 32)
    expect(a.r[0]).toBe(10)
    expect(a.g[0]).toBe(200)
    expect(a.b[0]).toBe(50)
    expect(diffSignatures(a, b)).toBe(0)
  })
})

describe('diffSignatures', () => {
  it('is 0 for identical frames and > 0 for different frames', () => {
    const a = frameSignature(solidPixels(16, 16, 0, 0, 0), 16, 16)
    const b = frameSignature(solidPixels(16, 16, 255, 255, 255), 16, 16)
    expect(diffSignatures(a, a)).toBe(0)
    expect(diffSignatures(a, b)).toBeGreaterThan(0.5)
    expect(diffSignatures(a, b)).toBeLessThanOrEqual(1)
  })
})

describe('groupFramesIntoScenes', () => {
  it('splits on diffs above the threshold', () => {
    const diffs = [0.02, 0.6, 0.02, 0.02]
    const scenes = groupFramesIntoScenes(diffs, 1, 0.15, 6)
    expect(scenes).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 6 },
    ])
  })

  it('returns a single scene when nothing changes', () => {
    const scenes = groupFramesIntoScenes([0.01, 0.01, 0.01], 1, 0.15, 4)
    expect(scenes).toEqual([{ start: 0, end: 4 }])
  })

  it('merges tiny scenes into the previous one', () => {
    const diffs = [0.8, 0.8]
    const scenes = groupFramesIntoScenes(diffs, 0.25, 0.15, 1)
    // boundaries at 0.25 and 0.5; the 0.25-0.5 slice (0.25s) is under minSceneDuration
    expect(scenes).toEqual([
      { start: 0, end: 0.5 },
      { start: 0.5, end: 1 },
    ])
  })
})

describe('extractKeywords', () => {
  it('filters stopwords and counts frequency', () => {
    const kws = extractKeywords(['the heart pumps blood', 'the heart beats fast'], 3)
    expect(kws).toContain('heart')
    expect(kws).not.toContain('the')
    expect(kws.length).toBeLessThanOrEqual(3)
  })
})

describe('summarizeScenes', () => {
  it('assigns summaries, keywords, and normalized importance', () => {
    const scenes = [{ start: 0, end: 10 }, { start: 10, end: 20 }]
    const segments = [
      { start: 0, end: 5, text: 'The heart pumps blood around the body' },
      { start: 5, end: 10, text: 'The lungs deliver oxygen' },
      { start: 15, end: 20, text: 'No overlap in the first scene' },
    ]
    const result = summarizeScenes(scenes, segments)
    expect(result).toHaveLength(2)
    expect(result[0].summary).toContain('heart pumps blood')
    expect(result[0].keywords).toContain('heart')
    expect(result[0].importance).toBe(1)
    expect(result[1].importance).toBeGreaterThan(0)
    expect(result[1].importance).toBeLessThan(1)
  })

  it('handles a scene with no overlapping speech', () => {
    const result = summarizeScenes([{ start: 0, end: 5 }], [{ start: 10, end: 12, text: 'later words here' }])
    expect(result[0].summary).toBe('')
    expect(result[0].keywords).toEqual([])
    expect(result[0].importance).toBe(0)
  })
})