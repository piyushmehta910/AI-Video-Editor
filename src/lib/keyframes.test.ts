import { describe, expect, it } from 'vitest'
import { keyframeAt, removeKeyframe, upsertKeyframe } from './keyframes'
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
