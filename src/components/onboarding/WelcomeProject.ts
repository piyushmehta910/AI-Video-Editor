import { putRecord } from '@/engine/storage/db'
import type { Asset, CaptionWord, Clip, Project } from '@/engine/types'
import { newProject } from '@/engine/types'
import type { StoredTranscript } from '@/engine/analysis/types'

/**
 * Procedurally generated "Welcome Project": shown on first launch so new users
 * land on a living timeline instead of an empty workspace.
 *
 * Contents (all generated in-browser, no bundled media):
 *  - Color-bars pattern image placed as three 5s segments on V1 with dissolve transitions
 *  - 15s ambient chord pad rendered via OfflineAudioContext on A1
 *  - "Welcome to ClipForge" title (fade-in) plus three caption samples on T1
 *  - Word-level transcript stored against the pattern asset for the native
 *    captions system
 */

export const WELCOME_ATTEMPTED_KEY = 'clipforge-welcome-attempted'
export const WELCOME_CREATED_KEY = 'clipforge-welcome-created'

const SEGMENT_SECONDS = 5

/** SMPTE-style color bars with a brand mark, drawn to a canvas and encoded as PNG. */
async function generateColorBarsFile(): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  const bars = ['#ffffff', '#e6e600', '#00dcd8', '#00c800', '#d500d5', '#d50000', '#0000d5']
  const barWidth = canvas.width / bars.length
  bars.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.floor(i * barWidth), 0, Math.ceil(barWidth), Math.floor(canvas.height * 0.72))
  })

  const grad = ctx.createLinearGradient(0, canvas.height * 0.72, 0, canvas.height)
  grad.addColorStop(0, '#0a0a0f')
  grad.addColorStop(1, '#1e1e2e')
  ctx.fillStyle = grad
  ctx.fillRect(0, Math.floor(canvas.height * 0.72), canvas.width, Math.ceil(canvas.height * 0.28))

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '700 96px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ClipForge', canvas.width / 2, canvas.height * 0.82)

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '400 40px Inter, system-ui, sans-serif'
  ctx.fillText('Sample footage — replace it with your own', canvas.width / 2, canvas.height * 0.9)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed')
  return new File([blob], 'Welcome color bars.png', { type: 'image/png' })
}

/** Encode an AudioBuffer as a 16-bit PCM WAV file. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numFrames = buffer.length
  const bytesPerSample = 2
  const blockAlign = buffer.numberOfChannels * bytesPerSample
  const dataSize = numFrames * blockAlign
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, buffer.numberOfChannels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}

/** Gentle ambient chord pad rendered offline — no network, no bundled audio. */
async function generateAmbientMusicFile(): Promise<File> {
  const sampleRate = 44100
  const duration = SEGMENT_SECONDS * 3
  const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate)

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, 0)
  master.gain.exponentialRampToValueAtTime(0.35, 1.2)
  master.gain.setValueAtTime(0.35, duration - 1.5)
  master.gain.exponentialRampToValueAtTime(0.0001, duration)
  master.connect(ctx.destination)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2400
  filter.connect(master)

  // A major pad
  for (const freq of [220, 277.18, 329.63]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.value = 0.28
    osc.connect(gain).connect(filter)
    osc.start(0)
    osc.stop(duration)
  }
  // Slow shimmer octave
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.25
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.06
  const shimmer = ctx.createOscillator()
  shimmer.type = 'triangle'
  shimmer.frequency.value = 440
  const shimmerGain = ctx.createGain()
  shimmerGain.gain.value = 0.08
  lfo.connect(lfoGain).connect(shimmerGain.gain)
  shimmer.connect(shimmerGain).connect(filter)
  lfo.start(0)
  shimmer.start(0)
  shimmer.stop(duration)

  const rendered = await ctx.startRendering()
  const wav = audioBufferToWav(rendered)
  return new File([wav], 'Welcome ambient.wav', { type: 'audio/wav' })
}

interface CaptionLine {
  start: number
  end: number
  text: string
}

const CAPTION_LINES: CaptionLine[] = [
  { start: 5.0, end: 8.2, text: 'This timeline already has media on it' },
  { start: 8.2, end: 11.5, text: 'Drag the playhead to scrub through time' },
  { start: 11.5, end: 14.8, text: 'Select any clip to edit its properties' },
]

/** Word-level timing synthesized by even distribution within each line. */
function wordsFor(line: CaptionLine): CaptionWord[] {
  const words = line.text.split(' ')
  const totalChars = words.reduce((n, w) => n + w.length, 0)
  const span = line.end - line.start
  let t = line.start
  return words.map((word) => {
    const share = (word.length / totalChars) * span
    const cue = { word, start: Number(t.toFixed(2)), end: Number((t + share).toFixed(2)) }
    t += share
    return cue
  })
}

