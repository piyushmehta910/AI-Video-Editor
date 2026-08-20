import type { Asset, Project } from '@/engine/types'

export type QualitySeverity = 'error' | 'warning' | 'info'

export type QualityType =
  | 'no_content'
  | 'missing_asset'
  | 'overlap'
  | 'empty_section'
  | 'static_clip'
  | 'story_hook'
  | 'story_ending'

export interface QualityFix {
  kind: 'remove_clip' | 'resolve_overlap' | 'none'
  clipIds: string[]
  moveClipId?: string
  targetTime?: number
  label: string
}

export interface QualityIssue {
  id: string
  type: QualityType
  severity: QualitySeverity
  message: string
  fix: QualityFix
}

export interface StoryScene {
  start: number
  end: number
  summary: string
  keywords: string[]
  importance: number
}

export interface CheckOptions {
  /** Timeline-relative scene structure gathered from local analysis. */
  scenes?: StoryScene[]
  /** Gap on the main video track that counts as an empty section (seconds). Default 3. */
  emptySectionGap?: number
  /** A video clip longer than this is flagged as a static shot (seconds). Default 20. */
  maxStaticClip?: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Review the whole timeline for editing problems. Pure and deterministic. */
export function checkTimeline(project: Project, assets: Asset[], options: CheckOptions = {}): QualityIssue[] {
  const issues: QualityIssue[] = []
  const emptySectionGap = options.emptySectionGap ?? 3
  const maxStaticClip = options.maxStaticClip ?? 20
  const assetIds = new Set(assets.map((a) => a.id))

  const allClips = project.tracks.flatMap((t) => t.clips)
  if (!allClips.length) {
    issues.push({
      id: 'no_content',
      type: 'no_content',
      severity: 'error',
      message: 'The timeline is empty — nothing to export or review yet.',
      fix: { kind: 'none', clipIds: [], label: 'Add media to the timeline first.' },
    })
    return issues
  }

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId || assetIds.has(clip.assetId)) continue
      issues.push({
        id: `missing_asset-${clip.id}`,
        type: 'missing_asset',
        severity: 'error',
        message: `Clip "${clip.name}" (${track.name}) references media that is no longer in your library.`,
        fix: { kind: 'remove_clip', clipIds: [clip.id], label: `Remove "${clip.name}"` },
      })
    }
  }

  for (const track of project.tracks) {
    if (track.locked) continue
    const clips = [...track.clips].sort((a, b) => a.startTime - b.startTime)
    for (let i = 0; i < clips.length - 1; i++) {
      const a = clips[i]
      const b = clips[i + 1]
      const aEnd = a.startTime + a.duration
      if (b.startTime >= aEnd - 0.05) continue
      issues.push({
        id: `overlap-${b.id}`,
        type: 'overlap',
        severity: 'warning',
        message: `"${b.name}" overlaps "${a.name}" on ${track.name} (starts ${round2(aEnd - b.startTime)}s before it ends).`,
        fix: {
          kind: 'resolve_overlap',
          clipIds: [a.id, b.id],
          moveClipId: b.id,
          targetTime: round2(aEnd),
          label: `Move "${b.name}" to start at ${round2(aEnd)}s`,
        },
      })
    }
  }

  for (const track of project.tracks) {
    if (track.type !== 'video') continue
    for (const clip of track.clips) {
      if (clip.duration <= maxStaticClip) continue
      issues.push({
        id: `static_clip-${clip.id}`,
        type: 'static_clip',
        severity: 'info',
        message: `"${clip.name}" is a single ${clip.duration.toFixed(0)}s shot on ${track.name} — consider splitting it or adding variety.`,
        fix: { kind: 'none', clipIds: [clip.id], label: 'Split or vary this clip.' },
      })
    }
  }

  const videoTracks = project.tracks.filter((t) => t.type === 'video')
  const mainTrack = [...videoTracks].sort((a, b) => b.clips.length - a.clips.length)[0]
  if (mainTrack && mainTrack.clips.length) {
    const clips = [...mainTrack.clips].sort((a, b) => a.startTime - b.startTime)
    if (clips[0].startTime > emptySectionGap) {
      issues.push({
        id: 'empty_lead',
        type: 'empty_section',
        severity: 'info',
        message: `There's a ${clips[0].startTime.toFixed(1)}s gap at the start of ${mainTrack.name} before any footage.`,
        fix: { kind: 'none', clipIds: [], label: 'Add an intro clip or tighten the start.' },
      })
    }
    for (let i = 0; i < clips.length - 1; i++) {
      const a = clips[i]
      const b = clips[i + 1]
      const gap = round2(b.startTime - (a.startTime + a.duration))
      if (gap <= emptySectionGap) continue
      issues.push({
        id: `empty_gap-${i}`,
        type: 'empty_section',
        severity: 'info',
        message: `A ${gap.toFixed(1)}s gap on ${mainTrack.name} between "${a.name}" and "${b.name}".`,
        fix: { kind: 'none', clipIds: [], label: 'Add b-roll or trim the gap.' },
      })
    }
  }

  if (options.scenes?.length) {
    issues.push(...checkStoryStructure(options.scenes))
  }

  return issues
}

/**
 * Tag the timeline's scene structure against a basic storytelling skeleton:
 * an opening hook and a closing beat. Purely heuristic — absence of local
 * analysis data yields no suggestions (we do not nag when there is nothing
 * to judge against).
 */
export function checkStoryStructure(scenes: StoryScene[]): QualityIssue[] {
  const issues: QualityIssue[] = []
  const sorted = [...scenes].sort((a, b) => a.start - b.start)
  if (!sorted.length) return issues
  const total = sorted[sorted.length - 1].end

  const hookZone = sorted.filter((s) => s.start < 3)
  const hasHook = hookZone.some((s) => s.importance > 0.2 || s.keywords.length > 0)
  if (total > 6 && !hasHook) {
    issues.push({
      id: 'story_hook',
      type: 'story_hook',
      severity: 'info',
      message: 'No hook detected in the first 3 seconds — the opening may not grab attention.',
      fix: { kind: 'none', clipIds: [], label: 'Add an opening hook (a strong first shot or a title card).' },
    })
  }

  const last = sorted[sorted.length - 1]
  const hasEnding = last.importance > 0.2 || last.keywords.length > 0
  if (total > 15 && !hasEnding) {
    issues.push({
      id: 'story_ending',
      type: 'story_ending',
      severity: 'info',
      message: 'The final scene appears to have no spoken content — consider a conclusion or call to action.',
      fix: { kind: 'none', clipIds: [], label: 'Add an outro or a spoken conclusion.' },
    })
  }

  return issues
}