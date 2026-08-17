const WAVEFORM_HEIGHT = 68
const WAVEFORM_WIDTH = 1200
const WAVEFORM_MAX_BUCKETS = 600

export interface WaveformResult {
  imageUrl: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  duration: number
}

/**
 * Decode an audio file and render a peak-amplitude waveform strip.
 * Reuses the FilmstripData shape so the timeline can position it identically.
 */
export async function generateWaveform(blob: Blob, type: 'audio' | 'video'): Promise<WaveformResult | null> {
  if (type !== 'audio') return null
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const duration = buffer.duration
    if (!isFinite(duration) || duration <= 0) return null

    const channels = Math.min(2, buffer.numberOfChannels)
    const data0 = buffer.getChannelData(0)
    const data1 = channels > 1 ? buffer.getChannelData(1) : null
    const buckets = Math.min(WAVEFORM_MAX_BUCKETS, Math.max(120, Math.floor(duration * 30)))

    const peaks = new Float32Array(buckets)
    const step = buffer.length / buckets
    for (let b = 0; b < buckets; b++) {
      const start = Math.floor(b * step)
      const end = Math.min(buffer.length, Math.floor((b + 1) * step))
      let peak = 0
      for (let i = start; i < end; i++) {
        const v = Math.abs(data0[i])
        const m = data1 ? Math.max(v, Math.abs(data1[i])) : v
        if (m > peak) peak = m
      }
      peaks[b] = peak
    }

    const canvas = document.createElement('canvas')
    canvas.width = WAVEFORM_WIDTH
    canvas.height = WAVEFORM_HEIGHT
    const g = canvas.getContext('2d')
    if (!g) return null

    g.fillStyle = '#0f172a'
    g.fillRect(0, 0, canvas.width, canvas.height)
    const barW = canvas.width / buckets
    const mid = canvas.height / 2
    g.fillStyle = '#34d399'
    for (let b = 0; b < buckets; b++) {
      const h = Math.max(1, Math.sqrt(peaks[b]) * (canvas.height - 8))
      g.fillRect(b * barW, mid - h / 2, Math.max(1, barW - 0.5), h)
    }

    return {
      imageUrl: canvas.toDataURL('image/png'),
      frameWidth: barW,
      frameHeight: WAVEFORM_HEIGHT,
      frameCount: buckets,
      duration,
    }
  } catch {
    return null
  } finally {
    void ctx.close()
  }
}
