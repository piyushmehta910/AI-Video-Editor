import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import { renderHtmlToPng } from '@/engine/motion/sandbox'
import { saveSlideDeckToStorage } from './slideContext'

export type MarpTheme = 'default' | 'gaia' | 'uncover' | 'cyber' | 'sunset'

export interface MarpSlide {
  title: string
  html: string
}

export interface MarpDeck {
  title: string
  slides: MarpSlide[]
}

export const MARP_SYSTEM_PROMPT = `You are a world-class Presentation Designer and Marp Markdown Specialist. You produce executive-ready, highly persuasive, visually balanced slide decks.

Format & Syntax Rules:
1. Slide Separation: Separate every slide with a line containing only "---".
2. Heading Hierarchy:
   - Use "# " for the Main Deck Title on Slide 1.
   - Use "## " for all sub-slide titles (concise, action-oriented, e.g. "## AI Engine Architecture", "## Key Performance Milestones").
3. Bullet Points:
   - Use "- " for bullet points (maximum 4-5 bullet points per slide).
   - Keep bullet points punchy and scannable (under 12 words each).
   - Prefix key phrases with bold text (e.g. "- **Sub-10ms Latency**: Built with WebCodecs & WebGPU").
4. Inductive Story Flow:
   - Slide 1: Hook & Core Title
   - Slide 2: The Core Problem / Status Quo Challenge
   - Slide 3: The Solution / Mechanism Architecture
   - Slide 4: Real-World Metrics, Data & Key Capabilities
   - Slide 5: Takeaways & Call to Action (Next Steps)
5. Speaker Notes:
   - Add speaker narration hints inside <!-- note: ... --> comments on each slide.
6. Output:
   - Return ONLY the clean Marp markdown text. No code fences, no introductory or conversational remarks.`

/** Ask the LLM for a Marp-markdown deck and split it into slides. */
export async function generateMarpMarkdown(options: {
  topic: string
  count?: number
  language?: string
  contextClues?: string
}): Promise<string> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')
  const languageLine = options.language && options.language !== 'auto' ? ` Write in ${options.language}.` : ''
  const countLine = options.count && options.count > 0 ? ` Use exactly ${options.count} slides.` : ' Use 4 to 6 slides.'
  const contextLine = options.contextClues ? `\n\nProject Observations & Context:\n${options.contextClues}` : ''

  const messages: ChatMessage[] = [
    { role: 'system', content: MARP_SYSTEM_PROMPT },
    { role: 'user', content: `Topic: "${options.topic}".${countLine}${languageLine}${contextLine}\n\nGenerate the complete Marp markdown presentation deck now:` },
  ]
  const reply = await chatCompletion(provider, messages)
  let md = reply.content ?? ''
  md = md.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '')
  return md.trim()
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface ParsedBlock {
  heading: string
  level: number
  bullets: string[]
  paragraph: string
}

function parseSlideBlock(block: string): ParsedBlock {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
  const out: ParsedBlock = { heading: '', level: 0, bullets: [], paragraph: '' }
  const paras: string[] = []
  for (const line of lines) {
    if (line.startsWith('<!--')) continue
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h && !out.heading) {
      out.level = h[1].length
      out.heading = h[2]
      continue
    }
    const b = line.match(/^[-*+]\s+(.*)$/)
    if (b) {
      out.bullets.push(b[1])
      continue
    }
    if (!line.startsWith('#')) paras.push(line)
  }
  out.paragraph = paras.join(' ')
  return out
}

/** Split Marp markdown into parsed slides. */
export function parseMarpDeck(markdown: string): Array<ParsedBlock> {
  return markdown
    .split(/\n---+\n/)
    .map((b) => b.replace(/^---\s*/,'').trim())
    .filter((b) => b.length > 0 && !/^theme:/i.test(b))
    .map(parseSlideBlock)
    .filter((s) => s.heading || s.bullets.length || s.paragraph)
}

const FONT_STACK = "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"

