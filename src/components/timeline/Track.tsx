import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, Clip as ClipModel, Track } from '@/engine/types'
import { TrackHeader } from '@/components/timeline/TrackHeader'
import { Clip, type DragMode } from '@/components/timeline/Clip'

/**
 * Unified track lane: sticky header (TrackHeader) plus absolutely-positioned
 * clips (Clip). Owns the per-clip keyboard navigation shared by all types.
 */
export function Track({
  track,
  shortLabel,
  zoom,
  assetById,
  selected,
  playhead,
  trimMode,
  onPointerDownClip,
}: {
  track: Track
  shortLabel: string
  zoom: number
  assetById: (id: string) => Asset | undefined
  selected: string[]
  playhead: number
  trimMode: boolean
  onPointerDownClip: (e: React.PointerEvent, clip: ClipModel, mode: DragMode) => void
}) {
  const trackHeight = useTrackHeight()

  const handleClipKeyDown = (e: React.KeyboardEvent, clip: ClipModel, track: Track) => {
    const store = useTimelineStore.getState()
    const allClips = store.project.tracks.flatMap((t) => t.clips)
    const clipIndex = allClips.findIndex((c) => c.id === clip.id)
    const focusClip = (target: ClipModel | undefined) => {
      if (!target) return
      store.select([target.id], target.trackId)
      document.querySelector<HTMLElement>(`[data-clip-id="${target.id}"]`)?.focus()
    }

    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        focusClip(e.shiftKey ? allClips[Math.max(0, clipIndex - 1)] : allClips[Math.min(allClips.length - 1, clipIndex + 1)])
        break
      case 'ArrowLeft':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          focusClip(allClips[Math.max(0, clipIndex - 1)])
        }
        break
      case 'ArrowRight':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          focusClip(allClips[Math.min(allClips.length - 1, clipIndex + 1)])
        }
        break
      case 'ArrowUp':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          const i = store.project.tracks.findIndex((t) => t.id === track.id)
          if (i > 0) {
            focusClip(
              store.project.tracks[i - 1].clips.find(
                (c) => c.startTime <= clip.startTime && c.startTime + c.duration >= clip.startTime,
              ),
            )
          }
        }
        break
      case 'ArrowDown':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          const i = store.project.tracks.findIndex((t) => t.id === track.id)
          if (i < store.project.tracks.length - 1) {
            focusClip(
              store.project.tracks[i + 1].clips.find(
                (c) => c.startTime <= clip.startTime && c.startTime + c.duration >= clip.startTime,
              ),
            )
          }
        }
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (selected.includes(clip.id)) store.select(selected.filter((id) => id !== clip.id), track.id)
        else store.select([...selected, clip.id], track.id)
        break
      case 'Delete':
      case 'Backspace':
        if (selected.length) {
          e.preventDefault()
          store.deleteClips(store.selection.clipIds, e.shiftKey)
        }
        break
    }
  }

  return (
    <div className="relative flex border-b" style={{ height: trackHeight }} data-timeline-track={track.id}>
      <TrackHeader track={track} shortLabel={shortLabel} />
      <div className="bg-muted/30 relative flex-1">
        {track.clips.map((clip) => (
          <Clip
            key={clip.id}
            clip={clip}
            track={track}
            asset={assetById(clip.assetId)}
            selected={selected.includes(clip.id)}
            isUnderPlayhead={playhead >= clip.startTime && playhead < clip.startTime + clip.duration}
            trimMode={trimMode}
            zoom={zoom}
            onPointerDownClip={onPointerDownClip}
            onKeyDown={handleClipKeyDown}
          />
        ))}
      </div>
    </div>
  )
}

function useTrackHeight(): number {
  // Match the legacy responsive row height without a media-query hook.
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 48 : 44
}
