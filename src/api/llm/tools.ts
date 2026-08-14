import { useTimelineStore } from '@/stores/timelineStore'
import { aspectToSize } from '@/engine/types'

const ASPECTS = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const
type Aspect = (typeof ASPECTS)[number]

export const DIRECTOR_TOOLS: Array<Record<string, unknown>> = [
  {
    type: 'function',
    function: {
      name: 'set_project_ratio',
      description: 'Change the project aspect ratio / resolution (e.g. reframe to vertical Reel).',
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
      description: 'Add an imported media asset to the timeline at the playhead.',
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
      description: 'Split the selected clip at the current playhead.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_selected_clips',
      description: 'Delete the currently selected clips from the timeline.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_playhead',
      description: 'Move the playhead (current preview time) to a specific second.',
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
      description: 'Set a numeric property of a clip by its name.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to edit.' },
          property: {
            type: 'string',
            enum: ['opacity', 'volume', 'speed', 'rotation'],
            description: 'Which property to change.',
          },
          value: { type: 'number', description: 'The new value (opacity/volume 0-1, speed 0.25-4, rotation degrees).' },
        },
        required: ['assetName', 'property', 'value'],
      },
    },
  },
]

function findClip(assetName: string) {
  const s = useTimelineStore.getState()
  const name = assetName.trim().toLowerCase()
  for (const track of s.project.tracks) {
    const clip = track.clips.find((c) => c.name.toLowerCase().includes(name))
    if (clip) return clip
  }
  return null
}

export function executeTool(name: string, args: Record<string, unknown>): string {
  const s = useTimelineStore.getState()
  switch (name) {
    case 'set_project_ratio': {
      const aspect = String(args.aspect ?? '')
      if (!(ASPECTS as readonly string[]).includes(aspect)) return `Invalid aspect "${aspect}". Valid: ${ASPECTS.join(', ')}`
      const { width, height } = aspectToSize(aspect as Aspect, 1920)
      s.setProjectSettings({ aspectRatio: aspect, width, height })
      return `Set project to ${aspect} (${width}×${height}).`
    }
    case 'add_media_to_timeline': {
      const assetName = String(args.assetName ?? '').trim().toLowerCase()
      const asset = s.assets.find((a) => a.name.toLowerCase().includes(assetName))
      if (!asset) {
        const names = s.assets.map((a) => a.name).join(', ')
        return `No media matching "${args.assetName}". Available: ${names || 'none imported'}.`
      }
      const type = asset.type === 'audio' ? 'audio' : 'video'
      const track = s.project.tracks.find((t) => t.type === type)
      if (!track) return 'No matching track available.'
      s.addClip(asset.id, track.id)
      return `Added "${asset.name}" to ${track.name}.`
    }
    case 'split_selected_clip': {
      const id = s.selection.clipIds[0]
      if (!id) return 'No clip selected to split.'
      s.splitClip(id, s.playhead)
      return 'Split the selected clip at the playhead.'
    }
    case 'delete_selected_clips': {
      const ids = s.selection.clipIds
      if (!ids.length) return 'No clips selected.'
      s.deleteClips(ids)
      return `Deleted ${ids.length} selected clip(s).`
    }
    case 'set_playhead': {
      const t = Number(args.timeSeconds)
      if (!Number.isFinite(t)) return `Invalid time "${args.timeSeconds}".`
      s.setPlayhead(Math.max(0, t))
      return `Moved playhead to ${Math.max(0, t).toFixed(1)}s.`
    }
    case 'set_clip_property': {
      const assetName = String(args.assetName ?? '')
      const property = String(args.property ?? '')
      const value = Number(args.value)
      const clip = findClip(assetName)
      if (!clip) return `No clip named "${assetName}".`
      const allowed = ['opacity', 'volume', 'speed', 'rotation']
      if (!allowed.includes(property)) return `Property "${property}" not supported.`
      const patch: Record<string, number> = { [property]: value }
      s.updateClip(clip.id, patch as never)
      return `Set ${property} of "${clip.name}" to ${value}.`
    }
    default:
      return `Unknown tool "${name}".`
  }
}