import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import { renderHtmlToPng } from '@/engine/motion/sandbox'

export type MarpTheme = 'default' | 'gaia' | 'uncover'

export interface MarpSlide {
  title: string
  html: string
}

export interface MarpDeck {
  title: string
  slides: MarpSlide[]
}

const MARP_SYSTEM_PROMPT = `You write presentations in Marp markdown format. Return ONLY Marp markdown, no code fences, no explanations.

Format rules:
- Separate slides with a line containing only "---"
- First slide starts with front-matter: theme name on its own line inside --- blocks is NOT needed; just start content
- Use "# " for the deck title slide heading, "## " for other slide headings
- Use "- " for bullet points (max 5 per slide)
- Optionally add speaker notes as HTML comments <!-- note -->
- Keep each slide concise and scannable
- Plain text only, no emojis, no images`

/** Ask the LLM for a Marp-markdown deck and split it into slides. */
export async function generateMarpMarkdown(options: {
  topic: string
  count?: number
  language?: string
}): Promise<string> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')
  const languageLine = options.language && options.language !== 'auto' ? ` Write in ${options.language}.` : ''
  const countLine = options.count && options.count > 0 ? ` Use exactly ${options.count} slides.` : ''
  const messages: ChatMessage[] = [
    { role: 'system', content: MARP_SYSTEM_PROMPT },
    { role: 'user', content: `Topic: "${options.topic}".${countLine}${languageLine}\nWrite the Marp markdown now.` },
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
    .map((b) => `<li style="margin:0 0 .55em 0;">${escapeHtml(b)}</li>`)
    .join('')
  const para = slide.paragraph ? `<p>${escapeHtml(slide.paragraph)}</p>` : ''
  const counter =
    total > 1
      ? `<div style="position:absolute;top:3%;right:3%;font:500 13px ${FONT_STACK};opacity:.55;">${index} / ${total}</div>`
      : ''
  const headingTag = slide.level <= 1 ? 'h1' : 'h2'
  const heading = slide.heading ? `<${headingTag}>${escapeHtml(slide.heading)}</${headingTag}>` : ''

  const styles: Record<MarpTheme, string> = {
    default: `body{margin:0;width:100%;height:100%;background:#ffffff;color:#222;font-family:${FONT_STACK};box-sizing:border-box;padding:7% 8%;}
    h1{font-size:52px;margin:0 0 4% 0;line-height:1.15;border-bottom:3px solid #ddd;padding-bottom:12px;}
    h2{font-size:40px;margin:0 0 4% 0;line-height:1.2;}
    ul{margin:0;padding-left:24px;font-size:26px;line-height:1.55;}
    p{font-size:26px;line-height:1.55;}`,
    gaia: `body{margin:0;width:100%;height:100%;background:linear-gradient(160deg,#1c2532 0%,#0f172a 100%);color:#eef2f7;font-family:${FONT_STACK};box-sizing:border-box;padding:7% 8%;}
    h1{font-size:54px;margin:0 0 4% 0;line-height:1.15;font-weight:800;}
    h2{font-size:40px;margin:0 0 4% 0;line-height:1.2;font-weight:700;}
    ul{margin:0;padding-left:24px;font-size:26px;line-height:1.55;}
    p{font-size:26px;line-height:1.55;opacity:.92;}
    ${headingTag}{border-left:10px solid #4ea1ff;padding-left:22px;}`,
    uncover: `body{margin:0;width:100%;height:100%;background:#f4f5f7;color:#1a1a1a;font-family:${FONT_STACK};box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:7% 9%;}
    h1{font-size:56px;margin:0 0 4% 0;line-height:1.12;font-weight:800;}
    h2{font-size:42px;margin:0 0 4% 0;line-height:1.2;font-weight:700;}
    ul{margin:0;padding-left:24px;font-size:27px;line-height:1.6;}
    p{font-size:27px;line-height:1.6;}
    ${headingTag}{color:#2563eb;}`,
  }

  return (
    `<div style="position:relative;width:100%;height:100%;">` +
    `<style>${styles[theme]}</style>` +
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
  onProgress?: (done: number, total: number) => void
}): Promise<{ title: string; pngs: Blob[] }> {
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
  return { title, pngs }
}
