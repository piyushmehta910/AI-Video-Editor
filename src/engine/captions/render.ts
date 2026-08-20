import type { Asset, CaptionPosition, CaptionStyle, CaptionWord, Clip, Project } from '@/engine/types'
import { defaultCaptionsConfig } from '@/engine/types'
import { useTimelineStore } from '@/stores/timelineStore'
import type { StoredOcr, StoredTranscript } from '@/engine/analysis/types'
import { activeWordIndex, assetTimeAt, buildCaptionCues, captionAnchor, cueAt, type FrameBox } from './captions'

export interface CaptionRenderInput {
  /** Timeline time of the frame being rendered. */
  time: number
  /** Output frame size in pixels. */
  frame: { width: number; height: number }
  enabled: boolean
  mode: 'sentence' | 'word'
  style: CaptionStyle
  position: CaptionPosition
  avoidProtectedRegions: boolean
  transcript: StoredTranscript | undefined
  ocr: StoredOcr | undefined
  /** Active video clip at `time`, or null. */
  activeClip: { clip: Clip; asset: Asset } | null
}

export interface CaptionRender {
  text: string
  words?: CaptionWord[]
  activeWordIndex: number
  style: CaptionStyle
  position: CaptionPosition
  avoidProtectedRegions: boolean
  protectedRegions: FrameBox[]
  maxWidth: number
  alpha: number
}

/**
 * Compute what to draw for the caption layer at `time`, or null when nothing
 * should be shown. Pure — no DOM access — so it is unit-testable and shared by
 * the live preview and both export pipelines.
 */
export function buildCaptionRender(input: CaptionRenderInput): CaptionRender | null {
  const { time, frame, enabled, mode, transcript, activeClip, ocr } = input
  if (!enabled) return null
  if (!activeClip || !transcript) return null

  const assetTime = assetTimeAt(activeClip.clip, time)
  const cue = cueAt(buildCaptionCues(transcript), assetTime)
  if (!cue) return null

  const activeWord = mode === 'word' && cue.words?.length ? activeWordIndex(cue, assetTime) : -1
  const fade = Math.min(1, (assetTime - cue.start) / 0.08, (cue.end - assetTime) / 0.08)
  const alpha = Math.max(0, Math.min(1, fade))
  if (alpha <= 0) return null

  const protectedRegions =
    ocr?.regions.filter((r) => assetTime >= r.start && assetTime <= r.end) ?? []

  return {
    text: cue.text,
    words: mode === 'word' ? cue.words : undefined,
    activeWordIndex: activeWord,
    style: input.style,
    position: input.position,
    avoidProtectedRegions: input.avoidProtectedRegions,
    protectedRegions,
    maxWidth: frame.width * input.position.maxWidthPct,
    alpha,
  }
}

/**
 * Build the captions provider shared by the preview and export pipelines. It
 * pulls the transcript/OCR cache from the store and the caption config from the
 * project, so compositeFrame stays a pure-ish renderer.
 */
export function makeCaptionsProvider(project: Project) {
  return async (input: {
    time: number
    size: { width: number; height: number }
    activeClip: { clip: Clip; asset: Asset } | null
  }): Promise<CaptionRender | null> => {
    const { transcripts, ocr } = useTimelineStore.getState()
    const captions = project.captions ?? defaultCaptionsConfig()
    return buildCaptionRender({
      time: input.time,
      frame: input.size,
      enabled: captions.enabled,
      mode: captions.mode,
      style: captions.style,
      position: captions.position,
      avoidProtectedRegions: captions.avoidProtectedRegions,
      transcript: input.activeClip ? transcripts[input.activeClip.asset.id] : undefined,
      ocr: input.activeClip ? ocr[input.activeClip.asset.id] : undefined,
      activeClip: input.activeClip,
    })
  }
}

