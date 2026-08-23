import * as React from 'react'
import { AudioLines, LoaderCircle, Scissors, Volume2, VolumeX } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useDenoiseAction } from '@/hooks/useDenoiseAction'
import { normalizeClipVolume, type InspectorApi } from '@/hooks/useInspector'
import { LabeledSlider, MiniToggle, Row, Section, SelectInput } from './controls'

/** Audio: volume, mute, fades, normalize, denoise, EQ and ducking. */
export function AudioSection({ insp }: { insp: InspectorApi }) {
  const target = insp.target!
  const clip = target.clip
  const project = useTimelineStore((s) => s.project)
  const assets = useTimelineStore((s) => s.assets)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const denoise = useDenoiseAction()

  const asset = assets.find((a) => a.id === clip.assetId)
  const hasAudio =
    target.track.type === 'audio' ||
    asset?.type === 'video' || // video files carry their own audio track
    clip.clipType === 'voice' ||
    clip.clipType === 'music'

  const [normalizing, setNormalizing] = React.useState(false)

  if (!hasAudio) return null

  const runNormalize = async () => {
    setNormalizing(true)
    try {
      const volume = await normalizeClipVolume(clip)
      if (volume != null) {
        updateClip(clip.id, { volume })
      }
    } finally {
      setNormalizing(false)
    }
  }

  const handleTrimSilence = async () => {
    if (target.track.type !== 'audio') return
    try {
      const { readMediaFile } = await import('@/engine/storage/opfs')
      const file = asset ? await readMediaFile(asset.filePath) : null
      if (!file) return
      const buf = await file.arrayBuffer()
      const ctx = new AudioContext()
      let buffer: AudioBuffer
      try {
        buffer = await ctx.decodeAudioData(buf)
      } finally {
        void ctx.close()
      }
      const result = trimLeadTrailSilence(
        buffer,
        { from: clip.sourceStart, to: clip.sourceEnd },
        0.02,
        0.15,
      )
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

  const eq = clip.eq ?? { low: 0, mid: 0, high: 0 }
  const setEq = (patch: Partial<typeof eq>, label: string) =>
    insp.batched({ eq: { ...eq, ...patch } }, label)

  const audioTracks = project.tracks.filter((t) => t.type === 'audio')

  return (
    <Section title="Audio">
      <LabeledSlider
        label="Volume"
        value={Math.round(clip.volume * 100)}
        min={0}
        max={200}
        format={(v) => `${v}%`}
        onChange={(v) => insp.batched({ volume: v / 100 }, `Changed volume of '${clip.name}'`)}
        right={
          <MiniToggle
            checked={!clip.muted}
            onChange={(on) => insp.update({ muted: !on }, `${on ? 'Unmuted' : 'Muted'} '${clip.name}'`)}
            label={clip.muted ? 'Unmute clip' : 'Mute clip'}
          />
        }
      />
      <div className="text-muted-foreground -mt-1 flex items-center gap-1 text-[10px]">
        {clip.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
        {clip.muted ? 'Clip muted' : '100% = original level'}
      </div>

      <LabeledSlider
        label="Fade in"
        value={clip.fadeIn}
        min={0}
        max={5}
        step={0.1}
        format={(v) => `${v.toFixed(1)}s`}
        onChange={(v) => insp.batched({ fadeIn: v }, `Changed fade-in of '${clip.name}'`)}
      />
      <LabeledSlider
        label="Fade out"
        value={clip.fadeOut}
        min={0}
        max={5}
        step={0.1}
        format={(v) => `${v.toFixed(1)}s`}
        onChange={(v) => insp.batched({ fadeOut: v }, `Changed fade-out of '${clip.name}'`)}
      />

      {/* AI / one-click actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void runNormalize()}
          disabled={normalizing}
          className="hover:bg-muted flex h-8 items-center justify-center gap-1 rounded-md border border-neutral-700 text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          {normalizing ? <LoaderCircle className="size-3.5 animate-spin" /> : <AudioLines className="size-3.5 text-[#60a5fa]" />}
          Normalize
        </button>
        {target.track.type === 'audio' && (
          <>
            <button
              type="button"
              onClick={() => void denoise.run(clip.id)}
              disabled={denoise.busy}
              className="hover:bg-muted flex h-8 items-center justify-center gap-1 rounded-md border border-neutral-700 text-[11px] font-medium transition-colors disabled:opacity-50"
            >
              {denoise.busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <AudioLines className="size-3.5 text-emerald-400" />}
              Denoise
            </button>
            <button
              type="button"
              onClick={() => void handleTrimSilence()}
              className="hover:bg-muted col-span-2 flex h-8 items-center justify-center gap-1 rounded-md border border-neutral-700 text-[11px] font-medium transition-colors"
            >
              <Scissors className="size-3.5" /> Trim silence
            </button>
          </>
        )}
      </div>
      {denoise.error && <p className="text-destructive text-[10px]">{denoise.error}</p>}

      {/* EQ */}
      <Row label="EQ" stack>
        <div className="space-y-1 rounded-md border border-neutral-800 p-2">
          {(
            [
              ['low', 'Low'],
              ['mid', 'Mid'],
              ['high', 'High'],
            ] as const
          ).map(([key, label]) => (
            <LabeledSlider
              key={key}
              label={`${label} ${String.fromCodePoint(0x2022)}`}
              value={eq[key]}
              min={-12}
              max={12}
              step={0.5}
              format={(v) => `${v > 0 ? '+' : ''}${v}dB`}
              onChange={(v) => setEq({ [key]: v }, `Adjusted EQ of '${clip.name}'`)}
            />
          ))}
          <p className="text-muted-foreground pt-0.5 text-[9px]">EQ is applied to playback ducking and on export.</p>
        </div>
      </Row>

      {/* Ducking */}
      <Row label="Duck" stack>
        <SelectInput
          value={clip.duckUnderTrackId ?? ''}
          onChange={(v) => insp.update({ duckUnderTrackId: v || undefined }, `Changed ducking of '${clip.name}'`)}
          options={[
            { value: '', label: "Don't duck" },
            ...audioTracks.map((t) => ({ value: t.id, label: `Duck under ${t.name}` })),
          ]}
        />
        <p className="text-muted-foreground text-[9px]">
          This clip dips while clips on the chosen track are sounding.
        </p>
      </Row>
    </Section>
  )
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

  let firstSound = startSample
  while (firstSound < endSample) {
    let peak = 0
    for (let j = 0; j < frame && firstSound + j < endSample; j++) {
      peak = Math.max(peak, Math.abs(channel[firstSound + j]))
    }
    if (peak >= threshold) break
    firstSound += frame
  }
  const lead = (firstSound - startSample) / sr

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
