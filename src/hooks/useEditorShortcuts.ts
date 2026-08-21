import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'

export function useEditorShortcuts(playback: Pick<PlaybackApi, 'toggle' | 'seek' | 'frameStep' | 'speed' | 'setSpeed'>) {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
        return
      }
      const mod = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const s = useTimelineStore.getState()

      // Undo / Redo
      if (mod && e.key.toLowerCase() === 'z' && !shift) { e.preventDefault(); s.undo(); return }
      if (mod && e.key.toLowerCase() === 'z' && shift) { e.preventDefault(); s.redo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); return }

      // Save
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void s.save(); return }

      // Duplicate
      if (mod && e.key.toLowerCase() === 'd' && s.selection.clipIds.length) {
        e.preventDefault(); s.duplicateClips(s.selection.clipIds); return
      }

      // Copy / Cut / Paste
      if (mod && e.key.toLowerCase() === 'c' && s.selection.clipIds.length) {
        e.preventDefault(); s.copyClips(s.selection.clipIds); return
      }
      if (mod && e.key.toLowerCase() === 'x' && s.selection.clipIds.length) {
        e.preventDefault(); s.cutClips(s.selection.clipIds); return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault(); s.pasteClips(); return
      }

      // Split at playhead
      if ((mod && e.key.toLowerCase() === 'k') || (e.key.toLowerCase() === 'i' && s.selection.clipIds.length)) {
        e.preventDefault(); splitAtPlayhead(); return
      }

      // Delete selected (Shift+Delete forces ripple, otherwise normal delete)
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.clipIds.length) {
        e.preventDefault()
        if (shift) {
          // Shift+Delete = ripple delete
          s.deleteClips(s.selection.clipIds, true)
        } else {
          // Normal (non-ripple) delete
          s.deleteClips(s.selection.clipIds, false)
        }
        return
      }

      // Select all clips on focused track, or all clips
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        const allIds = s.project.tracks.flatMap((t) => t.clips.map((c) => c.id))
        s.select(allIds)
        return
      }

      // Play / Pause
      if (e.code === 'Space') { e.preventDefault(); playback.toggle(); return }

      // Frame stepping
      if (e.key === 'ArrowLeft' && !shift) { e.preventDefault(); playback.frameStep(-1); return }
      if (e.key === 'ArrowRight' && !shift) { e.preventDefault(); playback.frameStep(1); return }

      // Seek by 1 second
      if (e.key === 'ArrowLeft' && shift) { e.preventDefault(); playback.seek(s.playhead - 1); return }
      if (e.key === 'ArrowRight' && shift) { e.preventDefault(); playback.seek(s.playhead + 1); return }

      // Seek by 5 seconds
      if (e.key === 'ArrowUp') { e.preventDefault(); playback.seek(s.playhead + 5); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); playback.seek(s.playhead - 5); return }

      // Seek by 5 seconds
      if (e.key === 'ArrowUp') { e.preventDefault(); playback.seek(s.playhead + 5); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); playback.seek(s.playhead - 5); return }

      // Go to start / end
      if (e.key === 'Home') { e.preventDefault(); playback.seek(0); return }
      if (e.key === 'End') { e.preventDefault(); playback.seek(s.duration()); return }

      // J/K/L Shuttle Controls (Standard NLE shuttle)
      if (!mod && !shift && e.key.toLowerCase() === 'j') { e.preventDefault(); playback.setSpeed(Math.max(-8, playback.speed - 1)); return }
      if (!mod && !shift && e.key.toLowerCase() === 'k') { e.preventDefault(); playback.setSpeed(0); return }
      if (!mod && !shift && e.key.toLowerCase() === 'l') { e.preventDefault(); playback.setSpeed(Math.min(8, playback.speed + 1)); return }

      // Nudge selected clips left/right by 1 frame
      if (shift && e.key === 'ArrowLeft' && s.selection.clipIds.length) {
        e.preventDefault(); nudgeClips(-1 / s.project.fps); return
      }
      if (shift && e.key === 'ArrowRight' && s.selection.clipIds.length) {
        e.preventDefault(); nudgeClips(1 / s.project.fps); return
      }

      // Trim selected clip start/end edge with [ and ]
      if (e.key === '[' && s.selection.clipIds.length) {
        e.preventDefault(); trimSelectedEdge('start', -1 / s.project.fps); return
      }
      if (e.key === ']' && s.selection.clipIds.length) {
        e.preventDefault(); trimSelectedEdge('end', 1 / s.project.fps); return
      }

      // Ripple delete with Shift+Delete
      if (shift && (e.key === 'Delete' || e.key === 'Backspace') && s.selection.clipIds.length) {
        e.preventDefault(); s.deleteClips(s.selection.clipIds, true); return
      }

      // Zoom
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); s.setZoom(s.zoom * 1.25); return }
      if (mod && e.key === '-') { e.preventDefault(); s.setZoom(s.zoom * 0.8); return }
      if (mod && e.key === '0') { e.preventDefault(); s.setZoom(90); return }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playback])
}

function splitAtPlayhead() {
  const s = useTimelineStore.getState()
  const t = s.playhead
  for (const id of s.selection.clipIds) {
    for (const track of s.project.tracks) {
      const clip = track.clips.find((c) => c.id === id)
      if (clip && t > clip.startTime + 0.05 && t < clip.startTime + clip.duration - 0.05) {
        s.splitClip(id, t)
        break
      }
    }
  }
}

function nudgeClips(deltaSeconds: number) {
  const s = useTimelineStore.getState()
  s.begin()
  for (const id of s.selection.clipIds) {
    s.moveClip(id, deltaSeconds)
  }
}

function trimSelectedEdge(edge: 'start' | 'end', delta: number) {
  const s = useTimelineStore.getState()
  s.begin()
  for (const id of s.selection.clipIds) {
    s.trimClip(id, edge, delta)
  }
}
