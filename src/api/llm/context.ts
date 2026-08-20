import { useTimelineStore } from '@/stores/timelineStore'
import { getStoredScenes, getStoredTranscript } from '@/api/llm/understanding'
import type { StoryScene } from '@/ai/quality/checker'

/**
 * Trim a transcript to roughly `maxChars`, cutting at a sentence/word boundary
 * so the AI gets the gist without burning tokens.
 */
export function compressTranscript(text: string, maxChars = 600): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  const cut = trimmed.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  const boundary = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${boundary.trimEnd()}…`
}

/**
 * Gather timeline-relative scene structure from the local analysis cache.
 * Scene times are mapped from asset time into clip timeline time.
 */
export async function collectTimelineScenes(): Promise<StoryScene[]> {
  const { project, assets } = useTimelineStore.getState()
  const out: StoryScene[] = []
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const asset = assets.find((a) => a.id === clip.assetId)
      if (!asset || asset.type !== 'video') continue
      const stored = await getStoredScenes(asset.id).catch(() => undefined)
      if (!stored) continue
      for (const sc of stored.scenes) {
        const start = Math.max(clip.startTime, clip.startTime + sc.start)
        const end = Math.min(clip.startTime + clip.duration, clip.startTime + sc.end)
        if (end <= start) continue
        out.push({ start, end, summary: sc.summary, keywords: sc.keywords, importance: sc.importance })
      }
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/**
 * Build a compressed, scene-level understanding of the whole project. When
 * scenes exist they replace the raw transcript (they already carry the gist
 * plus keywords); otherwise a truncated transcript is used. Keeps the context
 * window small while preserving the meaning the AI needs to edit confidently.
 */
export async function buildDirectorContext(): Promise<string> {
  const { project, assets } = useTimelineStore.getState()
  const lines: string[] = []

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const asset = assets.find((a) => a.id === clip.assetId)
      if (!asset || asset.type === 'image') continue
      const [transcript, scenes] = await Promise.all([
        getStoredTranscript(asset.id).catch(() => undefined),
        getStoredScenes(asset.id).catch(() => undefined),
      ])
      const range = `${clip.startTime.toFixed(1)}s–${(clip.startTime + clip.duration).toFixed(1)}s`
      if (scenes && scenes.scenes.length) {
        lines.push(`- Clip "${clip.name}" (${range}):`)
        for (const sc of scenes.scenes) {
          const kw = sc.keywords.length ? ` keywords: ${sc.keywords.join(', ')}` : ''
          lines.push(
            `  - Scene ${sc.id} [${sc.start.toFixed(1)}s–${sc.end.toFixed(1)}s] (importance ${sc.importance.toFixed(2)}): "${sc.summary}"${kw}`,
          )
        }
      } else if (transcript) {
        lines.push(`- Clip "${clip.name}" (${range}): "${compressTranscript(transcript.text)}"`)
      } else {
        lines.push(`- Clip "${clip.name}" (${range}): (not analyzed yet — run Analyze or ask for captions)`)
      }
    }
  }

  const text = lines.join('\n')
  if (!text) {
    return 'The project currently has no audio/video clips with understanding yet.'
  }
  return (
    'VIDEO UNDERSTANDING (compressed, from local analysis — trust it):\n' +
    text +
    '\nUse this to understand what the video actually says before making editing decisions.'
  )
}