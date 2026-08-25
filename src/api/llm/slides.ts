import { chatCompletion, getDirectorProvider, type ChatMessage } from './director'
import { firecrawlSearch, firecrawlScrape, isFirecrawlConfigured, type WebSearchResult } from '@/api/research/firecrawl'

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
  sources?: WebSearchResult[]
}

export interface GenerateSlidesOptions {
  topic: string
  count?: number
  language?: string
  theme?: SlideTheme
  font?: SlideFont
  animation?: SlideAnimation
  layoutArchetype?: string
  provider?: string
  model?: string
  useWebResearch?: boolean
  researchData?: WebSearchResult[]
  sourceUrl?: string
  onResearchProgress?: (msg: string) => void
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

export function generateLocalFallbackSlides(
  topic: string,
  count = 4,
  theme: SlideTheme = 'pitch_dark',
  font: SlideFont = 'sans',
  animation: SlideAnimation = 'slide_up',
): SlideDeck {
  const cleanTopic = topic.trim() || 'Product Overview'
  const title = cleanTopic.length > 50 ? `${cleanTopic.slice(0, 47)}...` : cleanTopic

  const slides: Slide[] = [
    {
      id: `slide-1-${Date.now()}`,
      title,
      subtitle: 'Executive Briefing & Strategic Overview',
      layout: 'hero',
      bullets: [
        `**Core Vision**: Transforming how teams execute and innovate on ${cleanTopic}.`,
        '**Key Objectives**: Accelerate workflow velocity, reduce overhead, and scale impact.',
        '**Target Outcomes**: Measurable performance gains delivered with automated precision.',
      ],
      theme,
      font,
      animation,
    },
    {
      id: `slide-2-${Date.now()}`,
      title: 'The Core Problem & Market Opportunity',
      subtitle: 'Status Quo Analysis',
      layout: 'split',
      bullets: [
        '**Legacy Friction**: High latency manual processes limiting throughput.',
        '**Resource Drain**: Fragmented toolchains causing context switching.',
        '**Modern Solution**: Unified AI-driven pipelines with real-time feedback.',
        '**Competitive Edge**: Seamless integration with instant time-to-value.',
      ],
      theme,
      font,
      animation,
    },
    {
      id: `slide-3-${Date.now()}`,
      title: 'Architectural Performance & Key Metrics',
      subtitle: 'Proven Results',
      layout: 'big_stat',
      statNumber: '10x',
      statLabel: 'Productivity Gain & Workflow Acceleration',
      bullets: [
        '**99.4% Precision**: High accuracy automation across all operations.',
        '**Zero Latency**: Continuous real-time processing with state persistence.',
      ],
      theme,
      font,
      animation,
    },
    {
      id: `slide-4-${Date.now()}`,
      title: 'Key Capabilities & Strategic Pillars',
      subtitle: 'Feature Breakdown',
      layout: 'cards',
      cards: [
        { tag: 'PILLAR 1', title: 'Automated Synthesis', description: 'Intelligent extraction of insights and structured narrative decks.' },
        { tag: 'PILLAR 2', title: 'Real-Time Compositing', description: 'Instant multi-track timeline placement and layer control.' },
        { tag: 'PILLAR 3', title: 'Extensible Pipeline', description: 'Seamless transitions, audio mixing, and high-fidelity rendering.' },
      ],
      bullets: [],
      theme,
      font,
      animation,
    },
    {
      id: `slide-5-${Date.now()}`,
      title: 'Strategic Roadmap & Next Steps',
      subtitle: 'Action Plan',
      layout: 'checklist',
      bullets: [
        '**Phase 1**: Immediate deployment and timeline integration.',
        '**Phase 2**: Multi-modal enhancement with narration & audio mixing.',
        '**Phase 3**: Scaled production and final export delivery.',
      ],
      theme,
      font,
      animation,
    },
  ]

  const limited = slides.slice(0, Math.max(1, Math.min(count, slides.length)))
  return {
    topic: cleanTopic,
    title,
    theme,
    font,
    animation,
    slides: limited,
  }
}

export async function generateSlides(options: GenerateSlidesOptions): Promise<SlideDeck> {
  const theme = options.theme ?? 'pitch_dark'
  const font = options.font ?? 'sans'
  const animation = options.animation ?? 'slide_up'
  const count = options.count ?? 4

  let researchResults: WebSearchResult[] = options.researchData ?? []

  // Perform real-time Firecrawl search or scrape if enabled
  if (options.useWebResearch || options.sourceUrl) {
    try {
      if (options.sourceUrl && isFirecrawlConfigured()) {
        options.onResearchProgress?.(`Scraping webpage ${options.sourceUrl} via Firecrawl...`)
        const scraped = await firecrawlScrape(options.sourceUrl)
        if (scraped) researchResults = [scraped, ...researchResults]
      } else if (options.useWebResearch && isFirecrawlConfigured() && researchResults.length === 0) {
        options.onResearchProgress?.(`Searching real-time facts on "${options.topic}" via Firecrawl...`)
        const searchHits = await firecrawlSearch(options.topic, 5)
        if (searchHits.length > 0) {
          researchResults = searchHits
        }
      }
    } catch (err) {
      console.warn('Firecrawl web research error (proceeding with generation):', err)
    }
  }

  const provider = getDirectorProvider({ provider: options.provider, model: options.model })
  if (!provider) {
    const fallback = generateLocalFallbackSlides(options.topic, count, theme, font, animation)
    fallback.sources = researchResults.length > 0 ? researchResults : undefined
    return fallback
  }

  const languageLine = options.language && options.language !== 'auto' ? ` Write in ${options.language}.` : ''
  const countLine = options.count && options.count > 0 ? ` Generate exactly ${options.count} slides.` : ''

  let researchPromptBlock = ''
  if (researchResults.length > 0) {
    const findings = researchResults
      .map(
        (r, i) =>
          `[Source ${i + 1}]: ${r.title} (${r.url})\nSummary: ${r.description || ''}\n${(r.markdown || '').slice(0, 600)}`,
      )
      .join('\n---\n')
    researchPromptBlock = `\n\nREAL-TIME GROUNDED WEB RESEARCH (via Firecrawl):\n${findings}\n\nCRITICAL INSTRUCTION: Ground the presentation slides in these authentic facts, real-world metrics, recent breakthroughs, and authoritative data points. In the speaker notes or subtitle, cite relevant sources where appropriate.`
  }

  const userPrompt = `TOPIC: "${options.topic}"${countLine}${languageLine}
THEME: ${theme}
FONT: ${font}
ANIMATION: ${animation}
ARCHETYPE: ${options.layoutArchetype || 'Modern Tech Startup Pitch Deck'}${researchPromptBlock}

Generate the complete, visually rich presentation deck JSON now.`

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: SLIDES_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]
    const reply = await chatCompletion(provider, messages)
    const raw = extractJson(reply.content ?? '')
    if (raw && typeof raw === 'object') {
      const normalized = normalizeSlides(raw as RawDeck, options.topic, options.count, theme, font, animation)
      if (researchResults.length > 0) {
        normalized.sources = researchResults
      }
      return normalized
    }
  } catch (err) {
    console.warn('AI Slides generation fallback triggered:', err)
  }

  const fallback = generateLocalFallbackSlides(options.topic, count, theme, font, animation)
  if (researchResults.length > 0) {
    fallback.sources = researchResults
  }
  return fallback
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
      .slide-bullets li::before { content: "•"; position: absolute; left: -24px; }
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
      .slide-bullets li::before { content: "•"; position: absolute; left: -24px; color: #fef08a; }
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = words[0] || ''

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width < maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.arcTo(x + width, y, x + width, y + radius, radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
  ctx.lineTo(x + radius, y + height)
  ctx.arcTo(x, y + height, x, y + height - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

export function renderSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  index: number,
  total: number,
  theme: SlideTheme = 'pitch_dark',
  width = 1280,
  height = 720,
  font: SlideFont = 'sans',
) {
  const isPortrait = height > width
  const minDim = Math.min(width, height)
  const scale = minDim / 720
  const themeMeta = SLIDE_THEMES_META[theme] || SLIDE_THEMES_META.pitch_dark
  const fontDef = SLIDE_FONTS_META[font] || SLIDE_FONTS_META.sans
  const accent = themeMeta.accent

  // 1. Draw Background
  if (theme === 'pitch_dark') {
    ctx.fillStyle = '#0b0f19'
    ctx.fillRect(0, 0, width, height)
    const radGrad = ctx.createRadialGradient(width * 0.8, height * 0.2, 0, width * 0.8, height * 0.2, width * 0.8)
    radGrad.addColorStop(0, '#1e1b4b')
    radGrad.addColorStop(0.7, '#0b0f19')
    ctx.fillStyle = radGrad
    ctx.fillRect(0, 0, width, height)
  } else if (theme === 'apple_minimal') {
    ctx.fillStyle = '#050508'
    ctx.fillRect(0, 0, width, height)
    const radGrad = ctx.createRadialGradient(width * 0.2, height * 0.2, 0, width * 0.2, height * 0.2, width * 0.6)
    radGrad.addColorStop(0, '#181824')
    radGrad.addColorStop(1, '#050508')
    ctx.fillStyle = radGrad
    ctx.fillRect(0, 0, width, height)
  } else if (theme === 'cyber_neon') {
    ctx.fillStyle = '#030712'
    ctx.fillRect(0, 0, width, height)
    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.6)
    g1.addColorStop(0, 'rgba(6, 182, 212, 0.15)')
    g1.addColorStop(1, 'transparent')
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, width, height)
    const g2 = ctx.createRadialGradient(width, height, 0, width, height, width * 0.6)
    g2.addColorStop(0, 'rgba(236, 72, 153, 0.12)')
    g2.addColorStop(1, 'transparent')
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, width, height)
  } else if (theme === 'sunset_warm') {
    const lin = ctx.createLinearGradient(0, 0, width, height)
    lin.addColorStop(0, '#3b0764')
    lin.addColorStop(0.5, '#831843')
    lin.addColorStop(1, '#78350f')
    ctx.fillStyle = lin
    ctx.fillRect(0, 0, width, height)
  } else if (theme === 'clean_studio') {
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, width, height)
  } else if (theme === 'neo_brutalist') {
    ctx.fillStyle = '#fef08a'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 6 * scale
    ctx.strokeRect(12 * scale, 12 * scale, width - 24 * scale, height - 24 * scale)
  }

  // 2. Counter Badge (top-right)
  const isLight = theme === 'clean_studio' || theme === 'neo_brutalist'
  const textColor = isLight ? '#0f172a' : '#ffffff'
  const mutedText = isLight ? '#475569' : '#94a3b8'

  if (total > 1) {
    const counterText = `${index} / ${total}`
    ctx.font = `bold ${Math.round(14 * scale)}px ${fontDef.family}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    if (theme === 'neo_brutalist') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(width - 95 * scale, 30 * scale, 65 * scale, 26 * scale)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(counterText, width - 40 * scale, 43 * scale)
    } else {
      ctx.fillStyle = mutedText
      ctx.fillText(counterText, width - 60 * scale, 45 * scale)
    }
  }

  // 3. Subtitle / Category Badge (top-left)
  let contentY = 60 * scale
  if (slide.subtitle) {
    ctx.font = `bold ${Math.round(13 * scale)}px ${fontDef.family}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    if (theme === 'neo_brutalist') {
      const subWidth = ctx.measureText(slide.subtitle.toUpperCase()).width
      ctx.fillStyle = '#ec4899'
      ctx.fillRect(60 * scale, contentY - 12 * scale, subWidth + 16 * scale, 24 * scale)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2 * scale
      ctx.strokeRect(60 * scale, contentY - 12 * scale, subWidth + 16 * scale, 24 * scale)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(slide.subtitle.toUpperCase(), 68 * scale, contentY)
    } else {
      ctx.fillStyle = accent
      ctx.fillText(slide.subtitle.toUpperCase(), 60 * scale, contentY)
    }
    contentY += 32 * scale
  }

  // 4. Slide Title
  ctx.font = `bold ${Math.round(38 * scale)}px ${fontDef.family}`
  ctx.fillStyle = textColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const titleLines = wrapText(ctx, slide.title, width - 120 * scale)
  for (const line of titleLines.slice(0, 3)) {
    ctx.fillText(line, 60 * scale, contentY)
    contentY += 46 * scale
  }
  contentY += 24 * scale

  // 5. Layout Content
  const layout = slide.layout || 'hero'

  if (layout === 'big_stat' && (slide.statNumber || slide.bullets.length)) {
    const statNum = slide.statNumber || '100%'
    const statDesc = slide.statLabel || slide.bullets[0] || 'Key Performance Milestone'

    // Big Stat Number
    ctx.font = `900 ${Math.round(76 * scale)}px ${fontDef.family}`
    ctx.fillStyle = accent
    ctx.fillText(statNum, 60 * scale, contentY)

    const numWidth = ctx.measureText(statNum).width
    ctx.font = `bold ${Math.round(22 * scale)}px ${fontDef.family}`
    ctx.fillStyle = mutedText
    const descLines = wrapText(ctx, statDesc, isPortrait ? width - 120 * scale : width - numWidth - 160 * scale)
    let descY = isPortrait ? contentY + 80 * scale : contentY + 12 * scale
    const descX = isPortrait ? 60 * scale : 80 * scale + numWidth
    for (const dl of descLines.slice(0, 2)) {
      ctx.fillText(dl, descX, descY)
      descY += 28 * scale
    }

    contentY = isPortrait ? descY + 20 * scale : contentY + 105 * scale
    // Supporting bullets
    const bullets = slide.bullets.slice(slide.statLabel ? 0 : 1, 4)
    for (const b of bullets) {
      const cleanB = b.replace(/\*\*/g, '')
      ctx.font = `${Math.round(18 * scale)}px ${fontDef.family}`
      ctx.fillStyle = accent
      ctx.fillText('▸', 60 * scale, contentY)
      ctx.fillStyle = textColor
      ctx.fillText(cleanB, 85 * scale, contentY)
      contentY += 34 * scale
    }
  } else if (layout === 'cards' && slide.cards?.length) {
    const cards = slide.cards.slice(0, 3)

    if (isPortrait) {
      // Stack cards vertically in portrait
      const cardWidth = width - 120 * scale
      const cardHeight = Math.min(140 * scale, (height - contentY - 60 * scale) / cards.length - 12 * scale)

      cards.forEach((card, idx) => {
        const cardX = 60 * scale
        const cardY = contentY + idx * (cardHeight + 12 * scale)

        roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 14 * scale)
        if (theme === 'neo_brutalist') {
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 3 * scale
          ctx.stroke()
        } else {
          ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.9)' : 'rgba(30, 41, 59, 0.6)'
          ctx.fill()
          ctx.strokeStyle = isLight ? 'rgba(203, 213, 225, 0.8)' : 'rgba(255, 255, 255, 0.12)'
          ctx.lineWidth = 1.5 * scale
          ctx.stroke()
        }

        let cy = cardY + 16 * scale
        if (card.tag) {
          ctx.font = `bold ${Math.round(11 * scale)}px ${fontDef.family}`
          ctx.fillStyle = accent
          ctx.fillText(card.tag.toUpperCase(), cardX + 16 * scale, cy)
          cy += 18 * scale
        }

        ctx.font = `bold ${Math.round(17 * scale)}px ${fontDef.family}`
        ctx.fillStyle = textColor
        ctx.fillText(card.title, cardX + 16 * scale, cy)
        cy += 24 * scale

        ctx.font = `${Math.round(13 * scale)}px ${fontDef.family}`
        ctx.fillStyle = mutedText
        const descLines = wrapText(ctx, card.description, cardWidth - 32 * scale)
        for (const dl of descLines.slice(0, 2)) {
          ctx.fillText(dl, cardX + 16 * scale, cy)
          cy += 18 * scale
        }
      })
    } else {
      // Horizontal cards in landscape
      const cardWidth = (width - 120 * scale - (cards.length - 1) * 20 * scale) / cards.length
      const cardHeight = height - contentY - 60 * scale

      cards.forEach((card, idx) => {
        const cardX = 60 * scale + idx * (cardWidth + 20 * scale)
        const cardY = contentY

        roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 14 * scale)
        if (theme === 'neo_brutalist') {
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 3 * scale
          ctx.stroke()
        } else {
          ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.9)' : 'rgba(30, 41, 59, 0.6)'
          ctx.fill()
          ctx.strokeStyle = isLight ? 'rgba(203, 213, 225, 0.8)' : 'rgba(255, 255, 255, 0.12)'
          ctx.lineWidth = 1.5 * scale
          ctx.stroke()
        }

        let cy = cardY + 20 * scale
        if (card.tag) {
          ctx.font = `bold ${Math.round(11 * scale)}px ${fontDef.family}`
          ctx.fillStyle = accent
          ctx.fillText(card.tag.toUpperCase(), cardX + 16 * scale, cy)
          cy += 20 * scale
        }

        ctx.font = `bold ${Math.round(18 * scale)}px ${fontDef.family}`
        ctx.fillStyle = textColor
        ctx.fillText(card.title, cardX + 16 * scale, cy)
        cy += 26 * scale

        ctx.font = `${Math.round(13 * scale)}px ${fontDef.family}`
        ctx.fillStyle = mutedText
        const descLines = wrapText(ctx, card.description, cardWidth - 32 * scale)
        for (const dl of descLines.slice(0, 4)) {
          ctx.fillText(dl, cardX + 16 * scale, cy)
          cy += 20 * scale
        }
      })
    }
  } else if (layout === 'quote' && (slide.bullets.length || slide.title)) {
    const quoteText = (slide.bullets[0] || slide.title).replace(/\*\*/g, '')
    const author = slide.quoteAuthor || 'Keynote Insight'

    // Quote bar
    ctx.fillStyle = accent
    ctx.fillRect(60 * scale, contentY, 4 * scale, 120 * scale)

    ctx.font = `italic 600 ${Math.round(26 * scale)}px ${fontDef.family}`
    ctx.fillStyle = textColor
    const qLines = wrapText(ctx, `“${quoteText}”`, width - 180 * scale)
    let qy = contentY + 4 * scale
    for (const ql of qLines.slice(0, 4)) {
      ctx.fillText(ql, 80 * scale, qy)
      qy += 34 * scale
    }
    qy += 12 * scale
    ctx.font = `bold ${Math.round(15 * scale)}px ${fontDef.family}`
    ctx.fillStyle = mutedText
    ctx.fillText(`— ${author}`, 80 * scale, qy)
  } else if (layout === 'split' && slide.bullets.length >= 2) {
    const half = Math.ceil(slide.bullets.length / 2)
    const col1 = slide.bullets.slice(0, half)
    const col2 = slide.bullets.slice(half)

    if (isPortrait) {
      // Stack split vertically in portrait
      let cy = contentY
      for (const b of [...col1, ...col2]) {
        const clean = b.replace(/\*\*/g, '')
        ctx.font = `${Math.round(18 * scale)}px ${fontDef.family}`
        ctx.fillStyle = accent
        ctx.fillText('▸', 60 * scale, cy)
        ctx.fillStyle = textColor
        const lines = wrapText(ctx, clean, width - 160 * scale)
        for (const l of lines) {
          ctx.fillText(l, 82 * scale, cy)
          cy += 24 * scale
        }
        cy += 12 * scale
      }
    } else {
      const colWidth = (width - 160 * scale) / 2

      // Col 1
      let c1y = contentY
      for (const b of col1) {
        const clean = b.replace(/\*\*/g, '')
        ctx.font = `${Math.round(18 * scale)}px ${fontDef.family}`
        ctx.fillStyle = accent
        ctx.fillText('▸', 60 * scale, c1y)
        ctx.fillStyle = textColor
        const lines = wrapText(ctx, clean, colWidth - 30 * scale)
        for (const l of lines) {
          ctx.fillText(l, 82 * scale, c1y)
          c1y += 24 * scale
        }
        c1y += 12 * scale
      }

      // Col 2
      let c2y = contentY
      const col2X = 60 * scale + colWidth + 40 * scale
      for (const b of col2) {
        const clean = b.replace(/\*\*/g, '')
        ctx.font = `${Math.round(18 * scale)}px ${fontDef.family}`
        ctx.fillStyle = accent
        ctx.fillText('▸', col2X, c2y)
        ctx.fillStyle = textColor
        const lines = wrapText(ctx, clean, colWidth - 30 * scale)
        for (const l of lines) {
          ctx.fillText(l, col2X + 22 * scale, c2y)
          c2y += 24 * scale
        }
        c2y += 12 * scale
      }
    }
  } else {
    // Hero & Standard Checklist
    const bullets = slide.bullets.length ? slide.bullets : ['Key takeaway and essential narrative insight']
    for (const b of bullets.slice(0, 6)) {
      const clean = b.replace(/\*\*/g, '')
      ctx.font = `bold ${Math.round(20 * scale)}px ${fontDef.family}`
      ctx.fillStyle = accent
      ctx.fillText(layout === 'checklist' ? '✓' : '▸', 60 * scale, contentY)

      ctx.font = `${Math.round(20 * scale)}px ${fontDef.family}`
      ctx.fillStyle = textColor
      const lines = wrapText(ctx, clean, width - 160 * scale)
      for (const l of lines) {
        ctx.fillText(l, 90 * scale, contentY)
        contentY += 28 * scale
      }
      contentY += 12 * scale
    }
  }
}

export async function renderSlidePng(
  slide: Slide,
  index: number,
  total: number,
  theme: SlideTheme,
  width = 1280,
  height = 720,
  font?: SlideFont,
  _animation?: SlideAnimation,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  renderSlideToCanvas(ctx, slide, index, total, theme, width, height, font || 'sans')
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })
}