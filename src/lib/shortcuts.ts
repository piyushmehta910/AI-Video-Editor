import { useEditorStore } from '@/stores/editorStore'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'

/**
 * Command-pattern keyboard shortcut registry. Every editor shortcut maps to a
 * named command; `useKeyboardShortcuts` translates KeyboardEvents to combos
 * and dispatches them. The metadata table doubles as the cheat-sheet source.
 */

export type ShortcutCategory = 'Playback' | 'Editing' | 'Navigation' | 'Tools' | 'View'

export type CommandId =
  | 'playPause'
  | 'shuttleBack'
  | 'shuttleForward'
  | 'stepFrameBack'
  | 'stepFrameForward'
  | 'step10FramesBack'
  | 'step10FramesForward'
  | 'selectTrackAbove'
  | 'selectTrackBelow'
  | 'splitAtPlayhead'
  | 'deleteSelected'
  | 'rippleDelete'
  | 'copySelected'
  | 'cutSelected'
  | 'pasteClips'
  | 'duplicateSelected'
  | 'selectAllOnTrack'
  | 'nudgeClipLeft'
  | 'nudgeClipRight'
  | 'setInPoint'
  | 'setOutPoint'
  | 'trimEdgeStartBack'
  | 'trimEdgeEndForward'
  | 'undo'
  | 'redo'
  | 'saveProject'
  | 'goToStart'
  | 'goToEnd'
  | 'toolSelect'
  | 'toolRazor'
  | 'toolRate'
  | 'toolText'
  | 'addMarker'
  | 'toggleTrimMode'
  | 'toggleSnap'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'fitToScreen'
  | 'showShortcuts'
  | 'cancelOperation'

export interface ShortcutDef {
  id: CommandId
  /** Canonical combo strings (see eventCombo). First entry is the primary key. */
  combos: string[]
  /** Human-readable key labels, parallel to `combos`. */
  keys: string[]
  category: ShortcutCategory
  description: string
}

