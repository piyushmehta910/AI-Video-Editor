import { describe, it, expect } from 'vitest'
import { infographicGenerator } from './InfographicGenerator'
import { colorDesignEngine } from '@/engine/design/ColorDesignEngine'

describe('InfographicGenerator', () => {
  it('generates valid animated bar chart HTML', () => {
    const palette = colorDesignEngine.selectPalette('cyberpunk')
    const html = infographicGenerator.generateHtml(
      {
        type: 'bar_chart',
        title: 'Q3 Growth Metrics',
        items: [
          { label: 'AI Adoption', value: 85 },
          { label: 'Cloud Scale', value: 65 },
        ],
      },
      palette,
    )

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Q3 Growth Metrics')
    expect(html).toContain('AI Adoption')
    expect(html).toContain('bar-fill')
  })

  it('generates animated stat callouts HTML', () => {
    const palette = colorDesignEngine.selectPalette('energetic')
    const html = infographicGenerator.generateHtml(
      {
        type: 'stat_callout',
        title: 'Key Milestones',
        items: [
          { label: 'Active Creators', value: '100K+' },
          { label: 'Videos Rendered', value: '2.5M' },
        ],
      },
      palette,
    )

    expect(html).toContain('stat-card')
    expect(html).toContain('100K+')
    expect(html).toContain('Active Creators')
  })
})
