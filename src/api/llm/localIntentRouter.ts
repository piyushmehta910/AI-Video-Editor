import { useTimelineStore } from '@/stores/timelineStore'
import { applyTool, type ToolResult } from './tools'

export interface LocalIntentMatch {
  matched: boolean
  toolName?: string
  toolArgs?: Record<string, unknown>
  explanation?: string
}

/**
 * Finds the most relevant clip for an ambiguous command.
 * Prefers the currently selected clip, then the clip at the playhead, then the first clip.
 */
function resolveTargetClip(nameOrQuery?: string): { name: string; trackId: string } | null {
  const { project, selection, playhead } = useTimelineStore.getState()
  const allClips = project.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, trackName: t.name })))
  if (allClips.length === 0) return null

  if (nameOrQuery && nameOrQuery.trim()) {
    const q = nameOrQuery.trim().toLowerCase()
    const found = allClips.find(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase() === q,
    )
    if (found) return { name: found.name, trackId: found.trackId }
  }

  // Check selection
  if (selection.clipIds.length > 0) {
    const selected = allClips.find((c) => selection.clipIds.includes(c.id))
    if (selected) return { name: selected.name, trackId: selected.trackId }
  }

  // Check clip under playhead
  const underPlayhead = allClips.find(
    (c) => playhead >= c.startTime && playhead <= c.startTime + c.duration,
  )
  if (underPlayhead) return { name: underPlayhead.name, trackId: underPlayhead.trackId }

  // Default to first visual clip or first clip
  const firstVideo = allClips.find((c) => c.trackName.toLowerCase().includes('video')) || allClips[0]
  return { name: firstVideo.name, trackId: firstVideo.trackId }
}

/**
 * Parses conversational natural-language commands for immediate client-side execution
 * with zero LLM API dependency and 0ms latency.
 */
