/**
 * Export format definitions, capability detection and helpers for the
 * MediaRecorder-based export pipeline.
 */

export type ExportFormatId = 'mp4' | 'webm' | 'frames'
export type QualityId = 'high' | 'medium' | 'low'
export type ResolutionId = '1080p' | '720p' | '360p'

export interface ResolutionOption {
  id: ResolutionId
  label: string
  width: number
  height: number
}

export const RESOLUTIONS: ResolutionOption[] = [
  { id: '1080p', label: '1920×1080', width: 1920, height: 1080 },
  { id: '720p', label: '1280×720', width: 1280, height: 720 },
  { id: '360p', label: '640×360', width: 640, height: 360 },
]

export const FPS_OPTIONS = [24, 30, 60]

export interface FormatOption {
  id: ExportFormatId
  label: string
  extension: string
  /** Candidate mime types, best first. */
  mimeTypes: string[]
}

export const FORMATS: FormatOption[] = [
  {
    id: 'mp4',
    label: 'MP4 (MediaRecorder)',
    extension: 'mp4',
    // Chrome 126+ supports MP4/H.264 in MediaRecorder; Safari uses mp4 too.
    mimeTypes: [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ],
  },
  {
    id: 'webm',
    label: 'WebM (MediaRecorder)',
    extension: 'webm',
    mimeTypes: [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ],
  },
  {
    id: 'frames',
    label: 'Frames (PNG sequence)',
    extension: 'zip',
    mimeTypes: [],
  },
]

/** Base video bitrates (bits/second) at 1080p; scaled by resolution pixels. */
const QUALITY_BITRATES_1080P: Record<QualityId, number> = {
  high: 12_000_000,
  medium: 8_000_000,
  low: 4_500_000,
}

export function bitrateFor(quality: QualityId, width: number, height: number): number {
  const pixels = Math.max(1, width * height)
  const scale = Math.sqrt(pixels / (1920 * 1080))
  return Math.round(Math.max(800_000, QUALITY_BITRATES_1080P[quality] * scale))
}

export function resolveMimeType(format: FormatOption): string | null {
  if (format.id === 'frames') return null
  if (typeof MediaRecorder === 'undefined') return null
  for (const mimeType of format.mimeTypes) {
    try {
      if (MediaRecorder.isTypeSupported(mimeType)) return mimeType
    } catch {
      // isTypeSupported can throw on exotic inputs — keep probing.
    }
  }
  return null
}

export interface FormatAvailability {
  format: FormatOption
  available: boolean
  mimeType: string | null
}

export function getFormatAvailability(): { list: FormatAvailability[]; mediaRecorderSupported: boolean } {
  const mediaRecorderSupported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined'
  const list = FORMATS.map((format) => ({
    format,
    available: format.id === 'frames' ? true : resolveMimeType(format) !== null,
    mimeType: resolveMimeType(format),
  }))
  return { list, mediaRecorderSupported }
}

export function defaultExportName(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `clipforge-export-${y}-${m}-${day}`
}

export function sanitizeFilename(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, '-').trim()
  return clean || 'clipforge-export'
}

export function humanFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : Number(value.toFixed(1))} ${units[unit]}`
}

export function frameCountFor(durationSeconds: number, fps: number): number {
  return Math.max(1, Math.ceil(durationSeconds * fps))
}

/** Simple forward extrapolation of remaining time from observed progress. */
export function estimateRemainingMs(done: number, total: number, elapsedMs: number): number {
  if (done <= 0 || total <= done) return 0
  const perUnit = elapsedMs / done
  return Math.round(perUnit * (total - done))
}
