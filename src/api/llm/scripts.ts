import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import { useTimelineStore } from '@/stores/timelineStore'
import { projectDuration } from '@/engine/types'
import type { ProjectScript, ScriptScene } from '@/stores/scriptStore'

export type { ProjectScript, ScriptScene }

export const WORDS_PER_SECOND = 2.5
export const HOOK_SECONDS = 4
export const CTA_SECONDS = 4
export const MIN_SCENE_SECONDS = 1.5

export type CreatorStyleId =
  | 'off'
  | 'mrbeast'
  | 'veritasium'
  | 'ali_abdaal'
  | 'mkbhd'
  | 'vox'
  | 'alex_hormozi'
  | 'magnates'
  | 'shorts_viral'
  | 'dhruv_rathee'
  | 'tech_burner'
  | 'tanmay_bhat'
  | 'sandeep_maheshwari'
  | 'custom'

export interface CreatorStyle {
  id: CreatorStyleId
  name: string
  creator: string
  tagline: string
  badge: string
  icon: string
  promptDirective: string
}

export const CREATOR_STYLES: Record<CreatorStyleId, CreatorStyle> = {
  off: {
    id: 'off',
    name: 'Standard (Neutral)',
    creator: 'Neutral / Custom',
    tagline: 'Clean, balanced, conversational video narration',
    badge: 'bg-muted text-muted-foreground',
    icon: 'mic',
    promptDirective: 'Write clear, natural, engaging narration suitable for high quality video.',
  },
  mrbeast: {
    id: 'mrbeast',
    name: 'MrBeast',
    creator: 'Jimmy Donaldson',
    tagline: 'Hyper-retention, extreme pacing, high stakes in frame 1',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: 'zap',
    promptDirective:
      'MRBEAST YOUTUBE STYLE: High-octane urgency. The hook in the first 3 seconds must state massive stakes or a crazy challenge. Every scene escalates the difficulty or tension. Zero filler. Short, punchy sentences. Constant visual callouts and extreme pacing to maximize 100% viewer retention.',
  },
  veritasium: {
    id: 'veritasium',
    name: 'Veritasium',
    creator: 'Derek Muller / Vsauce',
    tagline: 'Counterintuitive inquiry, scientific mystery & epiphany',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    icon: 'flask',
    promptDirective:
      'VERITASIUM / SCIENCE ESSAY STYLE: Open with a question that breaks common sense or exposes a paradox. Guide the viewer through progressive scientific reasoning, thought experiments, and historical twists. Conclude with an inspiring philosophical paradigm shift.',
  },
  ali_abdaal: {
    id: 'ali_abdaal',
    name: 'Ali Abdaal',
    creator: 'Ali Abdaal',
    tagline: 'Warm productivity, 3-part framework & actionable insights',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: 'book-open',
    promptDirective:
      'ALI ABDAAL PRODUCTIVITY STYLE: Warm, thoughtful, conversational tone. Uses structured frameworks ("Rule of 3"), evidence-based psychology, personal relatable anecdotes, and clear actionable takeaways for the viewer.',
  },
  mkbhd: {
    id: 'mkbhd',
    name: 'MKBHD',
    creator: 'Marques Brownlee',
    tagline: 'Crisp tech review, design philosophy & aesthetic verdict',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: 'smartphone',
    promptDirective:
      'MKBHD (MARQUES BROWNLEE) STYLE: Crisp, aesthetic tech review tone. Opens with "So I\'ve been using this for the past few weeks...", focuses on build quality, design nuances, day-to-day feel, key compromises, and ends with a decisive verdict.',
  },
  vox: {
    id: 'vox',
    name: 'Vox / Johnny Harris',
    creator: 'Johnny Harris / Vox',
    tagline: 'Investigative visual essay with maps & historical depth',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: 'map',
    promptDirective:
      'VOX / JOHNNY HARRIS INVESTIGATIVE STYLE: Journalistic visual essay. Builds narrative suspense, uses timeline and map animation cues, dives into historical and economic systems, and connects unexpected dots to reveal the bigger picture.',
  },
  alex_hormozi: {
    id: 'alex_hormozi',
    name: 'Alex Hormozi',
    creator: 'Alex Hormozi',
    tagline: 'No-BS high conviction business frameworks & raw truth',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    icon: 'briefcase',
    promptDirective:
      'ALEX HORMOZI STYLE: High-conviction, direct, no-BS tone. Opens with a bold contrarian truth ("Look, here\'s the brutal truth about..."). Uses simple math, leverage frameworks, eliminates excuses, and delivers dense actionable value.',
  },
  dhruv_rathee: {
    id: 'dhruv_rathee',
    name: 'Dhruv Rathee',
    creator: 'Dhruv Rathee',
    tagline: 'Logical case studies, visual chapter maps & deep-dive facts',
    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: 'newspaper',
    promptDirective:
      'DHRUV RATHEE STYLE: Highly structured, analytical explainer style. Opens with "Namaste doston..." or a gripping investigative question. Breaks topics into logical chronological chapters with historical context, charts, and clear balanced conclusions.',
  },
  tech_burner: {
    id: 'tech_burner',
    name: 'Tech Burner',
    creator: 'Shlok Srivastava',
    tagline: 'Super energetic fun tech entertainment & wild metaphors',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: 'sparkles',
    promptDirective:
      'TECH BURNER STYLE: Extreme energy, humorous Indian tech creator style. Fun metaphors, energetic delivery ("Doston ye dekho!"), crazy visual stunts, hilarious relatability, and fast snappy pacing.',
  },
  tanmay_bhat: {
    id: 'tanmay_bhat',
    name: 'Tanmay Bhat',
    creator: 'Tanmay Bhat',
    tagline: 'Witty finance breakdowns, startup insights & humor',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    icon: 'trending-up',
    promptDirective:
      'TANMAY BHAT STYLE: Witty, conversational, modern creator tone. Combines pop culture memes, sharp business & startup breakdowns, relatable humor, and rapid-fire conversational pacing.',
  },
  sandeep_maheshwari: {
    id: 'sandeep_maheshwari',
    name: 'Sandeep Maheshwari',
    creator: 'Sandeep Maheshwari',
    tagline: 'Passionate motivational storytelling & mindset epiphanies',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    icon: 'heart-pulse',
    promptDirective:
      'SANDEEP MAHESHWARI STYLE: Deeply inspiring, passionate storytelling style. Powerful emotional hooks, real-life mindset shifts, personal philosophy, and inspiring calls to overcome fear.',
  },
  magnates: {
    id: 'magnates',
    name: 'MagnatesMedia',
    creator: 'MagnatesMedia / Moon',
    tagline: 'Dark cinematic storytelling, corporate drama & suspense',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: 'clapperboard',
    promptDirective:
      'MAGNATESMEDIA DARK STORYTELLING STYLE: Cinematic, suspenseful docudrama about corporate empires, scandals, and epic downfalls. Atmospheric pacing, intense intrigue, psychological motives, and theatrical climaxes.',
  },
  shorts_viral: {
    id: 'shorts_viral',
    name: 'TikTok / Viral Shorts',
    creator: 'Viral Short-form',
    tagline: '0.5s visual pattern interrupt with seamless loop ending',
    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    icon: 'flame',
    promptDirective:
      'VIRAL SHORT-FORM / REELS STYLE: Instant pattern interrupt in the first 0.5s ("Stop scrolling if you want to know..."). Hyper-dense sentences, continuous visual change cues, and a clever loop transition that connects the last sentence seamlessly back to the first sentence.',
  },
  custom: {
    id: 'custom',
    name: 'Custom Creator',
    creator: 'User Specified',
    tagline: 'Tailored to your favorite YouTube channel or custom persona',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    icon: 'wand',
    promptDirective: 'Write in the custom creator persona specified by the user.',
  },
}

