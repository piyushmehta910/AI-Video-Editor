import { beforeEach, describe, expect, it } from 'vitest'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip } from '@/engine/types'
import { applyPlan, normalizePlan, qualityNotes, type EditPlan } from './plan'

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

beforeEach(() => {
  useTimelineStore.getState().resetProject()
})

describe('normalizePlan', () => {
  it('accepts a valid plan with resolvable actions', () => {
    const plan = normalizePlan({
      goal: 'Reframe to Reel',
      scenesAffected: ['clip-intro 0s-4s'],
      actions: [
        { tool: 'set_project_ratio', arguments: { aspect: '9:16' }, reason: 'Vertical short' },
        { tool: 'set_playhead', arguments: { timeSeconds: 2 }, reason: 'Move to intro' },
      ],
    })
    expect(plan).not.toBeNull()
    expect(plan!.goal).toBe('Reframe to Reel')
    expect(plan!.scenesAffected).toEqual(['clip-intro 0s-4s'])
    expect(plan!.actions).toHaveLength(2)
  })

  it('resolves aliases through describeTool validation', () => {
    const plan = normalizePlan({
      goal: 'Add a title',
      scenesAffected: [],
      actions: [{ tool: 'add_text', arguments: { text: 'Hello' }, reason: 'Title' }],
    })
    expect(plan).not.toBeNull()
    expect(plan!.actions[0].tool).toBe('add_text')
  })

  it('returns null when the goal is missing', () => {
    expect(normalizePlan({ scenesAffected: [], actions: [] })).toBeNull()
  })

  it('filters unknown tools and invalid arguments', () => {
    const plan = normalizePlan({
      goal: 'Try things',
      scenesAffected: [],
      actions: [
        { tool: 'does_not_exist', arguments: {}, reason: 'nope' },
        { tool: 'set_project_ratio', arguments: { aspect: 'banana' }, reason: 'bad' },
        { tool: 'delete_clip', arguments: { assetName: 'missing-clip' }, reason: 'gone' },
      ],
    })
    expect(plan).toBeNull()
  })
})

describe('applyPlan', () => {
  it('applies every action as a single undo step', async () => {
    const before = useTimelineStore.temporal.getState().pastStates.length
    const plan: EditPlan = {
      goal: 'Change ratio twice',
      scenesAffected: [],
      actions: [
        { tool: 'set_project_ratio', arguments: { aspect: '9:16' }, reason: 'Reel' },
        { tool: 'set_project_ratio', arguments: { aspect: '1:1' }, reason: 'Square' },
      ],
    }
    const result = await applyPlan(plan)
    expect(result.applied).toHaveLength(2)
    expect(result.skipped).toHaveLength(0)
    expect(useTimelineStore.getState().project.aspectRatio).toBe('1:1')
    expect(useTimelineStore.temporal.getState().pastStates.length - before).toBe(1)
    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().project.aspectRatio).toBe('16:9')
  })

  it('applies every action as a single undo step even when actions snapshot internally', async () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('intro', trackId, 0))
    s.addClipToTrack(makeClip('main', trackId, 4))
    const before = useTimelineStore.temporal.getState().pastStates.length
    const plan: EditPlan = {
      goal: 'Cut the intro',
      scenesAffected: [],
      actions: [
        { tool: 'split_clip', arguments: { assetName: 'clip-intro', timeSeconds: 1 }, reason: 'Split the intro' },
        { tool: 'delete_clip', arguments: { assetName: 'clip-intro' }, reason: 'Drop the intro' },
      ],
    }
    const result = await applyPlan(plan)
    expect(result.applied).toHaveLength(2)
    expect(result.skipped).toHaveLength(0)
    const after = useTimelineStore.getState()
    const all = after.project.tracks.flatMap((t) => t.clips)
    // intro clip deleted, its split piece + main remain
    expect(all.some((c) => c.id === 'intro')).toBe(false)
    expect(all.length).toBe(2)
    // exactly one snapshot for the whole plan
    expect(useTimelineStore.temporal.getState().pastStates.length - before).toBe(1)
    after.undo()
    const reverted = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    expect(reverted.some((c) => c.id === 'intro')).toBe(true)
    expect(reverted).toHaveLength(2)
  })

  it('reports stale actions as skipped instead of applying them', async () => {
    const s = useTimelineStore.getState()
    const trackId = s.project.tracks[0].id
    s.addClipToTrack(makeClip('intro', trackId, 0))
    const plan: EditPlan = {
      goal: 'Delete the intro',
      scenesAffected: [],
      actions: [{ tool: 'delete_clip', arguments: { assetName: 'clip-intro' }, reason: 'Not wanted' }],
    }
    s.deleteClips(['intro'])
    const result = await applyPlan(plan)
    expect(result.applied).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toBe('Not wanted')
  })
})

describe('qualityNotes', () => {
  it('turns issues into plain-language notes', () => {
    const notes = qualityNotes([
      { id: '1', type: 'missing_asset', severity: 'error', message: 'A clip references missing media', fix: { kind: 'none', clipIds: [], label: 'x' } },
      { id: '2', type: 'story_hook', severity: 'info', message: 'Add an opening hook', fix: { kind: 'none', clipIds: [], label: 'y' } },
    ])
    expect(notes).toEqual(['[error] A clip references missing media', '[info] Add an opening hook'])
  })
})