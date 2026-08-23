import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import { renderHtmlToPng } from '@/engine/motion/sandbox'

export type SlideTheme =
  | 'pitch_dark'
  | 'apple_minimal'
  | 'cyber_neon'
  | 'sunset_warm'
  | 'clean_studio'
  | 'neo_brutalist'

export type SlideFont = 'sans' | 'serif' | 'mono' | 'display'

export type SlideAnimation = 'fade' | 'slide_up' | 'zoom_pop' | 'glass_glow' | 'kinetic'

export type SlideLayout = 'hero' | 'cards' | 'big_stat' | 'split' | 'quote' | 'checklist'

export interface SlideCard {
  title: string
  description: string
  tag?: string
}

export interface Slide {
  id?: string
  title: string
  subtitle?: string
  layout?: SlideLayout
  bullets: string[]
  statNumber?: string
  statLabel?: string
  quoteAuthor?: string
  cards?: SlideCard[]
  notes?: string
  theme?: SlideTheme
  font?: SlideFont
  animation?: SlideAnimation
}

export interface SlideDeck {
  topic: string
  title: string
  theme: SlideTheme
  font: SlideFont
  animation: SlideAnimation
  slides: Slide[]
}

export interface GenerateSlidesOptions {
  topic: string
  count?: number
  language?: string
  theme?: SlideTheme
  font?: SlideFont
  animation?: SlideAnimation
  layoutArchetype?: string
}

export const SLIDE_THEMES_META: Record<
  SlideTheme,
  { name: string; description: string; previewBg: string; textColor: string; accent: string }
> = {
  pitch_dark: {
    name: 'Pitch Dark',
    description: 'Modern startup dark deck with glass cards & vibrant indigo glows',
    previewBg: 'bg-[#0f172a]',
    textColor: 'text-white',
    accent: '#6366f1',
  },
  apple_minimal: {
    name: 'Apple Keynote',
    description: 'Executive minimalist elegance, bold contrast & refined whitespace',
    previewBg: 'bg-[#000000]',
    textColor: 'text-white',
    accent: '#38bdf8',
  },
  cyber_neon: {
    name: 'Cyberpunk Neon',
    description: 'Futuristic HUD with cyan/magenta neon glow and tech grids',
    previewBg: 'bg-[#030712]',
    textColor: 'text-[#e0e7ff]',
    accent: '#06b6d4',
  },
  sunset_warm: {
    name: 'Sunset Gradient',
    description: 'Warm, emotional narrative gradient with rich crimson & gold',
    previewBg: 'bg-gradient-to-br from-purple-900 via-pink-700 to-amber-600',
    textColor: 'text-white',
    accent: '#f59e0b',
  },
  clean_studio: {
    name: 'Swiss Studio',
    description: 'Crisp light mode with geometric precision and cobalt accents',
    previewBg: 'bg-[#f8fafc]',
    textColor: 'text-[#0f172a]',
    accent: '#2563eb',
  },
  neo_brutalist: {
    name: 'Neo-Brutalist',
    description: 'High-contrast bold black borders, electric pop pastel blocks',
    previewBg: 'bg-[#fef08a]',
    textColor: 'text-[#000000]',
    accent: '#ec4899',
  },
}

export const SLIDE_FONTS_META: Record<SlideFont, { name: string; family: string; sample: string }> = {
  sans: {
    name: 'Modern Sans',
    family: "'Segoe UI', -apple-system, system-ui, Roboto, sans-serif",
    sample: 'Clean & Crisp',
  },
  serif: {
    name: 'Editorial Serif',
    family: "Georgia, 'Times New Roman', 'Playfair Display', serif",
    sample: 'Elegant & Thoughtful',
  },
  mono: {
    name: 'Tech Monospace',
    family: "'Fira Code', Consolas, 'Courier New', monospace",
    sample: 'Data & Architecture',
  },
  display: {
    name: 'Impact Display',
    family: "Impact, 'Arial Black', 'Montserrat ExtraBold', sans-serif",
    sample: 'Bold & Punchy',
  },
}

