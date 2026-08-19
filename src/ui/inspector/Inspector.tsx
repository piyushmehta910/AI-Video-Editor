import * as React from 'react'
import { AudioLines, ChevronRight, Clapperboard, Layers, Loader2, Music, Scissors, Sparkles, Type } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip, EffectType, TextAnimation, Transition } from '@/engine/types'
import { createEffect, formatSeconds, TEXT_ANIMATIONS } from '@/engine/types'
import { useDenoiseAction } from '@/hooks/useDenoiseAction'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const TYPE_META = {
  video: { label: 'Video', icon: Clapperboard, className: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  audio: { label: 'Audio', icon: Music, className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  text: { label: 'Text', icon: Type, className: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
} as const

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

export function Inspector({ onCollapse }: { onCollapse?: () => void }) {
  const selection = useTimelineStore((s) => s.selection)
  const project = useTimelineStore((s) => s.project)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const denoise = useDenoiseAction()

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
      <div className="flex w-full h-full flex-col bg-muted/30">
        <InspectorHeader title="Inspector" onCollapse={onCollapse} />
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
  const canDenoise = single && first.track.type === 'audio' && !denoise.busy

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
    <div className="flex w-full h-full flex-col bg-muted/30">
      <InspectorHeader title={single ? 'Clip' : `${selectedClips.length} clips`} onCollapse={onCollapse} />
      <ClipSummary clip={clip} trackType={first.track.type} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {single ? (
          <Tabs defaultValue="transform" className="gap-0">
            <TabsList className="mb-3 grid w-full grid-cols-3 rounded-md bg-muted">
              <TabsTrigger value="transform" className="px-2 text-xs">
                <Layers className="size-3.5" /> Transform
              </TabsTrigger>
              <TabsTrigger value="effects" className="px-2 text-xs">
                <Sparkles className="size-3.5" /> Effects
              </TabsTrigger>
              <TabsTrigger value="audio" className="px-2 text-xs">
                <AudioLines className="size-3.5" /> Audio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transform" className="space-y-4">
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

              <Section icon={<Layers className="size-3.5" />} title="Transitions">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="In">
                    <select
                      className="w-full rounded-md border bg-background px-1 py-0.5 text-xs"
                      value={clip.transitions.in?.type ?? ''}
                      onChange={(e) => {
                        const type = e.target.value as Transition['type'] | ''
                        set({ transitions: { ...clip.transitions, in: type ? { type, duration: 0.5 } : undefined } })
                      }}
                    >
                      <option value="">None</option>
                      <option value="dissolve">Dissolve</option>
                      <option value="wipe-left">Wipe Left</option>
                      <option value="wipe-right">Wipe Right</option>
                      <option value="slide">Slide</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </Field>
                  <Field label="Duration">
                    <Input
                      type="number"
                      min={0.1}
                      max={5}
                      step={0.1}
                      value={clip.transitions.in?.duration ?? 0.5}
                      onChange={(e) => {
                        if (!clip.transitions.in) return
                        set({ transitions: { ...clip.transitions, in: { ...clip.transitions.in, duration: Number(e.target.value) } } })
                      }}
                      disabled={!clip.transitions.in}
                    />
                  </Field>
                </div>
              </Section>

              {clip.text && (
                <Section icon={<Type className="size-3.5" />} title="Text">
                  <textarea
                    className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                    rows={3}
                    value={clip.text.text}
                    onChange={(e) => set({ text: { ...clip.text!, text: e.target.value } })}
                    placeholder="Enter text..."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Font Size">
                      <Input type="number" value={clip.text.fontSize} onChange={(e) => set({ text: { ...clip.text!, fontSize: Number(e.target.value) } })} />
                    </Field>
                    <Field label="Color">
                      <input type="color" value={clip.text.color} className="size-7 cursor-pointer rounded border" onChange={(e) => set({ text: { ...clip.text!, color: e.target.value } })} />
                    </Field>
                    <Field label="BG Color">
                      <input type="color" value={clip.text.backgroundColor === 'transparent' ? '#000000' : clip.text.backgroundColor} className="size-7 cursor-pointer rounded border" onChange={(e) => set({ text: { ...clip.text!, backgroundColor: e.target.value } })} />
                    </Field>
                    <Field label="Align">
                      <select
                        className="w-full rounded-md border bg-background px-1 py-0.5 text-xs"
                        value={clip.text.textAlign}
                        onChange={(e) => set({ text: { ...clip.text!, textAlign: e.target.value as 'left' | 'center' | 'right' } })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={clip.text.fontWeight === 'bold'} onCheckedChange={(c) => set({ text: { ...clip.text!, fontWeight: c ? 'bold' : 'normal' } })} aria-label="Bold" className="scale-75" />
                    <span className="text-muted-foreground text-[10px]">Bold</span>
                    <Switch checked={clip.text.shadow} onCheckedChange={(c) => set({ text: { ...clip.text!, shadow: c } })} aria-label="Shadow" className="scale-75" />
                    <span className="text-muted-foreground text-[10px]">Shadow</span>
                  </div>
                  <Field label="Animation">
                    <select
                      className="w-full rounded-md border bg-background px-1 py-0.5 text-xs"
                      value={clip.text.animation ?? 'none'}
                      onChange={(e) => set({ text: { ...clip.text!, animation: e.target.value as TextAnimation } })}
                    >
                      {TEXT_ANIMATIONS.map((a) => (
                        <option key={a} value={a}>
                          {a.charAt(0).toUpperCase() + a.slice(1).replace(/-/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Anim duration ${(clip.text.animationDuration ?? 1).toFixed(1)}s`}>
                    <Slider
                      min={0.2}
                      max={3}
                      step={0.1}
                      value={[clip.text.animationDuration ?? 1]}
                      onValueChange={([v]) => set({ text: { ...clip.text!, animationDuration: v } })}
                    />
                  </Field>
                </Section>
              )}
            </TabsContent>

            <TabsContent value="effects" className="space-y-4">
              <Section icon={<Sparkles className="size-3.5" />} title="Effects">
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
            </TabsContent>

            <TabsContent value="audio" className="space-y-4">
              <Section icon={<AudioLines className="size-3.5" />} title="Audio">
                <SliderRow label="Volume" value={clip.volume} min={0} max={1} step={0.01} onChange={(v) => set({ volume: v })} display={`${Math.round(clip.volume * 100)}%`} />
                <SliderRow label="Fade in" value={clip.fadeIn} min={0} max={5} step={0.1} onChange={(v) => set({ fadeIn: v })} display={`${clip.fadeIn.toFixed(1)}s`} />
                <SliderRow label="Fade out" value={clip.fadeOut} min={0} max={5} step={0.1} onChange={(v) => set({ fadeOut: v })} display={`${clip.fadeOut.toFixed(1)}s`} />
              </Section>

              {first.track.type === 'audio' && (
                <Section icon={<Sparkles className="size-3.5" />} title="AI Assist">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => void denoise.run(clip.id)}
                    disabled={!canDenoise}
                  >
                    {denoise.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-emerald-400" />}
                    {denoise.busy ? 'Denoising…' : 'Denoise audio'}
                  </Button>
                  {denoise.error && <p className="text-destructive text-[10px]">{denoise.error}</p>}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => void handleRemoveSilence()}>
                    <Scissors className="size-3.5" /> Trim silence
                  </Button>
                  <p className="text-muted-foreground text-[10px]">
                    Denoise removes background noise (RNNoise). Trim silence removes quiet leading and trailing audio.
                  </p>
                </Section>
              )}
            </TabsContent>
          </Tabs>
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
    </div>
  )
}

function InspectorHeader({ title, onCollapse }: { title: string; onCollapse?: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <span className="min-w-0 truncate text-xs font-semibold tracking-wide uppercase">{title}</span>
      {onCollapse ? (
        <button
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground ml-auto"
          title="Hide panel"
        >
          <ChevronRight className="size-4" />
        </button>
      ) : (
        <Type className="text-muted-foreground ml-auto size-4" />
      )}
    </div>
  )
}

function ClipSummary({
  clip,
  trackType,
}: {
  clip: Clip
  trackType: 'video' | 'audio' | 'text'
}) {
  const meta = TYPE_META[trackType]
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-2.5 border-b px-3 py-2">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.className)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{clip.name}</p>
        <p className="text-muted-foreground font-mono text-[10px]">{formatSeconds(clip.duration)}</p>
      </div>
      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', meta.className)}>
        {meta.label}
      </span>
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