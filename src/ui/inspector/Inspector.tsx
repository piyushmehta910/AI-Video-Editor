import * as React from 'react'
import { AudioLines, Layers, Scissors, Sparkles, Type } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip, EffectType } from '@/engine/types'
import { createEffect } from '@/engine/types'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const EFFECT_DEFS: Array<{
  type: EffectType
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}> = [
  { type: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.05, format: (v) => `${Math.round((1 + v) * 100)}%` },
  { type: 'contrast', label: 'Contrast', min: -1, max: 1, step: 0.05, format: (v) => `${Math.round((1 + v) * 100)}%` },
  { type: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.05, format: (v) => `${Math.round((1 + v) * 100)}%` },
  { type: 'blur', label: 'Blur', min: 0, max: 20, step: 0.5, format: (v) => `${v.toFixed(1)}px` },
  { type: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.1, format: (v) => `${Math.round(v * 100)}%` },
  { type: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
]

export function Inspector() {
  const selection = useTimelineStore((s) => s.selection)
  const project = useTimelineStore((s) => s.project)
  const updateClip = useTimelineStore((s) => s.updateClip)

  const selectedClips = selection.clipIds
    .map((id) => {
      for (const track of project.tracks) {
        const clip = track.clips.find((c) => c.id === id)
        if (clip) return { clip, track }
      }
      return null
    })
    .filter((x): x is { clip: Clip; track: (typeof project.tracks)[number] } => x !== null)

  if (selectedClips.length === 0) {
    return (
      <div className="flex w-64 shrink-0 flex-col border-l bg-muted/30">
        <InspectorHeader />
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Select a clip on the timeline to edit its transform, effects and audio.
          </p>
        </div>
      </div>
    )
  }

  const first = selectedClips[0]
  const single = selectedClips.length === 1
  const clip = first.clip

  const set = (patch: Partial<Clip>) => {
    updateClip(clip.id, patch)
  }

  const setEffectValue = (type: EffectType, value: number) => {
    const existing = clip.effects.find((e) => e.type === type)
    if (existing) {
      set({ effects: clip.effects.map((e) => (e.type === type ? { ...e, value } : e)) })
    } else {
      set({ effects: [...clip.effects, createEffect(type, value)] })
    }
  }

  const toggleEffect = (type: EffectType, enabled: boolean) => {
    if (!enabled) {
      set({ effects: clip.effects.filter((e) => e.type !== type) })
    } else {
      const existing = clip.effects.find((e) => e.type === type)
      if (!existing) set({ effects: [...clip.effects, createEffect(type, 0)] })
    }
  }

  const handleRemoveSilence = async () => {
    if (!single || first.track.type !== 'audio') return
    try {
      const url = await getAssetUrl(clip.assetId)
      const buffer = await decodeAudio(url)
      const srcRange = { from: clip.sourceStart, to: clip.sourceEnd }
      const result = trimLeadTrailSilence(buffer, srcRange, 0.02, 0.15)
      if (!result) return
      const duration = clip.duration - (result.lead + result.tail)
      if (duration <= 0.05) return
      updateClip(clip.id, {
        sourceStart: result.lead > 0 ? clip.sourceStart + result.lead : clip.sourceStart,
        duration,
        sourceEnd: result.lead > 0 ? clip.sourceStart + result.lead + duration : clip.sourceEnd - result.tail,
      })
    } catch {
      // ignore decode failures
    }
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-l bg-muted/30">
      <InspectorHeader />
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {single ? (
          <>
            <Section icon={<Layers className="size-3.5" />} title="Transform">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Position X">
                  <Input type="number" value={clip.position.x} onChange={(e) => set({ position: { ...clip.position, x: Number(e.target.value) } })} />
                </Field>
                <Field label="Position Y">
                  <Input type="number" value={clip.position.y} onChange={(e) => set({ position: { ...clip.position, y: Number(e.target.value) } })} />
                </Field>
                <Field label="Scale %">
                  <Input type="number" value={Math.round(clip.scale.x * 100)} onChange={(e) => { const v = Number(e.target.value) / 100; set({ scale: { x: v, y: v } }) }} />
                </Field>
                <Field label="Rotation °">
                  <Input type="number" value={clip.rotation} onChange={(e) => set({ rotation: Number(e.target.value) })} />
                </Field>
              </div>
              <SliderRow label="Opacity" value={clip.opacity} min={0} max={1} step={0.01} onChange={(v) => set({ opacity: v })} display={`${Math.round(clip.opacity * 100)}%`} />
            </Section>

            <Section icon={<AudioLines className="size-3.5" />} title="Audio">
              <SliderRow label="Volume" value={clip.volume} min={0} max={1} step={0.01} onChange={(v) => set({ volume: v })} display={`${Math.round(clip.volume * 100)}%`} />
              <SliderRow label="Fade in" value={clip.fadeIn} min={0} max={5} step={0.1} onChange={(v) => set({ fadeIn: v })} display={`${clip.fadeIn.toFixed(1)}s`} />
              <SliderRow label="Fade out" value={clip.fadeOut} min={0} max={5} step={0.1} onChange={(v) => set({ fadeOut: v })} display={`${clip.fadeOut.toFixed(1)}s`} />
            </Section>

            <Section icon={<Layers className="size-3.5" />} title="Effects">
              {EFFECT_DEFS.map((def) => {
                const effect = clip.effects.find((e) => e.type === def.type)
                const enabled = Boolean(effect)
                const value = effect?.value ?? 0
                return (
                  <div key={def.type} className="flex items-center gap-2">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(c) => toggleEffect(def.type, c)}
                      aria-label={`Toggle ${def.label}`}
                      className="scale-75"
                    />
                    <div className="flex-1">
                      <Slider
                        disabled={!enabled}
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        value={[value]}
                        onValueChange={([v]) => setEffectValue(def.type, v)}
                      />
                    </div>
                    <span className={cn('text-muted-foreground w-12 text-right font-mono text-[10px]', !enabled && 'opacity-40')}>
                      {def.format(value)}
                    </span>
                  </div>
                )
              })}
            </Section>

            {first.track.type === 'audio' && (
              <Section icon={<Sparkles className="size-3.5" />} title="AI Assist">
                <Button variant="outline" size="sm" className="w-full" onClick={() => void handleRemoveSilence()}>
                  <Scissors className="size-3.5" /> Trim silence
                </Button>
                <p className="text-muted-foreground text-[10px]">
                  Removes quiet leading and trailing audio within the clip.
                </p>
              </Section>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs">
              {selectedClips.length} clips selected. Multi-select edits apply to all.
            </p>
            <SliderRow
              label="Volume"
              value={clip.volume}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => {
                for (const sel of selectedClips) updateClip(sel.clip.id, { volume: v })
              }}
              display={`${Math.round(clip.volume * 100)}%`}
            />
            <SliderRow
              label="Opacity"
              value={clip.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => {
                for (const sel of selectedClips) updateClip(sel.clip.id, { opacity: v })
              }}
              display={`${Math.round(clip.opacity * 100)}%`}
            />
          </div>
        )}
      </div>
      <span className="sr-only">{single ? clip.name : `${selectedClips.length} clips`}</span>
    </div>
  )
}

function InspectorHeader() {
  return (
    <div className="flex items-center border-b px-3 py-2">
      <span className="text-xs font-semibold tracking-wide uppercase">Inspector</span>
      <Type className="text-muted-foreground ml-auto size-4" />
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        {icon}
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted-foreground text-[10px]">{label}</Label>
      {children}
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[11px]">{label}</span>
        <span className="text-muted-foreground font-mono text-[10px]">{display}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

async function getAssetUrl(assetId: string): Promise<string> {
  const store = useTimelineStore.getState()
  const asset = store.assets.find((a) => a.id === assetId)
  if (!asset) throw new Error('asset not found')
  const { readMediaFile } = await import('@/engine/storage/opfs')
  const file = await readMediaFile(asset.filePath)
  return URL.createObjectURL(file)
}

async function decodeAudio(url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(buf)
  } finally {
    void ctx.close()
  }
}

function trimLeadTrailSilence(
  buffer: AudioBuffer,
  range: { from: number; to: number },
  threshold: number,
  minTrim: number,
): { lead: number; tail: number } | null {
  const channel = buffer.getChannelData(0)
  const sr = buffer.sampleRate
  const startSample = Math.max(0, Math.floor(range.from * sr))
  const endSample = Math.min(channel.length, Math.floor(range.to * sr))
  const frame = Math.floor(sr / 20)

  let lead = 0
  let firstSound = startSample
  while (firstSound < endSample) {
    let peak = 0
    for (let j = 0; j < frame && firstSound + j < endSample; j++) {
      peak = Math.max(peak, Math.abs(channel[firstSound + j]))
    }
    if (peak >= threshold) break
    firstSound += frame
  }
  lead = (firstSound - startSample) / sr

  let lastSound = endSample
  while (lastSound > startSample) {
    let peak = 0
    for (let j = frame - 1; j >= 0 && lastSound - frame + j >= startSample; j--) {
      peak = Math.max(peak, Math.abs(channel[lastSound - frame + j]))
    }
    if (peak >= threshold) break
    lastSound -= frame
  }
  const tail = (endSample - lastSound) / sr

  if (lead < minTrim && tail < minTrim) return null
  return { lead: lead >= minTrim ? lead : 0, tail: tail >= minTrim ? tail : 0 }
}