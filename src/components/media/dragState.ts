import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import type { Asset, Clip } from '@/engine/types'

/** Custom MIME type used for Media Bin → Timeline asset drags. */
export const ASSET_DRAG_MIME = 'application/x-clipforge-asset'

/**
 * Module-level drag context. HTML5 DnD cannot read custom dataTransfer data
 * during `dragover` (only at drop), so the dragged asset is stashed here by
 * MediaItem and consulted by timeline drop targets for compatibility checks.
 */
let dragged: Asset | null = null

export function setDraggedAsset(asset: Asset): void {
  dragged = asset
}

export function getDraggedAsset(): Asset | null {
  return dragged
}

export function clearDraggedAsset(): void {
  dragged = null
}

/** Stamp the ghost content and register it as the drag image. */
export function beginAssetDrag(dataTransfer: DataTransfer, asset: Asset): void {
  const ghost = document.querySelector<HTMLDivElement>('[data-drag-ghost]')
  if (!ghost) return
  const thumb = ghost.querySelector<HTMLImageElement>('[data-ghost-thumb]')
  const label = ghost.querySelector<HTMLElement>('[data-ghost-label]')
  if (thumb) {
    if (asset.thumbnailUrl) {
      thumb.src = asset.thumbnailUrl
      thumb.style.display = ''
    } else {
      thumb.style.display = 'none'
    }
  }
  if (label) label.textContent = asset.name
  try {
    dataTransfer.setDragImage(ghost, 24, 20)
  } catch {
    // Some platforms reject setDragImage; the native fallback is acceptable.
  }
}

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
