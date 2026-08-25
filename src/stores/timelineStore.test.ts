import { beforeEach, describe, expect, it } from 'vitest'
import { useTimelineStore } from './timelineStore'
import { useHistoryStore } from './historyStore'
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

/** Number of document snapshots available for undo. */
function pastDepth(): number {
  return useTimelineStore.temporal.getState().pastStates.length
}

function futureDepth(): number {
  return useTimelineStore.temporal.getState().futureStates.length
}

beforeEach(() => {
  useTimelineStore.getState().resetProject()
})

describe('undo/redo core', () => {
  it('leaves a single edit as a single undo step', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    expect(clipCount()).toBe(1)
    expect(pastDepth()).toBe(1)
    s.undo()
    expect(clipCount()).toBe(0)
  })

  it('batches multiple edits inside withTransaction into one step', async () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    await s.withTransaction(() => {
      s.addClipToTrack(makeClip('a', trackId, 0))
      s.addClipToTrack(makeClip('b', trackId, 2))
      s.addClipToTrack(makeClip('c', trackId, 4))
    })
    expect(clipCount()).toBe(3)
    expect(pastDepth()).toBe(1)
    s.undo()
    expect(clipCount()).toBe(0)
  })

  it('supports async bodies in withTransaction', async () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    await s.withTransaction(async () => {
      await Promise.resolve()
      s.addClipToTrack(makeClip('a', trackId, 0))
    })
    expect(pastDepth()).toBe(1)
    s.undo()
    expect(clipCount()).toBe(0)
  })

  it('clears the redo stack after a new action', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    s.undo()
    expect(futureDepth()).toBe(1)
    s.redo()
    expect(clipCount()).toBe(1)
    // New action after redo → redo tail must be gone.
    s.updateClip('a', { volume: 0.5 })
    expect(futureDepth()).toBe(0)
    expect(useHistoryStore.getState().canRedo).toBe(false)
  })
})

describe('previously-untracked operations are now undoable', () => {
  it('undoes clip property changes (volume)', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    s.updateClip('a', { volume: 0.25 })
    const clipBefore = useTimelineStore.getState().project.tracks[0].clips[0]
    expect(clipBefore.volume).toBe(0.25)
    s.undo()
    const clipAfter = useTimelineStore.getState().project.tracks[0].clips[0]
    expect(clipAfter.volume).toBe(1)
  })

  it('undoes moves and trims', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 2))
    s.moveClip('a', 3)
    expect(useTimelineStore.getState().project.tracks[0].clips[0].startTime).toBe(5)
    s.undo()
    expect(useTimelineStore.getState().project.tracks[0].clips[0].startTime).toBe(2)

    s.trimClip('a', 'end', 1)
    expect(useTimelineStore.getState().project.tracks[0].clips[0].duration).toBe(3)
    s.undo()
    expect(useTimelineStore.getState().project.tracks[0].clips[0].duration).toBe(2)
  })

  it('undoes speed and effect changes', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    s.updateClip('a', { speed: 2 })
    s.undo()
    expect(useTimelineStore.getState().project.tracks[0].clips[0].speed).toBe(1)
  })

  it('undoes track state toggles', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.toggleTrackLock(trackId)
    expect(useTimelineStore.getState().project.tracks[0].locked).toBe(true)
    s.undo()
    expect(useTimelineStore.getState().project.tracks[0].locked).toBe(false)
  })
})

describe('edge cases', () => {
  it('undoing a delete restores clips to their original position', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 3))
    s.deleteClips(['a'])
    expect(clipCount()).toBe(0)
    s.undo()
    const restored = useTimelineStore.getState().project.tracks[0].clips[0]
    expect(restored.id).toBe('a')
    expect(restored.startTime).toBe(3)
  })

  it('undoing a split merges the clips back', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    s.splitClip('a', 1)
    expect(clipCount()).toBe(2)
    s.undo()
    expect(clipCount()).toBe(1)
    const merged = useTimelineStore.getState().project.tracks[0].clips[0]
    expect(merged.id).toBe('a')
    expect(merged.duration).toBe(2)
  })

  it('history survives stable clip IDs across many edits', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    for (let i = 1; i <= 10; i++) s.updateClip('a', { opacity: i / 10 })
    // Undo all 10 edits back to the add.
    for (let i = 0; i < 10; i++) s.undo()
    const clip = useTimelineStore.getState().project.tracks[0].clips.find((c) => c.id === 'a')
    expect(clip?.opacity).toBe(1)
    s.undo() // undoes the add itself
    expect(clipCount()).toBe(0)
  })

  it('caps history at 50 steps', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    for (let i = 0; i < 55; i++) {
      s.addClipToTrack(makeClip(`c${i}`, trackId, i * 2))
    }
    expect(pastDepth()).toBe(50)
    expect(useHistoryStore.getState().entries.length).toBeLessThanOrEqual(50)
  })
})

describe('drag grouping', () => {
  it('collapses a pointer drag into one move action', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    const depthAfterAdd = pastDepth()

    s.beginHistoryGroup({ type: 'move', description: "Moved 'clip-a'", clipId: 'a' })
    for (let frame = 0; frame < 60; frame++) {
      s.moveClip('a', 0.01) // simulates pointermove stream at ~60fps
    }
    s.endHistoryGroup()

    expect(pastDepth() - depthAfterAdd).toBe(1)
    expect(useTimelineStore.getState().project.tracks[0].clips[0].startTime).toBeCloseTo(0.6)
    s.undo()
    expect(useTimelineStore.getState().project.tracks[0].clips[0].startTime).toBe(0)
  })

  it('records nothing when a drag ends without movement', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    const depthAfterAdd = pastDepth()

    s.beginHistoryGroup({ type: 'move', description: "Moved 'clip-a'" })
    s.endHistoryGroup()

    expect(pastDepth() - depthAfterAdd).toBe(0)
  })
})

