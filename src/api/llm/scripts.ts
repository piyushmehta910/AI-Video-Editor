import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import { useTimelineStore } from '@/stores/timelineStore'
import { projectDuration } from '@/engine/types'
import type { ProjectScript, ScriptScene } from '@/stores/scriptStore'

export const WORDS_PER_SECOND = 2.5
export const HOOK_SECONDS = 4
export const CTA_SECONDS = 4
export const MIN_SCENE_SECONDS = 1.5

interface RawScene {
  title?: string
  text?: string
}

interface RawScript {
  title?: string
  hook?: string
  scenes?: RawScene[]
  cta?: string
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
    .map((s) => ({ title: (s.title ?? '').trim(), text: (s.text ?? '').trim() }))
    .filter((s) => s.text.length > 0)
  if (!out.length) return []
  const natural = out.map((s) => estimateSceneDuration(s.text))
  const total = natural.reduce((a, b) => a + b, 0)
  const floor = out.length * MIN_SCENE_SECONDS
  const budget = Math.max(floor, available)
  return out.map((s, i) => {
    const share = total > 0 ? natural[i] / total : 1 / out.length
    const duration = Math.max(MIN_SCENE_SECONDS, share * budget)
    return { title: s.title, text: s.text, durationSeconds: duration }
  })
}

/**
 * Normalize a raw script from the model into a ProjectScript whose scene
 * durations sum to `target` minus the fixed hook + CTA seconds.
 */
export function normalizeScript(raw: RawScript, target: number, topic: string): ProjectScript {
  const scenes = normalizeScenes(raw.scenes ?? [], Math.max(0, target - HOOK_SECONDS - CTA_SECONDS))
  return {
    topic,
    title: (raw.title ?? '').trim() || topic,
    hook: (raw.hook ?? '').trim(),
    scenes,
    cta: (raw.cta ?? '').trim(),
    targetDurationSeconds: target,
  }
}

export function scriptDuration(script: ProjectScript): number {
  return HOOK_SECONDS + script.scenes.reduce((a, s) => a + s.durationSeconds, 0) + CTA_SECONDS
}

/** Build the human-readable summary used by tool responses. */
export function describeScript(script: ProjectScript): string {
  const lines = [`Script "${script.title}" (${scriptDuration(script).toFixed(1)}s):`]
  if (script.hook) lines.push(`  Hook (${HOOK_SECONDS}s): ${script.hook}`)
  let start = HOOK_SECONDS
  for (const scene of script.scenes) {
    lines.push(`  ${start.toFixed(1)}s→${(start + scene.durationSeconds).toFixed(1)}s: ${scene.title || scene.text.slice(0, 40)} (${scene.durationSeconds.toFixed(1)}s)`)
    start += scene.durationSeconds
  }
  if (script.cta) lines.push(`  CTA (${CTA_SECONDS}s): ${script.cta}`)
  return lines.join('\n')
}

const SYSTEM_PROMPT = `You write narration scripts for short videos. Return ONLY a JSON object with this shape:
{
  "title": "short working title",
  "hook": "one or two punchy opening sentences (the hook)",
  "scenes": [
    { "title": "scene label", "text": "2-4 spoken sentences for this scene" }
  ],
  "cta": "one closing call-to-action sentence"
}
Rules:
- Write conversational narration for a spoken voiceover, not subtitles.
- 4-7 scenes max, each a distinct step of the explanation.
- Keep the total spoken length close to the requested duration (about 2.5 words per second).
- Do not include markdown, code fences, or any text outside the JSON object.`

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
  // Fall back to the current project duration (the slot the script fills).
  const { project } = useTimelineStore.getState()
  return Math.max(10, Math.round(projectDuration(project.tracks)))
}

async function runScriptTask(prompt: string, topic: string, target: number): Promise<ProjectScript> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]
  const reply = await chatCompletion(provider, messages)
  const raw = extractJson(reply.content ?? '')
  if (!raw || typeof raw !== 'object') throw new Error('Script response was not an object.')
  return normalizeScript(raw as RawScript, target, topic)
}

export interface GenerateScriptOptions {
  topic: string
  durationSeconds?: number
  language?: string
}

export async function generateScript(options: GenerateScriptOptions): Promise<ProjectScript> {
  const target = targetDurationFor(options.durationSeconds)
  const languageLine = options.language && options.language !== 'auto' ? ` Write it in ${options.language}.` : ''
  return runScriptTask(
    `Topic: "${options.topic}". Target duration: ${target} seconds.${languageLine} Write the full narration script now.`,
    options.topic,
    target,
  )
}

export async function rewriteScript(instruction: string, current: ProjectScript): Promise<ProjectScript> {
  return runScriptTask(
    `Rewrite the following script per: ${instruction}\n\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    current.targetDurationSeconds,
  )
}

export async function shortenScript(current: ProjectScript, targetSeconds: number): Promise<ProjectScript> {
  const script = await runScriptTask(
    `Compress this script to fit ${targetSeconds} seconds total: cut fluff, keep the essential steps.\n\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    targetSeconds,
  )
  return script
}

export async function expandScript(current: ProjectScript, targetSeconds: number): Promise<ProjectScript> {
  const script = await runScriptTask(
    `Expand this script to fill ${targetSeconds} seconds total: add concrete detail per step without changing the structure.\n\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    targetSeconds,
  )
  return script
}

export async function makeHook(current: ProjectScript, instruction?: string): Promise<ProjectScript> {
  const script = await runScriptTask(
    `Write a new opening hook${instruction ? ` per: ${instruction}` : ' (more punchy, curiosity-driven)'}.\nKeep the rest identical.\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    current.targetDurationSeconds,
  )
  return script
}

export async function makeCta(current: ProjectScript, instruction?: string): Promise<ProjectScript> {
  const script = await runScriptTask(
    `Write a new closing CTA${instruction ? ` per: ${instruction}` : ' (clear single next step)'}.\nKeep the rest identical.\nCurrent script:\n${describeScript(current)}`,
    current.topic,
    current.targetDurationSeconds,
  )
  return script
}