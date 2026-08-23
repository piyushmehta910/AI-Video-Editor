import type { Asset, Clip, Project, Track } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import { readMediaFile } from '@/engine/storage/opfs'

export interface MixOptions {
  sampleRate?: number
  masterVolume?: number
  muted?: boolean
}

export interface MixedAudio {
  buffer: AudioBuffer
  sampleRate: number
}

/**
 * Mix all audio clips in the project into a single stereo AudioBuffer using an
 * OfflineAudioContext. Respects clip volume/speed/fades, track mute, and the
 * master volume. Returns null when the project has no audio clips.
 */
export async function mixProjectAudio(
  project: Project,
  assets: Asset[],
  opts: MixOptions = {},
  signal?: AbortSignal,
): Promise<MixedAudio | null> {
  const audioClips: Array<{ clip: Clip; track: Track; asset: Asset }> = []
  for (const track of project.tracks) {
    if (track.hidden || track.locked) continue
    for (const clip of track.clips) {
      if (track.type !== 'audio') continue
      const asset = assets.find((a) => a.id === clip.assetId)
      if (!asset) continue
      audioClips.push({ clip, track, asset })
    }
  }
  if (audioClips.length === 0) return null

  const sampleRate = opts.sampleRate ?? 48000
  const duration = Math.max(0.1, projectDuration(project.tracks))
  const masterVolume = opts.masterVolume ?? 1
  const muted = opts.muted ?? false

  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate)

  const anySolo = project.tracks.some((t) => t.type === 'audio' && t.soloed)

  for (const { clip, track, asset } of audioClips) {
    if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
    const file = await readMediaFile(asset.filePath)
    const buf = await file.arrayBuffer()
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await ctx.decodeAudioData(buf)
    } catch {
      continue
    }

    const soloed = anySolo && track.type === 'audio' ? (track.soloed ? 1 : 0) : 1
    const baseGain = clip.volume * (clip.muted ? 0 : 1) * (track.muted ? 0 : 1) * soloed * masterVolume * (muted ? 0 : 1)
    if (baseGain <= 0) continue

    const when = Math.max(0, clip.startTime)
    const offset = clip.sourceStart + (clip.startTime < 0 ? -clip.startTime * clip.speed : 0)
    const sourceDuration = clip.duration / clip.speed
    const end = when + sourceDuration

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.playbackRate.value = clip.speed

    // Three-band EQ inserted between the source and the gain stage.
    let head: AudioNode = source
    const eq = clip.eq
    if (eq && (eq.low !== 0 || eq.mid !== 0 || eq.high !== 0)) {
      const low = ctx.createBiquadFilter()
      low.type = 'lowshelf'
      low.frequency.value = 200
      low.gain.value = Math.max(-12, Math.min(12, eq.low))
      const mid = ctx.createBiquadFilter()
      mid.type = 'peaking'
      mid.frequency.value = 1200
      mid.Q.value = 0.9
      mid.gain.value = Math.max(-12, Math.min(12, eq.mid))
      const high = ctx.createBiquadFilter()
      high.type = 'highshelf'
      high.frequency.value = 4800
      high.gain.value = Math.max(-12, Math.min(12, eq.high))
      source.connect(low)
      low.connect(mid)
      mid.connect(high)
      head = high
    }

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(baseGain, when)
    if (clip.fadeIn > 0 && clip.duration > 0) {
      gain.gain.linearRampToValueAtTime(baseGain, Math.min(end, when + clip.fadeIn))
    }
    if (clip.fadeOut > 0 && clip.duration > 0) {
      const fadeStart = Math.max(when, end - clip.fadeOut)
      gain.gain.setValueAtTime(baseGain, fadeStart)
      gain.gain.linearRampToValueAtTime(0, end)
    }

    head.connect(gain)

    // Ducking: second gain stage that dips while trigger clips sound.
    if (clip.duckUnderTrackId) {
      const triggers = collectTriggerRanges(project, clip.duckUnderTrackId, clip.id)
      const segments = buildDuckSegments(when, end, triggers)
      if (segments.length > 0) {
        const duckGain = ctx.createGain()
        applyDuckAutomation(duckGain.gain, when, end, segments, baseGain > 0 ? DUCK_LEVEL : 0, DUCK_RAMP)
        gain.connect(duckGain)
        duckGain.connect(ctx.destination)
      } else {
        gain.connect(ctx.destination)
      }
    } else {
      gain.connect(ctx.destination)
    }
    source.start(when, offset, sourceDuration)
    source.stop(end)
  }

  const buffer = await ctx.startRendering()
  return { buffer, sampleRate }
}

/** How far a ducked clip dips (fraction of its own volume). */
export const DUCK_LEVEL = 0.2
/** Ramp time in seconds entering/leaving a duck. */
export const DUCK_RAMP = 0.15

interface TimeRange {
  start: number
  end: number
}

/** All clip ranges on `trackId` (the ducking triggers), excluding the ducker itself. */
export function collectTriggerRanges(project: Project, trackId: string, excludeClipId: string): TimeRange[] {
  const track = project.tracks.find((t) => t.id === trackId)
  if (!track) return []
  return track.clips
    .filter((c) => c.id !== excludeClipId)
    .map((c) => ({ start: c.startTime, end: c.startTime + c.duration }))
}

/** Merge trigger ranges into duck windows clipped to [from,to]. */
export function buildDuckSegments(from: number, to: number, triggers: TimeRange[]): TimeRange[] {
  const segments: TimeRange[] = []
  for (const t of triggers) {
    const start = Math.max(from, t.start)
    const end = Math.min(to, t.end)
    if (end - start <= 0.001) continue
    const last = segments[segments.length - 1]
    if (last && start <= last.end + 0.001) {
      last.end = Math.max(last.end, end) // merge touching/overlapping windows
    } else {
      segments.push({ start, end })
    }
  }
  return segments
}

function applyDuckAutomation(
  param: AudioParam,
  from: number,
  to: number,
  segments: TimeRange[],
  level: number,
  ramp: number,
): void {
  param.setValueAtTime(1, from)
  for (const seg of segments) {
    const duckStart = Math.max(from + 0.001, seg.start)
    param.setTargetAtTime(level, duckStart, ramp / 3)
    if (seg.end < to) {
      param.setValueAtTime(level, Math.min(to, seg.end))
      param.setTargetAtTime(1, seg.end, ramp / 3)
    }
  }
  if (segments.length === 0 || segments[segments.length - 1].end >= to) {
    param.setValueAtTime(level, to)
  }
}