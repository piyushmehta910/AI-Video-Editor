import { describe, expect, it } from 'vitest'
import { decompressFrames, parseGIF } from 'gifuct-js'
import { parseGifMeta } from './gifToVideo'
import { wrapSourceTime } from '@/engine/media/sourceTime'
import { WebMMuxer } from '@/engine/export/webm-muxer'

// ─── Animated GIF fixture builder ─────────────────────────────────────────────

/**
 * Minimal GIF89a LZW encoder (LSB-first bit packing, standard dictionary
 * growth). Verified implicitly below: gifuct must decode our fixtures back
 * into the exact pixel colors we asked for.
 */
function lzwEncode(pixels: number[], minCodeSize = 2): Uint8Array {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let width = minCodeSize + 1
  let next = eoi + 1
  const dict = new Map<string, number>()

  const bytes: number[] = []
  let bitBuf = 0
  let bitCount = 0
  const emit = (code: number) => {
    bitBuf |= code << bitCount
    bitCount += width
    while (bitCount >= 8) {
      bytes.push(bitBuf & 0xff)
      bitBuf >>= 8
      bitCount -= 8
    }
  }

  emit(clear)
  let current = pixels[0]
  for (let i = 1; i < pixels.length; i++) {
    const p = pixels[i]
    const key = `${current},${p}`
    const hit = dict.get(key)
    if (hit !== undefined) {
      current = hit
    } else {
      emit(current)
      // GIF quirk: the decoder's dictionary lags one entry behind ours, so
      // width growth must be decided BEFORE this entry is assigned — growing
      // afterwards desyncs the bitstream mid-frame (tail decodes as palette 0).
      if (next === (1 << width) && width < 12) width++
      dict.set(key, next++)
      current = p
    }
  }
  emit(current)
  emit(eoi)
  if (bitCount > 0) bytes.push(bitBuf & 0xff)
  return new Uint8Array(bytes)
}

interface FixtureFrame {
  /** Per-frame delay in centiseconds (GIF native units). */
  delayCs: number
  /** Solid color palette index for every pixel. */
  colorIndex: number
}

/** Build an animated GIF89a: 4x2 px, 2-color GCT, one solid-color frame each. */
function buildAnimatedGif(frames: FixtureFrame[], width = 4, height = 2): ArrayBuffer {
  const bytes: number[] = []

  const u16 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff)

  // Header + Logical Screen Descriptor (GCT present, 2 entries).
  for (const ch of 'GIF89a') bytes.push(ch.charCodeAt(0))
  u16(width)
  u16(height)
  bytes.push(0xf0, 0x00, 0x00)
  // Global color table: index 0 = red, index 1 = blue.
  bytes.push(0xff, 0x00, 0x00, 0x00, 0x00, 0xff)

  for (const frame of frames) {
    // Graphic Control Extension: disposal=keep, this frame's own delay.
    bytes.push(0x21, 0xf9, 0x04, 0x04)
    u16(frame.delayCs)
    bytes.push(0x00, 0x00)
    // Image Descriptor: full-frame, no local color table, not interlaced.
    bytes.push(0x2c)
    u16(0)
    u16(0)
    u16(width)
    u16(height)
    bytes.push(0x00)
    // LZW image data in a single sub-block.
    const pixels = new Array<number>(width * height).fill(frame.colorIndex)
    const data = lzwEncode(pixels)
    bytes.push(0x02, data.length, ...data, 0x00)
  }

  bytes.push(0x3b) // trailer
  return new Uint8Array(bytes).buffer
}

// ─── parseGifMeta: per-frame timing extraction ────────────────────────────────

