import { describe, expect, it } from 'vitest'
import { defaultTrackName, migrateProjectTracks, newProject, trackShortLabel, type Project, type Track } from './types'

function makeTrack(partial: Partial<Track>): Track {
  return {
    id: crypto.randomUUID(),
    type: 'video',
    name: 'V1',
    index: 0,
    locked: false,
    muted: false,
    hidden: false,
    clips: [],
    ...partial,
  }
}

function makeProject(tracks: Track[]): Project {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'test',
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    tracks,
    createdAt: now,
    modifiedAt: now,
  }
}

describe('track system', () => {
  it('labels tracks V/A/T/FX per type', () => {
    expect(trackShortLabel('video', 1)).toBe('V1')
    expect(trackShortLabel('audio', 2)).toBe('A2')
    expect(trackShortLabel('text', 1)).toBe('T1')
    expect(trackShortLabel('fx', 3)).toBe('FX3')
    expect(defaultTrackName('fx', 0)).toBe('FX1')
  })

  it('new projects ship the 4-track system at schema v2', () => {
    const p = newProject()
    expect(p.schemaVersion).toBe(2)
    const types = new Set(p.tracks.map((t) => t.type))
    expect(types).toEqual(new Set(['video', 'audio', 'text', 'fx']))
  })

  it('migration appends an FX track and stamps schemaVersion on legacy data', () => {
    const legacy = makeProject([
      makeTrack({ type: 'video', name: 'Video 1', index: 0 }),
      makeTrack({ type: 'audio', name: 'Audio 1', index: 5 }),
      makeTrack({ type: 'text', name: 'Text 1', index: 8 }),
    ])
    const migrated = migrateProjectTracks(legacy)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.tracks.map((t) => t.type)).toContain('fx')
    // Original three tracks survive untouched apart from index normalization
    expect(migrated.tracks.filter((t) => t.type !== 'fx')).toHaveLength(3)
    expect(migrated.tracks.every((t) => typeof t.soloed === 'boolean')).toBe(true)
  })

  it('migration buckets unknown legacy types by name heuristics', () => {
    const weird = makeProject([makeTrack({ type: 'sticker' as never, name: 'Effect lane' })])
    const migrated = migrateProjectTracks(weird)
    expect(migrated.tracks[0].type).toBe('fx')
  })

  it('migration is idempotent', () => {
    const p = newProject()
    expect(migrateProjectTracks(p)).toBe(p)
  })
})
