import { useTimelineStore } from '@/stores/timelineStore'
import { aspectToSize, CAMERA_MODES, clampRig, defaultCameraRig } from '@/engine/types'
import type { Asset, CameraMode, Clip, TextAnimation } from '@/engine/types'
import { searchStockImages, downloadStockImage } from '@/api/stock/search'
import { searchMusic } from '@/api/music/search'
import { transcribeAsset, getStoredTranscript, type StoredTranscript } from '@/api/llm/understanding'
import { getActiveTtsProvider } from '@/api/tts'
import {
  generateScript,
  rewriteScript,
  shortenScript,
  expandScript,
  makeHook,
  makeCta,
  describeScript,
} from '@/api/llm/scripts'
import { useScriptStore, type ProjectScript } from '@/stores/scriptStore'
import { generateMotionCode } from '@/api/llm/motionGenerator'
import { renderMotionClip } from '@/engine/motion/sandbox'
import { generateMarpSlides, type MarpTheme } from '@/api/llm/marp'
import type { AvatarRole } from '@/api/llm/avatarGenerator'
import { checkTimeline } from '@/ai/quality/checker'
import { collectTimelineScenes } from '@/api/llm/context'
import { searchModels, downloadModelAsGlb } from '@/api/models/polyhaven'
import { searchSketchfabModels, downloadSketchfabGlb } from '@/api/models/sketchfab'
import { firecrawlSearch, firecrawlScrape } from '@/api/research/firecrawl'
import { analyzeProject } from '@/api/llm/analysis'
import { exportProject } from '@/engine/export/exportVideo'
import { computeReframingKeyframes } from '@/engine/reframing'
import { renderFramesToVideo } from '@/hooks/useLipSync'

const ASPECTS = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const
type Aspect = (typeof ASPECTS)[number]

const PROPERTIES = ['opacity', 'volume', 'speed', 'rotation'] as const

interface ToolDefinition extends Record<string, unknown> {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
    destructive?: boolean
  }
}