describe('human-readable log', () => {
  it('records typed entries with descriptions', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))

    const h = useHistoryStore.getState()
    expect(h.entries).toHaveLength(1)
    expect(h.index).toBe(1)
    expect(h.canUndo).toBe(true)
    expect(h.canRedo).toBe(false)
    expect(h.entries[0].type).toBe('add')
    expect(h.entries[0].description).toContain("'clip-a'")
    expect(h.entries[0].timestamp).toBeGreaterThan(0)
    expect(h.entries[0].id).toBeTruthy()
  })

  it('shows a toast describing what was undone', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0))
    s.undo()

    const toast = useHistoryStore.getState().toast
    expect(toast?.message).toContain('Undid:')
    expect(toast?.message).toContain('clip-a')

    useTimelineStore.getState().redo()
    expect(useHistoryStore.getState().toast?.message).toContain('Redid:')
  })

  it('restores UI context from checkpoints on undo', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('a', trackId, 0)) // timeline now 2s long
    s.select(['a'], trackId)
    s.setPlayhead(1)
    s.addClipToTrack(makeClip('b', trackId, 5))
    s.select(['b'], trackId)
    s.undo()
    expect(useTimelineStore.getState().selection.clipIds).toEqual(['a'])
    expect(useTimelineStore.getState().playhead).toBe(1)
  })

  it('strictly clamps playhead to project duration and prevents going to infinity', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    // Empty timeline
    s.setPlayhead(50)
    expect(useTimelineStore.getState().playhead).toBe(0)

    // Add clip with duration 4s
    const clip = makeClip('c1', trackId, 0)
    clip.duration = 4
    clip.sourceEnd = 4
    s.addClipToTrack(clip)
    expect(s.duration()).toBe(4)

    // Attempt to set beyond video duration
    s.setPlayhead(9999)
    expect(useTimelineStore.getState().playhead).toBe(4)

    // Attempt to set negative time
    s.setPlayhead(-10)
    expect(useTimelineStore.getState().playhead).toBe(0)

    // Valid intermediate position
    s.setPlayhead(2.5)
    expect(useTimelineStore.getState().playhead).toBe(2.5)
  })

  it('prevents overlapping clips on the same track when moving or adding', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id

    // Add clip A at [0, 4]
    const clipA = makeClip('clip-a', trackId, 0)
    clipA.duration = 4
    s.addClipToTrack(clipA)

    // Add clip B at [2, 6] (which overlaps [0, 4])
    const clipB = makeClip('clip-b', trackId, 2)
    clipB.duration = 4
    s.addClipToTrack(clipB)

    // clipB must have been routed to a non-colliding track (Video 2)
    const allTracks = useTimelineStore.getState().project.tracks
    const trackA = allTracks.find((t) => t.clips.some((c) => c.id === 'clip-a'))!
    const trackB = allTracks.find((t) => t.clips.some((c) => c.id === 'clip-b'))!
    expect(trackA.id).not.toBe(trackB.id)

    // Moving a clip towards another clip on the same track clamps to prevent overlap
    const clipC = makeClip('clip-c', trackA.id, 6)
    clipC.duration = 2
    s.addClipToTrack(clipC)

    // Move clipC left by 4 seconds (from 6 to 2, where clipA is [0, 4])
    s.moveClip('clip-c', -4)
    const updatedC = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips).find((c) => c.id === 'clip-c')!
    // clipC must be clamped at 4 (the end of clipA) or placed on non-colliding track without overlap
    expect(updatedC.startTime).toBeGreaterThanOrEqual(4)
  })

  it('supports multi-clip batch selection, property adjustments, shifting, and batch deletion', () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id

    const c1 = makeClip('c1', trackId, 0)
    c1.duration = 3
    const c2 = makeClip('c2', trackId, 4)
    c2.duration = 3
    const c3 = makeClip('c3', trackId, 8)
    c3.duration = 2

    s.addClipToTrack(c1)
    s.addClipToTrack(c2)
    s.addClipToTrack(c3)

    // Select all 3 clips
    s.select(['c1', 'c2', 'c3'])
    expect(useTimelineStore.getState().selection.clipIds).toEqual(['c1', 'c2', 'c3'])

    // Batch update opacity and volume
    s.updateClips(['c1', 'c2', 'c3'], { opacity: 0.8, volume: 0.5 })
    const allClips = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    expect(allClips.find((c) => c.id === 'c1')?.opacity).toBe(0.8)
    expect(allClips.find((c) => c.id === 'c2')?.volume).toBe(0.5)

    // Batch shift all clips by +2.0s
    s.shiftClips(['c1', 'c2', 'c3'], 2.0)
    const shifted = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    expect(shifted.find((c) => c.id === 'c1')?.startTime).toBe(2.0)
    expect(shifted.find((c) => c.id === 'c2')?.startTime).toBe(6.0)
    expect(shifted.find((c) => c.id === 'c3')?.startTime).toBe(10.0)

    // Batch align clips to playhead (e.g. 5.0s)
    s.alignClipsToTime(['c1', 'c2'], 5.0)
    const aligned = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    expect(aligned.find((c) => c.id === 'c1')?.startTime).toBe(5.0)
    expect(aligned.find((c) => c.id === 'c2')?.startTime).toBe(5.0)

    // Batch delete 2 clips
    s.deleteClips(['c1', 'c2'])
    expect(clipCount()).toBe(1)
    expect(useTimelineStore.getState().selection.clipIds).toEqual([])

    // Undo batch delete
    s.undo()
    expect(clipCount()).toBe(3)
  })
})


