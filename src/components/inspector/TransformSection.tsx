import * as React from 'react'
import {
  Link2,
  Link2Off,
  RotateCcw,
  CircleDot,
  ArrowUpLeft,
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  ArrowDownLeft,
  ArrowDown,
  ArrowDownRight,
  FlipHorizontal,
  FlipVertical,
  LayoutTemplate,
  Maximize2,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Sparkles,
  User,
} from 'lucide-react'
import type { InspectorApi } from '@/hooks/useInspector'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Track } from '@/engine/types'
import { KeyframeButton } from './KeyframeButton'
import { LabeledSlider, NumInput, Row, Section } from './controls'
import { cn } from '@/lib/utils'

const LOCK_KEY = 'clipforge-inspector-lock-aspect'

const ANCHORS: Array<{ x: number; y: number; label: string }> = [
  { x: 0, y: 0, label: 'Top left' },
  { x: 0.5, y: 0, label: 'Top center' },
  { x: 1, y: 0, label: 'Top right' },
  { x: 0, y: 0.5, label: 'Center left' },
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 1, y: 0.5, label: 'Center right' },
  { x: 0, y: 1, label: 'Bottom left' },
  { x: 0.5, y: 1, label: 'Bottom center' },
  { x: 1, y: 1, label: 'Bottom right' },
]