export function parseLocalIntent(prompt: string): LocalIntentMatch {
  const text = prompt.trim().toLowerCase()

  // 1. Split commands: "split clip at 5s", "split at 3.5 seconds", "split here", "cut at playhead"
  const splitMatch = text.match(/\b(?:split|cut|slice)\b(?:\s+(?:the\s+)?(?:clip|video|audio))?(?:\s+(?:at|on)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)?)?(?:\s+(?:at\s+)?(playhead|here))?/i)
  if (splitMatch) {
    const timeStr = splitMatch[1]
    const isHere = Boolean(splitMatch[2]) || text.includes('here') || text.includes('playhead')
    const { playhead } = useTimelineStore.getState()
    const timeSeconds = timeStr ? parseFloat(timeStr) : isHere ? playhead : undefined

    const target = resolveTargetClip()
    if (target) {
      return {
        matched: true,
        toolName: 'split_clip',
        toolArgs: {
          assetName: target.name,
          timeSeconds: timeSeconds ?? playhead,
        },
        explanation: `Splitting "${target.name}" at ${(timeSeconds ?? playhead).toFixed(2)}s`,
      }
    }
  }

  // 2. Delete / Remove clip: "delete clip", "remove selected clip", "delete this"
  if (/\b(?:delete|remove|drop)\b\s+(?:the\s+)?(?:this\s+clip|selected\s+clip|current\s+clip|clip)\b/i.test(text)) {
    const target = resolveTargetClip()
    if (target) {
      return {
        matched: true,
        toolName: 'delete_clip',
        toolArgs: { assetName: target.name },
        explanation: `Deleting clip "${target.name}" from timeline`,
      }
    }
  }

  // 3. Aspect ratio / Reframe: "change ratio to 9:16", "reframe to vertical", "make 16:9", "make square"
  if (/\b(?:reframe|aspect\s+ratio|ratio|format|canvas)\b/i.test(text) || /\b(?:16:9|9:16|1:1|4:5|21:9)\b/.test(text)) {
    let aspect: '16:9' | '9:16' | '1:1' | '4:5' | '21:9' | null = null
    if (text.includes('9:16') || text.includes('vertical') || text.includes('reels') || text.includes('tiktok') || text.includes('shorts')) aspect = '9:16'
    else if (text.includes('16:9') || text.includes('horizontal') || text.includes('landscape') || text.includes('youtube')) aspect = '16:9'
    else if (text.includes('1:1') || text.includes('square') || text.includes('instagram post')) aspect = '1:1'
    else if (text.includes('4:5')) aspect = '4:5'
    else if (text.includes('21:9') || text.includes('ultrawide') || text.includes('cinematic wide')) aspect = '21:9'

    if (aspect) {
      return {
        matched: true,
        toolName: 'set_project_ratio',
        toolArgs: { aspect },
        explanation: `Setting project aspect ratio to ${aspect}`,
      }
    }
  }

  // 4. Silence removal: "remove silent parts", "cut silence", "delete pauses", "cut dead air"
  if (/\b(?:silence|silent\s+parts|dead\s+air|pauses)\b/i.test(text) && /\b(?:remove|cut|delete|trim)\b/i.test(text)) {
    return {
      matched: true,
      toolName: 'auto_remove_silence',
      toolArgs: { minDurationSeconds: 1.0 },
      explanation: 'Removing silent gaps longer than 1.0s across all timeline clips',
    }
  }

  // 5. Volume adjustments: "mute track", "mute audio", "make louder", "set volume to 80%"
  if (/\b(?:mute|unmute)\b/i.test(text)) {
    const target = resolveTargetClip()
    if (target) {
      const isMute = !text.includes('unmute')
      return {
        matched: true,
        toolName: 'adjust_clip_property',
        toolArgs: { assetName: target.name, property: 'volume', value: isMute ? 0 : 1 },
        explanation: `${isMute ? 'Muting' : 'Unmuting'} audio on "${target.name}"`,
      }
    }
  }

  const volMatch = text.match(/\b(?:set\s+)?volume\s+(?:to\s+)?(\d+)%/i)
  if (volMatch) {
    const pct = parseInt(volMatch[1], 10)
    const val = Math.max(0, Math.min(2, pct / 100))
    const target = resolveTargetClip()
    if (target) {
      return {
        matched: true,
        toolName: 'adjust_clip_property',
        toolArgs: { assetName: target.name, property: 'volume', value: val },
        explanation: `Setting volume of "${target.name}" to ${pct}%`,
      }
    }
  }

  // 5. Speed adjustments: "speed up to 2x", "slow down to 0.5x", "set speed to 1.5x"
  const speedMatch = text.match(/\b(?:speed\s*(?:up)?|playback\s*speed)\s*(?:to\s*)?(\d+(?:\.\d+)?)\s*x?\b/i)
  if (speedMatch) {
    const speedVal = parseFloat(speedMatch[1])
    if (speedVal >= 0.25 && speedVal <= 4) {
      const target = resolveTargetClip()
      if (target) {
        return {
          matched: true,
          toolName: 'adjust_clip_property',
          toolArgs: { assetName: target.name, property: 'speed', value: speedVal },
          explanation: `Setting playback speed of "${target.name}" to ${speedVal}x`,
        }
      }
    }
  }

  // 6. Quality audit: "check quality", "audit timeline", "find issues"
  if (/\b(?:check\s+quality|audit|quality\s+review|timeline\s+check|find\s+issues)\b/i.test(text)) {
    return {
      matched: true,
      toolName: 'check_quality',
      toolArgs: {},
      explanation: 'Auditing timeline for pacing, silence gaps, and audio balance',
    }
  }

  // 8. Color grading: "teal and orange", "vintage look", "cyberpunk grade", "cinematic colors"
  if (/\b(?:color\s+grade|grade|cinematic\s+color|filter)\b/i.test(text)) {
    let preset = 'teal_orange'
    if (text.includes('vintage') || text.includes('retro')) preset = 'vintage'
    else if (text.includes('noir') || text.includes('black and white') || text.includes('monochrome')) preset = 'noir'
    else if (text.includes('cyberpunk') || text.includes('neon')) preset = 'cyberpunk'
    else if (text.includes('warm')) preset = 'warm'
    else if (text.includes('cool')) preset = 'cool'

    return {
      matched: true,
      toolName: 'color_grade_preset',
      toolArgs: { preset },
      explanation: `Applying ${preset.replace('_', ' ')} color grade preset to all clips`,
    }
  }

  // 9. Add caption or title: "add caption [text]", "add title [text]"
  const captionMatch = text.match(/\b(?:add|create)\s+(?:a\s+)?(?:caption|subtitle|title|text)\s+(?:saying|with text)?\s*["']?([^"']+)["']?$/i)
  if (captionMatch && captionMatch[1].trim().length > 0) {
    const rawText = captionMatch[1].trim()
    return {
      matched: true,
      toolName: 'add_caption',
      toolArgs: { text: rawText, style: 'karaoke' },
      explanation: `Adding text overlay: "${rawText}"`,
    }
  }

  return { matched: false }
}

/**
 * Tries to parse and execute a local intent directly.
 * Returns ToolResult if matched and executed, or null if no local intent matched.
 */
export async function matchAndExecuteLocalIntent(prompt: string): Promise<ToolResult | null> {
  const match = parseLocalIntent(prompt)
  if (!match.matched || !match.toolName) return null
  return await applyTool(match.toolName, match.toolArgs ?? {}, { undoStep: true })
}
