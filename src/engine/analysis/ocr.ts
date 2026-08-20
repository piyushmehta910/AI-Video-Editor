import type { OcrRegion, StoredOcr } from './types'
import { getRecord, putRecord } from '@/engine/storage/db'

const STORE_KEY = (assetId: string) => `ocr:${assetId}`

export async function getStoredOcr(assetId: string): Promise<StoredOcr | undefined> {
  return getRecord<StoredOcr>('settings', STORE_KEY(assetId))
}

export async function storeOcr(ocr: StoredOcr): Promise<void> {
  await putRecord('settings', { key: STORE_KEY(ocr.assetId), ...ocr })
}

export interface OcrOptions {
  signal?: AbortSignal
  onProgress?: (progress: number) => void
  /** Maximum frames to OCR. Long videos auto-widen the sample interval. Default 40. */
  maxFrames?: number
  /** Preferred seconds between samples. Default 1.5. */
  sampleInterval?: number
}

interface RawWord {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  confidence: number
}

interface FrameSample {
  time: number
  width: number
  height: number
  boxes: RawWord[]
}

/**
 * Detect persistent on-screen text (lower-thirds, titles, tickers, watermarks)
 * by OCR-ing sampled frames with Tesseract.js and clustering detections that
 * recur at the same location across time. Returned regions are "protected" —
 * auto-captions avoid overlapping them. Runs Tesseract in its own worker and
 * caches traineddata in IndexedDB, so re-runs are fast.
 */
export async function detectOnScreenText(
  file: Blob,
  assetId: string,
  options: OcrOptions = {},
): Promise<StoredOcr> {
  const { signal, onProgress, maxFrames = 40, sampleInterval = 1.5 } = options

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = URL.createObjectURL(file)
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => resolve()
  })

  const duration = Number.isFinite(video.duration) ? video.duration : 0
  try {
    if (!duration || video.videoWidth === 0) {
      return { assetId, regions: [], sampledFrames: 0, updatedAt: Date.now() }
    }

    const times: number[] = []
    const step = Math.max(sampleInterval, duration / maxFrames)
    for (let t = 0; t < duration; t += step) times.push(Math.min(t, Math.max(0, duration - 0.05)))
    if (times.length === 0) times.push(0)

    const worker = await createTesseractWorker()
    try {
      const samples: FrameSample[] = []
      for (let i = 0; i < times.length; i++) {
        if (signal?.aborted) throw new DOMException('OCR aborted', 'AbortError')
        const frame = await extractFrame(video, times[i])
        const res = await worker.recognize(frame.canvas)
        const words: RawWord[] = flattenWords(res.data as Parameters<typeof flattenWords>[0])
          .filter((w) => w.text.trim().length >= 2 && w.confidence >= 40)
          .map((w) => ({
            text: normalizeText(w.text),
            x0: w.bbox.x0,
            y0: w.bbox.y0,
            x1: w.bbox.x1,
            y1: w.bbox.y1,
            confidence: w.confidence,
          }))
        samples.push({ time: times[i], width: frame.width, height: frame.height, boxes: words })
        onProgress?.((i + 1) / times.length)
      }
      await worker.terminate()

      const regions = clusterRegions(samples, times.length)
      return { assetId, regions, sampledFrames: times.length, updatedAt: Date.now() }
    } finally {
      try {
        await worker.terminate()
      } catch {
        // already terminated
      }
    }
  } finally {
    URL.revokeObjectURL(video.src)
  }
}

async function createTesseractWorker() {
  const { createWorker } = await import('tesseract.js')
  return createWorker('eng', 1, {
    errorHandler: () => undefined,
    logger: () => undefined,
  })
}

async function extractFrame(video: HTMLVideoElement, time: number): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  await seekVideo(video, time)
  const MAX_W = 1280
  const scale = Math.min(1, MAX_W / video.videoWidth)
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0, width, height)
  return { canvas, width, height }
}

function seekVideo(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState >= 1 && Math.abs(el.currentTime - time) < 0.05) {
      resolve()
      return
    }
    const onSeeked = () => {
      el.removeEventListener('seeked', onSeeked)
      resolve()
    }
    el.addEventListener('seeked', onSeeked)
    try {
      el.currentTime = time
    } catch {
      resolve()
    }
    window.setTimeout(resolve, 1200)
  })
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

