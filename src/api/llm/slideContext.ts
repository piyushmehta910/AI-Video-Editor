import { useTimelineStore } from '@/stores/timelineStore'
import { getStoredScenes, getStoredTranscript } from '@/api/llm/understanding'
import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import type { MarpTheme } from './marp'

export interface InductiveSlideContext {
  topicThesis: string
  targetAudience: string
  tone: 'professional' | 'educational' | 'high-energy' | 'storytelling' | 'executive'
  recommendedSlideCount: number
  recommendedTheme: MarpTheme
  narrativePillars: Array<{ pillar: string; evidence: string }>
  slideOutline: Array<{ title: string; purpose: string; suggestedVisual: string }>
  timelineSyncSeconds: number[]
}

export interface SavedSlideDeck {
  id: string
  title: string
  topic: string
  theme: MarpTheme
  markdown: string
  slideCount: number
  timestamp: number
}

const SLIDE_DECKS_STORAGE_KEY = 'clipforge_slide_decks_history'
let inMemorySlideDecks: SavedSlideDeck[] = []

export function getSavedSlideDecks(): SavedSlideDeck[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SLIDE_DECKS_STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    }
  } catch {
    // fallback
  }
  return inMemorySlideDecks
}

export function saveSlideDeckToStorage(deck: Omit<SavedSlideDeck, 'id' | 'timestamp'>): SavedSlideDeck {
  const item: SavedSlideDeck = {
    ...deck,
    id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  }
  try {
    const existing = getSavedSlideDecks()
    const updated = [item, ...existing.filter((d) => d.markdown !== deck.markdown)].slice(0, 25)
    inMemorySlideDecks = updated
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SLIDE_DECKS_STORAGE_KEY, JSON.stringify(updated))
    }
  } catch {
    // ignore
  }
  return item
}

/**
 * Gather raw timeline context and evidence for inductive reasoning.
 */
export async function extractProjectObservations(): Promise<{
  totalDuration: number
  clipCount: number
  transcripts: string[]
  sceneSummaries: string[]
  keywords: string[]
}> {
  const { project, assets } = useTimelineStore.getState()
  const transcripts: string[] = []
  const sceneSummaries: string[] = []
  const keywordsSet = new Set<string>()

  let totalDuration = 0
  let clipCount = 0

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      clipCount++
      const end = clip.startTime + clip.duration
      if (end > totalDuration) totalDuration = end

      const asset = assets.find((a) => a.id === clip.assetId)
      if (!asset) continue

      const [tr, sc] = await Promise.all([
        getStoredTranscript(asset.id).catch(() => undefined),
        getStoredScenes(asset.id).catch(() => undefined),
      ])

      if (tr?.text) transcripts.push(tr.text)
      if (sc?.scenes) {
        for (const s of sc.scenes) {
          if (s.summary) sceneSummaries.push(s.summary)
          s.keywords?.forEach((k) => keywordsSet.add(k))
        }
      }
    }
  }

  return {
    totalDuration,
    clipCount,
    transcripts,
    sceneSummaries,
    keywords: Array.from(keywordsSet).slice(0, 30),
  }
}

/**
 * Synthesize an inductive slide deck plan from timeline observations.
 */
export async function generateInductiveSlideContext(topicPrompt?: string): Promise<InductiveSlideContext> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')

  const obs = await extractProjectObservations()

  const observationSummary = `
Project Timeline Observations:
- Total Project Duration: ${obs.totalDuration.toFixed(1)} seconds (${Math.round(obs.totalDuration / 60)} mins)
- Total Clips: ${obs.clipCount}
- Key Topics / Keywords: ${obs.keywords.join(', ') || '(none detected yet)'}
- Spoken Audio Transcripts: ${obs.transcripts.join(' ') || '(no spoken voiceover yet)'}
- Visual Scene Summaries: ${obs.sceneSummaries.join('; ') || '(no visual scenes analyzed yet)'}
User Prompt: "${topicPrompt || 'Synthesize presentation deck matching current project video'}"
`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are an expert Presentation Strategist specializing in Inductive Reasoning.
Your task is to analyze specific observations (transcripts, scene summaries, clip pacing) and infer:
1. Core Thesis / Main Idea (induced from evidence)
2. Target Audience & Tone
3. Optimal Slide Count (calculated from duration / narrative density, usually 3-7 slides)
4. Recommended Marp Theme ('gaia' for dark/tech/sleek, 'default' for clean light business, 'uncover' for bold editorial, 'gradient' for creative)
5. 3-5 Narrative Pillars with supporting evidence
6. Structured Slide Outline with slide titles, purpose, and visual cues.

Output strictly valid JSON with this shape:
{
  "topicThesis": "...",
  "targetAudience": "...",
  "tone": "professional" | "educational" | "high-energy" | "storytelling" | "executive",
  "recommendedSlideCount": 5,
  "recommendedTheme": "gaia",
  "narrativePillars": [
    { "pillar": "...", "evidence": "..." }
  ],
  "slideOutline": [
    { "title": "...", "purpose": "...", "suggestedVisual": "..." }
  ],
  "timelineSyncSeconds": [0, 8, 16, 24, 32]
}`,
    },
    { role: 'user', content: observationSummary },
  ]

  const reply = await chatCompletion(provider, messages)
  const content = reply.content ?? ''

  try {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      const parsed = JSON.parse(content.slice(start, end + 1))
      return {
        topicThesis: String(parsed.topicThesis || topicPrompt || 'Project Presentation'),
        targetAudience: String(parsed.targetAudience || 'General Audience'),
        tone: parsed.tone || 'professional',
        recommendedSlideCount: Math.max(2, Math.min(10, Number(parsed.recommendedSlideCount) || 5)),
        recommendedTheme: ['gaia', 'default', 'uncover', 'gradient', 'dark'].includes(parsed.recommendedTheme)
          ? parsed.recommendedTheme
          : 'gaia',
        narrativePillars: Array.isArray(parsed.narrativePillars) ? parsed.narrativePillars : [],
        slideOutline: Array.isArray(parsed.slideOutline) ? parsed.slideOutline : [],
        timelineSyncSeconds: Array.isArray(parsed.timelineSyncSeconds) ? parsed.timelineSyncSeconds : [0, 5, 10, 15, 20],
      }
    }
  } catch {
    // fallback
  }

  // Safe fallback
  return {
    topicThesis: topicPrompt || 'Executive Overview Deck',
    targetAudience: 'Professional Stakeholders',
    tone: 'professional',
    recommendedSlideCount: 4,
    recommendedTheme: 'gaia',
    narrativePillars: [{ pillar: 'Core Concept', evidence: 'Timeline audio analysis' }],
    slideOutline: [
      { title: 'Overview', purpose: 'Introduce core theme', suggestedVisual: 'Bold headline' },
      { title: 'Key Mechanism', purpose: 'Explain workflow', suggestedVisual: '2-column bullet layout' },
      { title: 'Metrics & Results', purpose: 'Highlight data', suggestedVisual: 'Stat callouts' },
      { title: 'Conclusion & CTA', purpose: 'Final takeaways', suggestedVisual: 'Summary card' },
    ],
    timelineSyncSeconds: [0, 5, 10, 15],
  }
}