interface RawScene {
  title?: string
  text?: string
  visual?: string
  onScreenText?: string
}

interface RawScript {
  title?: string
  hook?: string
  hookVisual?: string
  scenes?: RawScene[]
  cta?: string
  ctaVisual?: string
}

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length
}

export function estimateSceneDuration(text: string): number {
  return Math.max(MIN_SCENE_SECONDS, wordCount(text) / WORDS_PER_SECOND)
}

/**
 * Assign durations to scenes so their total exactly fills `available` seconds
 * (the timeline slot the script is meant to fill), weighted by how much text
 * each scene has. Never lets a scene drop below MIN_SCENE_SECONDS.
 */
export function normalizeScenes(scenes: RawScene[], available: number): ScriptScene[] {
  const out = scenes
    .map((s) => ({
      title: (s.title ?? '').trim(),
      text: (s.text ?? '').trim(),
      visualCue: (s.visual ?? '').trim(),
      onScreenText: (s.onScreenText ?? '').trim(),
    }))
    .filter((s) => s.text.length > 0)
  if (!out.length) return []
  const natural = out.map((s) => estimateSceneDuration(s.text))
  const total = natural.reduce((a, b) => a + b, 0)
  const floor = out.length * MIN_SCENE_SECONDS
  const budget = Math.max(floor, available)
  return out.map((s, i) => {
    const share = total > 0 ? natural[i] / total : 1 / out.length
    const duration = Math.max(MIN_SCENE_SECONDS, share * budget)
    return {
      title: s.title,
      text: s.text,
      visualCue: s.visualCue,
      onScreenText: s.onScreenText,
      durationSeconds: duration,
    }
  })
}

