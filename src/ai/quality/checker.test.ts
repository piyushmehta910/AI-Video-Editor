import { describe, expect, it } from 'vitest'
import { checkStoryStructure, checkTimeline, type CheckOptions, type StoryScene } from './checker'
import type { Asset, Clip, Project, Track } from '@/engine/types'

function makeClip(partial: Partial<Clip> & { id: string }): Clip {
  return {
    assetId: '',
    trackId: 't1',
    startTime: 0,
    duration: 5,
    sourceStart: 0,
    sourceEnd: 5,
    speed: 1,
    name: partial.id,
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    effects: [],
    transitions: {},
    ...partial,
  }
}

function makeProject(tracks: Track[]): Project {
  return {
    id: 'p',
    name: 'Test',
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    tracks,
    createdAt: 0,
    modifiedAt: 0,
  }
}

function videoTrack(id: string, clips: Clip[]): Track {
  return { id, type: 'video', name: 'V1', index: 0, locked: false, muted: false, hidden: false, clips }
}

const empty: CheckOptions = {}

describe('checkTimeline', () => {
  it('flags an empty timeline', () => {
    const project = makeProject([videoTrack('t1', [])])
    const issues = checkTimeline(project, [], empty)
    expect(issues.map((i) => i.type)).toEqual(['no_content'])
    expect(issues[0].severity).toBe('error')
  })

  it('flags clips referencing missing media', () => {
    const clip = makeClip({ id: 'c1', assetId: 'ghost' })
    const project = makeProject([videoTrack('t1', [clip])])
    const issues = checkTimeline(project, [], empty)
    const missing = issues.find((i) => i.type === 'missing_asset')
    expect(missing).toBeDefined()
    expect(missing!.fix.kind).toBe('remove_clip')
    expect(missing!.fix.clipIds).toEqual(['c1'])
  })

  it('ignores text overlays (empty assetId) as missing media', () => {
    const clip = makeClip({ id: 'c1', assetId: '' })
    const project = makeProject([videoTrack('t1', [clip])])
    const issues = checkTimeline(project, [], empty)
    expect(issues.some((i) => i.type === 'missing_asset')).toBe(false)
  })

  it('detects overlapping clips and proposes moving the later one', () => {
    const a = makeClip({ id: 'a', assetId: 'x', startTime: 0, duration: 5 })
    const b = makeClip({ id: 'b', assetId: 'x', startTime: 3, duration: 5 })
    const project = makeProject([videoTrack('t1', [a, b])])
    const issues = checkTimeline(project, [{ id: 'x' } as Asset], empty)
    const overlap = issues.find((i) => i.type === 'overlap')
    expect(overlap).toBeDefined()
    expect(overlap!.fix.kind).toBe('resolve_overlap')
    expect(overlap!.fix.moveClipId).toBe('b')
    expect(overlap!.fix.targetTime).toBe(5)
  })

  it('does not flag adjacent (non-overlapping) clips', () => {
    const a = makeClip({ id: 'a', assetId: 'x', startTime: 0, duration: 5 })
    const b = makeClip({ id: 'b', assetId: 'x', startTime: 5, duration: 5 })
    const project = makeProject([videoTrack('t1', [a, b])])
    const issues = checkTimeline(project, [{ id: 'x' } as Asset], empty)
    expect(issues.some((i) => i.type === 'overlap')).toBe(false)
  })

  it('flags a long static video shot', () => {
    const clip = makeClip({ id: 'a', assetId: 'x', startTime: 0, duration: 30 })
    const project = makeProject([videoTrack('t1', [clip])])
    const issues = checkTimeline(project, [{ id: 'x' } as Asset], empty)
    const stat = issues.find((i) => i.type === 'static_clip')
    expect(stat).toBeDefined()
    expect(stat!.severity).toBe('info')
  })

  it('flags empty gaps on the main video track', () => {
    const a = makeClip({ id: 'a', assetId: 'x', startTime: 0, duration: 5 })
    const b = makeClip({ id: 'b', assetId: 'x', startTime: 12, duration: 5 })
    const project = makeProject([videoTrack('t1', [a, b])])
    const issues = checkTimeline(project, [{ id: 'x' } as Asset], empty)
    const gap = issues.find((i) => i.type === 'empty_section')
    expect(gap).toBeDefined()
    expect(gap!.message).toContain('7.0s')
  })

  it('respects the emptySectionGap option', () => {
    const a = makeClip({ id: 'a', assetId: 'x', startTime: 0, duration: 5 })
    const b = makeClip({ id: 'b', assetId: 'x', startTime: 12, duration: 5 })
    const project = makeProject([videoTrack('t1', [a, b])])
    const issues = checkTimeline(project, [{ id: 'x' } as Asset], { emptySectionGap: 10 })
    expect(issues.some((i) => i.type === 'empty_section')).toBe(false)
  })
})

describe('checkStoryStructure', () => {
  it('suggests a hook when the first 3s have no spoken energy', () => {
    const scenes: StoryScene[] = [
      { start: 0, end: 4, summary: 'Silent intro b-roll', keywords: [], importance: 0 },
      { start: 4, end: 12, summary: 'The main topic is explained', keywords: ['topic'], importance: 0.8 },
    ]
    const issues = checkStoryStructure(scenes)
    expect(issues.map((i) => i.type)).toContain('story_hook')
  })

  it('does not suggest a hook when the opening is engaging', () => {
    const scenes: StoryScene[] = [
      { start: 0, end: 2, summary: 'Cold open question', keywords: ['question'], importance: 0.5 },
      { start: 2, end: 12, summary: 'Explanation', keywords: ['topic'], importance: 0.7 },
    ]
    const issues = checkStoryStructure(scenes)
    expect(issues.some((i) => i.type === 'story_hook')).toBe(false)
  })

  it('suggests an ending for long videos whose last scene has no spoken content', () => {
    const scenes: StoryScene[] = [
      { start: 0, end: 2, summary: 'Hook', keywords: ['hook'], importance: 0.6 },
      { start: 2, end: 30, summary: 'Long silent outro', keywords: [], importance: 0 },
    ]
    const issues = checkStoryStructure(scenes)
    expect(issues.map((i) => i.type)).toContain('story_ending')
  })

  it('stays quiet on short videos without scenes data', () => {
    expect(checkStoryStructure([])).toEqual([])
  })
})