/** Metadata for every command — rendered by the shortcuts cheat sheet. */
export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Playback
  { id: 'playPause', combos: ['space', 'k'], keys: ['Space', 'K'], category: 'Playback', description: 'Play / pause' },
  { id: 'shuttleBack', combos: ['j'], keys: ['J'], category: 'Playback', description: 'Shuttle reverse (tap for 1×, 2×, …)' },
  { id: 'shuttleForward', combos: ['l'], keys: ['L'], category: 'Playback', description: 'Shuttle forward (tap for 1×, 2×, …)' },
  { id: 'goToStart', combos: ['home'], keys: ['Home'], category: 'Playback', description: 'Go to start' },
  { id: 'goToEnd', combos: ['end'], keys: ['End'], category: 'Playback', description: 'Go to end' },

  // Editing
  { id: 'splitAtPlayhead', combos: ['s', 'mod+k'], keys: ['S', 'Ctrl K'], category: 'Editing', description: 'Split at playhead' },
  { id: 'deleteSelected', combos: ['delete', 'backspace'], keys: ['Del', 'Backspace'], category: 'Editing', description: 'Delete selected clips' },
  { id: 'rippleDelete', combos: ['shift+delete', 'shift+backspace'], keys: ['Shift Del'], category: 'Editing', description: 'Ripple delete (close the gap)' },
  { id: 'copySelected', combos: ['mod+c'], keys: ['Ctrl C'], category: 'Editing', description: 'Copy selected clips' },
  { id: 'cutSelected', combos: ['mod+x'], keys: ['Ctrl X'], category: 'Editing', description: 'Cut selected clips' },
  { id: 'pasteClips', combos: ['mod+v'], keys: ['Ctrl V'], category: 'Editing', description: 'Paste clips at playhead' },
  { id: 'duplicateSelected', combos: ['mod+d'], keys: ['Ctrl D'], category: 'Editing', description: 'Duplicate selected clips' },
  { id: 'selectAllOnTrack', combos: ['mod+a'], keys: ['Ctrl A'], category: 'Editing', description: 'Select all clips on current track' },
  { id: 'nudgeClipLeft', combos: [','], keys: [','], category: 'Editing', description: 'Nudge selected clip left one frame' },
  { id: 'nudgeClipRight', combos: ['.'], keys: ['.'], category: 'Editing', description: 'Nudge selected clip right one frame' },
  { id: 'setInPoint', combos: ['i'], keys: ['I'], category: 'Editing', description: 'Set in-point (trim start) at playhead' },
  { id: 'setOutPoint', combos: ['o'], keys: ['O'], category: 'Editing', description: 'Set out-point (trim end) at playhead' },
  { id: 'trimEdgeStartBack', combos: ['['], keys: ['['], category: 'Editing', description: 'Trim start edge back one frame' },
  { id: 'trimEdgeEndForward', combos: [']'], keys: [']'], category: 'Editing', description: 'Trim end edge forward one frame' },
  { id: 'undo', combos: ['mod+z'], keys: ['Ctrl Z'], category: 'Editing', description: 'Undo' },
  { id: 'redo', combos: ['mod+shift+z', 'mod+y'], keys: ['Ctrl Shift Z', 'Ctrl Y'], category: 'Editing', description: 'Redo' },
  { id: 'saveProject', combos: ['mod+s'], keys: ['Ctrl S'], category: 'Editing', description: 'Save project' },

  // Navigation
  { id: 'stepFrameBack', combos: ['arrowleft'], keys: ['←'], category: 'Navigation', description: 'Previous frame' },
  { id: 'stepFrameForward', combos: ['arrowright'], keys: ['→'], category: 'Navigation', description: 'Next frame' },
  { id: 'step10FramesBack', combos: ['shift+arrowleft'], keys: ['Shift ←'], category: 'Navigation', description: 'Back 10 frames' },
  { id: 'step10FramesForward', combos: ['shift+arrowright'], keys: ['Shift →'], category: 'Navigation', description: 'Forward 10 frames' },
  { id: 'selectTrackAbove', combos: ['arrowup'], keys: ['↑'], category: 'Navigation', description: 'Select clip on track above' },
  { id: 'selectTrackBelow', combos: ['arrowdown'], keys: ['↓'], category: 'Navigation', description: 'Select clip on track below' },

  // Tools
  { id: 'toolSelect', combos: ['v'], keys: ['V'], category: 'Tools', description: 'Select tool' },
  { id: 'toolRazor', combos: ['c', 'b'], keys: ['C', 'B'], category: 'Tools', description: 'Razor tool (click a clip to cut)' },
  { id: 'toolRate', combos: ['r'], keys: ['R'], category: 'Tools', description: 'Rate-stretch tool (click a clip to change speed)' },
  { id: 'toolText', combos: ['t'], keys: ['T'], category: 'Tools', description: 'Text tool (click timeline to add text)' },
  { id: 'addMarker', combos: ['m'], keys: ['M'], category: 'Tools', description: 'Add / remove marker at playhead' },
  { id: 'toggleTrimMode', combos: ['shift+t'], keys: ['Shift T'], category: 'Tools', description: 'Toggle trim mode (drag clip edges)' },
  { id: 'toggleSnap', combos: ['n'], keys: ['N'], category: 'Tools', description: 'Toggle magnetic snapping' },

  // View
  { id: 'zoomIn', combos: ['mod+=', 'mod++'], keys: ['Ctrl +'], category: 'View', description: 'Zoom timeline in' },
  { id: 'zoomOut', combos: ['mod+-'], keys: ['Ctrl -'], category: 'View', description: 'Zoom timeline out' },
  { id: 'zoomReset', combos: ['mod+0'], keys: ['Ctrl 0'], category: 'View', description: 'Reset zoom' },
  { id: 'fitToScreen', combos: ['f'], keys: ['F'], category: 'View', description: 'Fit timeline to screen' },
  { id: 'showShortcuts', combos: ['?'], keys: ['?'], category: 'View', description: 'Keyboard shortcuts cheat sheet' },
  { id: 'cancelOperation', combos: ['escape'], keys: ['Esc'], category: 'View', description: 'Cancel tool / close dialog' },
]

const COMBO_TO_COMMAND: Record<string, CommandId> = {}
for (const def of SHORTCUT_DEFS) {
  for (const combo of def.combos) COMBO_TO_COMMAND[combo] = def.id
}