export async function storeWelcomeTranscript(assetId: string): Promise<StoredTranscript> {
  const transcript: StoredTranscript = {
    assetId,
    text: CAPTION_LINES.map((l) => l.text).join(' '),
    segments: CAPTION_LINES.map((l) => ({ start: l.start, end: l.end, text: l.text })),
    sentences: CAPTION_LINES.map((l) => ({ start: l.start, end: l.end, text: l.text })),
    words: CAPTION_LINES.flatMap((l) => wordsFor(l)),
    language: 'en',
    updatedAt: Date.now(),
  }
  await putRecord('settings', { key: `transcript:${assetId}`, ...transcript })
  return transcript
}

function makeClip(partial: Partial<Clip> & Pick<Clip, 'trackId' | 'startTime' | 'duration'>): Clip {
  return {
    id: crypto.randomUUID(),
    assetId: '',
    sourceStart: 0,
    sourceEnd: partial.duration ?? 5,
    speed: 1,
    name: 'Clip',
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    effects: [],
    transitions: {},
    ...partial,
  }
}

/**
 * Generate all welcome content. `importFiles` is passed in by the store to
 * reuse the full import pipeline (OPFS storage, probing, thumbnails, waveform).
 */
export async function buildWelcomeContent(
  importFiles: (files: File[]) => Promise<{ imported: Asset[]; errors: string[] }>,
): Promise<{ project: Project; transcriptAssetId: string | null }> {
  const files: File[] = []
  try {
    files.push(await generateColorBarsFile())
  } catch (err) {
    console.warn('[welcome] pattern generation failed', err)
  }
  try {
    files.push(await generateAmbientMusicFile())
  } catch (err) {
    console.warn('[welcome] audio generation failed', err)
  }

  const { imported } = await importFiles(files)
  const barsAsset = imported.find((a) => a.type === 'image')
  const musicAsset = imported.find((a) => a.type === 'audio')

  const project = newProject('Welcome to ClipForge')

  const videoTrack = project.tracks.find((t) => t.type === 'video')!
  const audioTrack = project.tracks.find((t) => t.type === 'audio')!
  const textTrack = project.tracks.find((t) => t.type === 'text')!

  // Three pre-cut segments with crossfades between them
  if (barsAsset) {
    for (let i = 0; i < 3; i++) {
      videoTrack.clips.push(
        makeClip({
          assetId: barsAsset.id,
          trackId: videoTrack.id,
          startTime: i * SEGMENT_SECONDS,
          duration: SEGMENT_SECONDS + (i < 2 ? 0.5 : 0),
          sourceEnd: SEGMENT_SECONDS + (i < 2 ? 0.5 : 0),
          name: `Color bars ${['one', 'two', 'three'][i]}`,
          clipType: 'image',
          thumbnailUrl: barsAsset.thumbnailUrl,
          // Dissolve out of segments 1→2 and 2→3 renders as a real crossfade
          transitions: i < 2 ? { out: { type: 'dissolve', duration: 0.5 } } : {},
        }),
      )
    }
  }

  if (musicAsset) {
    audioTrack.clips.push(
      makeClip({
        assetId: musicAsset.id,
        trackId: audioTrack.id,
        startTime: 0,
        duration: SEGMENT_SECONDS * 3,
        sourceEnd: SEGMENT_SECONDS * 3,
        name: musicAsset.name,
        clipType: 'music',
        volume: 0.55,
      }),
    )
  }

  const title = makeClip({
    assetId: '',
    trackId: textTrack.id,
    startTime: 0.5,
    duration: 4,
    name: 'Welcome to ClipForge',
    textType: 'title',
    text: {
      text: 'Welcome to ClipForge',
      fontSize: 96,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 'bold',
      fontStyle: 'normal',
      color: '#ffffff',
      backgroundColor: 'transparent',
      textAlign: 'center',
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      borderRadius: 0,
      shadow: true,
      animation: 'fade-in',
      animationDuration: 0.8,
    },
  })
  textTrack.clips.push(title)

  CAPTION_LINES.forEach((line, i) => {
    textTrack.clips.push(
      makeClip({
        assetId: '',
        trackId: textTrack.id,
        startTime: line.start,
        duration: line.end - line.start,
        name: `Caption ${i + 1}`,
        textType: 'caption',
        text: {
          text: line.text,
          fontSize: 42,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.65)',
          textAlign: 'center',
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 14,
          paddingRight: 14,
          borderRadius: 8,
          shadow: false,
          animation: 'slide-up',
          animationDuration: 0.3,
        },
      }),
    )
  })

  return { project, transcriptAssetId: barsAsset?.id ?? null }
}
