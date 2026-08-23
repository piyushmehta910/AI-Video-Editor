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

  lines.push(`PROJECT SETTINGS: Resolution ${project.width}x${project.height} (${project.aspectRatio}), FPS: ${project.fps}`)

  for (const track of project.tracks) {
    if (!track.clips.length) continue
    lines.push(`\nTRACK [${track.type.toUpperCase()}] "${track.name}" (${track.clips.length} clips):`)

    for (const clip of track.clips) {
      const asset = assets.find((a) => a.id === clip.assetId)
      const range = `${clip.startTime.toFixed(1)}s–${(clip.startTime + clip.duration).toFixed(1)}s`
      const props: string[] = []
      if (clip.speed !== 1) props.push(`speed: ${clip.speed.toFixed(2)}x`)
      if (clip.volume !== 1) props.push(`volume: ${Math.round(clip.volume * 100)}%`)
      if (clip.muted) props.push('muted')
      if (clip.position && (clip.position.x !== 0 || clip.position.y !== 0)) {
        props.push(`pos: (${clip.position.x}, ${clip.position.y})`)
      }
      if (clip.scale && (clip.scale.x !== 1 || clip.scale.y !== 1)) {
        props.push(`scale: (${clip.scale.x.toFixed(2)}, ${clip.scale.y.toFixed(2)})`)
      }
      const propStr = props.length ? ` [${props.join(', ')}]` : ''

      if (clip.text) {
        lines.push(`  - Text/Caption "${clip.text.text.slice(0, 30)}" (${range})${propStr}`)
        continue
      }

      if (!asset || asset.type === 'image') {
        lines.push(`  - Clip "${clip.name}" (${range})${propStr}`)
        continue
      }

      const [transcript, scenes] = await Promise.all([
        getStoredTranscript(asset.id).catch(() => undefined),
        getStoredScenes(asset.id).catch(() => undefined),
      ])

      if (scenes && scenes.scenes.length) {
        lines.push(`  - Clip "${clip.name}" (${range})${propStr}:`)
        for (const sc of scenes.scenes) {
          const kw = sc.keywords.length ? ` keywords: ${sc.keywords.join(', ')}` : ''
          lines.push(
            `    - Scene ${sc.id} [${sc.start.toFixed(1)}s–${sc.end.toFixed(1)}s] (importance ${sc.importance.toFixed(2)}): "${sc.summary}"${kw}`,
          )
        }
      } else if (transcript) {
        lines.push(`  - Clip "${clip.name}" (${range})${propStr}: "${compressTranscript(transcript.text)}"`)
      } else {
        lines.push(`  - Clip "${clip.name}" (${range})${propStr}: (not analyzed yet)`)
      }
    }
  }

  const text = lines.join('\n')
  return (
    'TIMELINE & VIDEO UNDERSTANDING (from local project analysis — trust it):\n' +
    text +
    '\n\nUse this complete project layout to make precise editing, placement, speed, volume, and styling decisions.'
  )
}