interface OcrWordOutput {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/** Flatten Tesseract's block → paragraph → line → word tree. */
function flattenWords(page: { blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: OcrWordOutput[] }> }> }> | null }): OcrWordOutput[] {
  const out: OcrWordOutput[] = []
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) out.push(w)
      }
    }
  }
  return out
}

interface Cluster {
  x0: number
  y0: number
  x1: number
  y1: number
  texts: string[]
  confidences: number[]
  frames: number[]
  count: number
}

function clusterRegions(samples: FrameSample[], totalFrames: number): OcrRegion[] {
  const clusters: Cluster[] = []
  const norm = (v: RawWord, w: number, h: number) => ({
    x0: v.x0 / w,
    y0: v.y0 / h,
    x1: v.x1 / w,
    y1: v.y1 / h,
  })

  for (const sample of samples) {
    for (const word of sample.boxes) {
      const b = norm(word, sample.width, sample.height)
      if (b.x1 - b.x0 < 0.02 || b.y1 - b.y0 < 0.01) continue

      let best = -1
      let bestScore = 0
      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i]
        const cw = c.x1 - c.x0
        const ch = c.y1 - c.y0
        const iw = Math.max(0, Math.min(b.x1, c.x1) - Math.max(b.x0, c.x0))
        const ih = Math.max(0, Math.min(b.y1, c.y1) - Math.max(b.y0, c.y0))
        const overlap = (iw * ih) / Math.max(1e-9, Math.min((b.x1 - b.x0) * (b.y1 - b.y0), cw * ch))
        const similar = textSimilarity(word.text, mostFrequent(c.texts)) >= 0.55
        const score = overlap * (similar ? 1 : 0.4)
        if (overlap > 0.3 && score > bestScore) {
          best = i
          bestScore = score
        }
      }

      if (best >= 0) {
        const c = clusters[best]
        c.x0 = Math.min(c.x0, b.x0)
        c.y0 = Math.min(c.y0, b.y0)
        c.x1 = Math.max(c.x1, b.x1)
        c.y1 = Math.max(c.y1, b.y1)
        c.texts.push(word.text)
        c.confidences.push(word.confidence)
        c.frames.push(sample.time)
        c.count++
      } else {
        clusters.push({
          x0: b.x0,
          y0: b.y0,
          x1: b.x1,
          y1: b.y1,
          texts: [word.text],
          confidences: [word.confidence],
          frames: [sample.time],
          count: 1,
        })
      }
    }
  }

  return clusters
    .filter((c) => {
      const persistence = c.count / totalFrames
      const avgConf = c.confidences.reduce((a, b) => a + b, 0) / c.confidences.length
      const w = c.x1 - c.x0
      const h = c.y1 - c.y0
      if (w < 0.04 || h < 0.015) return false
      const text = mostFrequent(c.texts)
      if (text.length < 3) return false
      return persistence >= 0.2 || (c.count >= 2 && avgConf >= 55)
    })
    .map((c) => {
      const times = c.frames.sort((a, b) => a - b)
      return {
        id: `${Math.round(c.x0 * 1000)}-${Math.round(c.y0 * 1000)}-${Math.round(c.x1 * 1000)}`,
        x: c.x0,
        y: c.y0,
        w: c.x1 - c.x0,
        h: c.y1 - c.y0,
        text: mostFrequent(c.texts),
        confidence: Math.round(c.confidences.reduce((a, b) => a + b, 0) / c.confidences.length),
        persistence: Math.round((c.count / totalFrames) * 100) / 100,
        start: times[0],
        end: times[times.length - 1],
      }
    })
    .sort((a, b) => b.persistence - a.persistence)
}

function mostFrequent(items: string[]): string {
  const counts = new Map<string, number>()
  let best = ''
  let bestCount = 0
  for (const item of items) {
    const key = item.toLowerCase()
    const n = (counts.get(key) ?? 0) + 1
    counts.set(key, n)
    if (n > bestCount) {
      bestCount = n
      best = item
    }
  }
  return best
}

/** Normalized Levenshtein similarity (0..1). */
function textSimilarity(a: string, b: string): number {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  if (x === y) return 1
  if (!x.length || !y.length) return 0
  const maxLen = Math.max(x.length, y.length)
  const m = x.length
  const n = y.length
  let prev = new Array(n + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= m; i++) {
    const curr = new Array(n + 1).fill(0)
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return 1 - prev[n] / maxLen
}