export const DIRECTOR_TOOLS: ToolDefinition[] = [
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
      destructive: true,
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
      destructive: true,
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
      destructive: true,
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
      destructive: true,
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
      destructive: true,
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
          animation: {
            type: 'string',
            enum: ['none', 'fade-in', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'typewriter', 'pop', 'bounce'],
            description: 'Entrance animation (default none).',
          },
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
  {
    type: 'function',
    function: {
      name: 'search_stock_image',
      description: 'Search stock image providers (Unsplash / Pexels / Pixabay) for a query, download the best match, import it as a media asset and add it to the timeline. Runs on approval.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for, e.g. "sunset over mountains".' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_music',
      description: 'Search music providers (Deezer, MusicBrainz, Internet Archive) for background music or a sound effect, download the preview, import it as an audio asset and add it to the timeline. Runs on approval.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Mood or track to search for, e.g. "calm piano background music".' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_research',
      description: 'Research facts on the web via Firecrawl to ground scripts and slides in real information. Either search a topic or scrape a specific URL. Read-only: returns findings to you as context. Requires Firecrawl in Settings.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Topic or question to search the web for.' },
          url: { type: 'string', description: 'Optional exact URL to scrape instead of searching.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_captions',
      description: 'Transcribe the audio of a clip locally (Whisper) and add a captions text overlay clip that matches the spoken content. Runs on approval.',
      parameters: {
        type: 'object',
        properties: {
          clipName: { type: 'string', description: 'The clip name whose audio should be captioned. Omit to caption the first audio/video clip with audio.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_voiceover',
      description: 'Generate a voiceover from text using ElevenLabs TTS and add it as an audio clip on the timeline. Requires an ElevenLabs API key. Runs on approval.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The script / narration text to speak.' },
          durationSeconds: { type: 'number', description: 'Optional target duration in seconds to reserve on the timeline (default auto).' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'duplicate_clip',
      description: 'Duplicate an existing clip so it can be used again later in the timeline. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to duplicate.' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_3d_model',
      description: 'Search Poly Haven (free CC0) or Sketchfab (needs API token) for a 3D model, download the best match as GLB, import it as a 3D model asset and add it to the timeline with a camera animation. Runs on approval.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for, e.g. "wooden armchair" or "skull".' },
          source: { type: 'string', enum: ['polyhaven', 'sketchfab'], description: 'Model library to search (default polyhaven).' },
          durationSeconds: { type: 'number', description: 'Clip duration in seconds (default 4).' },
          mode: {
            type: 'string',
            enum: [...CAMERA_MODES],
            description: 'Camera animation: turntable (spin around), orbit, dolly (zoom in), or static.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'animate_3d_model',
      description: 'Full 3D animation shot: search Poly Haven/Sketchfab for a model, download it, render a camera-animated video (turntable/orbit/dolly/static) with three.js + WebCodecs, and add the finished video clip to the timeline. Use when the user wants a rendered 3D animation. Runs on approval.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What model to search for, e.g. "vintage camera".' },
          source: { type: 'string', enum: ['polyhaven', 'sketchfab'], description: 'Model library to search (default polyhaven).' },
          durationSeconds: { type: 'number', description: 'Animation length in seconds (default 5).' },
          mode: {
            type: 'string',
            enum: [...CAMERA_MODES],
            description: 'Camera move: turntable (spin around), orbit, dolly (zoom in), or static.',
          },
          resolution: { type: 'string', enum: ['720p', '1080p'], description: 'Render resolution (default 720p).' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_3d_camera',
      description: 'Set the camera animation rig for a 3D model clip on the timeline. Only applies to clips whose asset is a 3D model. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to edit.' },
          mode: {
            type: 'string',
            enum: [...CAMERA_MODES],
            description: 'Camera animation mode.',
          },
          azimuthStart: { type: 'number', description: 'Starting angle around the model in degrees.' },
          azimuthEnd: { type: 'number', description: 'Ending angle in degrees (360 = full spin).' },
          elevation: { type: 'number', description: 'Camera height angle in degrees (default 20).' },
          radius: { type: 'number', description: 'Camera distance from the model in world units (default ~6).' },
          fov: { type: 'number', description: 'Field of view in degrees (default 40).' },
          pan: { type: 'number', description: 'How much of the sweep plays across the clip (0.05–1, default 1).' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'understand_video',
      description: 'Generate (or refresh) a local transcript of every clip with audio so you can understand what the video says before making edits. Applied immediately.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_quality',
      description: 'Review the whole timeline for editing problems — overlapping clips, missing media references, long static shots, empty sections and story-structure gaps (missing hook or ending). Applied immediately and read-only: it reports findings but changes nothing.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_edit',
      description: 'Propose an execution plan for a non-trivial request BEFORE making any edits. Provide the goal, the scenes/clips affected, and the exact tool actions with a one-line plain-English reason each. The plan is shown to the user for approval — nothing is applied until they approve it. Call this FIRST for anything more than a single obvious action.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The user\'s request restated as a clear editing goal.' },
          scenesAffected: {
            type: 'array',
            items: { type: 'string' },
            description: 'The scenes or clips this plan touches, e.g. ["clip intro 0s-4s", "clip b-roll 4s-12s"].',
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tool: { type: 'string', description: 'A tool name from the available tools.' },
                arguments: { type: 'object', description: 'The tool arguments (must match the tool\'s parameters).' },
                reason: { type: 'string', description: 'One-line plain-English reason for this action.' },
              },
              required: ['tool', 'arguments', 'reason'],
            },
            description: 'The concrete tool actions to run once approved, in order.',
          },
        },
        required: ['goal', 'scenesAffected', 'actions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Ask the user ONE concise clarifying question when a request is genuinely ambiguous (e.g. which clip, what length, which style). Applied immediately and read-only. Never ask a question that has already been asked in this project — make your best guess instead.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'A single, concise question for the user.' },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_project',
      description: 'Review the project for open-ended improvements ("make this better", "improve", "polish"). Returns an itemized list of issues with a Fix All / Review Changes option. Read-only and applied immediately: it never rewrites the project. Use this instead of guessing when the user asks for general improvement.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_video',
      description: 'Run the local analysis pipeline on every clip with audio/video on the timeline: transcription, scene detection with summaries, and OCR protected regions. Applied immediately and read-only (it only adds analysis data, it does not edit the timeline).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_preview',
      description: 'Render the current timeline to a WebM video at the project resolution and download it. Applied immediately and read-only (produces a file, does not edit the timeline). Use this to preview the final output.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional output file name (default "clipforge-render").' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_caption',
      description: 'Transcribe the audio of a clip (Whisper, local) and enable the automatic captions layer for it — timed, styled captions rendered over the video. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          clipName: { type: 'string', description: 'The clip name whose audio should be captioned. Omit to caption the first clip with audio.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_transcript',
      description: 'Generate (or refresh) a local transcript of every clip with audio so you can understand what the video says before making edits. Alias for understand_video. Applied immediately.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_script',
      description: 'Write a full narration script (hook + numbered scenes + CTA) for a topic. Scene durations are normalized to fill the requested target duration (or the current timeline duration). The script is stored and its scene durations are authoritative for later tools like generate_voiceover and generate_motion_graphics. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The subject the script must explain, e.g. "how the heart pumps blood".' },
          durationSeconds: { type: 'number', description: 'Target total duration in seconds to fill. Omit to use the current timeline duration.' },
          language: { type: 'string', description: 'Optional narration language, e.g. "Hindi".' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rewrite_script',
      description: 'Rewrite the stored narration script per an instruction (tone, audience, wording). Keeps the same target duration and re-normalizes scene durations. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: 'How to rewrite it, e.g. "simpler words for kids".' },
        },
        required: ['instruction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'shorten_script',
      description: 'Compress the stored script so its scene durations fill a shorter target duration. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          targetDurationSeconds: { type: 'number', description: 'New total duration to fill.' },
        },
        required: ['targetDurationSeconds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'expand_script',
      description: 'Expand the stored script so its scene durations fill a longer target duration. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          targetDurationSeconds: { type: 'number', description: 'New total duration to fill.' },
        },
        required: ['targetDurationSeconds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'script_hook',
      description: 'Write a new opening hook for the stored script (optionally per an instruction). Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: 'Optional style hint, e.g. "more surprising".' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'script_cta',
      description: 'Write a new closing call-to-action for the stored script (optionally per an instruction). Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: 'Optional style hint, e.g. "ask to subscribe".' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_motion_graphics',
      description: 'Generate an animated diagram / motion graphic for a concept. The AI writes a self-contained canvas animation (code runs only inside a locked-down sandbox, never touching the page), the app renders it to a real WebM clip with WebCodecs and adds it to the video track. Best for explaining a mechanism (e.g. "how the heart pumps blood", "how a battery works"). Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          concept: { type: 'string', description: 'What the animation must show, e.g. "how the heart pumps blood".' },
          durationSeconds: { type: 'number', description: 'Clip length in seconds (default 8).' },
          style: { type: 'string', description: 'Visual style hint, e.g. "minimal flat", "neon", "whiteboard".' },
          language: { type: 'string', description: 'Optional language for labels in the diagram.' },
          transparent: { type: 'boolean', description: 'Whether the animation should have a transparent alpha channel for video overlay compositing.' },
          resolution: { type: 'string', enum: ['720p', '1080p'], description: 'Render resolution (default 720p).' },
        },
        required: ['concept'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_slides',
      description: 'Generate a presentation deck for a topic using Marp. The AI writes the deck as Marp markdown, the app renders each slide to a full-resolution PNG image and adds them to the video track as image clips. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The subject the deck must cover.' },
          count: { type: 'number', description: 'Optional number of slides (3-6).' },
          theme: { type: 'string', enum: ['gaia', 'cyber', 'sunset', 'uncover', 'default'], description: "Marp theme: gaia (dark navy/cyan), cyber (neon magenta/cyan), sunset (amber gradient), uncover (light indigo), default (white) (default gaia)." },
          language: { type: 'string', description: 'Optional language for slide text.' },
          durationSeconds: { type: 'number', description: 'Seconds each slide stays on screen (default 5).' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_avatar_intro',
      description: 'Generate a lip-synced avatar intro for a topic. Creates a talking-head video with generated script + TTS voiceover + lip-sync, and inserts it at the start of the timeline. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic the intro must introduce.' },
          durationSeconds: { type: 'number', description: 'Target duration in seconds (default 8).' },
          language: { type: 'string', description: 'Optional narration language.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_avatar_outro',
      description: 'Generate a lip-synced avatar outro for a topic. Creates a talking-head video with generated script + TTS voiceover + lip-sync, and inserts it at the end of the timeline. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic the outro must conclude.' },
          durationSeconds: { type: 'number', description: 'Target duration in seconds (default 6).' },
          language: { type: 'string', description: 'Optional narration language.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_avatar_presenter',
      description: 'Generate a lip-synced avatar presenter segment. Inserts at the playhead position. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic the presenter must explain.' },
          durationSeconds: { type: 'number', description: 'Target duration in seconds (default 12).' },
          language: { type: 'string', description: 'Optional narration language.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_avatar_narrator',
      description: 'Generate a lip-synced avatar narrator segment (documentary style). Inserts at the playhead position. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic the narrator must describe.' },
          durationSeconds: { type: 'number', description: 'Target duration in seconds (default 15).' },
          language: { type: 'string', description: 'Optional narration language.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'smart_reframe',
      description: 'Analyze a clip and compute dynamic crop keyframes to reframe it for a target aspect ratio (e.g., 16:9 → 9:16). Uses face/subject tracking to keep the subject centered. Stores crop keyframes on the clip for smooth rendering. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to reframe.' },
          targetAspect: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:5', '21:9'], description: 'Target aspect ratio (default 9:16).' },
          followStrength: { type: 'number', description: 'How aggressively to follow the subject (0-1, default 0.8).' },
          margin: { type: 'number', description: 'Margin around subject as fraction of crop size (default 0.15).' },
          smoothing: { type: 'number', description: 'Crop movement smoothing factor (0-1, default 0.15).' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_background',
      description: 'Remove the background from a video clip using AI segmentation. Replaces background with transparency, blur, solid color, or an image. Runs in-browser using ONNX model. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The clip name to remove background from.' },
          backgroundType: { type: 'string', enum: ['transparent', 'blur', 'color', 'image'], description: 'What to replace the background with (default transparent).' },
          backgroundColor: { type: 'string', description: 'Hex color for solid background (e.g., #ffffff).' },
          backgroundBlur: { type: 'number', description: 'Blur radius for blurred background (default 20).' },
          backgroundImageUrl: { type: 'string', description: 'URL of image to use as background.' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_text',
      description: 'Add a text overlay / title card to the timeline. Creates a text clip with the given content. Alias for add_text_overlay. Staged for user review.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text content to display. Use \\n for line breaks.' },
          durationSeconds: { type: 'number', description: 'Duration in seconds (default 4).' },
          fontSize: { type: 'number', description: 'Font size in pixels (default 48).' },
          color: { type: 'string', description: 'Text color as hex (default #ffffff).' },
          animation: {
            type: 'string',
            enum: ['none', 'fade-in', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'typewriter', 'pop', 'bounce'],
            description: 'Entrance animation (default none).',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_transition',
      description: 'Set a transition effect on a clip (e.g. dissolve, wipe). The transition plays at the start of the clip. Alias for set_transition. Staged for user review.',
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
  {
    type: 'function',
    function: {
      name: 'set_clip_speed',
      description: 'Set playback speed for a clip (0.1x to 8.0x) and optionally ripple/adjust its timeline duration.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'Clip name or ID.' },
          speed: { type: 'number', description: 'Speed multiplier (0.1 to 8.0).' },
          rippleDuration: { type: 'boolean', description: 'Whether to scale timeline duration with speed (default true).' },
          preservePitch: { type: 'boolean', description: 'Whether to preserve audio pitch (default true).' },
        },
        required: ['assetName', 'speed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_clip_volume',
      description: 'Set audio volume and gain for a clip.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'Clip name or ID.' },
          volume: { type: 'number', description: 'Volume gain from 0.0 (mute) to 2.0 (200%).' },
          muted: { type: 'boolean', description: 'Mute toggle.' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_clip_placement',
      description: 'Position, scale, and align a clip on the canvas (e.g. PIP corner, center, lower third).',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'Clip name or ID.' },
          alignment: {
            type: 'string',
            enum: ['center', 'top-left', 'top-right', 'bottom-center', 'pip', 'fill', 'reset'],
            description: 'Quick placement preset.',
          },
          positionX: { type: 'number', description: 'Canvas X position offset from center.' },
          positionY: { type: 'number', description: 'Canvas Y position offset from center.' },
          scale: { type: 'number', description: 'Uniform scale multiplier (e.g. 1.0 = normal, 0.35 = PIP).' },
          rotation: { type: 'number', description: 'Rotation in degrees.' },
        },
        required: ['assetName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'auto_generate_captions',
      description: 'Transcribe spoken audio from all video/audio clips on the timeline and generate timed subtitle cues with styled text overlays.',
      parameters: {
        type: 'object',
        properties: {
          style: {
            type: 'string',
            enum: ['karaoke', 'modern', 'cinematic', 'cyber'],
            description: 'Caption theme style (default karaoke).',
          },
        },
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
  'set_clip_speed',
  'set_clip_volume',
  'set_clip_placement',
  'auto_generate_captions',
  'add_text_overlay',
  'add_text',
  'set_transition',
  'add_transition',
  'search_stock_image',
  'search_music',
  'generate_captions',
  'add_caption',
  'generate_voiceover',
  'duplicate_clip',
  'add_3d_model',
  'animate_3d_model',
  'set_3d_camera',
  'generate_script',
  'rewrite_script',
  'shorten_script',
  'expand_script',
  'script_hook',
  'script_cta',
  'generate_motion_graphics',
  'generate_slides',
  'generate_avatar_intro',
  'generate_avatar_outro',
  'generate_avatar_presenter',
  'generate_avatar_narrator',
  'smart_reframe',
  'remove_background',
])

/** Tools that never mutate timeline state and therefore need no undo snapshot. */
const NON_MUTATING_TOOLS = new Set<string>([
  'set_playhead',
  'understand_video',
  'generate_transcript',
  'check_quality',
  'ask_user',
  'review_project',
  'analyze_video',
  'render_preview',
  'web_research',
])

/** Friendly aliases so the model can use either naming style. */
const ALIASES: Record<string, string> = {
  generate_transcript: 'understand_video',
  add_text: 'add_text_overlay',
  add_transition: 'set_transition',
}

export function isStagedTool(name: string): boolean {
  return STAGED_TOOLS.has(ALIASES[name] ?? name) || STAGED_TOOLS.has(name)
}

export function canonicalTool(name: string): string {
  return ALIASES[name] ?? name
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
  name = canonicalTool(name)
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
    case 'set_clip_speed': {
      const clip = findClip(String(args.assetName ?? ''))
      const speed = Number(args.speed)
      if (!clip || !Number.isFinite(speed)) return null
      return `Set playback speed of "${clip.name}" to ${speed.toFixed(2)}x`
    }
    case 'set_clip_volume': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return null
      const vol = args.volume != null ? `${Math.round(Number(args.volume) * 100)}%` : ''
      const mute = args.muted === true ? ' (muted)' : ''
      return `Set volume of "${clip.name}" to ${vol}${mute}`
    }
    case 'set_clip_placement': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return null
      const align = args.alignment ? ` alignment ${String(args.alignment)}` : ''
      return `Set placement on canvas for "${clip.name}"${align}`
    }
    case 'auto_generate_captions': {
      const style = String(args.style || 'karaoke')
      return `Auto-generate synchronized captions for timeline audio (${style} style)`
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
    case 'search_stock_image': {
      const query = String(args.query ?? '')
      if (!query.trim()) return null
      return `Search stock images for "${query}" and add the best match to the timeline`
    }
    case 'search_music': {
      const query = String(args.query ?? '')
      if (!query.trim()) return null
      return `Search music for "${query}" and add the best match to the timeline`
    }
    case 'generate_captions': {
      const name = String(args.clipName ?? '').trim()
      if (name && !findClip(name)) return null
      return name
        ? `Generate captions for "${name}"`
        : 'Generate captions for the first clip with audio'
    }
    case 'add_caption': {
      const clipName = String(args.clipName ?? '').trim()
      if (clipName && !findClip(clipName)) return null
      return clipName
        ? `Add captions layer for "${clipName}"`
        : 'Add captions layer for the first clip with audio'
    }
    case 'generate_script': {
      const topic = String(args.topic ?? '')
      if (!topic.trim()) return null
      const dur = Number(args.durationSeconds) || 0
      return `Generate a narration script for "${topic}"${dur > 0 ? ` (${dur}s)` : ''}`
    }
    case 'rewrite_script': {
      const instruction = String(args.instruction ?? '')
      if (!instruction.trim()) return null
      return `Rewrite the stored script: ${instruction}`
    }
    case 'shorten_script': {
      const target = Number(args.targetDurationSeconds)
      if (!Number.isFinite(target) || target <= 0) return null
      return `Shorten the stored script to ${target}s`
    }
    case 'expand_script': {
      const target = Number(args.targetDurationSeconds)
      if (!Number.isFinite(target) || target <= 0) return null
      return `Expand the stored script to ${target}s`
    }
    case 'script_hook': {
      const instruction = String(args.instruction ?? '')
      return instruction ? `Write a new hook for the script (${instruction})` : 'Write a new hook for the script'
    }
    case 'script_cta': {
      const instruction = String(args.instruction ?? '')
      return instruction ? `Write a new CTA for the script (${instruction})` : 'Write a new CTA for the script'
    }
    case 'generate_motion_graphics': {
      const concept = String(args.concept ?? '')
      if (!concept.trim()) return null
      const dur = Number(args.durationSeconds) || 0
      return `Generate an animated diagram of "${concept}"${dur > 0 ? ` (${dur}s)` : ''}`
    }
    case 'generate_slides': {
      const topic = String(args.topic ?? '')
      if (!topic.trim()) return null
      const count = Number(args.count) || 0
      return `Generate a ${count > 0 ? `${count}-slide ` : ''}deck for "${topic}"`
    }
    case 'generate_avatar_intro': {
      const topic = String(args.topic ?? '')
      if (!topic.trim()) return null
      const dur = Number(args.durationSeconds) || 8
      return `Generate avatar intro for "${topic}" (${dur}s)`
    }
    case 'generate_avatar_outro': {
      const topic = String(args.topic ?? '')
      if (!topic.trim()) return null
      const dur = Number(args.durationSeconds) || 6
      return `Generate avatar outro for "${topic}" (${dur}s)`
    }
    case 'generate_avatar_presenter': {
      const topic = String(args.topic ?? '')
      if (!topic.trim()) return null
      const dur = Number(args.durationSeconds) || 12
      return `Generate avatar presenter for "${topic}" (${dur}s)`
    }
    case 'generate_avatar_narrator': {
      const topic = String(args.topic ?? '')
      if (!topic.trim()) return null
      const dur = Number(args.durationSeconds) || 15
      return `Generate avatar narrator for "${topic}" (${dur}s)`
    }
    case 'smart_reframe': {
      const assetName = String(args.assetName ?? '')
      if (!assetName.trim()) return null
      const aspect = String(args.targetAspect ?? '9:16')
      return `Smart reframe "${assetName}" to ${aspect}`
    }
    case 'remove_background': {
      const assetName = String(args.assetName ?? '')
      if (!assetName.trim()) return null
      const bgType = String(args.backgroundType ?? 'transparent')
      return `Remove background from "${assetName}" (${bgType})`
    }
    case 'ask_user': {
      const question = String(args.question ?? '').trim()
      if (!question) return null
      return `Ask the user: ${question}`
    }
    case 'review_project': {
      return 'Review the project and list improvement opportunities'
    }
    case 'analyze_video': {
      return 'Run local analysis (transcript + scenes + OCR) on all clips'
    }
    case 'render_preview': {
      return `Render the timeline to ${String(args.name || 'clipforge-render').replace(/\.webm$/i, '')}.webm`
    }
    case 'generate_voiceover': {
      const text = String(args.text ?? '')
      if (!text.trim()) return null
      return `Generate voiceover: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`
    }
    case 'duplicate_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return null
      return `Duplicate "${clip.name}"`
    }
    case 'add_3d_model': {
      const query = String(args.query ?? '')
      if (!query.trim()) return null
      return `Search 3D models for "${query}" and add the best match to the timeline`
    }
    case 'set_3d_camera': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip || !clip.modelRig) return null
      const parts: string[] = []
      if (args.mode != null) parts.push(`mode ${String(args.mode)}`)
      if (args.azimuthStart != null) parts.push(`azimuth ${Number(args.azimuthStart)}°→${args.azimuthEnd != null ? `${Number(args.azimuthEnd)}°` : 'end'}`)
      if (args.elevation != null) parts.push(`elevation ${Number(args.elevation)}°`)
      if (args.radius != null) parts.push(`radius ${Number(args.radius)}`)
      if (args.fov != null) parts.push(`fov ${Number(args.fov)}°`)
      return parts.length
        ? `Set 3D camera on "${clip.name}": ${parts.join(', ')}`
        : `Reset 3D camera on "${clip.name}"`
    }
    default:
      return null
  }
}