describe('parseGifMeta', () => {
  it('extracts exact per-frame delays (non-uniform timing preserved)', () => {
    const gif = buildAnimatedGif([
      { delayCs: 4, colorIndex: 0 }, // 40ms
      { delayCs: 10, colorIndex: 1 }, // 100ms
    ])
    const meta = parseGifMeta(gif)

    expect(meta.width).toBe(4)
    expect(meta.height).toBe(2)
    expect(meta.frameCount).toBe(2)
    expect(meta.delaysUs).toEqual([40_000, 100_000])
    expect(meta.timestampsUs).toEqual([0, 40_000])
    expect(meta.durationSec).toBeCloseTo(0.14, 6)
  })

  it('decodes distinct pixels per frame — animation is real, not stuck on frame 1', () => {
    const gif = buildAnimatedGif([
      { delayCs: 4, colorIndex: 0 }, // red
      { delayCs: 10, colorIndex: 1 }, // blue
    ])
    const parsed = parseGIF(gif)
    const framesData = decompressFrames(parsed, true)
    expect(framesData.length).toBe(2)

    const [f1, f2] = framesData
    expect(f1.patch.every((v, i) => (i % 4 === 0 ? v === 255 : i % 4 === 3 ? v === 255 : v === 0))).toBe(true)
    expect(f2.patch.every((v, i) => (i % 4 === 2 ? v === 255 : i % 4 === 3 ? v === 255 : v === 0))).toBe(true)
    expect(Buffer.from(f1.patch).equals(Buffer.from(f2.patch))).toBe(false)
  })

  it('defaults missing/zero delays to 100ms instead of collapsing timing', () => {
    // A zero-delay GIF would previously decode at a broken uniform rate.
    const gif = buildAnimatedGif([{ delayCs: 0, colorIndex: 0 }])
    const meta = parseGifMeta(gif)
    expect(meta.delaysUs).toEqual([100_000])
  })
})

// ─── wrapSourceTime: preview + export looping contract ────────────────────────

describe('wrapSourceTime', () => {
  const DURATION = 0.14 // the fixture GIF above

  it('passes through times inside the source range', () => {
    expect(wrapSourceTime(0, DURATION)).toBe(0)
    expect(wrapSourceTime(0.05, DURATION)).toBeCloseTo(0.05, 6)
    expect(wrapSourceTime(0.12, DURATION)).toBeCloseTo(0.12, 6)
  })

  it('loops when a stretched clip runs past its source end', () => {
    // Old behaviour froze at duration-0.05 forever; now it wraps.
    // max = 0.14 - 0.02 = 0.12
    expect(wrapSourceTime(0.15, DURATION)).toBeCloseTo(0.03, 6)
    expect(wrapSourceTime(0.26, DURATION)).toBeCloseTo(0.02, 6)
    expect(wrapSourceTime(0.38, DURATION)).toBeCloseTo(0.02, 6) // wraps repeatedly
  })

  it('never returns the very last sliver (seek-safe)', () => {
    for (let t = 0; t <= 1; t += 0.01) {
      const wrapped = wrapSourceTime(t, DURATION)
      expect(wrapped).toBeGreaterThanOrEqual(0)
      expect(wrapped).toBeLessThanOrEqual(DURATION - 0.02)
    }
  })

  it('handles unknown/invalid durations defensively', () => {
    expect(wrapSourceTime(5, undefined)).toBe(5)
    expect(wrapSourceTime(5, 0)).toBe(5)
    expect(wrapSourceTime(-1, 1)).toBe(0)
  })

  it('animates across the loop seam while old clamp logic would freeze', () => {
    // Preview/export providers call wrapSourceTime(srcTime, asset.duration).
    // Sample a stretched 0.42s clip over a 0.14s GIF: three distinct loops.
    const samples = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4].map((t) =>
      Number(wrapSourceTime(t, DURATION).toFixed(4)),
    )
    const uniqueFrames = new Set(samples).size
    expect(uniqueFrames).toBeGreaterThan(5) // genuinely animating
    expect(samples[4]).toBeLessThan(DURATION - 0.02) // second loop restarted
  })
})

// ─── WebMMuxer round-trip: frame count + timing survive muxing ────────────────

interface EbmlElement {
  id: number
  start: number
  size: number
}

function readVint(buf: Uint8Array, pos: number): { raw: number; value: number; length: number } {
  const first = buf[pos]
  let length = 8
  for (const l of [1, 2, 3, 4, 5, 6, 7]) {
    if (first >= 256 >> l) {
      length = l
      break
    }
  }
  let raw = 0
  for (let i = 0; i < length; i++) raw = raw * 256 + buf[pos + i]
  return { raw, value: raw - Math.pow(2, 7 * length), length }
}

