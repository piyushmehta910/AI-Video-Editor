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
      name: 'split_clip',
      description: 'Split a clip at a specific time on the timeline. You can specify the clip by name and the time in seconds, or just the clip name to split at the current playhead. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to split.' },
          timeSeconds: { type: 'number', description: 'Timeline position in seconds to split at. Omit to split at the current playhead.' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_clip',
      description: 'Delete a clip from the timeline by its name. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to delete.' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trim_clip',
      description: 'Trim the start or end edge of a clip. Positive delta trims (shortens) from the edge; negative delta extends. The clip must have enough source media to extend. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to trim.' },
          edge: { type: 'string', enum: ['start', 'end'], description: 'Which edge to trim: "start" trims the beginning, "end" trims the end.' },
          deltaSeconds: { type: 'number', description: 'Amount in seconds to trim. Positive = shorten, negative = extend (if source allows).' },
        },
        required: ['assetName', 'edge', 'deltaSeconds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_clip',
      description: 'Move a clip to a new position on the timeline. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to move.' },
          newStartTime: { type: 'number', description: 'The new start time in seconds on the timeline.' },
        },
        required: ['assetName', 'newStartTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'join_clips',
      description: 'Merge two adjacent clips on the same track into one. The clips must be next to each other (no gap). The resulting clip keeps the first clip\'s properties. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          clipName1: { type: 'string', description: 'Name of the first clip (the one that starts earlier).' },
          clipName2: { type: 'string', description: 'Name of the second clip (the one that starts later).' },
        },
        required: ['clipName1', 'clipName2'],
      },
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
  {
    type: 'function',
    function: {
      name: 'add_text_overlay',
      description: 'Add a text overlay / title card to the timeline. Creates a text clip with the given content. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text content to display. Use \\n for line breaks.' },
          durationSeconds: { type: 'number', description: 'Duration in seconds (default 4).' },
          fontSize: { type: 'number', description: 'Font size in pixels (default 48).' },
          color: { type: 'string', description: 'Text color as hex (default #ffffff).' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_transition',
      description: 'Set a transition effect on a clip (e.g. dissolve, wipe). The transition plays at the start of the clip. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to add a transition to.' },
          type: { type: 'string', enum: ['dissolve', 'wipe-left', 'wipe-right', 'slide', 'zoom'], description: 'Transition type.' },
          durationSeconds: { type: 'number', description: 'Transition duration in seconds (default 0.5).' },
        },
        required: ['assetName', 'type'],
      },
    },
  },
]

/** Tools that change timeline state and therefore must be reviewed before applying. */
const STAGED_TOOLS = new Set<string>([
  'set_project_ratio',
  'add_media_to_timeline',
  'split_clip',
  'delete_clip',
  'trim_clip',
  'move_clip',
  'join_clips',
  'set_clip_property',
  'add_text_overlay',
  'set_transition',
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
    case 'split_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return null
      const time = args.timeSeconds != null ? Number(args.timeSeconds) : null
      if (time != null && !Number.isFinite(time)) return null
      const s = useTimelineStore.getState()
      const at = time ?? s.playhead
      return `Split "${clip.name}" at ${at.toFixed(1)}s`
    }
    case 'delete_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return null
      return `Delete "${clip.name}" from the timeline`
    }
    case 'trim_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      const edge = String(args.edge ?? '')
      const delta = Number(args.deltaSeconds)
      if (!clip || !['start', 'end'].includes(edge) || !Number.isFinite(delta)) return null
      const verb = delta > 0 ? 'Trim' : 'Extend'
      return `${verb} ${edge} of "${clip.name}" by ${Math.abs(delta).toFixed(1)}s`
    }
    case 'move_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      const newStart = Number(args.newStartTime)
      if (!clip || !Number.isFinite(newStart)) return null
      return `Move "${clip.name}" to ${Math.max(0, newStart).toFixed(1)}s`
    }
    case 'join_clips': {
      const c1 = findClip(String(args.clipName1 ?? ''))
      const c2 = findClip(String(args.clipName2 ?? ''))
      if (!c1 || !c2) return null
      if (c1.trackId !== c2.trackId) return null
      return `Join "${c1.name}" and "${c2.name}" into one clip`
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
    case 'add_text_overlay': {
      const text = String(args.text ?? '')
      if (!text.trim()) return null
      const dur = Number(args.durationSeconds) || 4
      return `Add text overlay "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}" (${dur}s)`
    }
    case 'set_transition': {
      const clip = findClip(String(args.assetName ?? ''))
      const type = String(args.type ?? '')
      if (!clip || !['dissolve', 'wipe-left', 'wipe-right', 'slide', 'zoom'].includes(type)) return null
      const dur = Number(args.durationSeconds) || 0.5
      return `Add ${type} transition (${dur}s) to "${clip.name}"`
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
    case 'split_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const time = args.timeSeconds != null ? Number(args.timeSeconds) : s.playhead
      s.splitClip(clip.id, time)
      return { ok: true, message: desc }
    }
    case 'delete_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      s.deleteClips([clip.id])
      return { ok: true, message: desc }
    }
    case 'trim_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const edge = String(args.edge) as 'start' | 'end'
      const delta = Number(args.deltaSeconds)
      s.begin()
      s.trimClip(clip.id, edge, delta)
      return { ok: true, message: desc }
    }
    case 'move_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const newStart = Math.max(0, Number(args.newStartTime))
      const delta = newStart - clip.startTime
      if (Math.abs(delta) < 0.01) return { ok: true, message: 'Clip is already at that position.' }
      s.begin()
      s.moveClip(clip.id, delta)
      return { ok: true, message: desc }
    }
    case 'join_clips': {
      const c1 = findClip(String(args.clipName1 ?? ''))
      const c2 = findClip(String(args.clipName2 ?? ''))
      if (!c1) return { ok: false, message: `Clip "${String(args.clipName1)}" no longer exists.` }
      if (!c2) return { ok: false, message: `Clip "${String(args.clipName2)}" no longer exists.` }
      if (c1.trackId !== c2.trackId) return { ok: false, message: 'Clips must be on the same track to join.' }
      s.joinClips(c1.id, c2.id)
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
    case 'add_text_overlay': {
      const text = String(args.text ?? '')
      const dur = Number(args.durationSeconds) || 4
      const fontSize = Number(args.fontSize) || 48
      const color = String(args.color || '#ffffff')
      const track = s.project.tracks.find((t) => t.type === 'video')
      if (!track) return { ok: false, message: 'No video track available.' }
      const clip = s.addTextClip(text, track.id)
      if (!clip) return { ok: false, message: 'Failed to create text clip.' }
      s.updateClip(clip.id, {
        duration: dur,
        sourceEnd: dur,
        text: { ...clip.text!, fontSize, color },
      })
      return { ok: true, message: desc }
    }
    case 'set_transition': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const type = String(args.type) as 'dissolve' | 'wipe-left' | 'wipe-right' | 'slide' | 'zoom'
      const dur = Number(args.durationSeconds) || 0.5
      s.updateClip(clip.id, { transitions: { ...clip.transitions, in: { type, duration: dur } } })
      return { ok: true, message: desc }
    }
    default:
      return { ok: false, message: `Unknown action "${name}".` }
  }
}
