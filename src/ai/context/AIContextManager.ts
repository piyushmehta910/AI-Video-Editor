import { useTimelineStore } from '@/stores/timelineStore'
import { readMediaFile } from '@/engine/storage/opfs'
import type { Track } from '@/engine/types'
import {
  getStoredTranscript,
  storeTranscript,
  getStoredScenes,
  storeScenes,
  getStoredOcr,
  storeOcr,
  transcribeAsset,
  type StoredTranscript,
  type StoredScenes,
  type StoredOcr,
} from '@/api/llm/understanding'
import { detectOnScreenText } from '@/engine/analysis/ocr'
import { generateScenes } from '@/engine/analysis/scenes'
import {
  createWordTimelineFromTranscript,
  type WordTimelineMasterClock,
} from '@/engine/captions/WordTimeline'
import {
  contextUnderstandingEngine,
  type UserPreferenceProfile,
  type PromptClassificationResult,
} from '@/ai/context/ContextUnderstandingEngine'

export interface TemporalMoment {
  time: number
  videoClips: Array<{ clipId: string; assetId: string; name: string; visualSummary?: string }>
  audioClips: Array<{ clipId: string; assetId: string; name: string; volume: number; isSpeech: boolean }>
  spokenWords: Array<{ word: string; start: number; end: number; clipId: string }>
  spokenText: string
  onScreenText: Array<{ text: string; confidence: number; x: number; y: number; w: number; h: number }>
  textOverlays: Array<{ text: string; position?: { x: number; y: number } }>
  hasSilence: boolean
  hasOverlappingSpeech: boolean
}

export interface TimelineHealthReport {
  totalDuration: number
  clipCount: number
  uncaptionedSpeechSpans: Array<{ start: number; end: number; duration: number }>
  silentGaps: Array<{ start: number; end: number; duration: number }>
  overlappingAudioSpans: Array<{ start: number; end: number }>
  activeOnScreenTextSpans: Array<{ start: number; end: number; text: string }>
  recommendations: string[]
}

export interface ComprehensiveProjectContext {
  projectId: string
  name: string
  resolution: string
  aspectRatio: string
  fps: number
  duration: number
  tracks: Track[]
  timelineManifest: string
  speechTranscriptsSummary: string
  ocrOnScreenTextSummary: string
  scenesVisualSummary: string
  healthReport: TimelineHealthReport
  editingKnowledge: string
}

export type ContextAnalysisProgressCallback = (status: {
  assetId: string
  assetName: string
  stage: 'transcribing' | 'ocr' | 'scenes' | 'idle' | 'complete' | 'error'
  progress: number
}) => void

/**
 * AI Context Manager
 * Persistent IndexedDB-backed multimodal knowledge manager that maintains full
 * timeline manifests, speech-to-text transcripts, frame-by-frame OCR on-screen text,
 * visual scene understanding, and video editing heuristics for the AI Director.
 */
export class AIContextManager {
  private static instance: AIContextManager
  private isRunningAnalysis = false
  private activeAbortController: AbortController | null = null
  private listeners = new Set<ContextAnalysisProgressCallback>()

  public static getInstance(): AIContextManager {
    if (!AIContextManager.instance) {
      AIContextManager.instance = new AIContextManager()
    }
    return AIContextManager.instance
  }

