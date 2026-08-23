import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import type { Asset, Clip } from '@/engine/types'

/**
 * Shared post-drop rules:
 * - Images become 5-second clips on the video track.
 * - With "link audio" enabled, a dropped/added audio clip is trimmed to the
 *   remaining duration of the video clip underneath it.
 */
export function applyAssetDropRules(clip: Clip, asset: Asset): void {
  const store = useTimelineStore.getState()

  if (asset.type === 'image' && Math.abs(clip.duration - 5) > 0.01) {
    store.updateClip(clip.id, { duration: 5, sourceEnd: 5 })
    return
  }

  if (asset.type === 'audio' && useEditorStore.getState().linkAudio) {
    const videoTrack = store.project.tracks.find((t) => t.type === 'video')
    const videoClip = videoTrack?.clips.find(
      (c) => clip.startTime >= c.startTime - 0.01 && clip.startTime < c.startTime + c.duration,
    )
    if (!videoClip) return
    const fitted = Math.min(clip.duration, videoClip.startTime + videoClip.duration - clip.startTime)
    if (fitted > 0.1 && Math.abs(fitted - clip.duration) > 0.05) {
      store.updateClip(clip.id, { duration: fitted, sourceEnd: fitted })
    }
  }
}