/** Commands that sensibly auto-repeat when the key is held down. */
const REPEAT_OK = new Set<CommandId>([
  'stepFrameBack',
  'stepFrameForward',
  'step10FramesBack',
  'step10FramesForward',
  'nudgeClipLeft',
  'nudgeClipRight',
  'trimEdgeStartBack',
  'trimEdgeEndForward',
  'shuttleBack',
  'shuttleForward',
  'zoomIn',
  'zoomOut',
])

/** Does this command auto-repeat when its key is held? */
export function allowsRepeat(id: CommandId): boolean {
  return REPEAT_OK.has(id)
}

export function commandForCombo(combo: string): CommandId | undefined {
  return COMBO_TO_COMMAND[combo]
}

/**
 * Normalize a KeyboardEvent into a canonical combo string, e.g.
 * "mod+shift+z", "space", "arrowleft", "?". Returns null for bare modifiers
 * and unmappable keys.
 */
export function eventCombo(e: KeyboardEvent): string | null {
  if (['Control', 'Meta', 'Shift', 'Alt', 'CapsLock'].includes(e.key)) return null
  const mod = e.ctrlKey || e.metaKey
  const shift = e.shiftKey
  let key = e.key.toLowerCase()
  if (key === '/') key = shift ? '?' : '/'
  const named: Record<string, string> = {
    ' ': 'space',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    escape: 'escape',
    enter: 'enter',
    tab: 'tab',
    delete: 'delete',
    backspace: 'backspace',
    home: 'home',
    end: 'end',
    plus: '+',
    equal: '=',
    minus: '-',
  }
  key = named[key] ?? key
  if (key.length !== 1 && !Object.values(named).includes(key)) return null
  const parts: string[] = []
  if (mod) parts.push('mod')
  // Shift is implied by these characters themselves ("?", "+", "="); keeping it
  // would make canonical combos like "mod++" unreachable on US layouts.
  if (shift && !['?', '+', '='].includes(key)) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

/** Pretty label for a canonical combo ("mod+shift+z" → "Ctrl Shift Z"). */
export function comboLabel(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      switch (part) {
        case 'mod':
          return 'Ctrl'
        case 'shift':
          return 'Shift'
        case 'arrowleft':
          return '←'
        case 'arrowright':
          return '→'
        case 'arrowup':
          return '↑'
        case 'arrowdown':
          return '↓'
        case 'space':
          return 'Space'
        default:
          return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)
      }
    })
    .join(' ')
}

export interface ShortcutContext {
  playback: Pick<PlaybackApi, 'toggle' | 'seek' | 'frameStep' | 'speed' | 'setSpeed' | 'isPlaying'>
}

function frame(): number {
  return 1 / useTimelineStore.getState().project.fps
}

function clipsAtPlayhead(): Array<{ clipId: string }> {
  const s = useTimelineStore.getState()
  const out: Array<{ clipId: string }> = []
  for (const track of s.project.tracks) {
    for (const c of track.clips) {
      if (s.playhead > c.startTime + 0.05 && s.playhead < c.startTime + c.duration - 0.05) {
        out.push({ clipId: c.id })
      }
    }
  }
  return out
}

function targetClipIdsForTrim(): string[] {
  const s = useTimelineStore.getState()
  if (s.selection.clipIds.length) return s.selection.clipIds
  return clipsAtPlayhead().map((c) => c.clipId)
}

function selectAllOnTrack() {  const s = useTimelineStore.getState()
  const trackId =
    s.selection.trackId ?? s.project.tracks.find((t) => t.clips.some((c) => c.id === s.selection.clipIds[0]))?.id
  if (trackId) {
    const track = s.project.tracks.find((t) => t.id === trackId)
    if (track && track.clips.length) {
      s.select(track.clips.map((c) => c.id), trackId)
      return
    }
  }
  // No track context — fall back to selecting everything.
  s.select(s.project.tracks.flatMap((t) => t.clips.map((c) => c.id)))
}

