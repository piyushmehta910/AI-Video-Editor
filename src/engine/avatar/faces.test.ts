import { describe, it, expect } from 'vitest'
import { AVATAR_FACE_PRESETS } from './faces'

describe('Avatar Face Presets', () => {
  it('has at least 6 curated face presets', () => {
    expect(AVATAR_FACE_PRESETS.length).toBeGreaterThanOrEqual(6)
  })

  it('all presets have valid mouth coordinates, SVG content, and defined mouth elements', () => {
    for (const preset of AVATAR_FACE_PRESETS) {
      expect(preset.id).toBeTruthy()
      expect(preset.name).toBeTruthy()
      expect(preset.svg).toContain('<svg')
      expect(preset.svg).toContain('</svg>')
      expect(preset.svg).toMatch(/Mouth|Lip|Smile/i)
      expect(preset.mouth.x).toBeGreaterThan(0)
      expect(preset.mouth.x).toBeLessThan(1)
      expect(preset.mouth.y).toBeGreaterThan(0.5)
      expect(preset.mouth.y).toBeLessThan(0.7)
      expect(preset.mouth.width).toBeGreaterThan(0.1)
      expect(preset.mouth.maxOpen).toBeGreaterThan(0.05)
    }
  })

  it('covers presenters, narrators, intros, and outros', () => {
    const roles = new Set(AVATAR_FACE_PRESETS.map((p) => p.role))
    expect(roles.has('presenter')).toBe(true)
    expect(roles.has('narrator')).toBe(true)
    expect(roles.has('intro')).toBe(true)
    expect(roles.has('outro')).toBe(true)
  })

  it('has unique IDs for all avatar presets', () => {
    const ids = AVATAR_FACE_PRESETS.map((p) => p.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})