/** Draw a prepared caption render onto the frame context. */
export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  render: CaptionRender,
  frame: { width: number; height: number },
): void {
  const { text, words, activeWordIndex: active, style, position, protectedRegions, maxWidth, alpha } = render
  const displayText = style.uppercase ? text.toUpperCase() : text

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `${style.fontWeight === 'bold' ? 'bold ' : ''}${style.fontSize}px ${style.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (words?.length) {
    drawWordByWord(ctx, words, active, style, position, protectedRegions, maxWidth, frame)
  } else {
    const lines = wrapText(ctx, displayText, maxWidth)
    if (!lines.length) {
      ctx.restore()
      return
    }
    const lineHeight = style.fontSize * 1.25
    const boxW = Math.min(maxWidth, Math.max(...lines.map((l) => ctx.measureText(l).width)) + style.fontSize * 0.6)
    const boxH = lines.length * lineHeight + style.fontSize * 0.4
    const anchor = captionAnchor({ frame, box: { width: boxW, height: boxH }, position, protectedRegions, avoidProtectedRegions: render.avoidProtectedRegions })

    drawBackground(ctx, anchor, boxW, boxH, style, alpha)
    const startY = anchor.y - ((lines.length - 1) * lineHeight) / 2
    ctx.fillStyle = style.color
    for (let i = 0; i < lines.length; i++) {
      drawShadowed(ctx, style, () => ctx.fillText(lines[i], anchor.x, startY + i * lineHeight))
    }
  }
  ctx.restore()
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  anchor: { x: number; y: number },
  boxW: number,
  boxH: number,
  style: CaptionStyle,
  alpha: number,
): void {
  if (!style.backgroundColor || style.backgroundOpacity <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha * style.backgroundOpacity
  ctx.fillStyle = style.backgroundColor
  const x = anchor.x - boxW / 2
  const y = anchor.y - boxH / 2
  if (style.borderRadius > 0) {
    ctx.beginPath()
    ctx.roundRect(x, y, boxW, boxH, style.borderRadius)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, boxW, boxH)
  }
  ctx.restore()
}

function drawShadowed(ctx: CanvasRenderingContext2D, style: CaptionStyle, draw: () => void): void {
  if (style.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
  }
  draw()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

/** Word-by-word rendering with the active word highlighted (karaoke-style). */
function drawWordByWord(
  ctx: CanvasRenderingContext2D,
  words: CaptionWord[],
  active: number,
  style: CaptionStyle,
  position: CaptionPosition,
  protectedRegions: FrameBox[],
  maxWidth: number,
  frame: { width: number; height: number },
): void {
  const uppercase = style.uppercase
  const tokens = words.map((w) => (uppercase ? w.word.toUpperCase() : w.word))
  const spaceW = ctx.measureText(' ').width
  const lineHeight = style.fontSize * 1.25

  const lines: number[][] = [[]]
  let curWidth = 0
  for (let i = 0; i < tokens.length; i++) {
    const w = ctx.measureText(tokens[i]).width
    const line = lines[lines.length - 1]
    if (line.length > 0 && curWidth + spaceW + w > maxWidth) {
      lines.push([])
      curWidth = 0
    }
    const idx = lines[lines.length - 1].length
    lines[lines.length - 1].push(i)
    curWidth += (idx > 0 ? spaceW : 0) + w
  }

  const lineTexts = lines.map((line) => line.map((i) => tokens[i]).join(' '))
  const boxW = Math.min(maxWidth, Math.max(...lineTexts.map((l) => ctx.measureText(l).width)) + style.fontSize * 0.6)
  const boxH = lines.length * lineHeight + style.fontSize * 0.4
  const anchor = captionAnchor({ frame, box: { width: boxW, height: boxH }, position, protectedRegions, avoidProtectedRegions: true })
  drawBackground(ctx, anchor, boxW, boxH, style, ctx.globalAlpha)

  const startY = anchor.y - ((lines.length - 1) * lineHeight) / 2
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const lineText = line.map((i) => tokens[i]).join(' ')
    const lineW = ctx.measureText(lineText).width
    let x = anchor.x - lineW / 2
    const y = startY + li * lineHeight
    for (const i of line) {
      const w = ctx.measureText(tokens[i]).width
      ctx.fillStyle = i === active ? '#ffd166' : style.color
      drawShadowed(ctx, style, () => ctx.fillText(tokens[i], x + w / 2, y))
      x += w + spaceW
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const raw of text.split('\n')) {
    if (!raw) continue
    if (ctx.measureText(raw).width <= maxWidth) {
      lines.push(raw)
      continue
    }
    let current = ''
    for (const word of raw.split(/\s+/)) {
      const test = current ? `${current} ${word}` : word
      if (ctx.measureText(test).width <= maxWidth) {
        current = test
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }
  return lines
}