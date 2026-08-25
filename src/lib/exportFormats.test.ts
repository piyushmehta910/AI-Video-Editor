import { describe, expect, it } from 'vitest'
import {
  FORMATS,
  RESOLUTIONS,
  bitrateFor,
  defaultExportName,
  estimateRemainingMs,
  frameCountFor,
  getFormatAvailability,
  humanFileSize,
  resolveMimeType,
  sanitizeFilename,
} from './exportFormats'

describe('exportFormats', () => {
  it('always offers the frames fallback', () => {
    const { list, mediaRecorderSupported } = getFormatAvailability()
    const frames = list.find((f) => f.format.id === 'frames')
    expect(frames?.available).toBe(true)
    expect(typeof mediaRecorderSupported).toBe('boolean')
  })

  it('returns null mime type when MediaRecorder is missing', () => {
    // jsdom has no MediaRecorder, mirroring unsupported browsers.
    expect(resolveMimeType(FORMATS[0])).toBeNull()
  })

  it('detects mp4 support when isTypeSupported says so', () => {
    const fake = { isTypeSupported: (t: string) => t.startsWith('video/mp4') }
    ;(globalThis as Record<string, unknown>).MediaRecorder = fake
    try {
      expect(resolveMimeType(FORMATS[0])).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
      expect(resolveMimeType({ ...FORMATS[0], mimeTypes: ['video/webm'] })).toBeNull()
    } finally {
      delete (globalThis as Record<string, unknown>).MediaRecorder
    }
  })

  it('scales bitrates by resolution and quality', () => {
    expect(bitrateFor('high', 1920, 1080)).toBe(12_000_000)
    expect(bitrateFor('high', 1280, 720)).toBeLessThan(bitrateFor('high', 1920, 1080))
    expect(bitrateFor('low', 1920, 1080)).toBeLessThan(bitrateFor('medium', 1920, 1080))
    expect(bitrateFor('high', 640, 360)).toBeGreaterThanOrEqual(800_000)
  })

  it('builds dated filenames', () => {
    expect(defaultExportName()).toMatch(/^clipforge-export-\d{4}-\d{2}-\d{2}$/)
  })

  it('sanitizes unsafe filename characters', () => {
    expect(sanitizeFilename('my: video/final?')).toBe('my- video-final-')
    expect(sanitizeFilename('   ')).toBe('clipforge-export')
  })

  it('formats file sizes', () => {
    expect(humanFileSize(0)).toBe('0 B')
    expect(humanFileSize(512)).toBe('512 B')
    expect(humanFileSize(2048)).toBe('2 KB')
    expect(humanFileSize(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('counts frames per duration', () => {
    expect(frameCountFor(15, 30)).toBe(450)
    expect(frameCountFor(1 / 60, 60)).toBe(1)
  })

  it('extrapolates remaining time', () => {
    expect(estimateRemainingMs(50, 100, 1000)).toBe(1000)
    expect(estimateRemainingMs(0, 100, 1000)).toBe(0)
    expect(estimateRemainingMs(100, 100, 1000)).toBe(0)
  })

  it('defines the spec resolutions', () => {
    expect(RESOLUTIONS.map((r) => `${r.width}x${r.height}`)).toEqual(['1920x1080', '1280x720', '640x360'])
  })
})
