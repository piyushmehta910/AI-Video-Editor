import { describe, expect, it } from 'vitest'
import { activeWordIndex, assetTimeAt, buildCaptionCues, captionAnchor, cueAt, overlapFraction, topmostVideoClip, type FrameBox } from './captions'
import type { StoredTranscript } from '@/engine/analysis/types'
import type { Asset, CaptionPosition, Clip, Project } from '@/engine/types'

const transcript: StoredTranscript = {
  assetId: 'a1',
  text: 'Hello world. This is next.',
  language: 'en',
  updatedAt: 1,
  segments: [
    { start: 0, end: 0.6, text: 'Hello world.' },
    { start: 0.6, end: 1.4, text: 'This is next.' },
  ],
  sentences: [
    { start: 0, end: 0.6, text: 'Hello world.' },
    { start: 0.6, end: 1.4, text: 'This is next.' },
  ],
  words: [
    { word: 'Hello', start: 0, end: 0.3 },
    { word: 'world.', start: 0.3, end: 0.6 },
    { word: 'This', start: 0.6, end: 0.8 },
    { word: 'is', start: 0.8, end: 1.0 },
    { word: 'next.', start: 1.0, end: 1.4 },
  ],
}

describe('buildCaptionCues', () => {
  it('builds one cue per sentence and attaches its words', () => {
    const cues = buildCaptionCues(transcript)
    expect(cues).toHaveLength(2)
    expect(cues[0].text).toBe('Hello world.')
    expect(cues[0].start).toBe(0)
    expect(cues[0].end).toBe(0.6)
    expect(cues[0].words?.map((w) => w.word)).toEqual(['Hello', 'world.'])
    expect(cues[1].words?.map((w) => w.word)).toEqual(['This', 'is', 'next.'])
  })

  it('skips empty sentences', () => {
    const cues = buildCaptionCues({ ...transcript, sentences: [{ start: 0, end: 1, text: '   ' }], words: [] })
    expect(cues).toHaveLength(0)
  })
})

describe('cueAt', () => {
  const cues = buildCaptionCues(transcript)
  it('finds the cue containing the time', () => {
    expect(cueAt(cues, 0.2)?.text).toBe('Hello world.')
    expect(cueAt(cues, 0.7)?.text).toBe('This is next.')
  })
  it('returns null in a gap', () => {
    expect(cueAt(cues, 5)).toBeNull()
  })
})

describe('activeWordIndex', () => {
  const cue = buildCaptionCues(transcript)[1]
  it('returns -1 before the first word', () => {
    expect(activeWordIndex(cue, 0.55)).toBe(-1)
  })
  it('returns the word index currently spoken', () => {
    expect(activeWordIndex(cue, 0.7)).toBe(0)
    expect(activeWordIndex(cue, 0.9)).toBe(1)
    expect(activeWordIndex(cue, 1.2)).toBe(2)
  })
})

describe('assetTimeAt / topmostVideoClip', () => {
  const clip: Clip = {
    id: 'c1',
    assetId: 'a1',
    trackId: 't1',
    startTime: 10,
    duration: 4,
    sourceStart: 2,
    sourceEnd: 6,
    speed: 2,
    name: 'c',
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    effects: [],
    transitions: {},
  }
  const asset: Asset = { id: 'a1', name: 'a', type: 'video', filePath: 'x', mime: 'video/mp4', size: 1, duration: 10, importedAt: 1 }
  const project: Project = {
    id: 'p1',
    name: 'p',
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    tracks: [
      { id: 't1', type: 'video', name: 'V1', index: 0, locked: false, muted: false, hidden: false, clips: [clip] },
      { id: 't2', type: 'audio', name: 'A1', index: 4, locked: false, muted: false, hidden: false, clips: [] },
    ],
    createdAt: 1,
    modifiedAt: 1,
  }

  it('maps timeline time through speed and source trim', () => {
    expect(assetTimeAt(clip, 11)).toBe(4)
    expect(assetTimeAt(clip, 12)).toBe(6)
  })
  it('finds the active video clip and ignores audio-only clips', () => {
    expect(topmostVideoClip(project, [asset], 11)?.clip.id).toBe('c1')
    expect(topmostVideoClip(project, [asset], 20)).toBeNull()
  })
})

describe('overlapFraction', () => {
  it('computes area overlap', () => {
    const a: FrameBox = { x: 0, y: 0, w: 0.5, h: 0.5 }
    const b: FrameBox = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }
    const overlap = overlapFraction(a, b)
    expect(overlap).toBeCloseTo(0.25)
  })
  it('returns 0 for disjoint boxes', () => {
    expect(overlapFraction({ x: 0, y: 0, w: 0.1, h: 0.1 }, { x: 0.5, y: 0.5, w: 0.1, h: 0.1 })).toBe(0)
  })
})

describe('captionAnchor', () => {
  const frame = { width: 1920, height: 1080 }
  const box = { width: 900, height: 80 }
  const bottom: CaptionPosition = { mode: 'bottom', marginX: 0.08, marginY: 0.08, maxWidthPct: 0.84 }
  const top: CaptionPosition = { mode: 'top', marginX: 0.08, marginY: 0.08, maxWidthPct: 0.84 }
  const auto: CaptionPosition = { mode: 'auto', marginX: 0.08, marginY: 0.08, maxWidthPct: 0.84 }

  it('anchors bottom at the bottom margin', () => {
    const { y } = captionAnchor({ frame, box, position: bottom, protectedRegions: [], avoidProtectedRegions: true })
    expect(y).toBeCloseTo(1080 - 0.08 * 1080 - 40)
  })

  it('anchors top at the top margin', () => {
    const { y } = captionAnchor({ frame, box, position: top, protectedRegions: [], avoidProtectedRegions: true })
    expect(y).toBeCloseTo(0.08 * 1080 + 40)
  })

  it('moves to the top edge when a protected region occupies the bottom', () => {
    const lowerThird: FrameBox = { x: 0.1, y: 0.78, w: 0.8, h: 0.16 }
    const { y } = captionAnchor({ frame, box, position: bottom, protectedRegions: [lowerThird], avoidProtectedRegions: true })
    expect(y).toBeCloseTo(0.08 * 1080 + 40)
  })

  it('stays at the bottom when a protected region is at the top', () => {
    const topRegion: FrameBox = { x: 0.1, y: 0.02, w: 0.8, h: 0.12 }
    const { y } = captionAnchor({ frame, box, position: bottom, protectedRegions: [topRegion], avoidProtectedRegions: true })
    expect(y).toBeCloseTo(1080 - 0.08 * 1080 - 40)
  })

  it('auto picks the side with less occlusion', () => {
    const lowerThird: FrameBox = { x: 0.1, y: 0.78, w: 0.8, h: 0.16 }
    const { y } = captionAnchor({ frame, box, position: auto, protectedRegions: [lowerThird], avoidProtectedRegions: true })
    expect(y).toBeCloseTo(0.08 * 1080 + 40)
  })

  it('ignores protected regions when avoidance is off', () => {
    const lowerThird: FrameBox = { x: 0.1, y: 0.78, w: 0.8, h: 0.16 }
    const { y } = captionAnchor({ frame, box, position: bottom, protectedRegions: [lowerThird], avoidProtectedRegions: false })
    expect(y).toBeCloseTo(1080 - 0.08 * 1080 - 40)
  })
})