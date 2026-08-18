import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset } from '@/engine/types'
import { readMediaFile } from '@/engine/storage/opfs'
import { getRecord, putRecord } from '@/engine/storage/db'
import type { TranscriptionResult, WhisperConfig } from '@/engine/captions/whisper-engine'

export interface StoredTranscript {
  assetId: string
  text: string
  segments: Array<{ start: number; end: number; text: string }>
  language: string
  updatedAt: number
}

const DEFAULT_WHISPER: WhisperConfig = {
  modelId: 'Xenova/whisper-base',
  language: 'en',
  task: 'transcribe',
  chunkLengthSeconds: 30,
  strideLengthSeconds: 5,
}

export async function getStoredTranscript(assetId: string): Promise<StoredTranscript | undefined> {
  return getRecord<StoredTranscript>('settings', `transcript:${assetId}`)
}

export async function storeTranscript(t: StoredTranscript): Promise<void> {
  await putRecord('settings', { key: `transcript:${t.assetId}`, ...t })
}

function makeWhisperWorker(): Worker {
  return new Worker(new URL('@/engine/captions/captions-worker.ts?worker', import.meta.url), { type: 'module' })
}

function initWorker(worker: Worker, config: WhisperConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'init') {
        worker.removeEventListener('message', handler)
        if (e.data.payload?.success) resolve()
        else reject(new Error('Whisper init failed'))
      }
    }
    worker.addEventListener('message', handler)
    worker.postMessage({ type: 'init', config })
  })
}

function transcribeWithWorker(worker: Worker, audioBuffer: Float32Array, sampleRate: number): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        worker.removeEventListener('message', handler)
        resolve(e.data.result)
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler)
        reject(new Error(e.data.error))
      }
    }
    worker.addEventListener('message', handler)
    worker.postMessage({ type: 'transcribe', audioBuffer, sampleRate })
  })
}

async function extractAudioData(file: File): Promise<{ buffer: Float32Array; sampleRate: number }> {
  if (file.type.startsWith('audio/')) {
    const arrayBuffer = await file.arrayBuffer()
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 16000 })
    try {
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      return { buffer: decoded.getChannelData(0), sampleRate: decoded.sampleRate }
    } finally {
      void ctx.close()
    }
  }

  // Video: decode the audio track via captureStream + MediaRecorder.
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = async () => {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 16000 })
        const dest = ctx.createMediaStreamDestination()
        const source = ctx.createMediaElementSource(video)
        source.connect(dest)
        const stream = (video as unknown as { captureStream: () => MediaStream }).captureStream()
        stream.getAudioTracks().forEach((t) => dest.stream.addTrack(t))
        const recorder = new MediaRecorder(dest.stream)
        const chunks: BlobPart[] = []
        recorder.ondataavailable = (e) => chunks.push(e.data)
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/wav' })
          const buf = await blob.arrayBuffer()
          try {
            const decoded = await ctx.decodeAudioData(buf)
            resolve({ buffer: decoded.getChannelData(0), sampleRate: decoded.sampleRate })
          } finally {
            URL.revokeObjectURL(video.src)
            void ctx.close()
          }
        }
        recorder.onerror = reject
        recorder.start()
        void video.play()
        video.onended = () => recorder.stop()
      } catch (err) {
        URL.revokeObjectURL(video.src)
        reject(err)
      }
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Failed to load video'))
    }
  })
}

/**
 * Transcribe an asset's audio locally (Whisper via Web Worker), cache the
 * result, and return it. On any failure the transcript is skipped — the AI
 * Director can still work from project structure alone.
 */
export async function transcribeAsset(asset: Asset, onProgress?: (p: number) => void): Promise<StoredTranscript | null> {
  if (asset.type === 'image') return null
  try {
    const cached = await getStoredTranscript(asset.id)
    if (cached) return cached

    const file = await readMediaFile(asset.filePath)
    const { buffer, sampleRate } = await extractAudioData(file)
    if (!buffer.length) return null

    const worker = makeWhisperWorker()
    try {
      await initWorker(worker, DEFAULT_WHISPER)
      if (onProgress) onProgress(0.1)
      const result = await transcribeWithWorker(worker, buffer, sampleRate)
      if (onProgress) onProgress(1)
      if (!result.text.trim()) return null
      const transcript: StoredTranscript = {
        assetId: asset.id,
        text: result.text,
        segments: result.segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
        language: result.language,
        updatedAt: Date.now(),
      }
      await storeTranscript(transcript)
      return transcript
    } finally {
      worker.terminate()
    }
  } catch {
    return null
  }
}

/** Build a plain-text understanding of the whole project for the AI. */
export async function buildProjectUnderstanding(): Promise<string> {
  const { project, assets } = useTimelineStore.getState()
  const lines: string[] = []

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const asset = assets.find((a) => a.id === clip.assetId)
      if (!asset || asset.type === 'image') continue
      const transcript = await getStoredTranscript(asset.id)
      const timeRange = `${clip.startTime.toFixed(1)}s–${(clip.startTime + clip.duration).toFixed(1)}s`
      if (transcript) {
        lines.push(`- Clip "${clip.name}" (${timeRange}): "${transcript.text}"`)
      } else {
        lines.push(`- Clip "${clip.name}" (${timeRange}): (no transcript yet)`)
      }
    }
  }

  const text = lines.join('\n')
  if (!text) {
    return 'The project currently has no audio/video clips, so there is no transcript to understand yet.'
  }
  return (
    'Transcript / content of the timeline:\n' +
    text +
    '\nUse this to understand what the video actually says before making editing decisions.'
  )
}

/** Ensure every playable clip on the timeline has a transcript, generating missing ones locally. */
export async function ensureProjectTranscripts(onProgress?: (done: number, total: number) => void): Promise<number> {
  const { project, assets } = useTimelineStore.getState()
  const playable = new Map<string, Asset>()
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const asset = assets.find((a) => a.id === clip.assetId)
      if (asset && asset.type !== 'image') playable.set(asset.id, asset)
    }
  }
  const total = playable.size
  let done = 0
  for (const asset of playable.values()) {
    await transcribeAsset(asset)
    done++
    onProgress?.(done, total)
  }
  return total
}