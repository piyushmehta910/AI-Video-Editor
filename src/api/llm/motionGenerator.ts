import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'

export interface MotionCodeOptions {
  concept: string
  durationSeconds: number
  style?: string
  language?: string
  transparent?: boolean
  provider?: string
  model?: string
}

export interface MotionCodeResult {
  code: string
}

export interface MotionHistoryEntry {
  id: string
  prompt: string
  code: string
  duration: number
  timestamp: number
}

const MOTION_HISTORY_KEY = 'clipforge_motion_history'
let inMemoryHistory: MotionHistoryEntry[] = []

export function getMotionHistory(): MotionHistoryEntry[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(MOTION_HISTORY_KEY)
      if (raw) return JSON.parse(raw)
    }
  } catch {
    // fallback to in-memory
  }
  return inMemoryHistory
}

export function saveMotionToHistory(entry: Omit<MotionHistoryEntry, 'id' | 'timestamp'>): MotionHistoryEntry {
  const full: MotionHistoryEntry = {
    ...entry,
    id: `motion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  }
  try {
    const history = getMotionHistory()
    const updated = [full, ...history.filter((h) => h.code !== entry.code)].slice(0, 30)
    inMemoryHistory = updated
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MOTION_HISTORY_KEY, JSON.stringify(updated))
    }
  } catch {
    // ignore storage quota errors
  }
  return full
}

export const MOTION_SYSTEM_PROMPT = `You are a world-class Motion Graphics Designer and Creative Coder. You produce high-end, production-ready motion graphics animations rendered onto an HTML5 Canvas / WebGL context.

Your code executes inside a deterministic rendering engine that calls:
  window.__INIT = function (ctx, w, h) { ... }         // optional, called once before rendering
  window.__ANIMATE = function (ctx, t, w, h) { ... }   // required, called every frame where t goes 0..1 (progress from start to end)

Design Standards & Capabilities:
1. Visual Polish: Use rich color gradients (createLinearGradient, createRadialGradient), vibrant neon or studio palettes, glows (shadowColor, shadowBlur), and professional typography.
2. Motion & Easing: Use smooth mathematical easing functions for natural deceleration/acceleration (e.g., const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3); const easeOutExpo = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x))).
3. Fluid Elements: You may create interconnected particle swarms, glowing grid overlays, holographic circular HUD gauges, geometric transformations, lower thirds, or kinetic typography.
4. Transparency vs Backdrop: If the user requests an overlay or lower third, use ctx.clearRect(0, 0, w, h) with semi-transparent rounded cards (ctx.roundRect). If a full backdrop is requested, start by filling with a dark gradient.
5. Deterministic Math: NO Math.random() in __ANIMATE (use deterministic trigonometry or seed tables based on index i and t). NO Date.now(). No DOM/window references outside canvas ctx.
6. Responsive Layout: Scale text sizes (e.g. Math.max(14, w * 0.04)) and element positions relative to w (width) and h (height).

Output Format:
Return ONLY the executable JavaScript code inside a single \`\`\`js ... \`\`\` fenced code block without conversational filler.`

function extractCode(content: string): string {
  const fenced = content.match(/```(?:js|javascript)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : content
  const trimmed = candidate.trim()
  if (!trimmed) throw new Error('Motion graphics response was empty.')
  return trimmed
}

export async function generateMotionCode(options: MotionCodeOptions): Promise<MotionCodeResult> {
  const provider = getDirectorProvider({ provider: options.provider, model: options.model })
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')
  const styleLine = options.style && options.style !== 'auto' ? ` Visual Style: ${options.style}.` : ''
  const languageLine = options.language && options.language !== 'auto' ? ` Text Language: ${options.language}.` : ''
  const transparentLine = options.transparent ? ' Transparent background (for video overlay compositing).' : ''

  const prompt =
    `Create a stunning motion graphic animation for: "${options.concept}".\n` +
    `Clip duration: ${options.durationSeconds} seconds (t goes from 0.0 to 1.0 over the clip).\n` +
    `Canvas dimensions: w x h (responsive).\n` +
    styleLine +
    languageLine +
    transparentLine +
    `\nProduce the complete, self-contained window.__ANIMATE (and optional __INIT) JavaScript code now.`

  const messages: ChatMessage[] = [
    { role: 'system', content: MOTION_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]
  const reply = await chatCompletion(provider, messages)
  const code = extractCode(reply.content ?? '')

  // Save to local context history
  saveMotionToHistory({ prompt: options.concept, code, duration: options.durationSeconds })

  return { code }
}