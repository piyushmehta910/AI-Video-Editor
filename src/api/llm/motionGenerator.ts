import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'

export interface MotionCodeOptions {
  concept: string
  durationSeconds: number
  style?: string
  language?: string
}

export interface MotionCodeResult {
  code: string
}

const MOTION_SYSTEM_PROMPT = `You write self-contained JavaScript for an animated diagram generator. The code runs inside an isolated sandbox that provides a 2D canvas context. It is shown to thousands of viewers, so it must clearly explain the concept through motion and labels.

You must produce code that defines the globals:

  window.__INIT = function (ctx, w, h) { ... }   // optional, called once with the canvas context
  window.__ANIMATE = function (ctx, t, w, h) { ... } // required, called every frame; t goes 0..1

Rules:
- ONLY use the CanvasRenderingContext2D API: fillRect, strokeRect, beginPath, moveTo, lineTo, arc, ellipse, bezierCurveTo, closePath, fill, stroke, fillText, measureText, createLinearGradient, createRadialGradient, translate, rotate, scale, save, restore, setLineDash, shadowColor, shadowBlur, globalAlpha, lineWidth, strokeStyle, fillStyle, font, textAlign, textBaseline.
- Draw a clean, readable animated diagram of the given concept: shapes that move/propagate to convey the mechanism, plus short text labels in ctx.fillText with a readable font like "24px system-ui, sans-serif".
- t is the normalized time (0 to 1) over the whole clip. The animation should progress meaningfully across t and loop smoothly (end state near start state).
- Background: start by filling the whole canvas with ctx.fillStyle + ctx.fillRect so text stays readable; choose a dark or light theme but keep high contrast.
- Deterministic: NO Math.random, NO Date, NO external assets, NO document/window/self/fetch/network. Compute positions only from ctx, t, w, h.
- Do not reference the DOM, do not throw, keep the whole function under 220 lines.
- Return ONLY the JavaScript inside a single fenced code block with language tag "js". Nothing else.`

function extractCode(content: string): string {
  const fenced = content.match(/```(?:js|javascript)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : content
  const trimmed = candidate.trim()
  if (!trimmed) throw new Error('Motion graphics response was empty.')
  return trimmed
}

export async function generateMotionCode(options: MotionCodeOptions): Promise<MotionCodeResult> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')
  const styleLine = options.style && options.style !== 'auto' ? ` Style: ${options.style}.` : ''
  const languageLine = options.language && options.language !== 'auto' ? ` Label the diagram in ${options.language}.` : ''
  const prompt =
    `Concept to animate: "${options.concept}".\n` +
    `Clip duration: ${options.durationSeconds} seconds (t goes from 0 to 1 over the whole clip).\n` +
    `Canvas may be any aspect ratio, so compute layout from w and h.\n` +
    styleLine +
    languageLine +
    `\nWrite the __ANIMATE (and optional __INIT) JavaScript now.`
  const messages: ChatMessage[] = [
    { role: 'system', content: MOTION_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]
  const reply = await chatCompletion(provider, messages)
  return { code: extractCode(reply.content ?? '') }
}