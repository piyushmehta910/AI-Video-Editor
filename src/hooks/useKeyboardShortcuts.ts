import * as React from 'react'
import { useEditorStore } from '@/stores/editorStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import {
  allowsRepeat,
  comboLabel,
  createCommandMap,
  commandForCombo,
  eventCombo,
  type CommandId,
  type ShortcutContext,
} from '@/lib/shortcuts'

/** How long the unknown-combo hint overlay stays visible. */
const HINT_MS = 900

/**
 * Global keyboard shortcut dispatcher. Mounts one window keydown listener and
 * routes normalized combos to commands from lib/shortcuts. Editor shortcuts
 * preventDefault; everything else (browser shortcuts, typing in inputs) passes
 * through untouched. Unknown modifier combos flash a VS Code-style key overlay.
 */
export function useKeyboardShortcuts(playback: Pick<PlaybackApi, 'toggle' | 'seek' | 'frameStep' | 'speed' | 'setSpeed' | 'isPlaying'>) {
  // usePlayback's identity changes every render (setSpeed is unmemoized);
  // route through a ref so commands and the listener are created exactly once.
  const playbackRef = React.useRef(playback)
  playbackRef.current = playback

  const ctx = React.useMemo<ShortcutContext>(
    () => ({
      get playback() {
        return playbackRef.current
      },
    }),
    [],
  )

  const commands = React.useMemo(() => createCommandMap(ctx), [ctx])

  const hintTimer = React.useRef<number | null>(null)

  React.useEffect(() => {
    const showHint = (combo: string) => {
      const ed = useEditorStore.getState()
      ed.setKeysHint(comboLabel(combo))
      if (hintTimer.current != null) window.clearTimeout(hintTimer.current)
      hintTimer.current = window.setTimeout(() => {
        hintTimer.current = null
        useEditorStore.getState().setKeysHint(null)
      }, HINT_MS)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Never intercept browser/menu alt-combos or bare modifier presses.
      if (e.altKey) return

      const edState = useEditorStore.getState()
      const modalOpen = edState.shortcutsOpen

      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true

      const combo = eventCombo(e)
      if (!combo) return

      // Escape works everywhere: closes dialogs, cancels tools/selection.
      if (combo === 'escape') {
        if (!typing || modalOpen) {
          e.preventDefault()
          commands.cancelOperation()
        }
        return
      }

      // '?' toggles the cheat sheet closed too (Escape also closes it).
      if (modalOpen && !typing && commandForCombo(combo) === 'showShortcuts') {
        e.preventDefault()
        commands.showShortcuts()
        return
      }

      // While the cheat sheet is open, editor keys are inert (search field works).
      if (modalOpen) return

      if (typing) return

      // '?' toggles help even without modifiers (shift+/ already yields '?').
      const id = commandForCombo(combo)
      if (!id) {
        // Only surface combos that carry modifiers — plain keys go to the page.
        if (e.ctrlKey || e.metaKey || e.shiftKey) showHint(combo)
        return
      }

      if (e.repeat && !allowsRepeat(id)) return

      // Editor-reserved combos swallow the event; everything else stays native.
      if (RESERVE_PREVENT.has(id)) e.preventDefault()
      execute(id, commands)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (hintTimer.current != null) window.clearTimeout(hintTimer.current)
    }
  }, [commands])
}

function execute(id: CommandId, commands: Record<CommandId, () => void>) {
  commands[id]()
}

/** Combos that must always preventDefault when handled (they have native meanings). */
const RESERVE_PREVENT = new Set<CommandId>([
  'playPause',
  'shuttleBack',
  'shuttleForward',
  'stepFrameBack',
  'stepFrameForward',
  'step10FramesBack',
  'step10FramesForward',
  'selectTrackAbove',
  'selectTrackBelow',
  'deleteSelected',
  'rippleDelete',
  'copySelected',
  'cutSelected',
  'pasteClips',
  'duplicateSelected',
  'selectAllOnTrack',
  'nudgeClipLeft',
  'nudgeClipRight',
  'undo',
  'redo',
  'saveProject',
  'goToStart',
  'goToEnd',
  'zoomIn',
  'zoomOut',
  'zoomReset',
  'showShortcuts',
  'commandPalette',
  'cancelOperation',
] as CommandId[])
