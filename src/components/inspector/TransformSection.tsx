import * as React from 'react'
import {
  Link2,
  Link2Off,
  RotateCcw,
  CircleDot,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDown,
  LayoutTemplate,
  Maximize2,
} from 'lucide-react'
import type { InspectorApi } from '@/hooks/useInspector'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Track } from '@/engine/types'
import { KeyframeButton } from './KeyframeButton'
import { LabeledSlider, NumInput, Row, Section } from './controls'

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

/** Position, scale (aspect-locked), rotation, opacity and the anchor grid. */
export function TransformSection({ insp }: { insp: InspectorApi }) {
  const clip = insp.target!.clip

  const [lockAspect, setLockAspect] = React.useState(() => localStorage.getItem(LOCK_KEY) !== '0')

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

  const resetTransform = () =>
    insp.update(
      { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, opacity: 1, anchor: undefined },
      `Reset transform of '${clip.name}'`,
    )

  return (
    <Section title="Transform">
      <Row label="Position">
        <NumInput value={clip.position.x} onChange={(v) => setPosition(v, clip.position.y)} step={1} suffix="px" />
        <NumInput value={clip.position.y} onChange={(v) => setPosition(clip.position.x, v)} step={1} suffix="px" />
        <KeyframeButton
          active={insp.hasKeyframeAt('position')}
          title="Position keyframe"
          onToggle={() => insp.toggleKeyframe('position', clip.position.x)}
        />
      </Row>

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
              ? 'text-[#60a5fa] hover:text-foreground flex size-5 shrink-0 items-center justify-center rounded'
              : 'text-muted-foreground hover:text-foreground flex size-5 shrink-0 items-center justify-center rounded'
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
            <NumInput value={clip.rotation} min={-180} max={180} step={0.5} onChange={(v) => insp.batched({ rotation: v }, `Rotated '${clip.name}'`)} />
            <KeyframeButton
              active={insp.hasKeyframeAt('rotation')}
              title="Rotation keyframe"
              onToggle={() => insp.toggleKeyframe('rotation', clip.rotation)}
            />
          </>
        }
      />

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

      <Row label="Quick Placement" stack>
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          {[
            { id: 'center', label: 'Center', icon: CircleDot, fn: () => insp.update({ position: { x: 0, y: 0 } }, `Centered '${clip.name}'`) },
            { id: 'top-left', label: 'Top-L', icon: ArrowUpLeft, fn: () => {
              const p = useTimelineStore.getState().project
              insp.update({ position: { x: -p.width * 0.25, y: -p.height * 0.25 } }, `Aligned '${clip.name}' top-left`)
            }},
            { id: 'top-right', label: 'Top-R', icon: ArrowUpRight, fn: () => {
              const p = useTimelineStore.getState().project
              insp.update({ position: { x: p.width * 0.25, y: -p.height * 0.25 } }, `Aligned '${clip.name}' top-right`)
            }},
            { id: 'bottom-center', label: 'Lower-3rd', icon: ArrowDown, fn: () => {
              const p = useTimelineStore.getState().project
              insp.update({ position: { x: 0, y: p.height * 0.3 } }, `Aligned '${clip.name}' lower-third`)
            }},
            { id: 'pip', label: 'PiP', icon: LayoutTemplate, fn: () => {
              const p = useTimelineStore.getState().project
              insp.update({ position: { x: p.width * 0.3, y: p.height * 0.28 }, scale: { x: 0.38, y: 0.38 } }, `PiP '${clip.name}'`)
            }},
            { id: 'fill', label: 'Fill View', icon: Maximize2, fn: () => insp.update({ position: { x: 0, y: 0 }, scale: { x: 1, y: 1 } }, `Filled '${clip.name}'`) },
            { id: 'reset', label: 'Reset', icon: RotateCcw, fn: resetTransform },
          ].map((btn) => {
            const Icon = btn.icon
            return (
              <button
                key={btn.id}
                type="button"
                className="flex items-center justify-center gap-1 rounded border border-border/60 bg-muted/30 py-1 text-center font-mono text-[9px] text-muted-foreground hover:bg-violet-600/20 hover:text-foreground transition"
                onClick={btn.fn}
              >
                <Icon className="size-2.5 shrink-0" />
                <span>{btn.label}</span>
              </button>
            )
          })}
        </div>
      </Row>

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
                  : 'rounded border border-border/60 bg-[#0f0f1a] py-1 text-center font-mono text-[9px] text-muted-foreground hover:text-foreground'
              }
              onClick={() => insp.update({ fitMode: mode.id as any }, `Changed fit mode of '${clip.name}'`)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Layer Order (Z-Index)" stack>
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          <button
            type="button"
            className="rounded border border-border/60 bg-[#0f0f1a] py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const videoTracks = store.project.tracks.filter((t: Track) => t.type === 'video' || t.type === 'text')
              if (videoTracks.length) store.moveClip(clip.id, 0, videoTracks[0].id)
            }}
            title="Bring clip to topmost foreground layer"
          >
            ⬆ Top Layer
          </button>
          <button
            type="button"
            className="rounded border border-border/60 bg-[#0f0f1a] py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const currentIdx = store.project.tracks.findIndex((t: Track) => t.id === clip.trackId)
              if (currentIdx > 0) store.moveClip(clip.id, 0, store.project.tracks[currentIdx - 1].id)
            }}
            title="Move layer up"
          >
            ▲ Up
          </button>
          <button
            type="button"
            className="rounded border border-border/60 bg-[#0f0f1a] py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const currentIdx = store.project.tracks.findIndex((t: Track) => t.id === clip.trackId)
              if (currentIdx >= 0 && currentIdx < store.project.tracks.length - 1) {
                store.moveClip(clip.id, 0, store.project.tracks[currentIdx + 1].id)
              }
            }}
            title="Move layer down"
          >
            ▼ Down
          </button>
          <button
            type="button"
            className="rounded border border-border/60 bg-[#0f0f1a] py-1 text-center text-[9px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              const store = useTimelineStore.getState()
              const videoTracks = store.project.tracks.filter((t: Track) => t.type === 'video' || t.type === 'text')
              if (videoTracks.length) store.moveClip(clip.id, 0, videoTracks[videoTracks.length - 1].id)
            }}
            title="Send clip to background layer"
          >
            ⬇ Bottom Layer
          </button>
        </div>
      </Row>

      <Row label="Anchor" stack>
        <div className="flex items-center gap-3">
          <div className="border-border/80 bg-[#0f0f1a] grid grid-cols-3 gap-0.5 rounded-md border p-1">
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
                  className={
                    active
                      ? 'bg-[#3b82f6] size-4 rounded-sm transition-colors'
                      : 'bg-[#334155] hover:bg-[#60a5fa]/60 size-4 rounded-sm transition-colors'
                  }
                />
              )
            })}
          </div>
          <button
            type="button"
            onClick={resetTransform}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[10px]"
            title="Reset position, scale, rotation, opacity and anchor"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
        </div>
      </Row>
    </Section>
  )
}