export function TransformSection({ insp }: { insp: InspectorApi }) {
  const clip = insp.target!.clip

  const [lockAspect, setLockAspect] = React.useState(() => localStorage.getItem(LOCK_KEY) !== '0')
  const [nudgeStep, setNudgeStep] = React.useState<number>(10)

  const setLock = (on: boolean) => {
    setLockAspect(on)
    localStorage.setItem(LOCK_KEY, on ? '1' : '0')
  }

  const setPosition = (x: number, y: number) => insp.batched({ position: { x, y } }, `Moved '${clip.name}'`)
  const setScale = (sx: number, sy: number) => insp.batched({ scale: { x: sx, y: sy } }, `Scaled '${clip.name}'`)
  const setOpacity = (opacity: number) => insp.batched({ opacity }, `Changed opacity of '${clip.name}'`)

  const onScaleW = (wPct: number) => {
    const w = wPct / 100
    if (!lockAspect) {
      setScale(w, clip.scale.y)
      return
    }
    const ratio = clip.scale.x !== 0 ? clip.scale.y / clip.scale.x : 1
    setScale(w, w * ratio)
  }

  const onScaleH = (hPct: number) => {
    const h = hPct / 100
    if (!lockAspect) {
      setScale(clip.scale.x, h)
      return
    }
    const ratio = clip.scale.y !== 0 ? clip.scale.x / clip.scale.y : 1
    setScale(h * ratio, h)
  }

  // Quick Presets
  const setQuickScale = (scalePct: number) => {
    const s = scalePct / 100
    setScale(s, s)
  }

  const flipH = () => {
    insp.update({ scale: { x: -clip.scale.x, y: clip.scale.y } }, `Flipped '${clip.name}' horizontally`)
  }

  const flipV = () => {
    insp.update({ scale: { x: clip.scale.x, y: -clip.scale.y } }, `Flipped '${clip.name}' vertically`)
  }

  const nudge = (dx: number, dy: number) => {
    setPosition(clip.position.x + dx, clip.position.y + dy)
  }

  const resetTransform = () =>
    insp.update(
      { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, opacity: 1, anchor: undefined },
      `Reset transform of '${clip.name}'`,
    )

  // 9-Point Smart Placement Matrix Handlers
  const align9Point = (quadX: number, quadY: number, label: string) => {
    const p = useTimelineStore.getState().project
    const w = p.width || 1920
    const h = p.height || 1080
    // 28% margin from center to corner
    const posX = Math.round(quadX * (w * 0.28))
    const posY = Math.round(quadY * (h * 0.28))
    insp.update({ position: { x: posX, y: posY } }, `Aligned '${clip.name}' ${label}`)
  }

  return (
    <Section title="Transform & Placement">
      
      {/* ── 1. Interactive 9-Point Smart Alignment Grid ── */}
      <Row label="Smart Placement" stack>
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Screen Alignment Grid</span>
            <button
              type="button"
              onClick={resetTransform}
              className="flex items-center gap-1 font-mono text-[9px] text-violet-400 hover:text-violet-300"
            >
              <RotateCcw className="size-2.5" /> Reset
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/80 bg-muted/20 p-1.5">
            {[
              { id: 'tl', label: 'Top Left', icon: ArrowUpLeft, x: -1, y: -1 },
              { id: 'tc', label: 'Top Center', icon: ArrowUp, x: 0, y: -1 },
              { id: 'tr', label: 'Top Right', icon: ArrowUpRight, x: 1, y: -1 },
              { id: 'ml', label: 'Center Left', icon: ArrowLeft, x: -1, y: 0 },
              { id: 'mc', label: 'Center Stage', icon: CircleDot, x: 0, y: 0 },
              { id: 'mr', label: 'Center Right', icon: ArrowRight, x: 1, y: 0 },
              { id: 'bl', label: 'Bottom Left', icon: ArrowDownLeft, x: -1, y: 1 },
              { id: 'bc', label: 'Lower Third', icon: ArrowDown, x: 0, y: 1 },
              { id: 'br', label: 'Bottom Right', icon: ArrowDownRight, x: 1, y: 1 },
            ].map((btn) => {
              const Icon = btn.icon
              const isCenter = btn.x === 0 && btn.y === 0
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => align9Point(btn.x, btn.y, btn.label)}
                  title={btn.label}
                  className={cn(
                    'flex h-7 items-center justify-center gap-1 rounded border border-border/60 bg-card text-[10px] font-medium transition hover:border-violet-500 hover:bg-violet-500/20 hover:text-violet-300',
                    isCenter && 'border-violet-500/40 text-violet-300',
                  )}
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="truncate text-[9px]">{btn.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Row>

      {/* ── 2. Screen Staging Archetypes ── */}
      <Row label="Staging Presets" stack>
        <div className="grid grid-cols-3 gap-1 pt-0.5">
          {[
            {
              id: 'webcam-circle',
              label: 'Webcam Circle',
              icon: User,
              fn: () => {
                const p = useTimelineStore.getState().project
                insp.update(
                  {
                    position: { x: Math.round((p.width || 1920) * 0.32), y: Math.round((p.height || 1080) * 0.28) },
                    scale: { x: 0.35, y: 0.35 },
                    border: { width: 4, color: '#8b5cf6', radius: 9999 },
                    dropShadow: { offsetX: 0, offsetY: 8, blur: 24, color: 'rgba(0,0,0,0.6)' },
                  },
                  `Webcam Circle '${clip.name}'`,
                )
              },
            },
            {
              id: 'pip',
              label: 'PiP Corner',
              icon: LayoutTemplate,
              fn: () => {
                const p = useTimelineStore.getState().project
                insp.update(
                  { position: { x: Math.round(p.width * 0.28), y: Math.round(p.height * 0.28) }, scale: { x: 0.35, y: 0.35 } },
                  `PiP '${clip.name}'`,
                )
              },
            },
            {
              id: 'watermark',
              label: 'Watermark',
              icon: Sparkles,
              fn: () => {
                const p = useTimelineStore.getState().project
                insp.update(
                  { position: { x: Math.round(p.width * 0.32), y: Math.round(-p.height * 0.32) }, scale: { x: 0.2, y: 0.2 } },
                  `Watermark '${clip.name}'`,
                )
              },
            },
            {
              id: 'split-l',
              label: 'Split Left',
              icon: ArrowLeft,
              fn: () => {
                const p = useTimelineStore.getState().project
                insp.update({ position: { x: Math.round(-p.width * 0.25), y: 0 }, scale: { x: 0.5, y: 0.5 } }, `Split left '${clip.name}'`)
              },
            },
            {
              id: 'split-r',
              label: 'Split Right',
              icon: ArrowRight,
              fn: () => {
                const p = useTimelineStore.getState().project
                insp.update({ position: { x: Math.round(p.width * 0.25), y: 0 }, scale: { x: 0.5, y: 0.5 } }, `Split right '${clip.name}'`)
              },
            },
            {
              id: 'lower-third',
              label: 'Lower Third',
              icon: ArrowDown,
              fn: () => {
                const p = useTimelineStore.getState().project
                insp.update({ position: { x: 0, y: Math.round(p.height * 0.3) } }, `Lower-third '${clip.name}'`)
              },
            },
            {
              id: 'fill',
              label: 'Fill Canvas',
              icon: Maximize2,
              fn: () => insp.update({ position: { x: 0, y: 0 }, scale: { x: 1, y: 1 } }, `Filled '${clip.name}'`),
            },
          ].map((preset) => {
            const Icon = preset.icon
            return (
              <button
                key={preset.id}
                type="button"
                className="flex items-center justify-center gap-1 rounded border border-border/60 bg-muted/40 py-1 font-mono text-[9px] text-muted-foreground hover:border-violet-500/50 hover:bg-violet-500/20 hover:text-foreground transition"
                onClick={preset.fn}
              >
                <Icon className="size-2.5 shrink-0 text-violet-400" />
                <span>{preset.label}</span>
              </button>
            )
          })}
        </div>
      </Row>

      {/* ── 3. Sticker & Element Sizing Presets ── */}
      <Row label="Quick Sizing" stack>
        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="grid grid-cols-5 gap-1">
            {[
              { label: '15% Mini', val: 15 },
              { label: '25% Sm', val: 25 },
              { label: '35% Med', val: 35 },
              { label: '50% Half', val: 50 },
              { label: '100% Full', val: 100 },
            ].map((size) => (
              <button
                key={size.val}
                type="button"
                onClick={() => setQuickScale(size.val)}
                className={cn(
                  'rounded border border-border/60 bg-muted/30 py-1 text-center font-mono text-[9px] font-medium text-muted-foreground hover:border-violet-500 hover:text-foreground transition',
                  Math.round(clip.scale.x * 100) === size.val && 'border-violet-500 bg-violet-500/20 text-violet-300 font-bold',
                )}
              >
                {size.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={flipH}
              className="flex-1 flex items-center justify-center gap-1 rounded border border-border/60 bg-muted/30 py-1 text-[9px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
              title="Flip element horizontally"
            >
              <FlipHorizontal className="size-3" />
              <span>Flip H</span>
            </button>
            <button
              type="button"
              onClick={flipV}
              className="flex-1 flex items-center justify-center gap-1 rounded border border-border/60 bg-muted/30 py-1 text-[9px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
              title="Flip element vertically"
            >
              <FlipVertical className="size-3" />
              <span>Flip V</span>
            </button>
          </div>
        </div>
      </Row>

      {/* ── 4. Position & D-Pad Micro Nudge ── */}
      <Row label="Position">
        <NumInput value={clip.position.x} onChange={(v) => setPosition(v, clip.position.y)} step={1} suffix="px" />
        <NumInput value={clip.position.y} onChange={(v) => setPosition(clip.position.x, v)} step={1} suffix="px" />
        <KeyframeButton
          active={insp.hasKeyframeAt('position')}
          title="Position keyframe"
          onToggle={() => insp.toggleKeyframe('position', clip.position.x)}
        />
      </Row>

      {/* Micro-Nudge D-Pad Controls */}
      <Row label="Pixel Nudge" stack>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Step:</span>
            {[1, 10, 50].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNudgeStep(s)}
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[9px]',
                  nudgeStep === s
                    ? 'bg-violet-600 font-bold text-white shadow-xs'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                )}
              >
                {s}px
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => nudge(-nudgeStep, 0)}
              className="flex size-6 items-center justify-center rounded border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              title={`Nudge Left ${nudgeStep}px`}
            >
              <ArrowLeft className="size-3" />
            </button>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => nudge(0, -nudgeStep)}
                className="flex size-6 items-center justify-center rounded border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                title={`Nudge Up ${nudgeStep}px`}
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => nudge(0, nudgeStep)}
                className="flex size-6 items-center justify-center rounded border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                title={`Nudge Down ${nudgeStep}px`}
              >
                <ArrowDown className="size-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => nudge(nudgeStep, 0)}
              className="flex size-6 items-center justify-center rounded border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              title={`Nudge Right ${nudgeStep}px`}
            >
              <ArrowRight className="size-3" />
            </button>
          </div>
        </div>
      </Row>

      {/* ── 5. Scale & Aspect Lock ── */}
      <Row label="Scale">
        <NumInput value={Math.round(clip.scale.x * 100)} onChange={onScaleW} min={1} max={800} suffix="%" />
        <NumInput value={Math.round(clip.scale.y * 100)} onChange={onScaleH} min={1} max={800} suffix="%" />
        <button
          type="button"
          aria-pressed={lockAspect}
          title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio free'}
          onClick={() => setLock(!lockAspect)}
          className={
            lockAspect
              ? 'flex size-5 shrink-0 items-center justify-center rounded text-violet-400 hover:text-foreground'
              : 'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground'
          }
        >
          {lockAspect ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
        </button>
        <KeyframeButton
          active={insp.hasKeyframeAt('scale')}
          title="Scale keyframe"
          onToggle={() => insp.toggleKeyframe('scale', clip.scale.x)}
        />
      </Row>

      {/* ── 6. Rotation & Angle Quick Turns ── */}
      <LabeledSlider
        label="Rotation"
        value={clip.rotation}
        min={-180}
        max={180}
        step={0.5}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => insp.batched({ rotation: v }, `Rotated '${clip.name}'`)}
        right={
          <>
            <NumInput
              value={clip.rotation}
              min={-180}
              max={180}
              step={0.5}
              onChange={(v) => insp.batched({ rotation: v }, `Rotated '${clip.name}'`)}
            />
            <KeyframeButton
              active={insp.hasKeyframeAt('rotation')}
              title="Rotation keyframe"
              onToggle={() => insp.toggleKeyframe('rotation', clip.rotation)}
            />
          </>
        }
      />

      <div className="flex items-center gap-1 pb-1">
        {[0, 90, 180, 270, -15, 15].map((deg) => (
          <button
            key={deg}
            type="button"
            onClick={() => insp.update({ rotation: deg }, `Rotated '${clip.name}' to ${deg}°`)}
            className={cn(
              'flex-1 rounded border border-border/60 bg-muted/30 py-0.5 text-center font-mono text-[9px] text-muted-foreground hover:border-violet-500 hover:text-foreground transition',
              clip.rotation === deg && 'border-violet-500 bg-violet-500/20 text-violet-300 font-bold',
            )}
          >
            {deg > 0 && deg < 90 ? `+${deg}°` : `${deg}°`}
          </button>
        ))}
      </div>

      {/* ── 7. Opacity ── */}
      <LabeledSlider
        label="Opacity"
        value={Math.round(clip.opacity * 100)}
        min={0}
        max={100}
        step={1}
        format={(v) => `${v}%`}
        onChange={(v) => setOpacity(v / 100)}
        right={
          <KeyframeButton
            active={insp.hasKeyframeAt('opacity')}
            title="Opacity keyframe"
            onToggle={() => insp.toggleKeyframe('opacity', Math.round(clip.opacity * 100))}
          />
        }
      />

      {/* ── 8. Fit Mode ── */}
      <Row label="Fit Mode" stack>
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          {[
            { id: 'cover', label: 'Cover (Fill)' },
            { id: 'contain', label: 'Fit (Show All)' },
            { id: 'fill', label: 'Stretch' },
            { id: 'none', label: '1:1 Pixel' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={
                (clip.fitMode ?? 'cover') === mode.id
                  ? 'rounded border border-violet-500 bg-violet-500/20 py-1 text-center font-mono text-[9px] font-semibold text-violet-300 shadow-xs'
                  : 'rounded border border-border/60 bg-card py-1 text-center font-mono text-[9px] text-muted-foreground hover:text-foreground'
              }
              onClick={() => insp.update({ fitMode: mode.id as any }, `Changed fit mode of '${clip.name}'`)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </Row>

      {/* ── 9. Layer Order (Z-Index / Stack) ── */}
      <Row label="Layer Order (Z-Index)" stack>
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          <button
            type="button"
            className="flex items-center justify-center gap-1 rounded border border-border/60 bg-card py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const videoTracks = store.project.tracks.filter((t: Track) => t.type === 'video' || t.type === 'text')
              if (videoTracks.length) store.moveClip(clip.id, 0, videoTracks[0].id)
            }}
            title="Bring clip to topmost foreground layer"
          >
            <ArrowUpToLine className="size-2.5 shrink-0 text-violet-400" />
            <span>Top</span>
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-1 rounded border border-border/60 bg-card py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const currentIdx = store.project.tracks.findIndex((t: Track) => t.id === clip.trackId)
              if (currentIdx > 0) store.moveClip(clip.id, 0, store.project.tracks[currentIdx - 1].id)
            }}
            title="Move layer up"
          >
            <ChevronUp className="size-2.5 shrink-0" />
            <span>Up</span>
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-1 rounded border border-border/60 bg-card py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const currentIdx = store.project.tracks.findIndex((t: Track) => t.id === clip.trackId)
              if (currentIdx >= 0 && currentIdx < store.project.tracks.length - 1) {
                store.moveClip(clip.id, 0, store.project.tracks[currentIdx + 1].id)
              }
            }}
            title="Move layer down"
          >
            <ChevronDown className="size-2.5 shrink-0" />
            <span>Down</span>
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-1 rounded border border-border/60 bg-card py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const videoTracks = store.project.tracks.filter((t: Track) => t.type === 'video' || t.type === 'text')
              if (videoTracks.length) store.moveClip(clip.id, 0, videoTracks[videoTracks.length - 1].id)
            }}
            title="Send clip to background layer"
          >
            <ArrowDownToLine className="size-2.5 shrink-0 text-violet-400" />
            <span>Bottom</span>
          </button>
        </div>
      </Row>

      {/* ── 10. Anchor Point ── */}
      <Row label="Anchor Origin" stack>
        <div className="flex items-center gap-3 pt-0.5">
          <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border/80 bg-muted/30 p-1">
            {ANCHORS.map((a) => {
              const active =
                Math.abs((clip.anchor?.x ?? 0.5) - a.x) < 0.01 && Math.abs((clip.anchor?.y ?? 0.5) - a.y) < 0.01
              return (
                <button
                  key={a.label}
                  type="button"
                  title={a.label}
                  aria-label={`Anchor ${a.label}`}
                  onClick={() => insp.update({ anchor: { x: a.x, y: a.y } }, `Re-anchored '${clip.name}'`)}
                  className={cn(
                    'size-4 rounded-xs transition-colors',
                    active ? 'bg-violet-600' : 'bg-muted-foreground/30 hover:bg-violet-400/60',
                  )}
                />
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Pivot point for scaling, rotation, and alignment transformations.
          </p>
        </div>
      </Row>
    </Section>
  )
}
