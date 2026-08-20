import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset } from '@/engine/types'
import { readMediaFile } from '@/engine/storage/opfs'
import { getRecord, putRecord } from '@/engine/storage/db'
import type { TranscriptionResult, WhisperConfig } from '@/engine/captions/whisper-engine'
import type { StoredOcr, StoredScenes, StoredTranscript } from '@/engine/analysis/types'

export type { StoredOcr, StoredScenes, StoredTranscript } from '@/engine/analysis/types'

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

export async function getStoredScenes(assetId: string): Promise<StoredScenes | undefined> {
  return getRecord<StoredScenes>('settings', `scenes:${assetId}`)
}

export async function storeScenes(s: StoredScenes): Promise<void> {
  await putRecord('settings', { key: `scenes:${s.assetId}`, ...s })
}

export async function getStoredOcr(assetId: string): Promise<StoredOcr | undefined> {
  return getRecord<StoredOcr>('settings', `ocr:${assetId}`)
}

export async function storeOcr(o: StoredOcr): Promise<void> {
  await putRecord('settings', { key: `ocr:${o.assetId}`, ...o })
}

function makeWhisperWorker(): Worker {
  return new Worker(new URL('@/engine/captions/captions-worker.ts?worker', import.meta.url), { type: 'module' })
}

function initWorker(worker: Worker, config: WhisperConfig, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      worker.terminate()
      cleanup()
      reject(new DOMException('Transcription aborted', 'AbortError'))
    }
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'init') {
        worker.removeEventListener('message', handler)
        cleanup()
        if (e.data.payload?.success) resolve()
        else reject(new Error('Whisper init failed'))
      }
    }
    signal?.addEventListener('abort', abort, { once: true })
    worker.addEventListener('message', handler)
    if (signal?.aborted) {
      abort()
      return
    }
    worker.postMessage({ type: 'init', config })
  })
}

function transcribeWithWorker(
  worker: Worker,
  audioBuffer: Float32Array,
  sampleRate: number,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      worker.postMessage({ type: 'cancel' })
      worker.terminate()
      cleanup()
      reject(new DOMException('Transcription aborted', 'AbortError'))
    }
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const handler = (e: MessageEvent) => {
      switch (e.data.type) {
        case 'progress':
          onProgress?.(e.data.progress as number)
          break
        case 'result':
          worker.removeEventListener('message', handler)
          cleanup()
          resolve(e.data.result as TranscriptionResult)
          break
        case 'error':
          worker.removeEventListener('message', handler)
          cleanup()
          reject(new Error(e.data.error))
          break
      }
    }
    signal?.addEventListener('abort', abort, { once: true })
    worker.addEventListener('message', handler)
    if (signal?.aborted) {
      abort()
      return
    }
    worker.postMessage({ type: 'transcribe', audioBuffer, sampleRate })
  })
}

async function extractAudioData(file: File): Promise<{ buffer: Float32Array; sampleRate: number }> {
  // Chrome's AudioContext.decodeAudioData decodes audio AND video containers
  // (mp4/mov/m4a/aac/mp3/wav/ogg/flac). Creating the context at 16 kHz makes
  // it resample to the Whisper input rate in one step, so no DOM element,
  // MediaRecorder, or captureStream is needed.
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 16000 })
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer)
    return { buffer: decoded.getChannelData(0), sampleRate: decoded.sampleRate }
  } finally {
    void ctx.close()
  }
}

/**
 * Transcribe an asset's audio locally (Whisper via Web Worker), cache the
 * result, and return it. Reports granular progress (model load + per-chunk
 * generation) and supports cancellation via `signal`. On any non-abort failure
 * the transcript is skipped — the AI Director can still work from project
 * structure alone.
 */
export async function transcribeAsset(
  asset: Asset,
  onProgress?: (p: number) => void,
  options: { signal?: AbortSignal } = {},
): Promise<StoredTranscript | null> {
  if (asset.type === 'image') return null
  try {
    const cached = await getStoredTranscript(asset.id)
    if (cached) return cached

    const file = await readMediaFile(asset.filePath)
    const { buffer, sampleRate } = await extractAudioData(file)
    if (!buffer.length) return null

    const worker = makeWhisperWorker()
    try {
      await initWorker(worker, DEFAULT_WHISPER, options.signal)
      const result = await transcribeWithWorker(worker, buffer, sampleRate, onProgress, options.signal)
      if (!result.text.trim()) return null
      const transcript: StoredTranscript = {
        assetId: asset.id,
        text: result.text,
        segments: result.segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
        words: result.words?.map((w) => ({ word: w.word, start: w.start, end: w.end })),
        sentences: result.sentences.map((s) => ({ start: s.start, end: s.end, text: s.text })),
        language: result.language,
        updatedAt: Date.now(),
      }
      await storeTranscript(transcript)
      return transcript
    } finally {
      worker.terminate()
    }
  } catch (err) {
    if (options.signal?.aborted) throw err
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
      const scenes = await getStoredScenes(asset.id)
      const timeRange = `${clip.startTime.toFixed(1)}s–${(clip.startTime + clip.duration).toFixed(1)}s`
      if (transcript) {
        lines.push(`- Clip "${clip.name}" (${timeRange}): "${transcript.text}"`)
      } else {
        lines.push(`- Clip "${clip.name}" (${timeRange}): (no transcript yet)`)
      }
      if (scenes && scenes.scenes.length) {
        for (const sc of scenes.scenes) {
          const kw = sc.keywords.length ? ` keywords: ${sc.keywords.join(', ')}` : ''
          lines.push(`  - Scene ${sc.id} [${sc.start.toFixed(1)}s–${sc.end.toFixed(1)}s]: "${sc.summary}"${kw}`)
        }
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