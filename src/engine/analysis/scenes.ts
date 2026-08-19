export interface Scene {
  id: string
  start: number
  end: number
  keyframeTime: number
  summary: string
  keywords: string[]
  importance: number
}

export interface RawScene {
  start: number
  end: number
  keyframeTime: number
}

export interface SceneResult {
  scenes: RawScene[]
  duration: number
}

export interface SceneOptions {
  /** Seconds between sampled frames. Default 0.5. */
  sampleInterval?: number
  /** Normalized signature-diff above which a shot boundary is declared. Default 0.15. */
  threshold?: number
  /** Cap on total sampled frames (long videos auto-widen the interval). Default 400. */
  maxFrames?: number
  /** Scenes shorter than this (seconds) merge into the previous scene. Default 0.4. */
  minSceneDuration?: number
  signal?: AbortSignal
}

export interface FrameSignature {
  r: Uint8Array
  g: Uint8Array
  b: Uint8Array
}

/** Average RGBA per cell over a `cells x cells` grid — a tiny color fingerprint. */
export function frameSignature(pixels: Uint8ClampedArray | number[], width: number, height: number, cells = 16): FrameSignature {
  const n = cells * cells
  const r = new Uint8Array(n)
  const g = new Uint8Array(n)
  const b = new Uint8Array(n)
  const cw = Math.max(1, Math.floor(width / cells))
  const ch = Math.max(1, Math.floor(height / cells))
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      let sr = 0
      let sg = 0
      let sb = 0
      let count = 0
      for (let y = cy * ch; y < Math.min((cy + 1) * ch, height); y++) {
        for (let x = cx * cw; x < Math.min((cx + 1) * cw, width); x++) {
          const i = (y * width + x) * 4
          sr += pixels[i]
          sg += pixels[i + 1]
          sb += pixels[i + 2]
          count++
        }
      }
      const idx = cy * cells + cx
      r[idx] = count ? Math.round(sr / count) : 0
      g[idx] = count ? Math.round(sg / count) : 0
      b[idx] = count ? Math.round(sb / count) : 0
    }
  }
  return { r, g, b }
}

/** Normalized euclidean distance (0..1) between two signatures. */
export function diffSignatures(a: FrameSignature, b: FrameSignature): number {
  const n = a.r.length
  let sum = 0
  for (let i = 0; i < n; i++) {
    const dr = a.r[i] - b.r[i]
    const dg = a.g[i] - b.g[i]
    const db = a.b[i] - b.b[i]
    sum += dr * dr + dg * dg + db * db
  }
  const max = Math.sqrt(n * 3) * 255
  return max ? Math.min(1, Math.sqrt(sum) / max) : 0
}

/**
 * Convert per-frame diffs into scene boundaries. `diffs[i]` is the difference
 * between frame `i` (at `i * sampleInterval`) and frame `i + 1`.
 */
export function groupFramesIntoScenes(
  diffs: number[],
  sampleInterval: number,
  threshold: number,
  duration: number,
  minSceneDuration = 0.4,
): Array<{ start: number; end: number }> {
  const boundaries = [0]
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i] > threshold) boundaries.push((i + 1) * sampleInterval)
  }
  const raw: Array<{ start: number; end: number }> = []
  for (let k = 1; k < boundaries.length; k++) {
    const start = boundaries[k - 1]
    const end = Math.min(boundaries[k], duration)
    if (end > start) raw.push({ start, end })
  }
  if (raw.length === 0) return [{ start: 0, end: duration }]
  const last = raw[raw.length - 1]
  if (last.end < duration) raw.push({ start: last.end, end: duration })

  const merged: Array<{ start: number; end: number }> = []
  for (const s of raw) {
    const prev = merged[merged.length - 1]
    if (prev && s.end - s.start < minSceneDuration) {
      prev.end = s.end
    } else {
      merged.push({ ...s })
    }
  }
  return merged
}

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'you', 'your', 'for', 'are', 'was', 'but', 'not', 'have', 'has', 'had', 'they',
  'them', 'their', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'about', 'into', 'from',
  'our', 'his', 'her', 'she', 'he', 'we', 'all', 'any', 'some', 'what', 'which', 'when', 'where', 'how', 'who', 'whom',
  'there', 'here', 'than', 'then', 'so', 'very', 'just', 'like', 'get', 'got', 'one', 'two', 'also', 'more', 'most',
  'even', 'only', 'if', 'as', 'at', 'by', 'of', 'on', 'in', 'to', 'it', 'its', 'be', 'been', 'being', 'do', 'does',
  'did', 'doing', 'is', 'am', 'an', 'or', 'because', 'before', 'after', 'while', 'during', 'over', 'under', 'out',
  'up', 'down', 'off', 'again', 'once', 'too', 'much', 'such', 'own', 'same', 'other', 'next', 'first', 'last',
])

