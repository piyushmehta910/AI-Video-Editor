import type { Asset } from '@/engine/types'
import { readMediaFile } from '@/engine/storage/opfs'
import { generateScenes, summarizeScenes } from '@/engine/analysis/scenes'
import { useTimelineStore } from '@/stores/timelineStore'
import { transcribeAsset, getStoredScenes, storeScenes, type StoredScenes, type StoredTranscript } from './understanding'

export interface AnalyzeProgress {
  stage: 'transcript' | 'scenes' | 'summaries'
  progress: number
}

export interface AnalyzeResult {
  transcript: StoredTranscript | null
  scenes: StoredScenes | null
}

/**
 * Analyze one asset: ensure a local transcript, then (for video) detect shot
 * boundaries and attach transcript-driven summaries. Results are cached in
 * IndexedDB keyed by asset, so re-analysis is a no-op unless forced.
 */
export async function analyzeAsset(
  asset: Asset,
  options: { signal?: AbortSignal; force?: boolean; onProgress?: (p: AnalyzeProgress) => void } = {},
): Promise<AnalyzeResult> {
  if (asset.type === 'image') return { transcript: null, scenes: null }

  options.onProgress?.({ stage: 'transcript', progress: 0 })
  const transcript = await transcribeAsset(asset)
  options.onProgress?.({ stage: 'transcript', progress: 1 })

  if (asset.type === 'audio') return { transcript, scenes: null }

  let scenes: StoredScenes | undefined
  if (!options.force) scenes = await getStoredScenes(asset.id)
  if (scenes) {
    options.onProgress?.({ stage: 'scenes', progress: 1 })
    options.onProgress?.({ stage: 'summaries', progress: 1 })
    return { transcript, scenes }
  }

  try {
    options.onProgress?.({ stage: 'scenes', progress: 0 })
    const file = await readMediaFile(asset.filePath)
    const { scenes: rawScenes, duration } = await generateScenes(
      file,
      { signal: options.signal },
      (p) => options.onProgress?.({ stage: 'scenes', progress: p }),
    )
    options.onProgress?.({ stage: 'summaries', progress: 0 })
    const summarized = summarizeScenes(rawScenes, transcript?.segments ?? [])
    const stored: StoredScenes = { assetId: asset.id, duration, scenes: summarized, updatedAt: Date.now() }
    await storeScenes(stored)
    options.onProgress?.({ stage: 'summaries', progress: 1 })
    return { transcript, scenes: stored }
  } catch (err) {
    if (options.signal?.aborted) throw err
    return { transcript, scenes: null }
  }
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