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

    const baseGain = clip.volume * (track.muted ? 0 : 1) * masterVolume * (muted ? 0 : 1)
    if (baseGain <= 0) continue

    const when = Math.max(0, clip.startTime)
    const offset = clip.sourceStart + (clip.startTime < 0 ? -clip.startTime * clip.speed : 0)
    const sourceDuration = clip.duration / clip.speed
    const end = when + sourceDuration

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.playbackRate.value = clip.speed

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

    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(when, offset, sourceDuration)
    source.stop(end)
  }

  const buffer = await ctx.startRendering()
  return { buffer, sampleRate }
}