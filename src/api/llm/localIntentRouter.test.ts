import { describe, it, expect, beforeEach } from 'vitest'
import { parseLocalIntent } from './localIntentRouter'
import { useTimelineStore } from '@/stores/timelineStore'

describe('localIntentRouter', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      project: {
        id: 'p1',
        name: 'Test Project',
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        tracks: [
          {
            id: 't-video',
            type: 'video',
            name: 'Main Video',
            index: 0,
            locked: false,
            muted: false,
            hidden: false,
            clips: [
              {
                id: 'c1',
                assetId: 'a1',
                trackId: 't-video',
                name: 'Intro Clip',
                startTime: 0,
                duration: 10,
                sourceStart: 0,
                sourceEnd: 10,
                speed: 1,
                volume: 1,
                fadeIn: 0,
                fadeOut: 0,
                position: { x: 0, y: 0 },
                scale: { x: 1, y: 1 },
                rotation: 0,
                opacity: 1,
                effects: [],
                transitions: {},
              },
            ],
          },
        ],
      },
      playhead: 4.5,
      selection: { clipIds: [], trackId: null },
    })
  })

  it('matches split command at specific time', () => {
    const res = parseLocalIntent('Split clip at 3.5s')
    expect(res.matched).toBe(true)
    expect(res.toolName).toBe('split_clip')
    expect(res.toolArgs?.timeSeconds).toBe(3.5)
    expect(res.toolArgs?.assetName).toBe('Intro Clip')
  })

  it('matches split here at playhead', () => {
    const res = parseLocalIntent('cut here')
    expect(res.matched).toBe(true)
    expect(res.toolName).toBe('split_clip')
    expect(res.toolArgs?.timeSeconds).toBe(4.5)
  })

  it('matches aspect ratio reframe', () => {
    const res = parseLocalIntent('Reframe to 9:16 vertical for reels')
    expect(res.matched).toBe(true)
    expect(res.toolName).toBe('set_project_ratio')
    expect(res.toolArgs?.aspect).toBe('9:16')
  })

  it('matches mute command', () => {
    const res = parseLocalIntent('Mute the audio')
    expect(res.matched).toBe(true)
    expect(res.toolName).toBe('adjust_clip_property')
    expect(res.toolArgs?.property).toBe('volume')
    expect(res.toolArgs?.value).toBe(0)
  })

  it('matches speed change', () => {
    const res = parseLocalIntent('Speed up to 2x')
    expect(res.matched).toBe(true)
    expect(res.toolName).toBe('adjust_clip_property')
    expect(res.toolArgs?.property).toBe('speed')
    expect(res.toolArgs?.value).toBe(2)
  })

  it('matches silence removal', () => {
    const res = parseLocalIntent('Remove all silent parts and dead air')
    expect(res.matched).toBe(true)
    expect(res.toolName).toBe('auto_remove_silence')
  })

  it('returns matched=false for open-ended conversation', () => {
    const res = parseLocalIntent('What is the best way to tell a story about space?')
    expect(res.matched).toBe(false)
  })
})
