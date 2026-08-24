import { describe, it, expect } from 'vitest'
import {
  colorDesignEngine,
  getContrastRatio,
} from './ColorDesignEngine'

describe('ColorDesignEngine', () => {
  it('calculates WCAG relative luminance and contrast ratio accurately', () => {
    // Black and white should have maximum contrast (21:1)
    const ratio = getContrastRatio('#ffffff', '#000000')
    expect(ratio).toBeCloseTo(21, 0)

    // Identical colors should have 1:1 contrast
    const sameRatio = getContrastRatio('#8b5cf6', '#8b5cf6')
    expect(sameRatio).toBeCloseTo(1, 0)
  })

  it('validates readability and suggests compensation', () => {
    // White text on dark background passes AAA
    const highRes = colorDesignEngine.validateTextReadability('#ffffff', '#09090b')
    expect(highRes.passesAA).toBe(true)
    expect(highRes.passesAAA).toBe(true)

    // Low contrast text on light background fails AA and triggers compensation
    const lowRes = colorDesignEngine.validateTextReadability('#e2e8f0', '#ffffff')
    expect(lowRes.passesAA).toBe(false)
    expect(lowRes.recommendedCompensation).toBeDefined()
  })

  it('selects palette by mood and industry', () => {
    const cyber = colorDesignEngine.selectPalette('cyberpunk')
    expect(cyber.primary).toBe('#8b5cf6')

    const corp = colorDesignEngine.selectPalette('professional', 'finance')
    expect(corp.primary).toBe('#2563eb')
  })
})
