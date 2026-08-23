import { describe, expect, it } from 'vitest'
import { interpolatePropertyKeyframe, keyframeAt, removeKeyframe, upsertKeyframe } from './keyframes'
import type { ClipKeyframe } from '@/engine/types'

const kf = (prop: string, time: number, value = 0): ClipKeyframe => ({
  id: `${prop}-${time}`,
  prop,
  time,
  value,
})

describe('keyframeAt', () => {
  it('finds a keyframe within half a frame of the playhead', () => {
    const list = [kf('opacity', 2)]
    expect(keyframeAt(list, 'opacity', 2 + 1 / 60)).toBeDefined()
    expect(keyframeAt(list, 'opacity', 2 + 0.5)).toBeUndefined()
  })

  it('matches per-property', () => {
    const list = [kf('opacity', 1), kf('scale', 1)]
    expect(keyframeAt(list, 'scale', 1)?.prop).toBe('scale')
    expect(keyframeAt(list, 'rotation', 1)).toBeUndefined()
  })

  it('tolerates undefined lists', () => {
    expect(keyframeAt(undefined, 'x', 0)).toBeUndefined()
  })
})

describe('upsertKeyframe', () => {
  it('inserts sorted by time', () => {
    let list = upsertKeyframe([], 'opacity', 3, 0.5)
    list = upsertKeyframe(list, 'opacity', 1, 0.1)
    list = upsertKeyframe(list, 'opacity', 2, 0.25)
    expect(list.map((k) => k.time)).toEqual([1, 2, 3])
  })

  it('replaces an exact-time keyframe instead of duplicating', () => {
    let list = upsertKeyframe([], 'rotation', 2, 45)
    list = upsertKeyframe(list, 'rotation', 2, 90)
    expect(list).toHaveLength(1)
    expect(list[0].value).toBe(90)
  })

  it('rounds stored times to milliseconds', () => {
    const list = upsertKeyframe([], 'opacity', 1.23456789, 1)
    expect(list[0].time).toBeCloseTo(1.235, 6)
  })
})

describe('removeKeyframe', () => {
  it('removes only the matching id', () => {
    const list = [kf('a', 1), kf('b', 2)]
    const next = removeKeyframe(list, 'b-2')
    expect(next.map((k) => k.prop)).toEqual(['a'])
  })
})

describe('interpolatePropertyKeyframe', () => {
  it('returns default value when keyframes are empty or undefined', () => {
    expect(interpolatePropertyKeyframe(undefined, 'opacity', 1, 1)).toBe(1)
    expect(interpolatePropertyKeyframe([], 'opacity', 1, 0.8)).toBe(0.8)
    expect(interpolatePropertyKeyframe([kf('scale', 0, 2)], 'opacity', 1, 0.5)).toBe(0.5)
  })

  it('returns exact value for single keyframe regardless of time', () => {
    const list = [kf('opacity', 2, 0.4)]
    expect(interpolatePropertyKeyframe(list, 'opacity', 0, 1)).toBe(0.4)
    expect(interpolatePropertyKeyframe(list, 'opacity', 2, 1)).toBe(0.4)
    expect(interpolatePropertyKeyframe(list, 'opacity', 5, 1)).toBe(0.4)
  })

  it('interpolates linearly between bracketing keyframes', () => {
    const list = [kf('opacity', 0, 0), kf('opacity', 2, 1)]
    expect(interpolatePropertyKeyframe(list, 'opacity', 0, 0.5)).toBe(0)
    expect(interpolatePropertyKeyframe(list, 'opacity', 1, 0.5)).toBe(0.5)
    expect(interpolatePropertyKeyframe(list, 'opacity', 2, 0.5)).toBe(1)
  })

  it('clamps to boundary keyframe values outside keyframe span', () => {
    const list = [kf('opacity', 1, 0.2), kf('opacity', 3, 0.8)]
    expect(interpolatePropertyKeyframe(list, 'opacity', 0, 0.5)).toBe(0.2)
    expect(interpolatePropertyKeyframe(list, 'opacity', 4, 0.5)).toBe(0.8)
  })
})
