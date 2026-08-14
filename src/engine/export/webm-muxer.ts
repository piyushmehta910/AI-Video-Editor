export interface MuxedVideoChunk {
  data: Uint8Array
  timestamp: number
  isKey: boolean
}

const TIMESTAMP_SCALE = 1_000_000

class ByteWriter {
  private buf: number[] = []

  u8(v: number) {
    this.buf.push(v & 0xff)
  }
  u16(v: number) {
    this.buf.push((v >> 8) & 0xff, v & 0xff)
  }
  u32(v: number) {
    this.buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff)
  }
  u64(v: number) {
    const hi = Math.floor(v / 0x100000000)
    const lo = v >>> 0
    this.buf.push(
      (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
      (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
    )
  }
  push(arr: Uint8Array | number[]) {
    for (const b of arr) this.buf.push(b & 0xff)
  }
  string(s: string) {
    for (let i = 0; i < s.length; i++) this.buf.push(s.charCodeAt(i) & 0xff)
  }
  // EBML variable-length integer (element size / track number)
  vint(value: number, markerBits?: number) {
    if (markerBits !== undefined) {
      const availableBits = markerBits * 7
      if (value < 1 << (availableBits - 1)) {
        this.buf.push((0xff >> markerBits) | (value >> (availableBits - markerBits + 1)))
        for (let i = markerBits - 1; i >= 1; i--) {
          this.buf.push((value >> ((i - 1) * 8)) & 0xff)
        }
        return
      }
    }
    const lengths = [1, 2, 3, 4, 8]
    for (const len of lengths) {
      const bits = len * 7
      if (value < 1 << (bits - 1)) {
        this.vint(value, len)
        return
      }
    }
    this.vint(value, 8)
  }
  element(id: number, payload: ByteWriter) {
    const arr = payload.toUint8Array()
    this.pushId(id)
    this.vint(arr.length)
    this.push(arr)
  }
  elementRaw(id: number, data: Uint8Array | number[]) {
    this.pushId(id)
    this.vint(data.length)
    this.push(data)
  }
  private pushId(id: number) {
    if (id < 0x100) this.u8(id)
    else if (id < 0x10000) this.u16(id)
    else if (id < 0x1000000) this.u32(id)
    else {
      this.u32(id >>> 8)
      this.u8(id & 0xff)
    }
  }
  toUint8Array(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.buf)
  }
}

export class WebMMuxer {
  private clusters: ByteWriter[] = []
  private currentCluster: { timestamp: number; data: ByteWriter } | null = null
  width: number
  height: number
  duration: number
  private codecId: string
  clusterCount = 0

  constructor(opts: { width: number; height: number; duration: number; codec: 'vp8' | 'vp9' | 'av1' }) {
    this.width = opts.width
    this.height = opts.height
    this.duration = opts.duration
    this.codecId = opts.codec === 'vp8' ? 'V_VP8' : opts.codec === 'vp9' ? 'V_VP9' : 'V_AV1'
  }

  addChunk(chunk: MuxedVideoChunk) {
    // Start a new cluster on each keyframe
    if (!this.currentCluster || chunk.isKey) {
      if (this.currentCluster) this.flushCluster()
      this.currentCluster = { timestamp: chunk.timestamp, data: new ByteWriter() }
    }
    if (!this.currentCluster) return

    const timecode = Math.round((chunk.timestamp - this.currentCluster.timestamp) * (1_000_000 / TIMESTAMP_SCALE))
    const block = new ByteWriter()
    block.vint(1)
    block.u16(timecode)
    block.u8(chunk.isKey ? 0x80 : 0x00)
    block.push(chunk.data)
    this.currentCluster.data.elementRaw(0xa3, block.toUint8Array())
  }

  private flushCluster() {
    if (!this.currentCluster) return
    const cluster = new ByteWriter()
    const payload = new ByteWriter()
    payload.element(0xe7, uintWriter(this.currentCluster.timestamp * 1_000_000))
    payload.push(this.currentCluster.data.toUint8Array())
    cluster.element(0x1f43b675, payload)
    this.clusters.push(cluster)
    this.currentCluster = null
    this.clusterCount++
  }

  finalize(): Blob {
    this.flushCluster()

    // Segment children: Info, Tracks, Clusters
    const segment = new ByteWriter()
    segment.element(0x1549a966, this.infoElement())
    segment.element(0x1654ae6b, this.tracksElement())
    for (const cluster of this.clusters) {
      segment.push(cluster.toUint8Array())
    }

    // EBML header
    const ebml = new ByteWriter()
    const docType = new ByteWriter()
    docType.elementRaw(0x4282, textBytes('webm')) // DocType
    docType.element(0x4287, uintWriter(2)) // DocTypeVersion
    docType.element(0x4285, uintWriter(2)) // DocTypeReadVersion
    ebml.element(0x1a45dfa3, docType)

    const head = new ByteWriter()
    head.push(ebml.toUint8Array())
    head.elementRaw(0x18538067, segment.toUint8Array())

    return new Blob([head.toUint8Array()], { type: 'video/webm' })
  }

  private infoElement(): ByteWriter {
    const info = new ByteWriter()
    info.element(0x2ad7b1, uintWriter(TIMESTAMP_SCALE)) // TimestampScale
    info.element(0x4489, floatWriter(this.duration * 1000)) // Duration in ms
    info.elementRaw(0x4d80, textBytes('ClipForge AI Studio')) // MuxingApp
    info.elementRaw(0x5741, textBytes('ClipForge AI Studio')) // WritingApp
    return info
  }

  private tracksElement(): ByteWriter {
    const entry = new ByteWriter()
    entry.element(0xd7, uintWriter(1)) // TrackNumber
    entry.element(0x73c5, uintWriter(1)) // TrackUID
    entry.element(0x83, uintWriter(1)) // TrackType = video
    entry.elementRaw(0x86, textBytes(this.codecId)) // CodecID
    const video = new ByteWriter()
    video.element(0xb0, uintWriter(this.width)) // PixelWidth
    video.element(0xba, uintWriter(this.height)) // PixelHeight
    entry.element(0xe0, video)
    const tracks = new ByteWriter()
    tracks.element(0xae, entry)
    return tracks
  }
}

function uintWriter(value: number): ByteWriter {
  const w = new ByteWriter()
  // Minimal-length unsigned integer element
  if (value < 0x100) w.u8(value)
  else if (value < 0x10000) w.u16(value)
  else if (value < 0x100000000) w.u32(value)
  else w.u64(value)
  return w
}

function floatWriter(value: number): ByteWriter {
  const w = new ByteWriter()
  const buf = new DataView(new ArrayBuffer(4))
  buf.setFloat32(0, value)
  w.u32(buf.getUint32(0))
  return w
}

function textBytes(s: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>
}