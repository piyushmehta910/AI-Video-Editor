import { useTimelineStore } from '@/stores/timelineStore'
import { getScript, type ScriptScene } from '@/stores/scriptStore'
import { getActiveTtsProvider } from '@/api/tts'
import { searchStockImages, downloadStockImage } from '@/api/stock/search'
import { aspectToSize, type Asset, type Clip, type TextOverlay } from '@/engine/types'
import type { VideoBrief } from '@/ai/videoBrief'
import type { SubagentExecutionResult } from './types'

/**
 * Scene-sequence adapter: turns the generated ProjectScript into concrete,
 * timed timeline operations. Each scene's visual is trimmed to its measured
 * narration duration, so picture and voice stay locked together.
 */

/** Sentinel tool name recognised by the orchestrator's executor. */
export const SCENE_SEQUENCE_TOOL = '__scene_sequence__'

export interface VideoScenePlan {
  index: number
  title: string
  /** Narration text for this scene ('' when the video is silent). */
  narration: string
  /** Search query / concept used to source the visual. */
  visualQuery: string
  /** How the visual is produced. */
  visualKind: 'stock' | 'user_media' | 'card'
  /** Short supporting text shown as an on-screen caption. */
  onScreenText?: string
  /** Fallback duration from the script when no narration is measured. */
  plannedSeconds: number
}

const STYLE_PALETTES: Record<VideoBrief['style'], [string, string, string]> = {
  energetic: ['#7c3aed', '#db2777', '#ffffff'],
  educational: ['#2563eb', '#0ea5e9', '#ffffff'],
  cinematic: ['#111827', '#374151', '#f9fafb'],
  minimalist: ['#f8fafc', '#e2e8f0', '#0f172a'],
  tech: ['#059669', '#06b6d4', '#ffffff'],
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

/**
 * Map the generated script (hook + scenes + CTA) onto concrete scene plans.
 * Pure function — no timeline or network access.
 */
export function planScenesFromScript(brief: VideoBrief): VideoScenePlan[] {
  const script = getScript()
  if (!script || (!script.hook && !script.scenes.length && !script.cta)) return []

  const entries: Array<{
    title: string
    text: string
    durationSeconds?: number
    visualCue?: string
    onScreenText?: string
  }> = [
    { title: 'Hook', text: script.hook, durationSeconds: undefined, visualCue: script.hookVisual, onScreenText: script.title },
    ...script.scenes.map((s: ScriptScene) => ({
      title: s.title,
      text: s.text,
      durationSeconds: s.durationSeconds,
      visualCue: s.visualCue,
      onScreenText: s.onScreenText,
    })),
    { title: 'Call to action', text: script.cta, durationSeconds: undefined, visualCue: script.ctaVisual, onScreenText: 'Subscribe for more' },
  ]
  const usable = entries.filter((e) => e.text.trim().length > 0)
  if (!usable.length) return []

  const fallbackSeconds = Math.max(2, Math.round((brief.durationSeconds / usable.length) * 10) / 10)

  return usable.map((entry, index) => {
    let visualKind: VideoScenePlan['visualKind']
    switch (brief.sourceStrategy) {
      case 'stock':
        visualKind = 'stock'
        break
      case 'user_media':
        visualKind = 'user_media'
        break
      case 'mixed':
        visualKind = entry.visualCue ? 'stock' : 'card'
        break
      default:
        visualKind = 'card'
    }
    const queryBase = [entry.visualCue, brief.topic].filter(Boolean).join(' ')
    return {
      index,
      title: entry.title,
      narration: entry.text,
      visualQuery: queryBase.slice(0, 80),
      visualKind,
      onScreenText: entry.onScreenText,
      plannedSeconds: entry.durationSeconds && entry.durationSeconds > 0 ? entry.durationSeconds : fallbackSeconds,
    }
  })
}

/** Deterministic full-frame card rendered as an SVG image asset. */
export function renderSceneCardSvg(
  scene: Pick<VideoScenePlan, 'title' | 'visualQuery' | 'onScreenText'>,
  options: { aspect: VideoBrief['aspectRatio']; style: VideoBrief['style'] },
): string {
  const [c1, c2, ink] = STYLE_PALETTES[options.style] ?? STYLE_PALETTES.energetic
  const { width, height } = aspectToSize(options.aspect, 1280)
  const fontSize = Math.round(width * 0.062)
  const subFontSize = Math.round(width * 0.034)
  const maxChars = Math.max(12, Math.floor((width * 0.84) / (fontSize * 0.52)))
  const lines = wrapText(scene.title || scene.visualQuery, maxChars).slice(0, 3)
  const startY = height / 2 - ((lines.length - 1) * fontSize * 1.25) / 2 + fontSize * 0.35
  const titleEls = lines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${startY + i * fontSize * 1.25}" fill="${ink}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle">${esc(line)}</text>`,
    )
    .join('')
  const subEl = scene.onScreenText
    ? `<text x="${width / 2}" y="${height * 0.74}" fill="${ink}" opacity="0.85" font-family="Inter, Arial, sans-serif" font-size="${subFontSize}" font-weight="500" text-anchor="middle">${esc(wrapText(scene.onScreenText, Math.floor(maxChars * 1.6))[0] ?? '')}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#g)"/>
<circle cx="${round1(width * 0.85)}" cy="${round1(height * 0.18)}" r="${round1(width * 0.16)}" fill="#ffffff" opacity="0.08"/>
<circle cx="${round1(width * 0.12)}" cy="${round1(height * 0.86)}" r="${round1(width * 0.22)}" fill="#000000" opacity="0.10"/>
${titleEls}
${subEl}
</svg>`
}