function ebmlChildren(buf: Uint8Array, start: number, end: number): EbmlElement[] {
  const out: EbmlElement[] = []
  let pos = start
  while (pos < end) {
    const idV = readVint(buf, pos)
    pos += idV.length
    const sizeV = readVint(buf, pos)
    pos += sizeV.length
    out.push({ id: idV.raw, start: pos, size: sizeV.value })
    pos += sizeV.value
  }
  return out
}

function findElement(list: EbmlElement[], id: number): EbmlElement | undefined {
  return list.find((e) => e.id === id)
}

function u32At(buf: Uint8Array, pos: number): number {
  return (buf[pos] << 24 | buf[pos + 1] << 16 | buf[pos + 2] << 8 | buf[pos + 3]) >>> 0
}

describe('WebMMuxer sticker round-trip', () => {
  it('preserves exact frame count and per-frame timestamps in the container', async () => {
    // Simulate encoding the 2-frame fixture GIF: cumulative µs timestamps.
    const timestampsMs = [0, 40]
    const durationSec = 0.14

    const muxer = new WebMMuxer({ width: 4, height: 2, duration: durationSec, codec: 'vp9' })
    muxer.addChunk({ data: new Uint8Array([1, 2, 3]), timestamp: timestampsMs[0], isKey: true })
    muxer.addChunk({ data: new Uint8Array([4, 5]), timestamp: timestampsMs[1], isKey: false })
    const blob = muxer.finalize()

    const buf = new Uint8Array(await blob.arrayBuffer())
    const top = ebmlChildren(buf, 0, buf.length)
    const segment = findElement(top, 0x18538067)!
    expect(segment).toBeDefined()

    const children = ebmlChildren(buf, segment.start, segment.start + segment.size)
    const info = findElement(children, 0x1549a966)!
    const infoKids = ebmlChildren(buf, info.start, info.start + info.size)

    // TimestampScale = 1e6 ns.
    const scale = findElement(infoKids, 0x2ad7b1)!
    expect(u32At(buf, scale.start)).toBe(1_000_000)

    // Duration element (float32, milliseconds).
    const durEl = findElement(infoKids, 0x4489)!
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    expect(view.getFloat32(durEl.start)).toBeCloseTo(durationSec * 1000, 1)

    // Exactly 2 SimpleBlocks with the authored timestamps.
    const cluster = findElement(children, 0x1f43b675)!
    const clusterKids = ebmlChildren(buf, cluster.start, cluster.start + cluster.size)
    const clusterTimeEl = findElement(clusterKids, 0xe7)!
    let clusterTimeMs = 0
    for (let i = 0; i < clusterTimeEl.size; i++) clusterTimeMs = clusterTimeMs * 256 + buf[clusterTimeEl.start + i]

    const blocks = clusterKids.filter((k) => k.id === 0xa3)
    expect(blocks.length).toBe(2)

    const times = blocks.map((b) => {
      // SimpleBlock: track vint + s16 timecode + flags + payload.
      const trackVintLen = buf[b.start] >= 0x80 ? 1 : 2
      const rel = (buf[b.start + trackVintLen] << 8) | buf[b.start + trackVintLen + 1]
      const signed = rel >= 0x8000 ? rel - 0x10000 : rel
      return signed + clusterTimeMs
    })
    expect(times).toEqual([0, 40])
  })
})

// ─── Provider wiring guards: BOTH preview and export must loop ────────────────

describe('looping wired into both render paths', () => {
  it('preview provider uses wrapSourceTime', async () => {
    const src = await import('node:fs/promises')
    const text = await src.readFile(new URL('../../hooks/usePlayback.ts', import.meta.url), 'utf8')
    expect(text).toContain('wrapSourceTime')
    expect(text).not.toContain('Math.min(srcTime, Math.max(0')
  })

  it('export provider uses wrapSourceTime independently', async () => {
    const src = await import('node:fs/promises')
    const text = await src.readFile(new URL('../export/exportVideo.ts', import.meta.url), 'utf8')
    expect(text).toContain('wrapSourceTime')
    expect(text).not.toContain('(asset.duration ?? srcTime) - 0.05')
  })
})
