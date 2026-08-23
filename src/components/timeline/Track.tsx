import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, Clip as ClipModel, Track } from '@/engine/types'
import { TrackHeader } from '@/components/timeline/TrackHeader'
import { Clip, type DragMode } from '@/components/timeline/Clip'
import { getDraggedAsset, clearDraggedAsset, ASSET_DRAG_MIME } from '@/components/media/dragState'
import { applyAssetDropRules } from '@/components/media/afterAdd'

function snapTo(value: number, zoom: number, candidates: number[]): number {
  const threshold = 8 / zoom
  for (const c of candidates) {
    if (Math.abs(c - value) < threshold) return c
  }
  return value
}

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

  // --- Media drag-and-drop (from the Media Bin) ---
  const laneRef = React.useRef<HTMLDivElement | null>(null)
  const [dropLine, setDropLine] = React.useState<number | null>(null)

  /** Audio assets only fit audio lanes; video/image/model only video lanes. */
  const acceptsAsset = (asset: Asset | null): asset is Asset => {
    if (!asset) return false
    if (track.type === 'audio') return asset.type === 'audio'
    if (track.type === 'video') return asset.type === 'video' || asset.type === 'image' || asset.type === 'model'
    return false
  }

  const dropTimeFromEvent = (e: React.DragEvent): number => {
    const lane = laneRef.current
    if (!lane) return 0
    const rect = lane.getBoundingClientRect()
    const raw = Math.max(0, (e.clientX - rect.left) / zoom)
    // Shift inverts the global snap preference (matches Timeline move behavior).
    const snapOn = useTimelineStore.getState().snapEnabled !== e.shiftKey
    const candidates = [0, playhead]
    for (const c of track.clips) {
      candidates.push(c.startTime, c.startTime + c.duration)
    }
    return snapOn ? snapTo(raw, zoom, candidates) : raw
  }

  const handleLaneDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(ASSET_DRAG_MIME)) return
    if (!acceptsAsset(getDraggedAsset())) {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropLine(dropTimeFromEvent(e))
  }

  const handleLaneDrop = (e: React.DragEvent) => {
    setDropLine(null)
    const asset = getDraggedAsset()
    clearDraggedAsset()
    if (!acceptsAsset(asset)) return
    e.preventDefault()
    const time = dropTimeFromEvent(e)
    const clip = useTimelineStore.getState().addClip(asset.id, track.id, time)
    if (clip) applyAssetDropRules(clip, asset)
  }

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
      <div
        ref={laneRef}
        className={
          'bg-muted/30 relative flex-1 transition-colors' +
          (dropLine != null ? ' bg-cyan-500/10 ring-1 ring-inset ring-cyan-400/60' : '')
        }
        onDragOver={handleLaneDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropLine(null)
        }}
        onDrop={handleLaneDrop}
        data-testid={`track-lane-${track.type}`}
      >
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
        {dropLine != null && (
          <div
            data-testid="drop-line"
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-cyan-400"
            style={{ left: dropLine * zoom }}
          />
        )}
      </div>
    </div>
  )
}

function useTrackHeight(): number {
  // Match the legacy responsive row height without a media-query hook.
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 48 : 44
}
