import { describe, it, expect } from 'vitest'
import { BUILTIN_MOTION_PRESETS } from './presets'
import { getMotionHistory, saveMotionToHistory } from '@/api/llm/motionGenerator'
import { WebMMuxer } from '@/engine/export/webm-muxer'

describe('Motion Graphics Presets & Generator', () => {
  it('loads all built-in motion graphics presets', () => {
    expect(BUILTIN_MOTION_PRESETS.length).toBeGreaterThanOrEqual(5)
    for (const preset of BUILTIN_MOTION_PRESETS) {
      expect(preset.id).toBeTruthy()
      expect(preset.name).toBeTruthy()
      expect(preset.category).toBeTruthy()
      expect(preset.code).toContain('window.__ANIMATE')
      expect(preset.defaultDuration).toBeGreaterThan(0)
    }
  })

  it('saves and retrieves motion graphics history in localStorage', () => {
    const entry = saveMotionToHistory({
      prompt: 'Cyberpunk HUD visualizer',
      code: 'window.__ANIMATE = function(ctx, t, w, h) {}',
      duration: 6,
    })

    expect(entry.id).toMatch(/^motion-/)
    expect(entry.prompt).toBe('Cyberpunk HUD visualizer')

    const history = getMotionHistory()
    expect(history.some((h) => h.id === entry.id)).toBe(true)
  })

  it('generates valid multi-keyframe WebM cluster timestamps without scale inflation', () => {
    const muxer = new WebMMuxer({ width: 640, height: 360, duration: 4, codec: 'vp8' })
    muxer.addChunk({ data: new Uint8Array([10, 20]), timestamp: 0, isKey: true })
    muxer.addChunk({ data: new Uint8Array([30, 40]), timestamp: 1000, isKey: false })
    muxer.addChunk({ data: new Uint8Array([50, 60]), timestamp: 2000, isKey: true })
    const blob = muxer.finalize()
    expect(blob.size).toBeGreaterThan(0)
    expect(muxer.clusterCount).toBe(2)
  })
})
