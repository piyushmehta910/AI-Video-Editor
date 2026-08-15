import { useTimelineStore } from '@/stores/timelineStore'
import { aspectToSize } from '@/engine/types'
import type { Asset, Clip } from '@/engine/types'

const ASPECTS = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const
type Aspect = (typeof ASPECTS)[number]

const PROPERTIES = ['opacity', 'volume', 'speed', 'rotation'] as const

export const DIRECTOR_TOOLS: Array<Record<string, unknown>> = [
  {
    type: 'function',
    function: {
      name: 'set_project_ratio',
      description: 'Change the project aspect ratio / resolution (e.g. reframe to vertical Reel). Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          aspect: { type: 'string', enum: [...ASPECTS], description: 'Target aspect ratio.' },
        },
        required: ['aspect'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_media_to_timeline',
      description: 'Add an imported media asset to the timeline at the playhead. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The asset name (from Available media) to add.' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'split_selected_clip',
      description: 'Split the selected clip at the current playhead. Staged for user review.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_selected_clips',
      description: 'Delete the currently selected clips from the timeline. Staged for user review.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_playhead',
      description: 'Move the playhead (current preview time) to a specific second. Applied immediately.',
      parameters: {
        type: 'object',
        properties: { timeSeconds: { type: 'number', description: 'Timeline position in seconds.' } },
        required: ['timeSeconds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_clip_property',
      description: 'Set a numeric property of a clip by its name. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to edit.' },
          property: {
            type: 'string',
            enum: [...PROPERTIES],
            description: 'Which property to change.',
          },
          value: { type: 'number', description: 'The new value (opacity/volume 0-1, speed 0.25-4, rotation degrees).' },
        },
        required: ['assetName', 'property', 'value'],
      },
    },
  },
]

/** Tools that change timeline state and therefore must be reviewed before applying. */
const STAGED_TOOLS = new Set<string>([
  'set_project_ratio',
  'add_media_to_timeline',
  'split_selected_clip',
  'delete_selected_clips',
  'set_clip_property',
])

export function isStagedTool(name: string): boolean {
  return STAGED_TOOLS.has(name)
}

/** An AI-proposed timeline change awaiting user approval. */
export interface ToolProposal {
  id: string
  name: string
  args: Record<string, unknown>
  label: string
}

function findClip(assetName: string): Clip | null {
  const s = useTimelineStore.getState()
  const name = assetName.trim().toLowerCase()
  for (const track of s.project.tracks) {
    const clip = track.clips.find((c) => c.name.toLowerCase().includes(name))
    if (clip) return clip
  }
  return null
}

function clipById(id: string): Clip | null {
  const s = useTimelineStore.getState()
  for (const track of s.project.tracks) {
    const clip = track.clips.find((c) => c.id === id)
    if (clip) return clip
  }
  return null
}

function findAsset(assetName: string): Asset | null {
  const s = useTimelineStore.getState()
  const name = assetName.trim().toLowerCase()
  return s.assets.find((a) => a.name.toLowerCase().includes(name)) ?? null
}

/**
 * Describe what a tool call would do, without applying it. Returns null when the
 * arguments are invalid or the referenced timeline object no longer exists.
 */
export function describeTool(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case 'set_project_ratio': {
      const aspect = String(args.aspect ?? '')
      if (!(ASPECTS as readonly string[]).includes(aspect)) return null
      const { width, height } = aspectToSize(aspect as Aspect, 1920)
      return `Change project to ${aspect} (${width}×${height})`
    }
    case 'add_media_to_timeline': {
      const asset = findAsset(String(args.assetName ?? ''))
      if (!asset) return null
      return `Add "${asset.name}" to the timeline`
    }
    case 'split_selected_clip': {
      const s = useTimelineStore.getState()
      const id = s.selection.clipIds[0]
      if (!id) return null
      const clip = clipById(id)
      return `Split "${clip?.name ?? 'selected clip'}" at the playhead`
    }
    case 'delete_selected_clips': {
      const s = useTimelineStore.getState()
      const n = s.selection.clipIds.length
      if (!n) return null
      return `Delete ${n} selected clip${n > 1 ? 's' : ''}`
    }
    case 'set_playhead': {
      const t = Number(args.timeSeconds)
      if (!Number.isFinite(t)) return null
      return `Move playhead to ${Math.max(0, t).toFixed(1)}s`
    }
    case 'set_clip_property': {
      const clip = findClip(String(args.assetName ?? ''))
      const property = String(args.property ?? '')
      const value = Number(args.value)
      if (!clip || !(PROPERTIES as readonly string[]).includes(property) || !Number.isFinite(value)) return null
      return `Set ${property} of "${clip.name}" to ${value}`
    }
    default:
      return null
  }
}

/**
 * Apply a tool call. Re-validates against current timeline state first — a
 * proposal may have become stale since it was created, in which case it is
 * not applied and an explanation is returned.
 */
export function applyTool(name: string, args: Record<string, unknown>): { ok: boolean; message: string } {
  const desc = describeTool(name, args)
  if (!desc) return { ok: false, message: 'This action is no longer valid, so it was not applied.' }

  const s = useTimelineStore.getState()
  switch (name) {
    case 'set_project_ratio': {
      const aspect = String(args.aspect)
      const { width, height } = aspectToSize(aspect as Aspect, 1920)
      s.setProjectSettings({ aspectRatio: aspect, width, height })
      return { ok: true, message: desc }
    }
    case 'add_media_to_timeline': {
      const asset = findAsset(String(args.assetName ?? ''))
      if (!asset) return { ok: false, message: `Media "${String(args.assetName)}" no longer exists.` }
      const type = asset.type === 'audio' ? 'audio' : 'video'
      const track = s.project.tracks.find((t) => t.type === type)
      if (!track) return { ok: false, message: 'No matching track available.' }
      s.addClip(asset.id, track.id)
      return { ok: true, message: desc }
    }
    case 'split_selected_clip': {
      const id = s.selection.clipIds[0]
      if (!id) return { ok: false, message: 'No clip is selected anymore.' }
      s.splitClip(id, s.playhead)
      return { ok: true, message: desc }
    }
    case 'delete_selected_clips': {
      const ids = s.selection.clipIds
      if (!ids.length) return { ok: false, message: 'No clips are selected anymore.' }
      s.deleteClips(ids)
      return { ok: true, message: desc }
    }
    case 'set_playhead': {
      s.setPlayhead(Math.max(0, Number(args.timeSeconds)))
      return { ok: true, message: desc }
    }
    case 'set_clip_property': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const property = String(args.property)
      const value = Number(args.value)
      s.updateClip(clip.id, { [property]: value } as never)
      return { ok: true, message: desc }
    }
    default:
      return { ok: false, message: `Unknown action "${name}".` }
  }
}