/** Render one parsed Marp slide to self-contained HTML for the rasterizer. */
export function renderMarpSlideHtml(
  slide: ParsedBlock,
  index: number,
  total: number,
  theme: MarpTheme,
): string {
  const bullets = slide.bullets
    .map((b) => {
      const formatted = escapeHtml(b).replace(/\*\*(.*?)\*\*/g, '<strong style="color:#38bdf8;">$1</strong>')
      return `<li style="margin:0 0 .65em 0;line-height:1.5;">${formatted}</li>`
    })
    .join('')
  const para = slide.paragraph ? `<p style="opacity:0.9;line-height:1.6;">${escapeHtml(slide.paragraph)}</p>` : ''
  const counter =
    total > 1
      ? `<div style="position:absolute;top:4%;right:4%;font:600 14px ${FONT_STACK};opacity:.65;letter-spacing:1px;">${index} / ${total}</div>`
      : ''
  const headingTag = slide.level <= 1 ? 'h1' : 'h2'
  const heading = slide.heading ? `<${headingTag}>${escapeHtml(slide.heading)}</${headingTag}>` : ''

  const styles: Record<MarpTheme, string> = {
    default: `body{margin:0;width:100%;height:100%;background:#ffffff;color:#1e293b;font-family:${FONT_STACK};box-sizing:border-box;padding:7% 8%;}
    h1{font-size:52px;margin:0 0 4% 0;line-height:1.15;border-bottom:3px solid #e2e8f0;padding-bottom:12px;color:#0f172a;}
    h2{font-size:40px;margin:0 0 4% 0;line-height:1.2;color:#0f172a;border-left:8px solid #2563eb;padding-left:18px;}
    ul{margin:0;padding-left:24px;font-size:26px;line-height:1.55;}
    p{font-size:26px;line-height:1.55;}`,

    gaia: `body{margin:0;width:100%;height:100%;background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 100%);color:#f8fafc;font-family:${FONT_STACK};box-sizing:border-box;padding:7% 8%;}
    h1{font-size:54px;margin:0 0 4% 0;line-height:1.15;font-weight:800;letter-spacing:-0.5px;}
    h2{font-size:40px;margin:0 0 4% 0;line-height:1.2;font-weight:700;}
    ul{margin:0;padding-left:24px;font-size:26px;line-height:1.55;}
    p{font-size:26px;line-height:1.55;opacity:.92;}
    ${headingTag}{border-left:10px solid #38bdf8;padding-left:22px;}`,

    uncover: `body{margin:0;width:100%;height:100%;background:#f8fafc;color:#0f172a;font-family:${FONT_STACK};box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:7% 9%;}
    h1{font-size:56px;margin:0 0 4% 0;line-height:1.12;font-weight:800;color:#1e3a8a;}
    h2{font-size:42px;margin:0 0 4% 0;line-height:1.2;font-weight:700;color:#2563eb;}
    ul{margin:0;padding-left:24px;font-size:27px;line-height:1.6;}
    p{font-size:27px;line-height:1.6;}`,

    cyber: `body{margin:0;width:100%;height:100%;background:#030712;color:#e0e7ff;font-family:${FONT_STACK};box-sizing:border-box;padding:7% 8%;}
    h1{font-size:54px;margin:0 0 4% 0;line-height:1.15;font-weight:900;color:#38bdf8;text-shadow:0 0 20px rgba(56,189,248,0.4);}
    h2{font-size:40px;margin:0 0 4% 0;line-height:1.2;font-weight:800;color:#c084fc;border-left:8px solid #ec4899;padding-left:18px;}
    ul{margin:0;padding-left:24px;font-size:26px;line-height:1.55;}
    p{font-size:26px;line-height:1.55;}`,

    sunset: `body{margin:0;width:100%;height:100%;background:linear-gradient(135deg,#4c0519 0%,#831843 50%,#1e1b4b 100%);color:#ffffff;font-family:${FONT_STACK};box-sizing:border-box;padding:7% 8%;}
    h1{font-size:54px;margin:0 0 4% 0;line-height:1.15;font-weight:800;color:#fbbf24;}
    h2{font-size:40px;margin:0 0 4% 0;line-height:1.2;font-weight:700;color:#f472b6;border-left:8px solid #f59e0b;padding-left:18px;}
    ul{margin:0;padding-left:24px;font-size:26px;line-height:1.55;}
    p{font-size:26px;line-height:1.55;}`,
  }

  return (
    `<div style="position:relative;width:100%;height:100%;">` +
    `<style>${styles[theme] || styles.gaia}</style>` +
    counter +
    heading +
    (bullets ? `<ul>${bullets}</ul>` : '') +
    para +
    `</div>`
  )
}

/** Full pipeline: topic -> Marp markdown -> rendered PNG blobs. */
export async function generateMarpSlides(options: {
  topic: string
  count?: number
  language?: string
  theme?: MarpTheme
  width?: number
  height?: number
  contextClues?: string
  onProgress?: (done: number, total: number) => void
}): Promise<{ title: string; markdown: string; pngs: Blob[] }> {
  const markdown = await generateMarpMarkdown(options)
  const slides = parseMarpDeck(markdown)
  if (!slides.length) throw new Error('AI returned an empty deck.')
  const theme = options.theme ?? 'gaia'
  const width = options.width ?? 1280
  const height = options.height ?? 720
  const title = slides[0]?.heading ?? options.topic
  const pngs: Blob[] = []
  for (let i = 0; i < slides.length; i++) {
    options.onProgress?.(i + 1, slides.length)
    const html = renderMarpSlideHtml(slides[i], i + 1, slides.length, theme)
    pngs.push(await renderHtmlToPng(html, width, height))
  }

  // Save to persistent slide storage context
  saveSlideDeckToStorage({
    title,
    topic: options.topic,
    theme,
    markdown,
    slideCount: pngs.length,
  })

  return { title, markdown, pngs }
}