function buildTextOverlay(text: string, fontSize: number): TextOverlay {
  return {
    text,
    fontSize,
    fontFamily: 'Inter, Arial, sans-serif',
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#ffffff',
    backgroundColor: 'rgba(15,15,26,0.55)',
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 12,
    shadow: true,
    animation: 'fade-in',
    animationDuration: 0.35,
  }
}

function trackEnd(trackId: string | undefined): number {
  if (!trackId) return 0
  const { project } = useTimelineStore.getState()
  const track = project.tracks.find((t) => t.id === trackId)
  return track ? track.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0) : 0
}

export interface SceneSequenceOptions {
  brief: VideoBrief
  runId: string
  signal: AbortSignal
  onStage: (message: string) => void
}

/**
 * Execute the scripted scenes against the real timeline:
 * per-scene TTS → measure → place audio; then a visual trimmed to exactly
 * that duration; captions follow their narration immediately.
 * All placements are tagged createdBy:'director' + directorRunId.
 */
export async function runSceneSequence(options: SceneSequenceOptions): Promise<SubagentExecutionResult[]> {
  const { brief, runId, signal, onStage } = options
  const results: SubagentExecutionResult[] = []
  const fail = (message: string): SubagentExecutionResult[] => [
    { taskId: SCENE_SEQUENCE_TOOL, role: 'visual_animator', ok: false, message },
  ]

  const plans = planScenesFromScript(brief)
  if (!plans.length) return fail('No script found — write a script before producing scenes.')

  const store = useTimelineStore.getState()
  const videoTrack = store.project.tracks.find((t) => t.type === 'video')
  if (!videoTrack) return fail('No video track exists on the timeline.')
  const audioTrack = store.project.tracks.find((t) => t.type === 'audio')
  const textTrack = store.project.tracks.find((t) => t.type === 'text')

  const userMediaAssets: Asset[] = store.assets.filter((a) => a.type === 'video' || a.type === 'image')
  const total = plans.length
  const ttsProvider = brief.narration === 'voiceover' ? getActiveTtsProvider() : null

  let cursor = round1(trackEnd(videoTrack.id))
  let audioCursor = round1(trackEnd(audioTrack?.id))
  let voicedScenes = 0
  let firstVisualStart: number | null = null
  let lastVisualEnd: number | null = null

  const importAsset = async (file: File): Promise<Asset> => {
    const { imported, errors } = await useTimelineStore.getState().importFiles([file])
    const asset = imported[0]
    if (!asset) throw new Error(errors[0] ?? 'Import failed')
    return asset
  }

  const placeClip = (clip: Omit<Clip, 'id'> & Partial<Pick<Clip, 'id'>>) => {
    useTimelineStore.getState().addClipToTrack({
      ...(clip as Clip),
      id: clip.id ?? crypto.randomUUID(),
      createdBy: 'director',
      directorRunId: runId,
    })
  }

  const makeAudioClip = (asset: Asset, start: number, duration: number): Omit<Clip, 'id'> => ({
    assetId: asset.id,
    trackId: audioTrack?.id ?? '',
    startTime: start,
    duration,
    sourceStart: 0,
    sourceEnd: Math.min(asset.duration || duration, duration),
    speed: 1,
    name: asset.name,
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0.2,
    effects: [],
    transitions: {},
    clipType: 'voice',
  })

  const makeVisualClip = (asset: Asset, start: number, duration: number, fadeIn: number): Omit<Clip, 'id'> => ({
    assetId: asset.id,
    trackId: videoTrack.id,
    startTime: start,
    duration,
    sourceStart: 0,
    sourceEnd: asset.type === 'image' ? duration : Math.min(asset.duration || duration, duration),
    speed: 1,
    name: asset.name,
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1,
    volume: 1,
    fadeIn,
    fadeOut: 0.25,
    effects: [],
    transitions: {},
    clipType: asset.type === 'image' ? 'image' : 'video',
  })

  const makeTextClip = (
    overlay: TextOverlay,
    textType: 'caption' | 'title' | 'lowerThird',
    start: number,
    duration: number,
  ): Omit<Clip, 'id'> | null => {
    if (!textTrack) return null
    return {
      assetId: '',
      trackId: textTrack.id,
      startTime: round1(start),
      duration: round1(duration),
      sourceStart: 0,
      sourceEnd: round1(duration),
      speed: 1,
      name: overlay.text.slice(0, 24) || textType,
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
      volume: 1,
      fadeIn: 0.2,
      fadeOut: 0.2,
      effects: [],
      transitions: {},
      clipType: undefined,
      textType,
      text: overlay,
    }
  }

  const acquireVisualAsset = async (
    plan: VideoScenePlan,
    sceneIndex: number,
  ): Promise<{ asset: Asset; note?: string }> => {
    // 1. Stock imagery when available.
    if (plan.visualKind === 'stock') {
      try {
        onStage(`Scene ${sceneIndex + 1}/${total}: sourcing stock visuals...`)
        const found = await searchStockImages(plan.visualQuery, { maxResults: 3 })
        if (found.length) {
          const file = await downloadStockImage(found[0])
          return { asset: await importAsset(file) }
        }
      } catch {
        /* fall through to user media / card */
      }
    }
    // 2. Existing user media (round-robin).
    if (plan.visualKind === 'user_media' || plan.visualKind === 'stock') {
      if (userMediaAssets.length) {
        return { asset: userMediaAssets[sceneIndex % userMediaAssets.length], note: 'reused existing media' }
      }
    }
    // 3. Deterministic generated card (always succeeds).
    onStage(`Scene ${sceneIndex + 1}/${total}: composing visual card...`)
    const svg = renderSceneCardSvg(plan, { aspect: brief.aspectRatio, style: brief.style })
    const file = new File([svg], `scene-${sceneIndex + 1}-card.svg`, { type: 'image/svg+xml' })
    return { asset: await importAsset(file), note: 'generated card' }
  }

  for (let i = 0; i < plans.length; i++) {
    if (signal.aborted) break
    const plan = plans[i]
    let sceneDuration = plan.plannedSeconds

    // --- Narration -------------------------------------------------------
    if (ttsProvider) {
      try {
        onStage(`Scene ${i + 1}/${total}: voicing "${plan.title}"...`)
        const synth = await ttsProvider.synthesize({ text: plan.narration })
        const file = new File([synth.blob], `vo-scene-${i + 1}.mp3`, { type: synth.blob.type || 'audio/mpeg' })
        const asset = await importAsset(file)
        const measured = asset.duration || synth.duration || plan.plannedSeconds
        sceneDuration = Math.max(0.5, round1(measured))
        placeClip(makeAudioClip(asset, audioCursor, sceneDuration))
        audioCursor = round1(audioCursor + sceneDuration)
        voicedScenes++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        // Keep the audio cursor in lockstep with the visual cursor even when
        // this scene goes silent, or every later voiceover lands misaligned.
        audioCursor = round1(audioCursor + sceneDuration)
        results.push({
          taskId: `scene-${i + 1}-vo`,
          role: 'audio_producer',
          ok: false,
          message: `Voiceover failed for scene ${i + 1} (${msg}) — continuing silently.`,
        })
      }
    }

    // --- Visual ----------------------------------------------------------
    if (signal.aborted) break
    try {
      const { asset, note } = await acquireVisualAsset(plan, i)
      const dur =
        asset.type === 'video' ? Math.max(0.5, Math.min(sceneDuration, asset.duration || sceneDuration)) : sceneDuration
      placeClip(makeVisualClip(asset, cursor, round1(dur), firstVisualStart === null ? 0.4 : 0.25))
      if (firstVisualStart === null) firstVisualStart = cursor
      lastVisualEnd = round1(cursor + dur)
      results.push({
        taskId: `scene-${i + 1}-visual`,
        role: 'visual_animator',
        ok: true,
        message: `Scene ${i + 1}/${total} placed (${round1(dur)}s${note ? `, ${note}` : ''}).`,
      })

      // Caption follows its narration immediately.
      const captionText = (plan.onScreenText || plan.narration).slice(0, 90)
      if (captionText && textTrack) {
        const caption = makeTextClip(buildTextOverlay(captionText, 30), 'caption', cursor, Math.min(sceneDuration, 5))
        if (caption) placeClip(caption)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        taskId: `scene-${i + 1}-visual`,
        role: 'visual_animator',
        ok: false,
        message: `Visual failed for scene ${i + 1}: ${msg}`,
      })
    }

    cursor = round1(cursor + sceneDuration)
  }

  // --- Title lower-third over the opening, CTA over the closing ----------
  const script = getScript()
  if (textTrack && firstVisualStart !== null && lastVisualEnd !== null && script) {
    const title = makeTextClip(
      buildTextOverlay(script.title, 56),
      'title',
      firstVisualStart,
      Math.min(5, lastVisualEnd - firstVisualStart),
    )
    if (title) placeClip(title)
    const ctaDuration = Math.min(4, Math.max(2, lastVisualEnd - firstVisualStart))
    const cta = makeTextClip(buildTextOverlay(script.cta, 36), 'lowerThird', Math.max(firstVisualStart, lastVisualEnd - ctaDuration), ctaDuration)
    if (cta) placeClip(cta)
  }

  const okCount = results.filter((r) => r.ok).length
  const summary: SubagentExecutionResult = {
    taskId: 'scene-sequence-summary',
    role: 'timeline_editor',
    ok: okCount > 0,
    message: `Sequenced ${total} scene${total > 1 ? 's' : ''}: ${voicedScenes} voiced, ${okCount}/${results.length} steps succeeded, span ~${cursor}s.`,
    outputData: { scenes: total, voiced: voicedScenes, timelineSpanSeconds: cursor },
  }
  return [...results, summary]
}
