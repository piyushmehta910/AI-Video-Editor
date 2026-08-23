import { describe, expect, it } from 'vitest'
import { buildZip, crc32, frameFileName } from './exportZip'

describe('exportZip', () => {
  it('computes CRC-32 (check value for "123456789")', () => {
    const data = new TextEncoder().encode('123456789')
    expect(crc32(data)).toBe(0xcbf43926)
  })

  it('produces an empty archive with end-of-central-directory only', () => {
    const zip = buildZip([])
    expect(zip.length).toBe(22)
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
    expect(zip[2]).toBe(0x05)
    expect(zip[3]).toBe(0x06)
  })

  it('stores entries uncompressed and readable', () => {
    const payload = new TextEncoder().encode('hello clipforge')
    const zip = buildZip([{ name: 'frame_000001.png', data: payload }])

    // Local file header signature
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
    expect(zip[2]).toBe(0x03)
    expect(zip[3]).toBe(0x04)

    const view = new DataView(zip.buffer)
    const nameLen = view.getUint16(26, true)
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe('frame_000001.png')

    // Stored method + sizes match payload
    expect(view.getUint16(8, true)).toBe(0)
    expect(view.getUint32(18, true)).toBe(payload.length)
    expect(view.getUint32(22, true)).toBe(payload.length)

    // Payload is copied verbatim after the header
    expect(Array.from(zip.slice(30 + nameLen, 30 + nameLen + payload.length))).toEqual(
      Array.from(payload),
    )
  })

  it('round-trips multiple entries via central directory offsets', () => {
    const entries = [
      { name: 'a.txt', data: new TextEncoder().encode('AAA') },
      { name: 'b.txt', data: new Uint8Array([0, 255, 128]) },
    ]
    const zip = buildZip(entries)
    const text = new TextDecoder()
    let offset = 0
    for (const entry of entries) {
      const nameLen = new DataView(zip.buffer).getUint16(offset + 26, true)
      expect(text.decode(zip.slice(offset + 30, offset + 30 + nameLen))).toBe(entry.name)
      offset += 30 + nameLen + entry.data.length
    }
    expect(offset).toBeGreaterThan(0)
  })

  it('names frames zero-padded', () => {
    expect(frameFileName(0)).toBe('frame_000001.png')
    expect(frameFileName(999)).toBe('frame_001000.png')
  })
})
