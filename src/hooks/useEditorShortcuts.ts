import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'

export function useEditorShortcuts(playback: Pick<PlaybackApi, 'toggle' | 'seek'>) {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
        return
      }
      const mod = e.ctrlKey || e.metaKey
      const s = useTimelineStore.getState()

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd' && s.selection.clipIds.length) {
        e.preventDefault()
        s.duplicateClips(s.selection.clipIds)
        return
      }
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        splitAtPlayhead()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void s.save()
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        playback.toggle()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        playback.seek(s.playhead - 1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        playback.seek(s.playhead + 1)
        return
      }
      if (e.key.toLowerCase() === 'i' && s.selection.clipIds.length) {
        splitAtPlayhead()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.clipIds.length) {
        e.preventDefault()
        s.deleteClips(s.selection.clipIds)
      }
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