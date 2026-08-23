import { describe, expect, it } from 'vitest'
import { normalizeSlides, renderSlideHtml, type SlideTheme } from './slides'

describe('normalizeSlides', () => {
  it('maps raw deck JSON into slides and honors the count cap', () => {
    const deck = normalizeSlides(
      {
        title: 'How a battery works',
        slides: [
          { title: 'Overview', bullets: ['a', 'b', ''], notes: 'say hi' },
          { title: 'Chemistry', bullets: ['x', 'y', 'z', 'w', 'q', 'r', 's', 't'] },
          {},
        ],
      },
      'batteries',
      2,
    )
    expect(deck.title).toBe('How a battery works')
    expect(deck.slides.length).toBe(2)
    expect(deck.slides[0].bullets).toEqual(['a', 'b'])
    expect(deck.slides[0].notes).toBe('say hi')
    // bullets capped at 6
    expect(deck.slides[1].bullets.length).toBe(6)
  })

  it('keeps the topic as the title when absent', () => {
    const deck = normalizeSlides({ slides: [{ title: 'S', bullets: ['b'] }] }, 'water cycle')
    expect(deck.title).toBe('water cycle')
  })
})

describe('renderSlideHtml', () => {
  const themes: SlideTheme[] = [
    'pitch_dark',
    'apple_minimal',
    'cyber_neon',
    'sunset_warm',
    'clean_studio',
    'neo_brutalist',
  ]

  it('renders title and bullets for every theme', () => {
    for (const theme of themes) {
      const html = renderSlideHtml({ title: 'Intro', bullets: ['one', 'two'] }, 1, 3, theme)
      expect(html).toContain('Intro')
      expect(html).toContain('one')
      expect(html).toContain('two')
      expect(html).toContain('1 / 3')
    }
  })

  it('renders big_stat layout with metrics', () => {
    const html = renderSlideHtml(
      {
        title: 'Q3 Results',
        layout: 'big_stat',
        statNumber: '+400%',
        statLabel: 'Active Users Growth',
        bullets: ['Driven by viral TikTok features'],
      },
      1,
      1,
      'pitch_dark',
    )
    expect(html).toContain('+400%')
    expect(html).toContain('Active Users Growth')
    expect(html).toContain('Q3 Results')
  })

  it('renders cards layout with multi-column grid', () => {
    const html = renderSlideHtml(
      {
        title: '3 Core Features',
        layout: 'cards',
        bullets: [],
        cards: [
          { title: 'WebCodecs', description: 'Zero-latency video decoding', tag: 'ENGINE' },
          { title: 'WebGPU', description: 'Real-time shaders and filters', tag: 'GPU' },
        ],
      },
      1,
      1,
      'apple_minimal',
    )
    expect(html).toContain('WebCodecs')
    expect(html).toContain('WebGPU')
    expect(html).toContain('ENGINE')
  })

  it('XML-escapes user text for the foreignObject rasterizer', () => {
    const html = renderSlideHtml({ title: 'Q&A < 5', bullets: ['A & B', 'x > y'] }, 1, 1, 'clean_studio')
    expect(html).toContain('Q&amp;A &lt; 5')
    expect(html).toContain('A &amp; B')
    expect(html).toContain('x &gt; y')
    expect(html).not.toContain('<li>Q')
  })
})

describe('Marp Slide Engine & Inductive Context Storage', () => {
  it('parses multi-slide Marp markdown decks', async () => {
    const { parseMarpDeck, renderMarpSlideHtml } = await import('./marp')
    const md = `# WebCodecs Engine

---

## Architecture Overview
- **Zero-Latency Canvas**: Render directly to canvas
- **WebCodecs VP8/VP9**: Hardware-accelerated muxing

---

## Performance Benchmarks
- 60 FPS offline export
- 1080p Full HD rendering`

    const slides = parseMarpDeck(md)
    expect(slides.length).toBe(3)
    expect(slides[0].heading).toBe('WebCodecs Engine')
    expect(slides[1].heading).toBe('Architecture Overview')
    expect(slides[1].bullets.length).toBe(2)

    for (const theme of ['gaia', 'cyber', 'sunset', 'uncover', 'default'] as const) {
      const html = renderMarpSlideHtml(slides[1], 2, 3, theme)
      expect(html).toContain('Architecture Overview')
      expect(html).toContain('Zero-Latency Canvas')
    }
  })

  it('saves and retrieves slide decks from storage context', async () => {
    const { saveSlideDeckToStorage, getSavedSlideDecks } = await import('./slideContext')
    const deck = saveSlideDeckToStorage({
      title: 'AI Presentation',
      topic: 'Machine Learning',
      theme: 'cyber',
      markdown: '# Slide 1\n---\n## Slide 2',
      slideCount: 2,
    })

    expect(deck.id).toMatch(/^deck-/)
    expect(deck.title).toBe('AI Presentation')

    const saved = getSavedSlideDecks()
    expect(saved.some((d) => d.id === deck.id)).toBe(true)
  })
})