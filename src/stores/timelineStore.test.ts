import { beforeEach, describe, expect, it } from 'vitest'
import { useTimelineStore } from './timelineStore'
import type { Clip } from '@/engine/types'

function makeClip(id: string, trackId: string, startTime: number): Clip {
  return {
    id,
    assetId: id,
    trackId,
    startTime,
    duration: 2,
    sourceStart: 0,
    sourceEnd: 2,
    speed: 1,
    name: `clip-${id}`,
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

function clipCount(): number {
  return useTimelineStore.getState().project.tracks.reduce((n, t) => n + t.clips.length, 0)
}

beforeEach(() => {
  useTimelineStore.getState().resetProject()
})

describe('withTransaction', () => {
  it('batches multiple edits into a single undo step', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.withTransaction(() => {
      s.addClipToTrack(makeClip('a', trackId, 0))
      s.addClipToTrack(makeClip('b', trackId, 2))
      s.addClipToTrack(makeClip('c', trackId, 4))
    })
    expect(clipCount()).toBe(3)
    s.undo()
    expect(clipCount()).toBe(0)
  })

  it('leaves a single edit as a single undo step', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    expect(clipCount()).toBe(1)
    s.undo()
    expect(clipCount()).toBe(0)
  })

  it('suppresses the inner begin() that mutating actions already call', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    const pastAfterFirst = useTimelineStore.getState().past.length
    useTimelineStore.getState().withTransaction(() => {
      s.addClipToTrack(makeClip('b', trackId, 2))
      s.deleteClips(['b'])
    })
    // The batch contributes exactly one snapshot, not one per inner action.
    expect(useTimelineStore.getState().past.length - pastAfterFirst).toBe(1)
  })
})