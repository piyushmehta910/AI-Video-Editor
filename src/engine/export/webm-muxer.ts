export interface MuxedVideoChunk {
  data: Uint8Array
  timestamp: number
  isKey: boolean
}

export interface MuxedAudioChunk {
  data: Uint8Array
  timestamp: number
}

export interface WebMAudioInfo {
  sampleRate: number
  channels: number
}

const TIMESTAMP_SCALE = 1_000_000
// Opus pre-skip (6.5ms = 312 samples @ 48kHz) and the required seek preroll.
const OPUS_CODEC_DELAY = 6_500_000
const OPUS_SEEK_PREROLL = 80_000_000

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
  vint(value: number) {
    // Smallest length with enough value bits: max value for len L is 2^(7L-1)-1.
    for (const len of [1, 2, 3, 4, 8]) {
      if (value <= Math.pow(2, len * 7 - 1) - 1) {
        this.vintFixed(value, len)
        return
      }
    }
    this.vintFixed(value, 8)
  }
  private vintFixed(value: number, len: number) {
    const marker = 0x80 >> (len - 1)
    for (let i = len - 1; i >= 0; i--) {
      let byte = (value >> (i * 8)) & 0xff
      if (i === len - 1) byte |= marker
      this.buf.push(byte)
    }
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
    // EBML element IDs are variable-length; the byte count is implicit in the
    // first byte's leading marker bits, so map the known IDs explicitly.
    const len =
      id === 0x1a45dfa3 || id === 0x18538067 || id === 0x1f43b675 || id === 0x1549a966 || id === 0x1654ae6b
        ? 4
        : id === 0x2ad7b1
          ? 3
          : id === 0x4282 || id === 0x4287 || id === 0x4285 || id === 0x4489 || id === 0x4d80 || id === 0x5741
            ? 2
            : 1
    for (let i = len - 1; i >= 0; i--) this.buf.push((id >>> (i * 8)) & 0xff)
  }
  toUint8Array(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.buf)
  }
}

type ChunkEntry = MuxedVideoChunk & { kind: 'video' } | MuxedAudioChunk & { kind: 'audio' }

export class WebMMuxer {
  private entries: ChunkEntry[] = []
  width: number
  height: number
  duration: number
  private codecId: string
  audio: WebMAudioInfo | null = null
  clusterCount = 0

  constructor(opts: { width: number; height: number; duration: number; codec: 'vp8' | 'vp9' | 'av1' }) {
    this.width = opts.width
    this.height = opts.height
    this.duration = opts.duration
    this.codecId = opts.codec === 'vp8' ? 'V_VP8' : opts.codec === 'vp9' ? 'V_VP9' : 'V_AV1'
  }

  setAudio(info: WebMAudioInfo) {
    this.audio = info
  }

  addChunk(chunk: MuxedVideoChunk) {
    this.entries.push({ ...chunk, kind: 'video' })
  }

  addAudioChunk(chunk: MuxedAudioChunk) {
    if (!this.audio) return
    this.entries.push({ ...chunk, kind: 'audio' })
  }

  private buildClusters(): ByteWriter {
    const segment = new ByteWriter()
    let currentCluster: { timestamp: number; data: ByteWriter } | null = null

    const sorted = [...this.entries].sort((a, b) => a.timestamp - b.timestamp || (a.kind === 'video' ? -1 : 1))
    for (const entry of sorted) {
      // Start a new cluster on each video keyframe (or when the current one is
      // empty and we only have audio so far).
      if (!currentCluster || (entry.kind === 'video' && entry.isKey)) {
        if (currentCluster) this.flushCluster(segment, currentCluster)
        currentCluster = { timestamp: entry.timestamp, data: new ByteWriter() }
      }
      if (!currentCluster) continue

      const timecode = Math.round((entry.timestamp - currentCluster.timestamp) * (TIMESTAMP_SCALE / TIMESTAMP_SCALE))
      const block = new ByteWriter()
      block.vint(entry.kind === 'video' ? 1 : 2)
      block.u16(timecode)
      block.u8(entry.kind === 'video' ? (entry.isKey ? 0x80 : 0x00) : 0x00)
      block.push(entry.data)
      currentCluster.data.elementRaw(0xa3, block.toUint8Array())
    }
    if (currentCluster) this.flushCluster(segment, currentCluster)
    return segment
  }

  private flushCluster(segment: ByteWriter, currentCluster: { timestamp: number; data: ByteWriter }) {
    const cluster = new ByteWriter()
    const payload = new ByteWriter()
    payload.element(0xe7, uintWriter(currentCluster.timestamp * TIMESTAMP_SCALE))
    payload.push(currentCluster.data.toUint8Array())
    cluster.element(0x1f43b675, payload)
    segment.push(cluster.toUint8Array())
    this.clusterCount++
  }

  finalize(): Blob {
    const segmentClusters = this.buildClusters()

    // Segment children: Info, Tracks, Clusters
    const segment = new ByteWriter()
    segment.element(0x1549a966, this.infoElement())
    segment.element(0x1654ae6b, this.tracksElement())
    segment.push(segmentClusters.toUint8Array())

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

  private videoTrackElement(): ByteWriter {
    const entry = new ByteWriter()
    entry.element(0xd7, uintWriter(1)) // TrackNumber
    entry.element(0x73c5, uintWriter(1)) // TrackUID
    entry.element(0x83, uintWriter(1)) // TrackType = video
    entry.elementRaw(0x86, textBytes(this.codecId)) // CodecID
    const video = new ByteWriter()
    video.element(0xb0, uintWriter(this.width)) // PixelWidth
    video.element(0xba, uintWriter(this.height)) // PixelHeight
    entry.element(0xe0, video)
    return entry
  }

  private audioTrackElement(): ByteWriter {
    const entry = new ByteWriter()
    entry.element(0xd7, uintWriter(2)) // TrackNumber
    entry.element(0x73c5, uintWriter(2)) // TrackUID
    entry.element(0x83, uintWriter(2)) // TrackType = audio
    entry.elementRaw(0x86, textBytes('A_OPUS')) // CodecID
    entry.element(0x56aa, uintWriter(OPUS_CODEC_DELAY)) // CodecDelay (ns)
    entry.element(0x56bb, uintWriter(OPUS_SEEK_PREROLL)) // SeekPreRoll (ns)
    const audio = new ByteWriter()
    audio.element(0xb5, floatWriter(this.audio?.sampleRate ?? 48000)) // SamplingFrequency
    audio.element(0x9f, uintWriter(this.audio?.channels ?? 2)) // Channels
    entry.element(0xe1, audio)
    return entry
  }

  private tracksElement(): ByteWriter {
    const tracks = new ByteWriter()
    tracks.element(0xae, this.videoTrackElement())
    if (this.audio) tracks.element(0xae, this.audioTrackElement())
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