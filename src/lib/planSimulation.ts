import type { Project, Track } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import type { EditPlan } from '@/api/llm/plan'

/**
 * Plan simulation for the ActionPreview diff: applies the plan's geometric
 * effects to a clone of the before-snapshot so the AFTER map is honest about
 * adds/removes/moves without touching the real timeline.
 */

export interface SimClipBlock {
  trackIndex: number
  start: number
  duration: number
  label: string
  removed?: boolean
  added?: boolean
  moved?: boolean
}

function findTrackIndex(project: Project, clipName: string): number {
  const lower = clipName.trim().toLowerCase()
  return project.tracks.findIndex((t) => t.clips.some((c) => c.name.toLowerCase().includes(lower)))
}

function findTrackIndexOfAsset(project: Project, assetIdOrName: string): number {
  const lower = assetIdOrName.trim().toLowerCase()
  return project.tracks.findIndex(
    (t) =>
      t.clips.some((c) => c.assetId === assetIdOrName) ||
      t.clips.some((c) => c.assetId.toLowerCase().includes(lower)),
  )
}

export function simulateProject(
  before: Project,
  plan: EditPlan,
): { after: Project; blocks: SimClipBlock[]; duration: number } {
  const after = structuredClone(before)
  const blocks: SimClipBlock[] = []

  for (const action of plan.actions) {
    const args = action.arguments
    const name = action.tool
    const str = (key: string) => String(args[key] ?? '')
    const num = (key: string) => Number(args[key] ?? NaN)

    if (name === 'delete_clip') {
      const ref = str('clip') || str('clip_name')
      const target = findTrackIndex(after, ref)
      if (target >= 0) {
        const lower = ref.toLowerCase()
        const clip = after.tracks[target].clips.find((c) => c.name.toLowerCase().includes(lower))
        if (clip) {
          blocks.push({ trackIndex: target, start: clip.startTime, duration: clip.duration, label: clip.name, removed: true })
        }
        after.tracks[target].clips = after.tracks[target].clips.filter((c) => !c.name.toLowerCase().includes(lower))
      }
    } else if (name === 'move_clip') {
      const clipRef = str('clip') || str('clip_name')
      const idx = findTrackIndex(after, clipRef)
      const deltaRaw = args.delta ?? args.offset
      const delta = Number(deltaRaw)
      if (idx >= 0 && Number.isFinite(delta)) {
        const clip = after.tracks[idx].clips.find((c) => c.name.toLowerCase().includes(clipRef.toLowerCase()))
        if (clip) {
          clip.startTime += delta
          blocks.push({ trackIndex: idx, start: clip.startTime, duration: clip.duration, label: clip.name, moved: true })
        }
      }
    } else if (name === 'trim_clip' || name === 'split_clip') {
      const clipRef = str('clip') || str('clip_name')
      const idx = findTrackIndex(after, clipRef)
      if (idx >= 0) {
        const clip = after.tracks[idx].clips.find((c) => c.name.toLowerCase().includes(clipRef.toLowerCase()))
        if (clip && name === 'split_clip' && Number.isFinite(num('at'))) {
          const at = num('at')
          const leftDur = at - clip.startTime
          if (leftDur > 0.05 && clip.duration - leftDur > 0.05) {
            blocks.push({ trackIndex: idx, start: clip.startTime, duration: leftDur, label: `${clip.name} (1)` })
            blocks.push({ trackIndex: idx, start: at, duration: clip.duration - leftDur, label: `${clip.name} (2)` })
            continue
          }
        }
        if (clip) blocks.push({ trackIndex: idx, start: clip.startTime, duration: clip.duration, label: clip.name })
      }
    } else if (name === 'add_media_to_timeline' || name === 'duplicate_clip' || name === 'add_text_overlay') {
      const assetRef = str('asset') || str('asset_name') || str('source')
      const assetIdx = assetRef ? findTrackIndexOfAsset(after, assetRef) : -1
      const trackIdx =
        name === 'add_text_overlay'
          ? after.tracks.findIndex((t) => t.type === 'text')
          : assetIdx >= 0
            ? assetIdx
            : after.tracks.findIndex((t) => t.type === 'video')
      const start = Number.isFinite(num('start')) ? num('start') : Number.isFinite(num('at')) ? num('at') : 0
      const duration = Number.isFinite(num('duration')) ? num('duration') : 3
      if (trackIdx >= 0) {
        const label = name === 'add_text_overlay' ? str('text') || 'Text' : assetRef || 'New clip'
        blocks.push({
          trackIndex: trackIdx,
          start: Math.max(0, start),
          duration: Math.max(0.5, duration),
          label,
          added: true,
        })
      }
    }
    // Other tools (transitions, properties, generation) don't change layout.
  }

  return { after, blocks, duration: projectDuration(after.tracks) }
}

export const TRACK_COLORS: Record<Track['type'], string> = {
  video: '#6366f1',
  audio: '#10b981',
  text: '#f59e0b',
  fx: '#a855f7',
}