function splitAtPlayhead() {
  const s = useTimelineStore.getState()
  const t = s.playhead
  const ids = s.selection.clipIds.length
    ? [...s.selection.clipIds]
    : clipsAtPlayhead().map((c) => c.clipId)
  for (const id of ids) {
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
  const store = useTimelineStore.getState()
  if (!store.selection.clipIds.length) return
  store.beginHistoryGroup({ type: 'move', description: 'Nudged selection' })
  try {
    for (const id of store.selection.clipIds) store.moveClip(id, deltaSeconds)
  } finally {
    store.endHistoryGroup()
  }
}

function trimTo(edge: 'start' | 'end') {
  const s = useTimelineStore.getState()
  for (const id of targetClipIdsForTrim()) {
    for (const track of s.project.tracks) {
      const clip = track.clips.find((c) => c.id === id)
      if (!clip) continue
      const boundary = edge === 'start' ? clip.startTime : clip.startTime + clip.duration
      const delta = s.playhead - boundary
      if (
        s.playhead > clip.startTime + 0.05 &&
        s.playhead < clip.startTime + clip.duration - 0.05 &&
        Math.abs(delta) > frame() / 2
      ) {
        s.trimClip(id, edge, delta)
      }
      break
    }
  }
}

function shuttle(ctx: ShortcutContext['playback'], dir: 1 | -1) {
  const speed = ctx.speed
  if (!ctx.isPlaying) {
    ctx.setSpeed(dir)
    ctx.toggle()
    return
  }
  if (dir === 1) {
    ctx.setSpeed(speed < 0 ? 1 : Math.min(8, Math.max(1, speed) + 1))
  } else {
    ctx.setSpeed(speed > 0 ? -1 : Math.max(-8, Math.min(-1, speed) - 1))
  }
}

function pauseAndResetSpeed(playback: ShortcutContext['playback']) {
  if (playback.isPlaying) {
    playback.toggle()
    playback.setSpeed(1)
  } else {
    playback.toggle()
  }
}

function selectAdjacentTrack(dir: 1 | -1) {
  const s = useTimelineStore.getState()
  const tracks = s.project.tracks
  if (!tracks.length) return

  let currentIndex = -1
  if (s.selection.trackId) currentIndex = tracks.findIndex((t) => t.id === s.selection.trackId)
  if (currentIndex === -1 && s.selection.clipIds[0]) {
    currentIndex = tracks.findIndex((t) => t.clips.some((c) => c.id === s.selection.clipIds[0]))
  }
  if (currentIndex === -1) {
    // Nothing selected: start from the topmost track that has clips near the playhead.
    currentIndex = dir === 1 ? -1 : tracks.length
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].clips.some((c) => s.playhead >= c.startTime && s.playhead < c.startTime + c.duration)) {
        currentIndex = i
        break
      }
    }
    if (currentIndex === -1 || currentIndex === tracks.length) currentIndex = 0
    dir = 1
  }

  const pickClip = (trackIndex: number): string | null => {
    const track = tracks[trackIndex]
    if (!track || !track.clips.length) return null
    const covering = track.clips.find(
      (c) => s.playhead >= c.startTime && s.playhead < c.startTime + c.duration,
    )
    const nearest = [...track.clips].sort(
      (a, b) => Math.abs(a.startTime - s.playhead) - Math.abs(b.startTime - s.playhead),
    )[0]
    return (covering ?? nearest).id
  }

  let target = currentIndex + dir
  while (target >= 0 && target < tracks.length) {
    const id = pickClip(target)
    if (id) {
      s.select([id], tracks[target].id)
      document.querySelector<HTMLElement>(`[data-clip-id="${id}"]`)?.focus()
      return
    }
    target += dir
  }
}

function fitTimelineToScreen() {
  const vp = document.querySelector<HTMLElement>('[data-testid="timeline-root"]')
  const gutter = document.querySelector<HTMLElement>('[data-header-gutter]')
  if (!vp) return
  const s = useTimelineStore.getState()
  const duration = s.project.tracks.reduce((max, t) => {
    for (const c of t.clips) max = Math.max(max, c.startTime + c.duration)
    return max
  }, 0)
  if (duration <= 0) return
  const headerWidth = gutter?.offsetWidth || 78
  s.setZoom(Math.max(15, Math.min(200, (vp.clientWidth - headerWidth) / duration)))
}

function cycleRateTool(clipId: string) {
  const s = useTimelineStore.getState()
  const RATES = [1, 2, 4, 0.5]
  for (const track of s.project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId)
    if (!clip) continue
    const idx = RATES.findIndex((r) => Math.abs(r - clip.speed) < 0.001)
    const next = RATES[(idx + 1) % RATES.length] ?? 2
    s.updateClip(clipId, { speed: next })
    return
  }
}