export const SLIDE_ANIMATIONS_META: Record<SlideAnimation, { name: string; description: string }> = {
  fade: { name: 'Cinematic Fade', description: 'Smooth progressive opacity reveal' },
  slide_up: { name: 'Fluid Slide Up', description: 'Staggered vertical ascent with dampening' },
  zoom_pop: { name: 'Zoom & Pop', description: 'Dynamic kinetic scale bounce' },
  glass_glow: { name: 'Glass Glow', description: 'Illuminated border and subtle shimmer' },
  kinetic: { name: 'Kinetic Type', description: 'Energetic snap with rapid entry' },
}

const SLIDES_SYSTEM_PROMPT = `You are a world-class Presentation Designer (like Pitch, Keynote, and McKinsey).
You create executive-ready, highly persuasive, visually rich presentation slide decks.

Return ONLY a valid JSON object with this shape:
{
  "title": "Presentation Deck Title",
  "theme": "pitch_dark",
  "font": "sans",
  "animation": "slide_up",
  "slides": [
    {
      "title": "Slide Headline",
      "subtitle": "Short category context or takeaway",
      "layout": "hero | cards | big_stat | split | quote | checklist",
      "bullets": ["2-4 punchy bullet points with bold leads"],
      "statNumber": "+140% or 10x (only if layout is big_stat)",
      "statLabel": "Metric description (only if layout is big_stat)",
      "quoteAuthor": "Person name / title (only if layout is quote)",
      "cards": [
        { "title": "Card Title", "description": "1-2 sentence breakdown", "tag": "STEP 1" }
      ],
      "notes": "Speaker notes for voiceover"
    }
  ]
}
Rules:
- 3 to 6 slides with logical narrative flow: Hook -> Problem -> Architecture/Solution -> Proof/Metric -> Takeaway.
- Vary the layouts across slides (e.g. Slide 1 hero, Slide 2 split, Slide 3 big_stat or cards, Slide 4 checklist).
- Output raw JSON ONLY with zero markdown code fences.`

interface RawCard {
  title?: string
  description?: string
  tag?: string
}

interface RawSlide {
  title?: string
  subtitle?: string
  layout?: SlideLayout
  bullets?: unknown
  statNumber?: string
  statLabel?: string
  quoteAuthor?: string
  cards?: RawCard[]
  notes?: string
}