/**
 * Apply a tool call. Re-validates against current timeline state first — a
 * proposal may have become stale since it was created, in which case it is
 * not applied and an explanation is returned.
 *
 * Unless `undoStep: false`, a mutating tool records a single undo snapshot so
 * every AI edit is reversible exactly like a manual edit.
 */
export interface ApplyToolOptions {
  /** Set false when the caller already opened an undo transaction. */
  undoStep?: boolean
}

async function applyScriptEdit(
  fn: (current: ProjectScript) => Promise<{ script: ProjectScript; message: string }>,
): Promise<{ ok: boolean; message: string }> {
  const current = useScriptStore.getState().script
  if (!current) {
    return { ok: false, message: 'No script generated yet — call generate_script first.' }
  }
  try {
    const { script, message } = await fn(current)
    useScriptStore.getState().setScript(script)
    return { ok: true, message }
  } catch (err) {
    return { ok: false, message: `Script update failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function applyTool(
  name: string,
  args: Record<string, unknown>,
  opts: ApplyToolOptions = {},
): Promise<{ ok: boolean; message: string }> {
  const requestedName = name
  name = canonicalTool(name)
  const desc = describeTool(name, args)
  if (!desc) return { ok: false, message: 'This action is no longer valid, so it was not applied.' }

  const s = useTimelineStore.getState()
  const mutating =
    !NON_MUTATING_TOOLS.has(requestedName) && !NON_MUTATING_TOOLS.has(name)
  if (opts.undoStep !== false && mutating) s.begin()
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
    case 'set_clip_speed': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const speed = Math.max(0.1, Math.min(10, Number(args.speed) || 1.0))
      const ripple = args.rippleDuration !== false
      const sourceDuration = Math.max(0.1, clip.sourceEnd - clip.sourceStart)
      const updates: Partial<Clip> = { speed }
      if (ripple) updates.duration = sourceDuration / speed
      if (args.preservePitch != null) updates.preservePitch = Boolean(args.preservePitch)
      s.updateClip(clip.id, updates)
      return { ok: true, message: desc }
    }
    case 'set_clip_volume': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const updates: Partial<Clip> = {}
      if (args.volume != null) updates.volume = Math.max(0, Math.min(3.0, Number(args.volume)))
      if (args.muted != null) updates.muted = Boolean(args.muted)
      s.updateClip(clip.id, updates)
      return { ok: true, message: desc }
    }
    case 'set_clip_placement': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      const pw = s.project.width
      const ph = s.project.height
      const updates: Partial<Clip> = {}

      if (args.alignment) {
        switch (args.alignment) {
          case 'center':
            updates.position = { x: 0, y: 0 }
            break
          case 'top-left':
            updates.position = { x: -pw * 0.25, y: -ph * 0.25 }
            break
          case 'top-right':
            updates.position = { x: pw * 0.25, y: -ph * 0.25 }
            break
          case 'bottom-center':
            updates.position = { x: 0, y: ph * 0.3 }
            break
          case 'pip':
            updates.position = { x: pw * 0.3, y: ph * 0.28 }
            updates.scale = { x: 0.38, y: 0.38 }
            break
          case 'fill':
            updates.position = { x: 0, y: 0 }
            updates.scale = { x: 1.0, y: 1.0 }
            break
          case 'reset':
            updates.position = { x: 0, y: 0 }
            updates.scale = { x: 1.0, y: 1.0 }
            updates.rotation = 0
            break
        }
      }

      if (args.positionX != null || args.positionY != null) {
        updates.position = {
          x: args.positionX != null ? Number(args.positionX) : (updates.position?.x ?? clip.position?.x ?? 0),
          y: args.positionY != null ? Number(args.positionY) : (updates.position?.y ?? clip.position?.y ?? 0),
        }
      }
      if (args.scale != null) {
        const sc = Number(args.scale)
        updates.scale = { x: sc, y: sc }
      }
      if (args.rotation != null) {
        updates.rotation = Number(args.rotation)
      }

      s.updateClip(clip.id, updates)
      return { ok: true, message: desc }
    }
    case 'auto_generate_captions': {
      const style = String(args.style || 'karaoke')
      const targetTrack = s.project.tracks.find((t) => t.type === 'text') || s.project.tracks.find((t) => t.type === 'video')
      if (!targetTrack) return { ok: false, message: 'No track available for captions.' }

      const mediaClips = s.project.tracks
        .filter((t) => t.type === 'video' || t.type === 'audio')
        .flatMap((t) => t.clips)
        .sort((a, b) => a.startTime - b.startTime)

      if (!mediaClips.length) return { ok: false, message: 'No media clips on timeline to transcribe.' }

      const { transcribeAsset, getStoredTranscript } = await import('@/api/llm/understanding')
      let count = 0

      for (const c of mediaClips) {
        const asset = s.assets.find((a) => a.id === c.assetId)
        if (!asset || asset.type === 'image') continue
        let transcript = await getStoredTranscript(asset.id)
        if (!transcript) transcript = (await transcribeAsset(asset)) ?? undefined

        if (transcript?.sentences?.length) {
          for (const st of transcript.sentences) {
            const start = Math.max(c.startTime, c.startTime + (st.start - c.sourceStart) / c.speed)
            const end = Math.min(c.startTime + c.duration, c.startTime + (st.end - c.sourceStart) / c.speed)
            if (end > start && st.text.trim()) {
              const tc = s.addTextClip(st.text.trim(), targetTrack.id, start)
              if (tc) {
                const dur = Math.max(1, end - start)
                s.updateClip(tc.id, {
                  name: st.text.slice(0, 20),
                  duration: dur,
                  sourceEnd: dur,
                  textType: 'caption',
                  text: {
                    text: st.text.trim(),
                    fontSize: 44,
                    color: style === 'karaoke' ? '#facc15' : '#ffffff',
                    backgroundColor: '#000000bb',
                    textAlign: 'center',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 'bold',
                    fontStyle: 'normal',
                    paddingTop: 8,
                    paddingBottom: 8,
                    paddingLeft: 16,
                    paddingRight: 16,
                    borderRadius: 6,
                    shadow: true,
                    animation: 'pop',
                    animationDuration: 0.3,
                  },
                })
                count++
              }
            }
          }
        }
      }
      return { ok: true, message: `${desc} — created ${count} caption cues.` }
    }
    case 'add_text_overlay': {
      const text = String(args.text ?? '')
      const dur = Number(args.durationSeconds) || 4
      const fontSize = Number(args.fontSize) || 48
      const color = String(args.color || '#ffffff')
      const animation = String(args.animation ?? 'none') as TextAnimation
      const track = s.project.tracks.find((t) => t.type === 'video')
      if (!track) return { ok: false, message: 'No video track available.' }
      const clip = s.addTextClip(text, track.id)
      if (!clip) return { ok: false, message: 'Failed to create text clip.' }
      s.updateClip(clip.id, {
        duration: dur,
        sourceEnd: dur,
        text: { ...clip.text!, fontSize, color, animation },
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
    case 'search_stock_image': {
      const query = String(args.query ?? '')
      const results = await searchStockImages(query, { maxResults: 5 })
      if (!results.length) return { ok: false, message: `No stock images found for "${query}". Check your API keys in Settings.` }
      try {
        const file = await downloadStockImage(results[0])
        const imported = await s.importFiles([file])
        const asset = imported.imported[0]
        if (!asset) return { ok: false, message: 'Downloaded image could not be imported.' }
        const track = s.project.tracks.find((t) => t.type === 'video')
        if (!track) return { ok: false, message: 'No video track available.' }
        s.addClip(asset.id, track.id)
        return { ok: true, message: `${desc} (added "${asset.name}")` }
      } catch (err) {
        return { ok: false, message: `Stock image download failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'search_music': {
      const query = String(args.query ?? '')
      const tracks = await searchMusic(query, { maxResults: 5 })
      if (!tracks.length) return { ok: false, message: `No music found for "${query}".` }
      const track = tracks[0]
      if (!track.previewUrl) return { ok: false, message: 'No downloadable preview for the best match.' }
      try {
        const res = await fetch(track.previewUrl)
        const blob = await res.blob()
        const file = new File([blob], `music-${track.source}-${track.id}.mp3`, { type: blob.type || 'audio/mpeg' })
        const imported = await s.importFiles([file])
        const asset = imported.imported[0]
        if (!asset) return { ok: false, message: 'Music could not be imported.' }
        const audioTrack = s.project.tracks.find((t) => t.type === 'audio')
        if (!audioTrack) return { ok: false, message: 'No audio track available.' }
        s.addClip(asset.id, audioTrack.id)
        return { ok: true, message: `${desc} (added "${track.title}" by ${track.artist})` }
      } catch (err) {
        return { ok: false, message: `Music download failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'generate_captions': {
      const name = String(args.clipName ?? '').trim()
      const s = useTimelineStore.getState()
      let targetClip: Clip | null = null
      for (const t of s.project.tracks) {
        for (const c of t.clips) {
          const asset = s.assets.find((a) => a.id === c.assetId)
          if (!asset || asset.type === 'image') continue
          if (!name || c.name.toLowerCase().includes(name.toLowerCase())) {
            targetClip = c
            break
          }
        }
        if (targetClip) break
      }
      if (!targetClip) {
        return { ok: false, message: name ? `No clip with audio named "${name}".` : 'No clip with audio found to caption.' }
      }
      const asset = s.assets.find((a) => a.id === targetClip!.assetId)
      if (!asset) return { ok: false, message: 'Clip asset not found.' }
      const transcript = await transcribeAsset(asset)
      if (!transcript) return { ok: false, message: `Could not transcribe "${targetClip.name}" (audio may be silent or the model could not load).` }
      const videoTrack = s.project.tracks.find((t) => t.type === 'video')
      if (!videoTrack) return { ok: false, message: 'No video track available for captions.' }
      const textClip = s.addTextClip(transcript.text.slice(0, 120), videoTrack.id, targetClip.startTime)
      if (!textClip) return { ok: false, message: 'Failed to create captions clip.' }
      s.updateClip(textClip.id, {
        duration: targetClip.duration,
        sourceEnd: targetClip.duration,
        text: { ...textClip.text!, fontSize: 24, color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', animation: 'fade-in', animationDuration: 0.3 },
      })
      return { ok: true, message: `${desc} — captions added for "${targetClip.name}"` }
    }
    case 'generate_voiceover': {
      const text = String(args.text ?? '')
      const provider = getActiveTtsProvider()
      if (!provider) {
        return {
          ok: false,
          message: 'No voice provider is configured. Add an ElevenLabs or NVIDIA NIM TTS API key in Settings → Voice first.',
        }
      }
      try {
        const result = await provider.synthesize({ text })
        const file = new File([result.blob], `voiceover-${Date.now()}.mp3`, { type: result.blob.type || 'audio/mpeg' })
        const imported = await s.importFiles([file])
        const asset = imported.imported[0]
        if (!asset) return { ok: false, message: 'Voiceover could not be imported.' }
        const audioTrack = s.project.tracks.find((t) => t.type === 'audio')
        if (!audioTrack) return { ok: false, message: 'No audio track available.' }
        s.addClip(asset.id, audioTrack.id)
        return { ok: true, message: `${desc} — voiceover added to the timeline via ${provider.name}` }
      } catch (err) {
        return { ok: false, message: `Voiceover generation failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'duplicate_clip': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip) return { ok: false, message: `Clip "${String(args.assetName)}" no longer exists.` }
      s.duplicateClips([clip.id])
      return { ok: true, message: desc }
    }
    case 'add_3d_model': {
      const query = String(args.query ?? '')
      const source = String(args.source ?? 'polyhaven')
      let file: File
      let modelName: string = query
      try {
        if (source === 'sketchfab') {
          const results = await searchSketchfabModels(query, { maxResults: 5 })
          if (!results.length) return { ok: false, message: `No downloadable Sketchfab models found for "${query}".` }
          file = await downloadSketchfabGlb(results[0].id)
          modelName = results[0].name
        } else {
          const results = await searchModels(query, { maxResults: 5 })
          if (!results.length) return { ok: false, message: `No 3D models found for "${query}".` }
          file = await downloadModelAsGlb(results[0].id)
          modelName = results[0].name
        }
        const imported = await s.importFiles([file])
        const asset = imported.imported[0]
        if (!asset) return { ok: false, message: 'Downloaded model could not be imported.' }
        const dur = Math.max(1, Number(args.durationSeconds) || 4)
        const clip = s.addAssetToTimeline(asset.id)
        if (!clip) return { ok: false, message: 'No video track available for the 3D model.' }
        s.updateClip(clip.id, { duration: dur, sourceEnd: dur })
        return { ok: true, message: `${desc} (added "${asset.name}" from ${source})` }
      } catch (err) {
        return { ok: false, message: `3D model download failed for "${modelName ?? query}": ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'animate_3d_model': {
      const query = String(args.query ?? args.preset ?? 'cyber-cube')
      if (!query.trim()) return { ok: false, message: 'No query or preset provided for the 3D animation.' }
      const source = String(args.source ?? 'polyhaven')
      const dur = Math.max(1, Number(args.durationSeconds) || 5)
      const is1080 = String(args.resolution ?? '720p') === '1080p'
      const width = is1080 ? 1920 : 1280
      const height = is1080 ? 1080 : 720
      let modelName = query
      try {
        let file: File
        const matchedPreset = ['cyber-cube', 'studio-camera', 'gold-trophy', 'diamond-gem', 'retro-mic', 'drone-quad'].find(
          (p) => p === query || p.includes(query.toLowerCase()) || query.toLowerCase().includes(p.split('-')[0]),
        )

        if (matchedPreset) {
          const { exportPresetToGlb } = await import('@/engine/three/presets')
          const glbBlob = await exportPresetToGlb(matchedPreset)
          file = new File([glbBlob], `${matchedPreset}-${Date.now()}.glb`, { type: 'model/gltf-binary' })
          modelName = matchedPreset
        } else if (source === 'sketchfab') {
          const results = await searchSketchfabModels(query, { maxResults: 5 })
          if (!results.length) return { ok: false, message: `No downloadable Sketchfab models found for "${query}".` }
          file = await downloadSketchfabGlb(results[0].id)
          modelName = results[0].name
        } else {
          const results = await searchModels(query, { maxResults: 5 })
          if (!results.length) {
            const { exportPresetToGlb } = await import('@/engine/three/presets')
            const glbBlob = await exportPresetToGlb('cyber-cube')
            file = new File([glbBlob], `cyber-cube-${Date.now()}.glb`, { type: 'model/gltf-binary' })
            modelName = 'Cyber Tesseract'
          } else {
            file = await downloadModelAsGlb(results[0].id)
            modelName = results[0].name
          }
        }
        const imported = await s.importFiles([file])
        const asset = imported.imported[0]
        if (!asset) return { ok: false, message: '3D model asset could not be prepared.' }

        const mode = String(args.mode ?? 'turntable') as CameraMode
        const radius = (asset.modelRadius ?? 2.4) * 2.5
        const rig = defaultCameraRig()
        rig.mode = mode
        rig.radiusStart = radius
        rig.radiusEnd = mode === 'dolly' ? radius * 0.55 : radius

        // Lazy: pulls the three.js chunk only when a 3D render is actually requested.
        const { renderGlbToVideo } = await import('@/engine/three/renderGlbToVideo')
        const rendered = await renderGlbToVideo({ asset, rig, duration: dur, fps: 30, width, height })
        const videoFile = new File([rendered.blob], `3d-${modelName.replace(/\W+/g, '-').toLowerCase()}-${Date.now()}.webm`, { type: 'video/webm' })
        const next = useTimelineStore.getState()
        const vimported = await next.importFiles([videoFile])
        const vasset = vimported.imported[0]
        if (!vasset) return { ok: false, message: 'Rendered 3D animation could not be imported.' }
        const videoTrack = next.project.tracks.find((t) => t.type === 'video')
        if (!videoTrack) return { ok: false, message: 'No video track available.' }
        next.addClip(vasset.id, videoTrack.id)
        const clip = next.project.tracks.flatMap((t) => t.clips).find((c) => c.assetId === vasset.id)
        if (clip) next.updateClip(clip.id, { duration: dur, sourceEnd: dur })
        return { ok: true, message: `${desc} — rendered ${rendered.frames} frames of "${modelName}" at ${width}x${height} and added it to the timeline.` }
      } catch (err) {
        return { ok: false, message: `3D animation failed for "${modelName}": ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'set_3d_camera': {
      const clip = findClip(String(args.assetName ?? ''))
      if (!clip || !clip.modelRig) {
        return { ok: false, message: `"${String(args.assetName)}" is not a 3D model clip.` }
      }
      const rig = { ...clip.modelRig }
      if (args.mode != null) rig.mode = String(args.mode) as CameraMode
      if (args.azimuthStart != null) rig.azimuthStart = Number(args.azimuthStart)
      if (args.azimuthEnd != null) rig.azimuthEnd = Number(args.azimuthEnd)
      if (args.elevation != null) {
        rig.elevationStart = Number(args.elevation)
        rig.elevationEnd = Number(args.elevation)
      }
      if (args.radius != null) {
        rig.radiusStart = Number(args.radius)
        rig.radiusEnd = Number(args.radius)
      }
      if (args.fov != null) rig.fov = Number(args.fov)
      if (args.pan != null) rig.pan = Number(args.pan)
      s.updateClip(clip.id, { modelRig: clampRig(rig) })
      return { ok: true, message: desc }
    }
    case 'generate_script': {
      const topic = String(args.topic ?? '')
      const language = String(args.language ?? '') || undefined
      try {
        const script = await generateScript({
          topic,
          durationSeconds: args.durationSeconds != null ? Number(args.durationSeconds) : undefined,
          language,
        })
        useScriptStore.getState().setScript(script)
        return { ok: true, message: `${desc} — ${describeScript(script)}` }
      } catch (err) {
        return { ok: false, message: `Script generation failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'rewrite_script': {
      return applyScriptEdit(async (current) => {
        const script = await rewriteScript(String(args.instruction ?? ''), current)
        return { script, message: `${desc} — ${describeScript(script)}` }
      })
    }
    case 'shorten_script': {
      return applyScriptEdit(async (current) => {
        const script = await shortenScript(current, Number(args.targetDurationSeconds))
        return { script, message: `${desc} — ${describeScript(script)}` }
      })
    }
    case 'expand_script': {
      return applyScriptEdit(async (current) => {
        const script = await expandScript(current, Number(args.targetDurationSeconds))
        return { script, message: `${desc} — ${describeScript(script)}` }
      })
    }
    case 'script_hook': {
      return applyScriptEdit(async (current) => {
        const script = await makeHook(current, args.instruction != null ? String(args.instruction) : undefined)
        return { script, message: `${desc} — new hook: "${script.hook}"` }
      })
    }
    case 'script_cta': {
      return applyScriptEdit(async (current) => {
        const script = await makeCta(current, args.instruction != null ? String(args.instruction) : undefined)
        return { script, message: `${desc} — new CTA: "${script.cta}"` }
      })
    }
    case 'understand_video': {
      const count = await analyzeProject()
      return { ok: true, message: count ? `Full understanding ready for ${count} clip${count > 1 ? 's' : ''} (transcripts, scene breakdown, on-screen text).` : 'No clips with audio to transcribe.' }
    }
    case 'check_quality': {
      const s = useTimelineStore.getState()
      const scenes = await collectTimelineScenes()
      const issues = checkTimeline(s.project, s.assets, { scenes })
      if (!issues.length) return { ok: true, message: 'Quality check passed — the timeline looks clean.' }
      const lines = issues.map((i) => {
        const action = i.fix.kind !== 'none' ? ` (${i.fix.label})` : ''
        return `- [${i.severity}] ${i.message}${action}`
      })
      return { ok: true, message: `Quality check found ${issues.length} issue${issues.length > 1 ? 's' : ''}:\n${lines.join('\n')}` }
    }
    case 'web_research': {
      const url = String(args.url ?? '').trim()
      const query = String(args.query ?? '').trim()
      try {
        if (url) {
          const page = await firecrawlScrape(url)
          const body = (page.markdown ?? '').slice(0, 2500)
          return { ok: true, message: `Research from ${url}\nTitle: ${page.title}\n\n${body}${(page.markdown ?? '').length > 2500 ? '\n…(truncated)' : ''}` }
        }
        if (!query) return { ok: false, message: 'Provide a query or url for web research.' }
        const results = await firecrawlSearch(query)
        if (!results.length) return { ok: true, message: `No web results found for "${query}".` }
        const lines = results.map((r, i) => {
          const snippet = (r.markdown ?? r.description ?? '').replace(/\s+/g, ' ').slice(0, 400)
          return `${i + 1}. ${r.title || r.url}\n   ${snippet}`
        })
        return { ok: true, message: `Web research for "${query}":\n${lines.join('\n')}` }
      } catch (err) {
        return { ok: false, message: `Web research failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'add_caption': {
      const clipName = String(args.clipName ?? '').trim()
      let targetClip: Clip | null = null
      for (const t of s.project.tracks) {
        for (const c of t.clips) {
          const asset = s.assets.find((a) => a.id === c.assetId)
          if (!asset || asset.type === 'image') continue
          if (!clipName || c.name.toLowerCase().includes(clipName.toLowerCase())) {
            targetClip = c
            break
          }
        }
        if (targetClip) break
      }
      if (!targetClip) {
        return { ok: false, message: clipName ? `No clip with audio named "${clipName}".` : 'No clip with audio found to caption.' }
      }
      const asset = s.assets.find((a) => a.id === targetClip!.assetId)
      if (!asset) return { ok: false, message: 'Clip asset not found.' }
      let transcript: StoredTranscript | null | undefined = await getStoredTranscript(asset.id).catch(() => undefined)
      if (!transcript) {
        transcript = await transcribeAsset(asset)
      }
      if (!transcript) {
        return { ok: false, message: `Could not transcribe "${targetClip.name}" (audio may be silent or the model could not load).` }
      }
      const next = useTimelineStore.getState()
      if (!next.project.captions?.enabled) next.setCaptions({ enabled: true })
      return { ok: true, message: `${desc} — captions enabled for "${targetClip.name}"` }
    }
    case 'generate_motion_graphics': {
      const concept = String(args.concept ?? '')
      if (!concept.trim()) return { ok: false, message: 'No concept provided for motion graphics.' }
      const durationSeconds = Math.max(1, Number(args.durationSeconds) || 8)
      const style = args.style != null ? String(args.style) : undefined
      const language = args.language != null ? String(args.language) : undefined
      const transparent = args.transparent === true
      const is1080 = String(args.resolution ?? '720p') === '1080p'
      try {
        const { code } = await generateMotionCode({ concept, durationSeconds, style, language, transparent })
        const width = is1080 ? 1920 : 1280
        const height = is1080 ? 1080 : 720
        const rendered = await renderMotionClip({ code, width, height, fps: 30, duration: durationSeconds })
        const file = new File([rendered.blob], `motion-${Date.now()}.webm`, { type: 'video/webm' })
        const imported = await s.importFiles([file])
        const asset = imported.imported[0]
        if (!asset) return { ok: false, message: 'Rendered animation could not be imported.' }
        const videoTrack = s.project.tracks.find((t) => t.type === 'video')
        if (!videoTrack) return { ok: false, message: 'No video track available.' }
        const clip = s.addClip(asset.id, videoTrack.id)
        if (clip) s.updateClip(clip.id, { duration: durationSeconds, sourceEnd: durationSeconds })
        return {
          ok: true,
          message: `${desc} — rendered ${rendered.frames} frames at ${width}x${height} and added "${asset.name}" to the timeline.`,
        }
      } catch (err) {
        return { ok: false, message: `Motion graphics generation failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'generate_slides': {
      const topic = String(args.topic ?? '')
      if (!topic.trim()) return { ok: false, message: 'No topic provided for slides.' }
      const count = args.count != null ? Number(args.count) : undefined
      const rawTheme = String(args.theme ?? 'gaia')
      const themeMap: Record<string, MarpTheme> = {
        gaia: 'gaia',
        cyber: 'cyber',
        sunset: 'sunset',
        uncover: 'uncover',
        default: 'default',
        clean: 'default',
        dark: 'gaia',
        gradient: 'sunset',
      }
      const marpTheme = themeMap[rawTheme] ?? 'gaia'
      const language = args.language != null ? String(args.language) : undefined
      const perSlide = Math.max(1, Number(args.durationSeconds) || 5)
      try {
        const deck = await generateMarpSlides({ topic, count, language, theme: marpTheme })
        if (!deck.pngs.length) return { ok: false, message: 'Slide generation returned no slides.' }
        const files: File[] = deck.pngs.map(
          (png, i) => new File([png], `slide-${i + 1}-${Date.now()}.png`, { type: 'image/png' }),
        )
        const imported = await s.importFiles(files)
        const assets = imported.imported
        const videoTrack = s.project.tracks.find((t) => t.type === 'video')
        if (!videoTrack) return { ok: false, message: 'No video track available.' }
        for (const asset of assets) {
          const clip = s.addClip(asset.id, videoTrack.id)
          if (clip) s.updateClip(clip.id, { duration: perSlide, sourceEnd: perSlide })
        }
        return { ok: true, message: `${desc} — rendered ${assets.length} Marp slides ("${deck.title}", ${marpTheme} theme) onto the timeline.` }
      } catch (err) {
        return { ok: false, message: `Slide generation failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'generate_avatar_intro':
    case 'generate_avatar_outro':
    case 'generate_avatar_presenter':
    case 'generate_avatar_narrator': {
      const toolName = name
      const role = toolName.replace('generate_avatar_', '') as AvatarRole
      const topic = String(args.topic ?? args.script ?? args.text ?? 'Introduction')
      const scriptText = args.scriptText != null ? String(args.scriptText) : args.script != null ? String(args.script) : undefined
      const durationSeconds = Math.max(1, Number(args.durationSeconds) || (role === 'intro' ? 8 : role === 'outro' ? 6 : role === 'presenter' ? 12 : 15))
      const language = args.language != null ? String(args.language) : undefined
      const presetId = args.presetId != null ? String(args.presetId) : undefined
      const style = args.style as import('@/engine/avatar/lipsync').LipsyncStyle | undefined
      try {
        const { generateAvatarVideo } = await import('@/api/llm/avatarGenerator')
        const result = await generateAvatarVideo({ role, topic, scriptText, durationSeconds, language, presetId, style })
        const file = new File([result.videoBlob], `avatar-${role}-${Date.now()}.webm`, { type: 'video/webm' })
        const imported = await s.importFiles([file])
        const asset = imported.imported[0]
        if (!asset) return { ok: false, message: 'Avatar video could not be imported.' }
        const videoTrack = s.project.tracks.find((t) => t.type === 'video')
        if (!videoTrack) return { ok: false, message: 'No video track available.' }
        let insertTime = 0
        if (role === 'intro') {
          insertTime = 0
        } else if (role === 'outro') {
          const lastClip = s.project.tracks.flatMap((t) => t.clips).sort((a, b) => b.startTime - a.startTime)[0]
          insertTime = lastClip ? lastClip.startTime + lastClip.duration : 0
        } else {
          insertTime = s.playhead ?? 0
        }
        const newClip = s.addClip(asset.id, videoTrack.id, insertTime)
        if (newClip) {
          s.updateClip(newClip.id, {
            duration: result.duration,
            sourceEnd: result.duration,
            avatarRole: role,
            clipType: 'avatar',
            autoLipsync: true,
          })
        }
        return { ok: true, message: `${desc} — generated ${role} avatar (${result.duration.toFixed(1)}s) with babble lip-sync and inserted at ${insertTime.toFixed(1)}s.` }
      } catch (err) {
        return { ok: false, message: `Avatar ${role} generation failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'smart_reframe': {
      const assetName = String(args.assetName ?? '')
      if (!assetName.trim()) return { ok: false, message: 'No clip name provided for smart reframe.' }
      const targetAspect = String(args.targetAspect ?? '9:16')
      const followStrength = Math.max(0, Math.min(1, Number(args.followStrength) || 0.8))
      const margin = Math.max(0, Math.min(1, Number(args.margin) || 0.15))
      const smoothing = Math.max(0, Math.min(1, Number(args.smoothing) || 0.15))
      try {
        const clip = findClip(assetName)
        if (!clip) return { ok: false, message: `Clip "${assetName}" not found.` }
        const asset = s.assets.find((a) => a.id === clip.assetId)
        if (!asset || asset.type !== 'video') return { ok: false, message: 'Smart reframe only works on video clips.' }
        // Compute crop keyframes by analyzing the video
        const keyframes = await computeReframingKeyframes({ filePath: asset.filePath, duration: asset.duration ?? 0 }, targetAspect, { targetAspect, followStrength, margin, smoothing: 1 - smoothing })
        s.updateClip(clip.id, { reframing: { enabled: true, targetAspect, followStrength, margin, smoothing, keyframes } })
        return { ok: true, message: `${desc} — computed ${keyframes.length} crop keyframes for "${assetName}" reframe to ${targetAspect}.` }
      } catch (err) {
        return { ok: false, message: `Smart reframe failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'remove_background': {
      const assetName = String(args.assetName ?? '')
      if (!assetName.trim()) return { ok: false, message: 'No clip name provided for background removal.' }
      const backgroundTypeRaw = String(args.backgroundType ?? 'transparent')
      const backgroundType = (['transparent', 'blur', 'color', 'image'] as const).includes(backgroundTypeRaw as any)
        ? backgroundTypeRaw as 'transparent' | 'blur' | 'color' | 'image'
        : 'transparent'
      const backgroundColor = args.backgroundColor != null ? String(args.backgroundColor) : undefined
      const backgroundBlur = Math.max(0, Number(args.backgroundBlur) || 20)
      const backgroundImageUrl = args.backgroundImageUrl != null ? String(args.backgroundImageUrl) : undefined
      try {
        const clip = findClip(assetName)
        if (!clip) return { ok: false, message: `Clip "${assetName}" not found.` }
        const asset = s.assets.find((a) => a.id === clip.assetId)
        if (!asset || asset.type !== 'video') return { ok: false, message: 'Background removal only works on video clips.' }
      // Process background removal using engine directly
      const { BackgroundRemovalEngine } = await import('@/engine/background-removal')
      const engine = new BackgroundRemovalEngine({ modelUrl: '/models/modnet.onnx', inputSize: [512, 512] })
      await engine.initialize()
      const frames = await extractFramesFromAsset(asset)
      const resultFrames = await engine.process(frames, backgroundType, backgroundColor ?? backgroundImageUrl, backgroundBlur)
      const outputBlob = await renderFramesToVideo(resultFrames, 30)
      const file = new File([outputBlob], `bg-removed-${Date.now()}.webm`, { type: 'video/webm' })
      const imported = await s.importFiles([file])
      const newAsset = imported.imported[0]
      if (!newAsset) return { ok: false, message: 'Processed video could not be imported.' }
      const videoTrack = s.project.tracks.find((t) => t.type === 'video')
      if (!videoTrack) return { ok: false, message: 'No video track available.' }
      const newClip = s.addClip(newAsset.id, videoTrack.id, clip.startTime)
      if (newClip) s.updateClip(newClip.id, { duration: frames.length / 30, sourceEnd: frames.length / 30 })
      return { ok: true, message: `${desc} — removed background from "${assetName}" (${backgroundType}).` }
      } catch (err) {
        return { ok: false, message: `Background removal failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
    case 'ask_user': {
      const question = String(args.question ?? '').trim()
      if (!question) return { ok: false, message: 'Missing question.' }
      return { ok: true, message: `Question for the user: ${question}` }
    }
    case 'review_project': {
      const review = useTimelineStore.getState()
      const scenes = await collectTimelineScenes()
      const issues = checkTimeline(review.project, review.assets, { scenes })
      if (!issues.length) return { ok: true, message: 'The project looks clean — no improvements needed right now.' }
      const lines = issues.map((i) => {
        const action = i.fix.kind !== 'none' ? ` (${i.fix.label})` : ''
        return `- [${i.severity}] ${i.message}${action}`
      })
      return { ok: true, message: `${issues.length} improvement${issues.length > 1 ? 's' : ''} found:\n${lines.join('\n')}` }
    }
    case 'analyze_video': {
      const count = await analyzeProject()
      return { ok: true, message: count ? `Analysis ready for ${count} clip${count > 1 ? 's' : ''} (transcript, scenes, OCR).` : 'No clips to analyze.' }
    }
    case 'render_preview': {
      const { project, assets } = useTimelineStore.getState()
      const name = String(args.name || 'clipforge-render').replace(/\.webm$/i, '')
      const { blob, frames } = await exportProject(project, assets, {
        width: project.width,
        height: project.height,
        fps: project.fps,
        bitrate: 8_000_000,
        codec: 'vp9',
        onProgress: () => {},
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.webm`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      return { ok: true, message: `${desc} (${(blob.size / 1024 / 1024).toFixed(1)} MB, ${frames} frames)` }
    }
    default:
      return { ok: false, message: `Unknown action "${name}".` }
  }
}

async function extractFramesFromAsset(asset: Asset): Promise<ImageData[]> {
  const { readMediaFile } = await import('@/engine/storage/opfs')
  const blob = await readMediaFile(asset.filePath)
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'
  video.src = url
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video'))
    setTimeout(() => reject(new Error('Video load timeout')), 10000)
  })
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')!
  const frames: ImageData[] = []
  const duration = video.duration
  const frameCount = Math.floor(duration * 30)
  const step = duration / frameCount
  for (let i = 0; i < frameCount; i++) {
    video.currentTime = i * step
    await new Promise<void>((resolve) => {
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0)
        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
        video.onseeked = null
        resolve()
      }
    })
  }
  URL.revokeObjectURL(url)
  return frames
}
