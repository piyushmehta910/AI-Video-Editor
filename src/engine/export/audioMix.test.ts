import { describe, it, expect } from 'vitest'
import { collectTriggerRanges, buildDuckSegments, DUCK_LEVEL, DUCK_RAMP } from './audioMix'
import type { Project, Track, Clip } from '@/engine/types'

function makeClip(id: string, startTime: number, duration: number, trackId: string): Clip {
  return {
    id,
    assetId: 'a1',
    trackId,
    startTime,
    duration,
    sourceStart: 0,
    sourceEnd: duration,
    speed: 1,
    name: `Clip ${id}`,
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
}

function makeProject(tracks: Track[]): Project {
  return {
    id: 'p1',
    name: 'Test Project',
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    tracks,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  }
}

describe('audioMix ducking logic', () => {
  it('collects trigger ranges excluding the ducker clip itself', () => {
    const track: Track = {
      id: 'voice-track',
      name: 'Voice',
      type: 'audio',
      clips: [
        makeClip('c1', 2, 4, 'voice-track'),
        makeClip('c2', 8, 3, 'voice-track'),
      ],
    }
    const project = makeProject([track])

    const ranges = collectTriggerRanges(project, 'voice-track', 'c3')
    expect(ranges).toEqual([
      { start: 2, end: 6 },
      { start: 8, end: 11 },
    ])

    const excluded = collectTriggerRanges(project, 'voice-track', 'c1')
    expect(excluded).toEqual([{ start: 8, end: 11 }])
  })

  it('returns empty array when trigger track is not found', () => {
    const project = makeProject([])
    expect(collectTriggerRanges(project, 'missing-track', 'c1')).toEqual([])
  })

  it('builds and merges overlapping duck segments within [from, to]', () => {
    const triggers = [
      { start: 1, end: 4 },
      { start: 3, end: 6 }, // overlaps with first
      { start: 8, end: 10 },
    ]

    const segments = buildDuckSegments(0, 12, triggers)
    expect(segments).toEqual([
      { start: 1, end: 6 },
      { start: 8, end: 10 },
    ])
  })

  it('clips triggers strictly to [from, to] bounds', () => {
    const triggers = [
      { start: 0, end: 5 },
      { start: 10, end: 20 },
    ]

    const segments = buildDuckSegments(2, 15, triggers)
    expect(segments).toEqual([
      { start: 2, end: 5 },
      { start: 10, end: 15 },
    ])
  })

  it('returns empty array if all triggers fall outside [from, to]', () => {
    const triggers = [{ start: 20, end: 30 }]
    const segments = buildDuckSegments(0, 10, triggers)
    expect(segments).toEqual([])
  })

  it('exports expected constants', () => {
    expect(DUCK_LEVEL).toBe(0.2)
    expect(DUCK_RAMP).toBe(0.15)
  })
})
