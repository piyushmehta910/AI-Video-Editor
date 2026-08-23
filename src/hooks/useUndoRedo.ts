import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useHistoryStore } from '@/stores/historyStore'

/**
 * Reactive undo/redo API for components.
 *
 * - canUndo/canRedo mirror the zundo temporal stack depths
 * - labels surface the next action's description for tooltips:
 *     "Undo: Added 'video.mp4' to V1"
 * - jumpTo walks the stacks step-by-step to reach a specific history entry
 */
export function useUndoRedo() {
  const canUndo = useHistoryStore((s) => s.canUndo)
  const canRedo = useHistoryStore((s) => s.canRedo)
  const entries = useHistoryStore((s) => s.entries)
  const index = useHistoryStore((s) => s.index)

  const undo = React.useCallback(() => useTimelineStore.getState().undo(), [])
  const redo = React.useCallback(() => useTimelineStore.getState().redo(), [])

  const indexNow = () => useHistoryStore.getState().index

  const jumpTo = React.useCallback((targetIndex: number) => {
    let guard = 0
    while (indexNow() !== targetIndex && guard++ < 100) {
      if (indexNow() < targetIndex) useTimelineStore.getState().redo()
      else useTimelineStore.getState().undo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    canUndo,
    canRedo,
    /** Description of the action the next undo will reverse. */
    undoDescription: index > 0 ? entries[index - 1]?.description : undefined,
    /** Description of the action the next redo will reapply. */
    redoDescription: index < entries.length ? entries[index]?.description : undefined,
    undoLabel: index > 0 ? `Undo: ${entries[index - 1]?.description}` : 'Nothing to undo',
    redoLabel: index < entries.length ? `Redo: ${entries[index]?.description}` : 'Nothing to redo',
    undo,
    redo,
    jumpTo,
  }
}