/**
 * Normalize a raw script from the model into a ProjectScript whose scene
 * durations sum to `target` minus the fixed hook + CTA seconds.
 */
export function normalizeScript(
  raw: RawScript,
  target: number,
  topic: string,
  creatorStyle?: string,
): ProjectScript {
  const scenes = normalizeScenes(raw.scenes ?? [], Math.max(0, target - HOOK_SECONDS - CTA_SECONDS))
  return {
    topic,
    title: (raw.title ?? '').trim() || topic,
    hook: (raw.hook ?? '').trim(),
    hookVisual: (raw.hookVisual ?? '').trim(),
    scenes,
    cta: (raw.cta ?? '').trim(),
    ctaVisual: (raw.ctaVisual ?? '').trim(),
    creatorStyle,
    targetDurationSeconds: target,
  }
}

export function scriptDuration(script: ProjectScript): number {
  return HOOK_SECONDS + script.scenes.reduce((a, s) => a + s.durationSeconds, 0) + CTA_SECONDS
}

/** Build full teleprompter / readable text for spoken voiceover. */
export function formatTeleprompter(script: ProjectScript): string {
  const parts: string[] = []
  if (script.hook) parts.push(script.hook)
  for (const sc of script.scenes) {
    if (sc.text) parts.push(sc.text)
  }
  if (script.cta) parts.push(script.cta)
  return parts.join('\n\n')
}

/** Calculate spoken metrics. */
export function calculateScriptMetrics(script: ProjectScript) {
  const fullText = formatTeleprompter(script)
  const totalWords = wordCount(fullText)
  const estimatedSeconds = Math.round(totalWords / WORDS_PER_SECOND)
  const wpm = Math.round(WORDS_PER_SECOND * 60)
  return { totalWords, estimatedSeconds, wpm }
}

/** Build the human-readable summary used by tool responses. */
export function describeScript(script: ProjectScript): string {
  const lines = [`Script "${script.title}" (${scriptDuration(script).toFixed(1)}s${script.creatorStyle ? ` · ${script.creatorStyle}` : ''}):`]
  if (script.hook) lines.push(`  Hook (${HOOK_SECONDS}s): ${script.hook}`)
  let start = HOOK_SECONDS
  for (const scene of script.scenes) {
    const visual = scene.visualCue ? ` [Visual: ${scene.visualCue.slice(0, 30)}]` : ''
    lines.push(`  Scene: ${start.toFixed(1)}s→${(start + scene.durationSeconds).toFixed(1)}s: ${scene.title || scene.text.slice(0, 40)}${visual}`)
    start += scene.durationSeconds
  }
  if (script.cta) lines.push(`  CTA (${CTA_SECONDS}s): ${script.cta}`)
  return lines.join('\n')
}

const SYSTEM_PROMPT = `You are a world-class professional YouTube video scriptwriter and viral content director.
Return ONLY a valid JSON object with this exact shape:
{
  "title": "High-CTR engaging YouTube video title",
  "hook": "Punchy 1-2 sentence spoken hook for the opening 4 seconds",
  "hookVisual": "Specific visual B-roll or dynamic camera action happening during the hook",
  "scenes": [
    {
      "title": "Scene label / beat title",
      "text": "2-4 conversational spoken narration sentences for this scene",
      "visual": "Clear visual description of what should be shown on screen (B-roll, 3D graphics, motion maps)",
      "onScreenText": "Short bold on-screen text pop-up (optional, e.g. 'RULE #1')"
    }
  ],
  "cta": "One closing call-to-action sentence (subscribe, comment, check link)",
  "ctaVisual": "Closing screen graphic or animation description"
}
Rules:
- Write conversational spoken narration for voiceover, NOT subtitles.
- Make each scene a logical storytelling step.
- Keep the spoken word count calibrated to the target duration (approx. 2.5 words/sec).
- Output raw JSON only with zero markdown code fences and zero conversational prelude.`

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : content
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('Script response was not JSON.')
  return JSON.parse(candidate.slice(start, end + 1))
}

function targetDurationFor(seconds?: number): number {
  if (seconds != null && Number.isFinite(seconds) && seconds > 0) return seconds
  const { project } = useTimelineStore.getState()
  return Math.max(10, Math.round(projectDuration(project.tracks)))
}