/** Place a new text clip at `time` on the first text track (text tool). */
export function addTextAtTime(time: number) {
  const s = useTimelineStore.getState()
  const textTrack = s.project.tracks.find((t) => t.type === 'text')
  if (!textTrack) return
  s.addTextClip('Text', textTrack.id, Math.max(0, Math.round(time * 10) / 10))
}

/** All commands, wired to live store state. Created once per playback binding. */
export function createCommandMap(ctx: ShortcutContext): Record<CommandId, () => void> {
  const tl = () => useTimelineStore.getState()
  const ed = () => useEditorStore.getState()
  return {
    playPause: () => pauseAndResetSpeed(ctx.playback),
    shuttleBack: () => shuttle(ctx.playback, -1),
    shuttleForward: () => shuttle(ctx.playback, 1),
    stepFrameBack: () => ctx.playback.frameStep(-1),
    stepFrameForward: () => ctx.playback.frameStep(1),
    step10FramesBack: () => ctx.playback.seek(tl().playhead - 10 * frame()),
    step10FramesForward: () => ctx.playback.seek(tl().playhead + 10 * frame()),
    selectTrackAbove: () => selectAdjacentTrack(-1),
    selectTrackBelow: () => selectAdjacentTrack(1),
    splitAtPlayhead: () => splitAtPlayhead(),
    deleteSelected: () => {
      const s = tl()
      if (s.selection.clipIds.length) s.deleteClips(s.selection.clipIds, false)
    },
    rippleDelete: () => {
      const s = tl()
      if (s.selection.clipIds.length) s.deleteClips(s.selection.clipIds, true)
    },
    copySelected: () => {
      const s = tl()
      if (s.selection.clipIds.length) s.copyClips(s.selection.clipIds)
    },
    cutSelected: () => {
      const s = tl()
      if (s.selection.clipIds.length) s.cutClips(s.selection.clipIds)
    },
    pasteClips: () => tl().pasteClips(),
    duplicateSelected: () => {
      const s = tl()
      if (s.selection.clipIds.length) s.duplicateClips(s.selection.clipIds)
    },
    selectAllOnTrack: () => selectAllOnTrack(),
    nudgeClipLeft: () => nudgeClips(-frame()),
    nudgeClipRight: () => nudgeClips(frame()),
    setInPoint: () => trimTo('start'),
    setOutPoint: () => trimTo('end'),
    trimEdgeStartBack: () => {
      const s = tl()
      for (const id of s.selection.clipIds) s.trimClip(id, 'start', -frame())
    },
    trimEdgeEndForward: () => {
      const s = tl()
      for (const id of s.selection.clipIds) s.trimClip(id, 'end', frame())
    },
    undo: () => tl().undo(),
    redo: () => tl().redo(),
    saveProject: () => void tl().save(),
    goToStart: () => ctx.playback.seek(0),
    goToEnd: () => ctx.playback.seek(tl().duration()),
    toolSelect: () => ed().setTool('select'),
    toolRazor: () => ed().setTool(ed().tool === 'razor' ? 'select' : 'razor'),
    toolRate: () => ed().setTool(ed().tool === 'rate' ? 'select' : 'rate'),
    toolText: () => ed().setTool(ed().tool === 'text' ? 'select' : 'text'),
    addMarker: () => tl().toggleMarker(tl().playhead),
    toggleTrimMode: () => ed().toggleTrimMode(),
    toggleSnap: () => tl().setSnapEnabled(!tl().snapEnabled),
    zoomIn: () => tl().setZoom(tl().zoom * 1.25),
    zoomOut: () => tl().setZoom(tl().zoom * 0.8),
    zoomReset: () => tl().setZoom(90),
    fitToScreen: () => fitTimelineToScreen(),
    showShortcuts: () => ed().setShortcutsOpen(!ed().shortcutsOpen),
    cancelOperation: () => {
      if (ed().shortcutsOpen) {
        ed().setShortcutsOpen(false)
        return
      }
      if (ed().tool !== 'select') {
        ed().setTool('select')
        return
      }
      const s = tl()
      if (s.selection.clipIds.length) s.select([], null)
    },
  }
}

export { cycleRateTool }
