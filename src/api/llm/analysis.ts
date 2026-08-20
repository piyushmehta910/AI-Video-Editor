import type { Asset } from '@/engine/types'
import { readMediaFile } from '@/engine/storage/opfs'
import { generateScenes, summarizeScenes } from '@/engine/analysis/scenes'
import { useTimelineStore } from '@/stores/timelineStore'
import { transcribeAsset, getStoredScenes, storeScenes } from './understanding'
import { detectOnScreenText, getStoredOcr, storeOcr } from '@/engine/analysis/ocr'
import type { StoredOcr, StoredScenes, StoredTranscript } from '@/engine/analysis/types'

export interface AnalyzeProgress {
  stage: 'transcript' | 'scenes' | 'summaries' | 'ocr'
  progress: number
}

export interface AnalyzeResult {
  transcript: StoredTranscript | null
  scenes: StoredScenes | null
  ocr: StoredOcr | null
}

/**
 * Analyze one asset: ensure a local transcript (with granular progress +
 * cancellation), detect shot boundaries + transcript-driven summaries for
 * video, then OCR sampled frames into "protected" on-screen text regions.
 * Results are cached in IndexedDB and mirrored into the zustand store so the
 * UI and captions layer can use them without re-reading the database.
 */
export async function analyzeAsset(
  asset: Asset,
  options: { signal?: AbortSignal; force?: boolean; onProgress?: (p: AnalyzeProgress) => void } = {},
): Promise<AnalyzeResult> {
  if (asset.type === 'image') return { transcript: null, scenes: null, ocr: null }

  const { signal } = options
  const store = () => useTimelineStore.getState()

  options.onProgress?.({ stage: 'transcript', progress: 0 })
  const transcript = await transcribeAsset(
    asset,
    (p) => options.onProgress?.({ stage: 'transcript', progress: p }),
    { signal },
  )
  options.onProgress?.({ stage: 'transcript', progress: 1 })
  if (transcript) store().setTranscript(transcript)

  if (asset.type === 'audio') return { transcript, scenes: null, ocr: null }

  let scenes: StoredScenes | null = null
  const cachedScenes = !options.force ? await getStoredScenes(asset.id) : undefined
  if (cachedScenes) {
    scenes = cachedScenes
    store().setScenes(cachedScenes)
    options.onProgress?.({ stage: 'scenes', progress: 1 })
    options.onProgress?.({ stage: 'summaries', progress: 1 })
  } else {
    try {
      options.onProgress?.({ stage: 'scenes', progress: 0 })
      const file = await readMediaFile(asset.filePath)
      const { scenes: rawScenes, duration } = await generateScenes(
        file,
        { signal },
        (p) => options.onProgress?.({ stage: 'scenes', progress: p }),
      )
      options.onProgress?.({ stage: 'summaries', progress: 0 })
      const summarized = summarizeScenes(rawScenes, transcript?.segments ?? [])
      const stored: StoredScenes = { assetId: asset.id, duration, scenes: summarized, updatedAt: Date.now() }
      await storeScenes(stored)
      store().setScenes(stored)
      options.onProgress?.({ stage: 'summaries', progress: 1 })
      scenes = stored
    } catch (err) {
      if (signal?.aborted) throw err
    }
  }

  let ocr: StoredOcr | null = null
  const cachedOcr = !options.force ? await getStoredOcr(asset.id) : undefined
  if (cachedOcr) {
    ocr = cachedOcr
    store().setOcr(cachedOcr)
  } else {
    try {
      options.onProgress?.({ stage: 'ocr', progress: 0 })
      const file = await readMediaFile(asset.filePath)
      const detected = await detectOnScreenText(file, asset.id, {
        signal,
        onProgress: (p) => options.onProgress?.({ stage: 'ocr', progress: p }),
      })
      await storeOcr(detected)
      store().setOcr(detected)
      ocr = detected
      options.onProgress?.({ stage: 'ocr', progress: 1 })
    } catch (err) {
      if (signal?.aborted) throw err
    }
  }

  // Ready-to-style captions: flip the layer on once we have a transcript.
  if (transcript && !store().project.captions?.enabled) {
    store().setCaptions({ enabled: true })
  }

  return { transcript, scenes, ocr }
}

/** Analyze every playable clip asset in the project, reporting (done, total). */
export async function analyzeProject(onProgress?: (done: number, total: number) => void, options: { signal?: AbortSignal; force?: boolean } = {}): Promise<number> {
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
    await analyzeAsset(asset, { ...options, onProgress: undefined })
    done++
    onProgress?.(done, total)
  }
  return total
}