/** Top keywords by frequency across transcript segment texts, stopwords filtered. */
export function extractKeywords(texts: string[], topN = 5): string[] {
  const counts = new Map<string, number>()
  for (const t of texts) {
    for (const raw of t.toLowerCase().split(/[^a-z0-9']+/)) {
      const w = raw.trim()
      if (!w || w.length < 3 || STOPWORDS.has(w)) continue
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([w]) => w)
}

/**
 * Fill scenes with transcript-derived summaries, keywords, and an importance
 * score (0..1) proportional to speech density times scene length.
 */
export function summarizeScenes(
  scenes: Array<{ start: number; end: number }>,
  segments: Array<{ start: number; end: number; text: string }>,
): Scene[] {
  const raw = scenes.map((s, i) => {
    const overlap = segments.filter((seg) => seg.start < s.end && seg.end > s.start)
    const speech = overlap.reduce((acc, seg) => {
      return acc + (Math.min(seg.end, s.end) - Math.max(seg.start, s.start))
    }, 0)
    const len = Math.max(0.001, s.end - s.start)
    const density = Math.min(1, speech / len)
    return {
      id: `scene-${i + 1}`,
      start: s.start,
      end: s.end,
      keyframeTime: (s.start + s.end) / 2,
      summary: overlap[0]?.text ?? '',
      keywords: extractKeywords(overlap.map((seg) => seg.text)),
      importance: density * len,
    }
  })
  const maxImportance = Math.max(0.001, ...raw.map((s) => s.importance))
  return raw.map((s) => ({ ...s, importance: s.importance / maxImportance }))
}

function createVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video')
    el.preload = 'auto'
    el.muted = true
    el.playsInline = true
    el.crossOrigin = 'anonymous'
    el.onloadedmetadata = () => resolve(el)
    el.onerror = () => reject(new Error('Failed to load video for scene detection'))
    el.src = url
  })
}

function waitForSeek(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(el.currentTime - time) < 0.02) {
      resolve()
      return
    }
    const onSeeked = () => {
      el.removeEventListener('seeked', onSeeked)
      resolve()
    }
    el.addEventListener('seeked', onSeeked)
    el.currentTime = time
    window.setTimeout(resolve, 3000)
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Scene detection aborted', 'AbortError')
}

/**
 * Detect shot boundaries by sampling the video at a fixed interval, fingerprinting
 * each frame, and grouping frames whose neighbors differ beyond a threshold.
 * Runs on the main thread (async seeks), same as filmstrip generation.
 */
export async function generateScenes(blob: Blob, options: SceneOptions = {}, onProgress?: (p: number) => void): Promise<SceneResult> {
  const sampleInterval = Math.max(0.25, options.sampleInterval ?? 0.5)
  const maxFrames = Math.max(20, options.maxFrames ?? 400)
  const threshold = options.threshold ?? 0.15
  const minSceneDuration = options.minSceneDuration ?? 0.4
  const cells = 16

  const url = URL.createObjectURL(blob)
  let el: HTMLVideoElement | null = null
  try {
    throwIfAborted(options.signal)
    el = await createVideoElement(url)
    const duration = el.duration || 0
    const srcW = el.videoWidth || 0
    const srcH = el.videoHeight || 0
    if (!isFinite(duration) || duration <= 0.5 || srcW === 0 || srcH === 0) {
      return { scenes: [], duration }
    }

    const step = Math.max(sampleInterval, duration / maxFrames)
    const times: number[] = []
    for (let t = 0; t < duration; t += step) {
      times.push(t)
    }

    const canvas = document.createElement('canvas')
    canvas.width = cells
    canvas.height = cells
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { scenes: [], duration }

    const signatures: FrameSignature[] = []
    for (let i = 0; i < times.length; i++) {
      throwIfAborted(options.signal)
      await waitForSeek(el, times[i])
      ctx.drawImage(el, 0, 0, cells, cells)
      const data = ctx.getImageData(0, 0, cells, cells).data
      signatures.push(frameSignature(data, cells, cells, cells))
      if (i % 10 === 0) {
        onProgress?.(i / times.length)
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    const diffs: number[] = []
    for (let i = 1; i < signatures.length; i++) {
      diffs.push(diffSignatures(signatures[i - 1], signatures[i]))
    }
    const groups = groupFramesIntoScenes(diffs, step, threshold, duration, minSceneDuration)
    return { scenes: groups.map((g) => ({ ...g, keyframeTime: (g.start + g.end) / 2 })), duration }
  } catch {
    if (options.signal?.aborted) throw new DOMException('Scene detection aborted', 'AbortError')
    return { scenes: [], duration: 0 }
  } finally {
    if (el) el.src = ''
    URL.revokeObjectURL(url)
  }
}