import { useTimelineStore } from '@/stores/timelineStore'
import { getStoredScenes } from '@/api/llm/understanding'
import type { StoryScene } from '@/ai/quality/checker'
import { aiContextManager } from '@/ai/context/AIContextManager'

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
 * Build a comprehensive, multimodal understanding of the whole project
 * backed by IndexedDB knowledge caching (Timeline Layout, Audio Transcripts,
 * Frame-by-Frame OCR Text, Scene Understanding & Health Diagnostics).
 */
export async function buildDirectorContext(): Promise<string> {
  try {
    const comp = await aiContextManager.getComprehensiveContext()

    const sections: string[] = [
      'TIMELINE & MULTIMODAL VIDEO UNDERSTANDING (IndexedDB Knowledge Graph):',
      comp.timelineManifest,
      '\nSPOKEN AUDIO TRANSCRIPTS & DIALOGUE:\n' + comp.speechTranscriptsSummary,
      '\nFRAME-BY-FRAME ON-SCREEN VISUAL TEXT (OCR):\n' + comp.ocrOnScreenTextSummary,
      '\nVISUAL SCENES & ATMOSPHERE:\n' + comp.scenesVisualSummary,
    ]

    if (comp.healthReport.recommendations.length > 0) {
      sections.push(
        '\nTIMELINE EDITING HEALTH & DIAGNOSTICS:\n' +
          comp.healthReport.recommendations.map((r) => `  * ${r}`).join('\n'),
      )
    }

    sections.push(
      '\n' + comp.editingKnowledge +
      '\n\nUse this complete project layout and multimodal knowledge to make precise, professional editing decisions.',
    )

    return sections.join('\n')
  } catch (err) {
    console.warn('[buildDirectorContext] IndexedDB query failed, fallback to basic manifest:', err)
    const { project } = useTimelineStore.getState()
    return `PROJECT TIMELINE: "${project.name}" (${project.width}x${project.height}, ${project.tracks.length} tracks).`
  }
}