  public subscribe(cb: ContextAnalysisProgressCallback): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(status: Parameters<ContextAnalysisProgressCallback>[0]) {
    for (const cb of this.listeners) {
      cb(status)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. IndexedDB Knowledge Retrieval & Caching
  // ──────────────────────────────────────────────────────────────────────────

  public async getAssetTranscript(assetId: string): Promise<StoredTranscript | undefined> {
    return getStoredTranscript(assetId)
  }

  public async getAssetOcr(assetId: string): Promise<StoredOcr | undefined> {
    return getStoredOcr(assetId)
  }

  public async getAssetScenes(assetId: string): Promise<StoredScenes | undefined> {
    return getStoredScenes(assetId)
  }

  public async cacheAssetTranscript(transcript: StoredTranscript): Promise<void> {
    await storeTranscript(transcript)
  }

  public async cacheAssetOcr(ocr: StoredOcr): Promise<void> {
    await storeOcr(ocr)
  }

  public async cacheAssetScenes(scenes: StoredScenes): Promise<void> {
    await storeScenes(scenes)
  }

  public async getWordTimelineForAsset(assetId: string): Promise<WordTimelineMasterClock | null> {
    const transcript = await this.getAssetTranscript(assetId)
    if (!transcript) return null
    return createWordTimelineFromTranscript(transcript)
  }

  public async getUserPreferences(): Promise<UserPreferenceProfile> {
    return contextUnderstandingEngine.getUserPreferences()
  }

  public classifyPrompt(prompt: string): PromptClassificationResult {
    return contextUnderstandingEngine.analyzePrompt(prompt)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Automatic Multimodal Background Ingestion Pipeline
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Automatically analyzes all un-indexed audio/video assets:
   * 1. Speech-to-Text Transcription via Whisper Web Worker
   * 2. Frame-by-frame / sampled frame OCR via Tesseract Worker
   * 3. Scene boundary and visual summary detection
   */
  public async analyzeAllProjectAssets(options: { force?: boolean } = {}): Promise<void> {
    if (this.isRunningAnalysis) return
    this.isRunningAnalysis = true
    this.activeAbortController = new AbortController()
    const signal = this.activeAbortController.signal

    const { assets } = useTimelineStore.getState()
    const mediaAssets = assets.filter((a) => a.type === 'video' || a.type === 'audio')

    try {
      for (let i = 0; i < mediaAssets.length; i++) {
        if (signal.aborted) break
        const asset = mediaAssets[i]

        // 1. Speech Transcription
        const existingTranscript = !options.force ? await this.getAssetTranscript(asset.id) : undefined
        if (!existingTranscript) {
          this.notify({
            assetId: asset.id,
            assetName: asset.name,
            stage: 'transcribing',
            progress: 0.1,
          })
          try {
            await transcribeAsset(asset, (p: number) => {
              this.notify({
                assetId: asset.id,
                assetName: asset.name,
                stage: 'transcribing',
                progress: p,
              })
            }, { signal })
          } catch (e) {
            console.warn(`[AIContextManager] Transcription failed for ${asset.name}:`, e)
          }
        }

        // 2. Frame-by-frame OCR (for video)
        if (asset.type === 'video') {
          const existingOcr = !options.force ? await this.getAssetOcr(asset.id) : undefined
          if (!existingOcr) {
            this.notify({
              assetId: asset.id,
              assetName: asset.name,
              stage: 'ocr',
              progress: 0.1,
            })
            try {
              const file = await readMediaFile(asset.filePath)
              const detectedOcr = await detectOnScreenText(file, asset.id, {
                signal,
                onProgress: (p: number) => {
                  this.notify({
                    assetId: asset.id,
                    assetName: asset.name,
                    stage: 'ocr',
                    progress: p,
                  })
                },
              })
              await this.cacheAssetOcr(detectedOcr)
            } catch (e) {
              console.warn(`[AIContextManager] OCR failed for ${asset.name}:`, e)
            }
          }

          // 3. Scene Detection
          const existingScenes = !options.force ? await this.getAssetScenes(asset.id) : undefined
          if (!existingScenes) {
            this.notify({
              assetId: asset.id,
              assetName: asset.name,
              stage: 'scenes',
              progress: 0.1,
            })
            try {
              const file = await readMediaFile(asset.filePath)
              const res = await generateScenes(file, { signal }, (p: number) => {
                this.notify({
                  assetId: asset.id,
                  assetName: asset.name,
                  stage: 'scenes',
                  progress: p,
                })
              })
              const formattedScenes = res.scenes.map((s, idx) => ({
                id: String(idx + 1),
                start: s.start,
                end: s.end,
                keyframeTime: s.keyframeTime,
                summary: `Scene ${idx + 1} (${s.start.toFixed(1)}s–${s.end.toFixed(1)}s)`,
                keywords: [],
                importance: 0.5,
              }))
              await this.cacheAssetScenes({
                assetId: asset.id,
                duration: asset.duration || res.duration || 0,
                scenes: formattedScenes,
                updatedAt: Date.now(),
              })
            } catch (e) {
              console.warn(`[AIContextManager] Scene detection failed for ${asset.name}:`, e)
            }
          }
        }

        this.notify({
          assetId: asset.id,
          assetName: asset.name,
          stage: 'complete',
          progress: 1,
        })
      }
    } finally {
      this.isRunningAnalysis = false
      this.activeAbortController = null
      this.notify({
        assetId: '',
        assetName: '',
        stage: 'idle',
        progress: 1,
      })
    }
  }

  public cancelAnalysis(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort()
      this.isRunningAnalysis = false
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Temporal Knowledge Querying (Frame/Second-Level Context)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns exact multimodal knowledge at any timeline timestamp (what is spoken,
   * what on-screen OCR text is visible, what videos/audio are playing, and health flags).
   */
  public async getMomentContext(time: number): Promise<TemporalMoment> {
    const { project, assets } = useTimelineStore.getState()

    const videoClips: TemporalMoment['videoClips'] = []
    const audioClips: TemporalMoment['audioClips'] = []
    const spokenWords: TemporalMoment['spokenWords'] = []
    const onScreenText: TemporalMoment['onScreenText'] = []
    const textOverlays: TemporalMoment['textOverlays'] = []
    const spokenSentences: string[] = []

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (time >= clip.startTime && time <= clip.startTime + clip.duration) {
          const asset = assets.find((a) => a.id === clip.assetId)
          const clipRelativeTime = (time - clip.startTime) * clip.speed + clip.sourceStart

          // 1. Text Overlay Clips
          if (clip.text) {
            textOverlays.push({
              text: clip.text.text,
              position: clip.position,
            })
          }

          // 2. Video Clips & OCR
          if (track.type === 'video') {
            const scenes = asset ? await this.getAssetScenes(asset.id) : undefined
            const currentScene = scenes?.scenes.find(
              (s) => clipRelativeTime >= s.start && clipRelativeTime <= s.end,
            )

            videoClips.push({
              clipId: clip.id,
              assetId: clip.assetId,
              name: clip.name,
              visualSummary: currentScene?.summary,
            })

            const ocr = asset ? await this.getAssetOcr(asset.id) : undefined
            if (ocr?.regions?.length) {
              for (const r of ocr.regions) {
                if (clipRelativeTime >= r.start && clipRelativeTime <= r.end) {
                  onScreenText.push({
                    text: r.text,
                    confidence: r.confidence,
                    x: r.x,
                    y: r.y,
                    w: r.w,
                    h: r.h,
                  })
                }
              }
            }
          }

          // 3. Audio Clips & Spoken Transcripts
          if (track.type === 'audio' || (track.type === 'video' && !clip.muted)) {
            const transcript = asset ? await this.getAssetTranscript(asset.id) : undefined
            const isSpeech = Boolean(transcript && transcript.text.trim())

            audioClips.push({
              clipId: clip.id,
              assetId: clip.assetId,
              name: clip.name,
              volume: clip.volume,
              isSpeech,
            })

            if (transcript) {
              if (transcript.words?.length) {
                for (const w of transcript.words) {
                  if (clipRelativeTime >= w.start && clipRelativeTime <= w.end) {
                    spokenWords.push({
                      word: w.word,
                      start: clip.startTime + (w.start - clip.sourceStart) / clip.speed,
                      end: clip.startTime + (w.end - clip.sourceStart) / clip.speed,
                      clipId: clip.id,
                    })
                  }
                }
              }
              for (const s of transcript.sentences || transcript.segments || []) {
                if (clipRelativeTime >= s.start && clipRelativeTime <= s.end) {
                  spokenSentences.push(s.text.trim())
                }
              }
            }
          }
        }
      }
    }

    const hasSilence = audioClips.length === 0 || audioClips.every((a) => a.volume === 0)
    const activeSpeechClips = audioClips.filter((a) => a.isSpeech && a.volume > 0)
    const hasOverlappingSpeech = activeSpeechClips.length > 1

    return {
      time,
      videoClips,
      audioClips,
      spokenWords,
      spokenText: Array.from(new Set(spokenSentences)).join(' '),
      onScreenText,
      textOverlays,
      hasSilence,
      hasOverlappingSpeech,
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Timeline Health & Editing Intelligence Assessment
  // ──────────────────────────────────────────────────────────────────────────

  public async evaluateTimelineHealth(): Promise<TimelineHealthReport> {
    const { project } = useTimelineStore.getState()
    const totalDuration = Math.max(
      ...project.tracks.flatMap((t) => t.clips.map((c) => c.startTime + c.duration)),
      0,
    )
    const clipCount = project.tracks.reduce((sum, t) => sum + t.clips.length, 0)

    const uncaptionedSpeechSpans: TimelineHealthReport['uncaptionedSpeechSpans'] = []
    const silentGaps: TimelineHealthReport['silentGaps'] = []
    const overlappingAudioSpans: TimelineHealthReport['overlappingAudioSpans'] = []
    const activeOnScreenTextSpans: TimelineHealthReport['activeOnScreenTextSpans'] = []
    const recommendations: string[] = []

    if (totalDuration === 0 || clipCount === 0) {
      return {
        totalDuration: 0,
        clipCount: 0,
        uncaptionedSpeechSpans: [],
        silentGaps: [],
        overlappingAudioSpans: [],
        activeOnScreenTextSpans: [],
        recommendations: ['Timeline is empty. Import video/audio media or create a presentation slide.'],
      }
    }

    // Step through timeline in 0.5s increments
    const step = 0.5
    let currentSilentStart: number | null = null

    for (let t = 0; t < totalDuration; t += step) {
      const moment = await this.getMomentContext(t)

      // Silent spans
      if (moment.hasSilence) {
        if (currentSilentStart === null) currentSilentStart = t
      } else {
        if (currentSilentStart !== null) {
          const dur = t - currentSilentStart
          if (dur >= 1.5) {
            silentGaps.push({ start: currentSilentStart, end: t, duration: dur })
          }
          currentSilentStart = null
        }
      }

      // Overlapping speech
      if (moment.hasOverlappingSpeech) {
        overlappingAudioSpans.push({ start: t, end: t + step })
      }

      // Uncaptioned speech
      if (moment.spokenText && moment.textOverlays.length === 0) {
        uncaptionedSpeechSpans.push({ start: t, end: t + step, duration: step })
      }

      // On-screen OCR text
      if (moment.onScreenText.length > 0) {
        const textSnippet = moment.onScreenText.map((o) => o.text).join(' | ')
        activeOnScreenTextSpans.push({ start: t, end: t + step, text: textSnippet })
      }
    }

    if (silentGaps.length > 0) {
      recommendations.push(
        `Found ${silentGaps.length} silent gap(s) (>1.5s). Consider trimming dead space or adding background audio.`,
      )
    }
    if (overlappingAudioSpans.length > 0) {
      recommendations.push(
        'Detected overlapping spoken audio dialogue on multiple tracks. Apply audio ducking or adjust clip positions.',
      )
    }
    if (uncaptionedSpeechSpans.length > 0) {
      recommendations.push(
        'Spoken dialogue is present without on-screen captions. Generate animated captions to boost engagement.',
      )
    }

    return {
      totalDuration,
      clipCount,
      uncaptionedSpeechSpans,
      silentGaps,
      overlappingAudioSpans,
      activeOnScreenTextSpans,
      recommendations,
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Comprehensive Context Synthesis for AI Director
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compiles the full multimodal knowledge base into a structured, highly informative
   * context document designed specifically for LLM reasoning and precise tool calls.
   */
  public async getComprehensiveContext(): Promise<ComprehensiveProjectContext> {
    const { project, assets } = useTimelineStore.getState()
    const totalDuration = Math.max(
      ...project.tracks.flatMap((t) => t.clips.map((c) => c.startTime + c.duration)),
      0,
    )

    // 1. Tracks & Clips Layout Manifest
    const manifestLines: string[] = []
    manifestLines.push(`Project: "${project.name}" ${project.width}×${project.height} (${project.aspectRatio}) @ ${project.fps}fps, Total Duration: ${totalDuration.toFixed(2)}s`)
    manifestLines.push(`Tracks Hierarchy (${project.tracks.length} tracks, ${project.tracks.reduce((s, t) => s + t.clips.length, 0)} clips):`)

    for (const track of project.tracks) {
      manifestLines.push(`  [Track ${track.type.toUpperCase()}] "${track.name}" (${track.clips.length} clips):`)
      for (const clip of track.clips) {
        const props: string[] = []
        if (clip.speed !== 1) props.push(`speed: ${clip.speed.toFixed(2)}x`)
        if (clip.volume !== 1) props.push(`volume: ${Math.round(clip.volume * 100)}%`)
        if (clip.muted) props.push('muted')
        if (clip.position && (clip.position.x !== 0 || clip.position.y !== 0)) {
          props.push(`pos: (${clip.position.x}, ${clip.position.y})`)
        }
        if (clip.scale && (clip.scale.x !== 1 || clip.scale.y !== 1)) {
          props.push(`scale: (${clip.scale.x.toFixed(2)}, ${clip.scale.y.toFixed(2)})`)
        }
        if (clip.rotation) props.push(`rot: ${clip.rotation}°`)
        if (clip.opacity !== undefined && clip.opacity !== 1) props.push(`opacity: ${Math.round(clip.opacity * 100)}%`)

        const propStr = props.length ? ` [${props.join(', ')}]` : ''
        const bounds = `${clip.startTime.toFixed(2)}s–${(clip.startTime + clip.duration).toFixed(2)}s`

        if (clip.text) {
          manifestLines.push(`    - Text Overlay: "${clip.text.text}" (${bounds})${propStr}`)
        } else {
          manifestLines.push(`    - Clip: "${clip.name}" (${bounds}, source: ${clip.sourceStart.toFixed(1)}s→${clip.sourceEnd.toFixed(1)}s)${propStr}`)
        }
      }
    }

    // 2. Spoken Speech & Audio Captions Summary
    const transcriptLines: string[] = []
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const asset = assets.find((a) => a.id === clip.assetId)
        if (!asset || asset.type === 'image') continue
        const transcript = await this.getAssetTranscript(asset.id)
        if (transcript && transcript.text.trim()) {
          const sentences = transcript.sentences || transcript.segments || []
          const clipSentences = sentences
            .filter((s) => s.end >= clip.sourceStart && s.start <= clip.sourceEnd)
            .map((s) => `[${(clip.startTime + (s.start - clip.sourceStart) / clip.speed).toFixed(1)}s]: "${s.text.trim()}"`)
            .slice(0, 6)

          transcriptLines.push(`  - Clip "${clip.name}" Spoken Audio:\n    ${clipSentences.join('\n    ')}`)
        }
      }
    }

    // 3. Frame-by-Frame OCR On-Screen Text Summary
    const ocrLines: string[] = []
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const asset = assets.find((a) => a.id === clip.assetId)
        if (!asset || asset.type !== 'video') continue
        const ocr = await this.getAssetOcr(asset.id)
        if (ocr && ocr.regions.length > 0) {
          const visibleRegions = ocr.regions
            .filter((r) => r.end >= clip.sourceStart && r.start <= clip.sourceEnd)
            .map((r) => {
              const startT = (clip.startTime + (r.start - clip.sourceStart) / clip.speed).toFixed(1)
              const endT = (clip.startTime + (r.end - clip.sourceStart) / clip.speed).toFixed(1)
              return `[${startT}s–${endT}s, pos: (${Math.round(r.x * 100)}%, ${Math.round(r.y * 100)}%)]: "${r.text}"`
            })
            .slice(0, 8)

          if (visibleRegions.length) {
            ocrLines.push(`  - Clip "${clip.name}" On-Screen Visual Text (OCR):\n    ${visibleRegions.join('\n    ')}`)
          }
        }
      }
    }

    // 4. Visual Scenes & Color Atmospheres
    const sceneLines: string[] = []
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const asset = assets.find((a) => a.id === clip.assetId)
        if (!asset || asset.type !== 'video') continue
        const scenes = await this.getAssetScenes(asset.id)
        if (scenes && scenes.scenes.length > 0) {
          const visibleScenes = scenes.scenes
            .filter((s) => s.end >= clip.sourceStart && s.start <= clip.sourceEnd)
            .map((s) => {
              const startT = (clip.startTime + (s.start - clip.sourceStart) / clip.speed).toFixed(1)
              const endT = (clip.startTime + (s.end - clip.sourceStart) / clip.speed).toFixed(1)
              const kw = s.keywords?.length ? ` (keywords: ${s.keywords.join(', ')})` : ''
              return `[${startT}s–${endT}s Scene ${s.id}]: "${s.summary}"${kw}`
            })

          if (visibleScenes.length) {
            sceneLines.push(`  - Clip "${clip.name}" Visual Scene Cuts:\n    ${visibleScenes.join('\n    ')}`)
          }
        }
      }
    }

    // 5. Timeline Health Report
    const healthReport = await this.evaluateTimelineHealth()

    // 6. Professional Video Editing Knowledge
    const editingKnowledge = `
VIDEO EDITING PRINCIPLES & GUIDELINES:
1. Pacing: Match cut frequency to dialogue rhythm and music tempo (fast energetic: cuts every 1.5s–3s; narrative: cuts every 4s–7s).
2. Captions: Keep captions centered in lower-third safe zones (bottom 20-30%) with bold contrast and 1-2 lines per screen.
3. Audio Balance: Dialogue should sit prominently at -6dB to -12dB; background music ducked to 15-25% under voiceover.
4. Transitions: Use cuts for narrative continuity; cross-fades or wipes only for time progression or scene shifts.
5. On-Screen Text & OCR: Avoid placing new text overlays directly over existing on-screen text regions (lower thirds / logos).
`.trim()

    return {
      projectId: project.id,
      name: project.name,
      resolution: `${project.width}×${project.height}`,
      aspectRatio: project.aspectRatio,
      fps: project.fps,
      duration: totalDuration,
      tracks: project.tracks,
      timelineManifest: manifestLines.join('\n'),
      speechTranscriptsSummary: transcriptLines.length ? transcriptLines.join('\n') : 'No speech audio detected or transcribed yet.',
      ocrOnScreenTextSummary: ocrLines.length ? ocrLines.join('\n') : 'No persistent on-screen text detected by OCR.',
      scenesVisualSummary: sceneLines.length ? sceneLines.join('\n') : 'No visual scene cut data available.',
      healthReport,
      editingKnowledge,
    }
  }
}

export const aiContextManager = AIContextManager.getInstance()
