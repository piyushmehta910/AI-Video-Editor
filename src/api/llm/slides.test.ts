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
  const themes: SlideTheme[] = ['clean', 'dark', 'gradient']

  it('renders title and bullets for every theme', () => {
    for (const theme of themes) {
      const html = renderSlideHtml({ title: 'Intro', bullets: ['one', 'two'] }, 1, 3, theme)
      expect(html).toContain('Intro')
      expect(html).toContain('one')
      expect(html).toContain('two')
      expect(html).toContain('1 / 3')
    }
  })

  it('XML-escapes user text for the foreignObject rasterizer', () => {
    const html = renderSlideHtml({ title: 'Q&A < 5', bullets: ['A & B', 'x > y'] }, 1, 1, 'clean')
    expect(html).toContain('Q&amp;A &lt; 5')
    expect(html).toContain('A &amp; B')
    expect(html).toContain('x &gt; y')
    expect(html).not.toContain('<li>Q')
  })
})