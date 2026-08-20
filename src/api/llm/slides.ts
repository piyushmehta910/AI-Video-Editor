import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import { renderHtmlToPng } from '@/engine/motion/sandbox'

export type SlideTheme = 'clean' | 'dark' | 'gradient'

export interface Slide {
  title: string
  bullets: string[]
  notes?: string
}

export interface SlideDeck {
  topic: string
  title: string
  slides: Slide[]
}

export interface GenerateSlidesOptions {
  topic: string
  count?: number
  language?: string
}

const SLIDES_SYSTEM_PROMPT = `You write the content for a presentation about a topic. Return ONLY a JSON object with this shape:
{
  "title": "short working title",
  "slides": [
    { "title": "slide headline", "bullets": ["3-5 concise bullet points"], "notes": "optional speaker note" }
  ]
}
Rules:
- 3-6 slides, each a distinct aspect of the topic. First slide can be an overview.
- Bullets must be short (max ~10 words each), scannable, and self-contained on the slide.
- Plain text only: no markdown, no emojis, no HTML.
- Do not include markdown, code fences, or any text outside the JSON object.`

interface RawSlide {
  title?: string
  bullets?: unknown
  notes?: string
}

interface RawDeck {
  title?: string
  slides?: RawSlide[]
}

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : content
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('Slides response was not JSON.')
  return JSON.parse(candidate.slice(start, end + 1))
}

export function normalizeSlides(raw: RawDeck, topic: string, count?: number): SlideDeck {
  const slides = (raw.slides ?? [])
    .map((s) => ({
      title: (s.title ?? '').trim(),
      bullets: Array.isArray(s.bullets)
        ? s.bullets
            .map((b) => String(b).trim())
            .filter(Boolean)
            .slice(0, 6)
        : [],
      notes: (s.notes ?? '').trim() || undefined,
    }))
    .filter((s) => s.title || s.bullets.length)
  const limited = count && count > 0 ? slides.slice(0, Math.max(1, Math.min(count, 6))) : slides
  return {
    topic,
    title: (raw.title ?? '').trim() || topic,
    slides: limited,
  }
}

export async function generateSlides(options: GenerateSlidesOptions): Promise<SlideDeck> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')
  const languageLine = options.language && options.language !== 'auto' ? ` Write the slide text in ${options.language}.` : ''
  const countLine = options.count && options.count > 0 ? ` Use up to ${options.count} slides.` : ''
  const messages: ChatMessage[] = [
    { role: 'system', content: SLIDES_SYSTEM_PROMPT },
    { role: 'user', content: `Topic: "${options.topic}".${countLine}${languageLine}\nWrite the deck JSON now.` },
  ]
  const reply = await chatCompletion(provider, messages)
  const raw = extractJson(reply.content ?? '')
  if (!raw || typeof raw !== 'object') throw new Error('Slides response was not an object.')
  return normalizeSlides(raw as RawDeck, options.topic, options.count)
}

const FONT_STACK =
  "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build a self-contained inline-styled HTML slide for the foreignObject rasterizer. */
export function renderSlideHtml(slide: Slide, index: number, total: number, theme: SlideTheme = 'clean'): string {
  const bullets = slide.bullets
    .map((b) => `<li style="margin: 0 0 0.55em 0;">${xmlEscape(b)}</li>`)
    .join('')
  const counter = total > 1 ? `<div style="position:absolute;top:2%;right:2%;font:500 14px ${FONT_STACK};opacity:.55;">${index} / ${total}</div>` : ''
  const title = xmlEscape(slide.title)

  const styles: Record<SlideTheme, string> = {
    clean: `body{margin:0;width:100%;height:100%;background:#f8fafc;color:#0f172a;font-family:${FONT_STACK};box-sizing:border-box;padding:6% 7%;}
    .bar{width:72px;height:8px;border-radius:4px;background:linear-gradient(90deg,#2563eb,#0ea5e9);margin-bottom:4%;}
    h1{margin:0 0 3% 0;font-size:44px;line-height:1.15;font-weight:700;}
    ul{margin:0;padding:0 0 0 22px;list-style:none;font-size:27px;line-height:1.5;}
    li::before{content:"▸";color:#2563eb;margin-right:14px;font-weight:700;}`,
    dark: `body{margin:0;width:100%;height:100%;background:#0f172a;color:#e2e8f0;font-family:${FONT_STACK};box-sizing:border-box;padding:6% 7%;}
    .bar{width:72px;height:8px;border-radius:4px;background:linear-gradient(90deg,#22d3ee,#818cf8);margin-bottom:4%;}
    h1{margin:0 0 3% 0;font-size:44px;line-height:1.15;font-weight:700;}
    ul{margin:0;padding:0 0 0 22px;list-style:none;font-size:27px;line-height:1.5;}
    li::before{content:"▸";color:#22d3ee;margin-right:14px;font-weight:700;}`,
    gradient: `body{margin:0;width:100%;height:100%;background:linear-gradient(135deg,#7c3aed 0%,#db2777 55%,#f59e0b 100%);color:#ffffff;font-family:${FONT_STACK};box-sizing:border-box;padding:7% 8%;}
    .bar{width:72px;height:8px;border-radius:4px;background:rgba(255,255,255,.85);margin-bottom:4%;}
    h1{margin:0 0 3% 0;font-size:46px;line-height:1.15;font-weight:800;text-shadow:0 2px 12px rgba(0,0,0,.25);}
    ul{margin:0;padding:0 0 0 22px;list-style:none;font-size:29px;line-height:1.5;text-shadow:0 1px 8px rgba(0,0,0,.2);}
    li::before{content:"▸";margin-right:14px;font-weight:700;opacity:.9;}`,
  }

  return (
    `<div style="position:relative;width:100%;height:100%;"><style>${styles[theme]}</style>` +
    counter +
    `<div class="bar"></div><h1>${title}</h1><ul>${bullets}</ul></div>`
  )
}

export async function renderSlidePng(slide: Slide, index: number, total: number, theme: SlideTheme, width: number, height: number): Promise<Blob> {
  const html = renderSlideHtml(slide, index, total, theme)
  return renderHtmlToPng(html, width, height)
}