async function runScriptTask(
  prompt: string,
  topic: string,
  target: number,
  creatorStyle?: CreatorStyleId,
): Promise<ProjectScript> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')

  const styleObj = creatorStyle ? CREATOR_STYLES[creatorStyle] : CREATOR_STYLES.off
  const systemPrompt = `${SYSTEM_PROMPT}\n\nSTYLE DIRECTIVE:\n${styleObj.promptDirective}`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]
  const reply = await chatCompletion(provider, messages)
  const raw = extractJson(reply.content ?? '')
  if (!raw || typeof raw !== 'object') throw new Error('Script response was not an object.')
  return normalizeScript(raw as RawScript, target, topic, styleObj.name)
}

export interface GenerateScriptOptions {
  topic: string
  durationSeconds?: number
  language?: string
  creatorStyle?: CreatorStyleId
  customCreator?: string
  customTone?: string
  sceneCount?: number
}

export async function generateScript(options: GenerateScriptOptions): Promise<ProjectScript> {
  const target = targetDurationFor(options.durationSeconds)
  const style = options.creatorStyle ?? 'off'
  const styleObj = CREATOR_STYLES[style]
  const scenesDirective = options.sceneCount ? ` Structure into ${options.sceneCount} distinct scenes.` : ''
  const toneDirective = options.customTone ? ` Tone: ${options.customTone}.` : ''

  // Language formatting (English, Hindi, Hinglish, etc.)
  let languageDirective = ''
  if (options.language) {
    const lang = options.language.toLowerCase()
    if (lang.includes('hindi') && !lang.includes('hinglish')) {
      languageDirective = ' LANGUAGE REQUIREMENT: Write the entire spoken narration in authentic conversational Hindi (हिन्दी) in standard Devanagari script.'
    } else if (lang.includes('hinglish')) {
      languageDirective = ' LANGUAGE REQUIREMENT: Write in authentic Hinglish (conversational Hindi-English blend written in English/Latin letters), exactly like top Indian YouTube & Reels creators (e.g. "Doston aaj hum baat karenge...").'
    } else if (lang !== 'auto' && lang !== 'english') {
      languageDirective = ` LANGUAGE REQUIREMENT: Write the entire spoken narration in ${options.language}.`
    }
  }

  // Creator persona formatting (Supports preset creator OR custom creator input)
  const creatorDirective = options.customCreator?.trim()
    ? `CUSTOM CREATOR: ${options.customCreator.trim()} (write in the signature spoken style, catchphrases, pacing, and vibe of this creator)`
    : `${styleObj.name} (${styleObj.tagline})`

  const userPrompt = `TOPIC: "${options.topic}"
TARGET DURATION: ${target} seconds
CREATOR PERSONA: ${creatorDirective}${scenesDirective}${toneDirective}${languageDirective}

Write the complete viral, structured narration script now.`

  const styleLabel = options.customCreator?.trim() ? options.customCreator.trim() : styleObj.name
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')

  const systemPrompt = options.customCreator?.trim()
    ? `${SYSTEM_PROMPT}\n\nSTYLE DIRECTIVE:\nMimic the exact spoken tone, humor, catchphrases, pacing, and storytelling rhythm of creator "${options.customCreator.trim()}".`
    : `${SYSTEM_PROMPT}\n\nSTYLE DIRECTIVE:\n${styleObj.promptDirective}`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  const reply = await chatCompletion(provider, messages)
  const raw = extractJson(reply.content ?? '')
  if (!raw || typeof raw !== 'object') throw new Error('Script response was not an object.')
  return normalizeScript(raw as RawScript, target, options.topic, styleLabel)
}

export async function rewriteScript(instruction: string, current: ProjectScript): Promise<ProjectScript> {
  return runScriptTask(
    `Rewrite the following script per: ${instruction}\n\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    current.targetDurationSeconds,
  )
}

export async function shortenScript(current: ProjectScript, targetSeconds: number): Promise<ProjectScript> {
  return runScriptTask(
    `Compress this script to fit ${targetSeconds} seconds total: cut fluff, keep the essential steps.\n\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    targetSeconds,
  )
}

export async function expandScript(current: ProjectScript, targetSeconds: number): Promise<ProjectScript> {
  return runScriptTask(
    `Expand this script to fill ${targetSeconds} seconds total: add concrete detail per step without changing the structure.\n\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    targetSeconds,
  )
}

export async function makeHook(current: ProjectScript, instruction?: string): Promise<ProjectScript> {
  return runScriptTask(
    `Write a new opening hook${instruction ? ` per: ${instruction}` : ' (more punchy, curiosity-driven)'}.\nKeep the rest identical.\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    current.targetDurationSeconds,
  )
}

export async function makeCta(current: ProjectScript, instruction?: string): Promise<ProjectScript> {
  return runScriptTask(
    `Write a new closing CTA${instruction ? ` per: ${instruction}` : ' (clear single next step)'}.\nKeep the rest identical.\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    current.targetDurationSeconds,
  )
}