import { describe, it, expect } from 'vitest'
import {
  TEXT_TYPOGRAPHY_PRESETS,
  TYPOGRAPHY_CATEGORIES,
  applyTypographyPreset,
  preloadAllTypographyPresetFonts,
} from './typographyPresets'
import { GOOGLE_FONTS } from './fonts'
import type { TextOverlay } from '@/engine/types'

describe('typographyPresets', () => {
  it('contains at least 30 diverse typography presets', () => {
    expect(TEXT_TYPOGRAPHY_PRESETS.length).toBeGreaterThanOrEqual(30)
  })

  it('has unique IDs for every preset', () => {
    const ids = TEXT_TYPOGRAPHY_PRESETS.map((p) => p.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('assigns every preset to a valid non-All category', () => {
    const validCategories = TYPOGRAPHY_CATEGORIES.filter((c) => c !== 'All')
    for (const preset of TEXT_TYPOGRAPHY_PRESETS) {
      expect(validCategories).toContain(preset.category)
      expect(preset.name.trim().length).toBeGreaterThan(0)
      expect(preset.fontSize).toBeGreaterThan(10)
      expect(preset.fontFamily.trim().length).toBeGreaterThan(0)
    }
  })

  it('covers every defined category in the catalog', () => {
    const validCategories = TYPOGRAPHY_CATEGORIES.filter((c) => c !== 'All')
    for (const cat of validCategories) {
      const matching = TEXT_TYPOGRAPHY_PRESETS.filter((p) => p.category === cat)
      expect(matching.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('uses fonts supported in GOOGLE_FONTS catalog', () => {
    const supportedFamilies = new Set(GOOGLE_FONTS.map((gf) => gf.family.toLowerCase()))
    for (const preset of TEXT_TYPOGRAPHY_PRESETS) {
      expect(supportedFamilies.has(preset.fontFamily.toLowerCase())).toBe(true)
    }
  })

  describe('applyTypographyPreset', () => {
    const mockPreset = TEXT_TYPOGRAPHY_PRESETS.find((p) => p.id === 'viral-yellow-hook')!

    it('applies preset styling while keeping existing text content', () => {
      const current: TextOverlay = {
        text: 'Custom My Clip Text',
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 0,
        shadow: false,
        animation: 'none',
        animationDuration: 1,
      }

      const updated = applyTypographyPreset(current, mockPreset)
      expect(updated.text).toBe('Custom My Clip Text')
      expect(updated.fontFamily).toBe(mockPreset.fontFamily)
      expect(updated.fontSize).toBe(mockPreset.fontSize)
      expect(updated.color).toBe(mockPreset.color)
      expect(updated.stroke).toEqual(mockPreset.stroke)
      expect(updated.shadow).toBe(true)
      expect(updated.animation).toBe(mockPreset.animation)
    })

    it('uses override text when explicitly specified', () => {
      const current: TextOverlay = {
        text: 'Old Text',
        fontSize: 20,
        fontFamily: 'Roboto',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#000',
        backgroundColor: 'transparent',
        textAlign: 'left',
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        borderRadius: 0,
        shadow: false,
        animation: 'none',
        animationDuration: 1,
      }

      const updated = applyTypographyPreset(current, mockPreset, 'Brand New Override')
      expect(updated.text).toBe('Brand New Override')
      expect(updated.fontFamily).toBe(mockPreset.fontFamily)
    })

    it('falls back to preset text when current text is empty', () => {
      const updated = applyTypographyPreset(undefined, mockPreset)
      expect(updated.text).toBe(mockPreset.text)
      expect(updated.fontSize).toBe(mockPreset.fontSize)
    })
  })

  it('preloadAllTypographyPresetFonts runs safely without error in node env', () => {
    expect(() => preloadAllTypographyPresetFonts()).not.toThrow()
  })
})