interface RawDeck {
  title?: string
  theme?: SlideTheme
  font?: SlideFont
  animation?: SlideAnimation
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

export function normalizeSlides(
  raw: RawDeck,
  topic: string,
  count?: number,
  fallbackTheme: SlideTheme = 'pitch_dark',
  fallbackFont: SlideFont = 'sans',
  fallbackAnimation: SlideAnimation = 'slide_up',
): SlideDeck {
  const deckTheme: SlideTheme = raw.theme && SLIDE_THEMES_META[raw.theme] ? raw.theme : fallbackTheme
  const deckFont: SlideFont = raw.font && SLIDE_FONTS_META[raw.font] ? raw.font : fallbackFont
  const deckAnim: SlideAnimation =
    raw.animation && SLIDE_ANIMATIONS_META[raw.animation] ? raw.animation : fallbackAnimation

  const slides: Slide[] = (raw.slides ?? [])
    .map((s, idx) => {
      const title = (s.title ?? '').trim()
      const subtitle = (s.subtitle ?? '').trim() || undefined
      const layout: SlideLayout = s.layout || (idx === 0 ? 'hero' : s.statNumber ? 'big_stat' : s.cards?.length ? 'cards' : 'checklist')

      const bullets = Array.isArray(s.bullets)
        ? s.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
        : []

      const cards: SlideCard[] | undefined = Array.isArray(s.cards)
        ? s.cards
            .map((c) => ({
              title: String(c.title ?? '').trim(),
              description: String(c.description ?? '').trim(),
              tag: c.tag ? String(c.tag).trim() : undefined,
            }))
            .filter((c) => c.title || c.description)
            .slice(0, 3)
        : undefined

      return {
        id: `slide-${idx + 1}-${Date.now()}`,
        title: title || `Slide ${idx + 1}`,
        subtitle,
        layout,
        bullets,
        statNumber: s.statNumber ? String(s.statNumber).trim() : undefined,
        statLabel: s.statLabel ? String(s.statLabel).trim() : undefined,
        quoteAuthor: s.quoteAuthor ? String(s.quoteAuthor).trim() : undefined,
        cards: cards && cards.length ? cards : undefined,
        notes: (s.notes ?? '').trim() || undefined,
        theme: deckTheme,
        font: deckFont,
        animation: deckAnim,
      }
    })
    .filter((s) => s.title || s.bullets.length || s.cards?.length || s.statNumber)

  const limited = count && count > 0 ? slides.slice(0, Math.max(1, Math.min(count, 8))) : slides

  return {
    topic,
    title: (raw.title ?? '').trim() || topic,
    theme: deckTheme,
    font: deckFont,
    animation: deckAnim,
    slides: limited,
  }
}

export async function generateSlides(options: GenerateSlidesOptions): Promise<SlideDeck> {
  const provider = getDirectorProvider()
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI & Reasoning.')
  const languageLine = options.language && options.language !== 'auto' ? ` Write in ${options.language}.` : ''
  const countLine = options.count && options.count > 0 ? ` Generate exactly ${options.count} slides.` : ''
  const theme = options.theme ?? 'pitch_dark'
  const font = options.font ?? 'sans'
  const animation = options.animation ?? 'slide_up'

  const userPrompt = `TOPIC: "${options.topic}"${countLine}${languageLine}
THEME: ${theme}
FONT: ${font}
ANIMATION: ${animation}
ARCHETYPE: ${options.layoutArchetype || 'Modern Tech Startup Pitch Deck'}

Generate the complete, visually rich presentation deck JSON now.`

  const messages: ChatMessage[] = [
    { role: 'system', content: SLIDES_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
  const reply = await chatCompletion(provider, messages)
  const raw = extractJson(reply.content ?? '')
  if (!raw || typeof raw !== 'object') throw new Error('Slides response was not an object.')
  return normalizeSlides(raw as RawDeck, options.topic, options.count, theme, font, animation)
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Render formatted bullet item with bold emphasis on first keywords */
function formatBulletHtml(text: string, accentColor: string): string {
  const escaped = xmlEscape(text)
  const formatted = escaped.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${accentColor};">$1</strong>`)
  return formatted
}

/** Build a self-contained inline-styled HTML slide with animations for live preview & rasterization. */
export function renderSlideHtml(
  slide: Slide,
  index: number,
  total: number,
  overrideTheme?: SlideTheme,
  overrideFont?: SlideFont,
  overrideAnimation?: SlideAnimation,
): string {
  const theme = overrideTheme || slide.theme || 'pitch_dark'
  const font = overrideFont || slide.font || 'sans'
  const anim = overrideAnimation || slide.animation || 'slide_up'

  const fontDef = SLIDE_FONTS_META[font] || SLIDE_FONTS_META.sans
  const themeMeta = SLIDE_THEMES_META[theme] || SLIDE_THEMES_META.pitch_dark
  const accent = themeMeta.accent

  const title = xmlEscape(slide.title)
  const subtitle = slide.subtitle ? `<div class="slide-subtitle">${xmlEscape(slide.subtitle)}</div>` : ''
  const counter = total > 1 ? `<div class="slide-counter">${index} / ${total}</div>` : ''

  // Layout Content Generators
  let bodyContent = ''

  if (slide.layout === 'big_stat' && (slide.statNumber || slide.bullets.length)) {
    const stat = xmlEscape(slide.statNumber || '100%')
    const label = xmlEscape(slide.statLabel || slide.bullets[0] || 'Key Performance Milestone')
    const supportingBullets = slide.bullets
      .slice(slide.statLabel ? 0 : 1)
      .map((b) => `<li>${formatBulletHtml(b, accent)}</li>`)
      .join('')

    bodyContent = `
      <div class="stat-container">
        <div class="stat-number">${stat}</div>
        <div class="stat-label">${label}</div>
      </div>
      ${supportingBullets ? `<ul class="stat-bullets">${supportingBullets}</ul>` : ''}
    `
  } else if (slide.layout === 'cards' && slide.cards?.length) {
    const cardsHtml = slide.cards
      .map(
        (c, idx) => `
        <div class="slide-card card-${idx + 1}">
          ${c.tag ? `<div class="card-tag">${xmlEscape(c.tag)}</div>` : ''}
          <div class="card-title">${xmlEscape(c.title)}</div>
          <div class="card-desc">${xmlEscape(c.description)}</div>
        </div>
      `,
      )
      .join('')

    bodyContent = `<div class="cards-grid">${cardsHtml}</div>`
  } else if (slide.layout === 'quote' && (slide.bullets.length || slide.title)) {
    const quoteText = xmlEscape(slide.bullets[0] || slide.title)
    const author = xmlEscape(slide.quoteAuthor || 'Keynote Insight')
    bodyContent = `
      <div class="quote-container">
        <div class="quote-mark">“</div>
        <div class="quote-text">${quoteText}</div>
        <div class="quote-author">— ${author}</div>
      </div>
    `
  } else if (slide.layout === 'split' && slide.bullets.length >= 2) {
    const half = Math.ceil(slide.bullets.length / 2)
    const col1 = slide.bullets.slice(0, half).map((b) => `<li>${formatBulletHtml(b, accent)}</li>`).join('')
    const col2 = slide.bullets.slice(half).map((b) => `<li>${formatBulletHtml(b, accent)}</li>`).join('')
    bodyContent = `
      <div class="split-container">
        <div class="split-col"><ul>${col1}</ul></div>
        <div class="split-col"><ul>${col2}</ul></div>
      </div>
    `
  } else {
    // Standard Checklist / Hero
    const bulletsHtml = (slide.bullets.length ? slide.bullets : ['Key takeaway and essential narrative insight'])
      .map((b) => `<li>${formatBulletHtml(b, accent)}</li>`)
      .join('')
    bodyContent = `<ul class="slide-bullets">${bulletsHtml}</ul>`
  }

  // Animation CSS Keyframes
  const animationCss = `
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes zoomPop {
      0% { opacity: 0; transform: scale(0.92); }
      70% { opacity: 1; transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes glowPulse {
      0%, 100% { filter: drop-shadow(0 0 15px ${accent}44); }
      50% { filter: drop-shadow(0 0 30px ${accent}88); }
    }
    @keyframes kineticSnap {
      0% { opacity: 0; transform: translateX(-20px) rotate(-1deg); }
      100% { opacity: 1; transform: translateX(0) rotate(0deg); }
    }

    .slide-root {
      animation: ${
        anim === 'fade'
          ? 'fadeIn 0.6s ease-out forwards'
          : anim === 'zoom_pop'
            ? 'zoomPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            : anim === 'glass_glow'
              ? 'fadeIn 0.6s ease-out forwards, glowPulse 3s infinite ease-in-out'
              : anim === 'kinetic'
                ? 'kineticSnap 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                : 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      };
    }
  `

  // Theme Styles
  const themeStyles: Record<SlideTheme, string> = {
    pitch_dark: `
      body { margin: 0; width: 100%; height: 100%; background: #0b0f19; color: #f8fafc; font-family: ${fontDef.family}; box-sizing: border-box; }
      .slide-root { position: relative; width: 100%; height: 100%; padding: 6% 7%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: radial-gradient(circle at 80% 20%, #1e1b4b 0%, #0b0f19 70%); }
      .slide-counter { position: absolute; top: 5%; right: 6%; font-size: 14px; font-weight: 600; color: #94a3b8; font-family: 'Fira Code', monospace; }
      .slide-subtitle { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: ${accent}; margin-bottom: 8px; }
      .slide-title { font-size: 42px; font-weight: 800; line-height: 1.15; margin: 0 0 20px 0; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
      .slide-bullets { margin: 0; padding: 0 0 0 20px; list-style: none; font-size: 24px; line-height: 1.55; color: #cbd5e1; }
      .slide-bullets li { margin-bottom: 12px; position: relative; }
      .slide-bullets li::before { content: "▸"; color: ${accent}; position: absolute; left: -22px; font-weight: 800; }
      .stat-container { background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 16px; padding: 24px 32px; backdrop-filter: blur(12px); display: inline-block; }
      .stat-number { font-size: 64px; font-weight: 900; color: #ffffff; background: linear-gradient(135deg, #a5b4fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .stat-label { font-size: 20px; color: #94a3b8; font-weight: 600; margin-top: 4px; }
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 100%; }
      .slide-card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 20px; backdrop-filter: blur(8px); }
      .card-tag { font-size: 10px; font-weight: 700; color: ${accent}; text-transform: uppercase; margin-bottom: 6px; }
      .card-title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 6px; }
      .card-desc { font-size: 13px; color: #94a3b8; line-height: 1.45; }
      .quote-container { border-left: 4px solid ${accent}; padding-left: 24px; }
      .quote-text { font-size: 32px; font-weight: 600; font-style: italic; line-height: 1.35; color: #f1f5f9; }
      .quote-author { font-size: 16px; color: #94a3b8; margin-top: 14px; font-weight: 500; }
      .split-container { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    `,
    apple_minimal: `
      body { margin: 0; width: 100%; height: 100%; background: #000000; color: #ffffff; font-family: ${fontDef.family}; box-sizing: border-box; }
      .slide-root { position: relative; width: 100%; height: 100%; padding: 7% 8%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
      .slide-counter { position: absolute; top: 6%; right: 6%; font-size: 13px; color: #64748b; font-weight: 500; }
      .slide-subtitle { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #38bdf8; margin-bottom: 12px; }
      .slide-title { font-size: 52px; font-weight: 800; line-height: 1.1; margin: 0 0 24px 0; letter-spacing: -1px; }
      .slide-bullets { margin: 0; padding: 0; list-style: none; font-size: 26px; line-height: 1.6; color: #a1a1aa; }
      .slide-bullets li { margin-bottom: 14px; }
      .stat-number { font-size: 80px; font-weight: 900; color: #38bdf8; letter-spacing: -2px; }
      .stat-label { font-size: 24px; color: #e4e4e7; font-weight: 500; }
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      .slide-card { border-top: 2px solid #27272a; padding-top: 16px; }
      .card-title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 6px; }
      .card-desc { font-size: 14px; color: #71717a; line-height: 1.5; }
      .quote-text { font-size: 38px; font-weight: 700; line-height: 1.25; color: #ffffff; }
      .quote-author { font-size: 18px; color: #a1a1aa; margin-top: 16px; }
      .split-container { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    `,
    cyber_neon: `
      body { margin: 0; width: 100%; height: 100%; background: #030712; color: #e0e7ff; font-family: ${fontDef.family}; box-sizing: border-box; }
      .slide-root { position: relative; width: 100%; height: 100%; padding: 6% 7%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(6, 182, 212, 0.3); }
      .slide-counter { position: absolute; top: 5%; right: 6%; font-size: 13px; color: #06b6d4; font-family: monospace; }
      .slide-subtitle { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: #ec4899; }
      .slide-title { font-size: 46px; font-weight: 900; line-height: 1.15; color: #06b6d4; text-shadow: 0 0 20px rgba(6,182,212,0.6); margin: 0 0 20px 0; }
      .slide-bullets { margin: 0; padding: 0 0 0 20px; list-style: none; font-size: 24px; line-height: 1.6; color: #cbd5e1; }
      .slide-bullets li::before { content: "⚡"; position: absolute; left: -24px; }
      .stat-number { font-size: 72px; font-weight: 900; color: #ec4899; text-shadow: 0 0 25px rgba(236,72,153,0.7); }
      .stat-label { font-size: 20px; color: #06b6d4; font-family: monospace; }
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .slide-card { background: rgba(6, 182, 212, 0.05); border: 1px solid #06b6d4; border-radius: 8px; padding: 18px; box-shadow: 0 0 15px rgba(6,182,212,0.15); }
      .card-title { font-size: 18px; font-weight: 800; color: #ec4899; }
      .card-desc { font-size: 13px; color: #94a3b8; }
      .quote-text { font-size: 32px; font-weight: 800; color: #06b6d4; }
      .split-container { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    `,
    sunset_warm: `
      body { margin: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #4c1d95 0%, #be185d 50%, #f59e0b 100%); color: #ffffff; font-family: ${fontDef.family}; box-sizing: border-box; }
      .slide-root { position: relative; width: 100%; height: 100%; padding: 6% 7%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
      .slide-counter { position: absolute; top: 5%; right: 6%; font-size: 14px; font-weight: 700; opacity: 0.8; }
      .slide-subtitle { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 6px; }
      .slide-title { font-size: 46px; font-weight: 900; line-height: 1.15; margin: 0 0 20px 0; text-shadow: 0 2px 14px rgba(0,0,0,0.3); }
      .slide-bullets { margin: 0; padding: 0 0 0 22px; list-style: none; font-size: 25px; line-height: 1.6; text-shadow: 0 1px 6px rgba(0,0,0,0.2); }
      .slide-bullets li::before { content: "★"; position: absolute; left: -24px; color: #fef08a; }
      .stat-number { font-size: 76px; font-weight: 900; color: #ffffff; text-shadow: 0 4px 20px rgba(0,0,0,0.35); }
      .stat-label { font-size: 22px; font-weight: 700; color: #fde047; }
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .slide-card { background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 12px; padding: 18px; backdrop-filter: blur(10px); }
      .card-title { font-size: 19px; font-weight: 800; color: #ffffff; }
      .card-desc { font-size: 13px; opacity: 0.95; line-height: 1.45; }
      .quote-text { font-size: 34px; font-weight: 700; font-style: italic; }
      .split-container { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    `,
    clean_studio: `
      body { margin: 0; width: 100%; height: 100%; background: #f8fafc; color: #0f172a; font-family: ${fontDef.family}; box-sizing: border-box; }
      .slide-root { position: relative; width: 100%; height: 100%; padding: 6% 7%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
      .slide-counter { position: absolute; top: 5%; right: 6%; font-size: 14px; font-weight: 700; color: #64748b; }
      .slide-subtitle { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #2563eb; margin-bottom: 6px; }
      .slide-title { font-size: 44px; font-weight: 800; line-height: 1.15; color: #0f172a; margin: 0 0 20px 0; }
      .slide-bullets { margin: 0; padding: 0 0 0 22px; list-style: none; font-size: 24px; line-height: 1.6; color: #334155; }
      .slide-bullets li::before { content: "▪"; position: absolute; left: -20px; color: #2563eb; font-size: 28px; }
      .stat-number { font-size: 74px; font-weight: 900; color: #2563eb; }
      .stat-label { font-size: 22px; font-weight: 700; color: #475569; }
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .slide-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      .card-title { font-size: 18px; font-weight: 800; color: #0f172a; }
      .card-desc { font-size: 13px; color: #64748b; }
      .quote-text { font-size: 32px; font-weight: 700; color: #1e293b; }
      .split-container { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    `,
    neo_brutalist: `
      body { margin: 0; width: 100%; height: 100%; background: #fef08a; color: #000000; font-family: ${fontDef.family}; box-sizing: border-box; }
      .slide-root { position: relative; width: 100%; height: 100%; padding: 6% 7%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 4px solid #000000; box-shadow: 8px 8px 0px #000000; }
      .slide-counter { position: absolute; top: 5%; right: 6%; font-size: 15px; font-weight: 900; background: #000000; color: #ffffff; padding: 4px 8px; }
      .slide-subtitle { font-size: 14px; font-weight: 900; text-transform: uppercase; background: #ec4899; color: #ffffff; display: inline-block; padding: 2px 8px; border: 2px solid #000000; margin-bottom: 8px; }
      .slide-title { font-size: 46px; font-weight: 900; line-height: 1.1; margin: 0 0 20px 0; color: #000000; }
      .slide-bullets { margin: 0; padding: 0; list-style: none; font-size: 24px; line-height: 1.55; }
      .slide-bullets li { background: #ffffff; border: 3px solid #000000; padding: 10px 14px; margin-bottom: 10px; box-shadow: 4px 4px 0px #000000; font-weight: 700; }
      .stat-number { font-size: 80px; font-weight: 900; color: #000000; background: #38bdf8; padding: 10px 24px; border: 4px solid #000000; display: inline-block; box-shadow: 6px 6px 0px #000000; }
      .stat-label { font-size: 24px; font-weight: 900; margin-top: 8px; }
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .slide-card { background: #ffffff; border: 3px solid #000000; padding: 16px; box-shadow: 5px 5px 0px #000000; }
      .card-title { font-size: 18px; font-weight: 900; }
      .card-desc { font-size: 13px; font-weight: 600; }
      .quote-text { font-size: 34px; font-weight: 900; background: #ffffff; border: 4px solid #000000; padding: 20px; box-shadow: 8px 8px 0px #000000; }
      .split-container { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    `,
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${themeStyles[theme]}
          ${animationCss}
        </style>
      </head>
      <body>
        <div class="slide-root">
          ${counter}
          <div>
            ${subtitle}
            <div class="slide-title">${title}</div>
          </div>
          ${bodyContent}
        </div>
      </body>
    </html>
  `
}

export async function renderSlidePng(
  slide: Slide,
  index: number,
  total: number,
  theme: SlideTheme,
  width: number,
  height: number,
  font?: SlideFont,
  animation?: SlideAnimation,
): Promise<Blob> {
  const html = renderSlideHtml(slide, index, total, theme, font, animation)
  return renderHtmlToPng(html, width, height)
}