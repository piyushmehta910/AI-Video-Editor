import { create } from 'zustand'
import { getRecord, putRecord, deleteRecord } from '@/engine/storage/db'

/**
 * Document-history bookkeeping for the undo/redo system.
 *
 * The actual project snapshots live in zundo's temporal store attached to
 * `timelineStore` (canonical stacks: pastStates/futureStates). This store keeps
 * the human-readable log that powers tooltips, toasts and the History panel,
 * mirrors canUndo/canRedo reactivity, and persists both log + snapshots to
 * IndexedDB so history survives a refresh.
 *
 * UI state (selection, playhead, zoom) is intentionally NOT snapshot into
 * history — only lightweight checkpoints ride along on each entry's
 * before/after so undo/redo can restore editing context.
 */

export type HistoryType = 'add' | 'remove' | 'move' | 'edit' | 'split' | 'merge'

/** Lightweight editor context captured alongside each document snapshot. */
export interface UiCheckpoint {
  selection?: { clipIds: string[]; trackId: string | null }
  playhead?: number
}

export interface HistoryEntry {
  id: string
  timestamp: number
  type: HistoryType
  /** Human-readable, e.g. "Added 'video.mp4' to V1". */
  description: string
  before: UiCheckpoint & { project?: unknown }
  after: UiCheckpoint & { project?: unknown }
  clipId?: string
}

interface PersistedHistory {
  id: string
  entries: HistoryEntry[]
  snapshots: unknown[]
  index: number
}

const HISTORY_DB_KEY = 'doc'
const PERSIST_DEBOUNCE_MS = 800

interface HistoryState {
  entries: HistoryEntry[]
  /** Number of applied entries (entries[index] is the next redo). */
  index: number
  /** Mirrors temporal stack depth; drives disabled states. */
  canUndo: boolean
  canRedo: boolean
  toast: { id: number; message: string } | null

  setLog: (entries: HistoryEntry[], index: number) => void
  pushEntry: (entry: HistoryEntry) => void
  stepIndex: (delta: number) => void
  clearLog: () => void
  showToast: (message: string) => void
  dismissToast: (id: number) => void
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  entries: [],
  index: 0,
  canUndo: false,
  canRedo: false,
  toast: null,

  setLog: (entries, index) => {
    set({
      entries,
      index,
      canUndo: index > 0,
      canRedo: index < entries.length,
    })
    schedulePersist(get)
  },

  pushEntry: (entry) => {
    const { entries, index } = get()
    // New action after undo clears the redo tail.
    const next = [...entries.slice(0, index), entry].slice(-HISTORY_LOG_LIMIT)
    get().setLog(next, next.length)
  },

  stepIndex: (delta) => {
    const { index } = get()
    const next = Math.max(0, Math.min(get().entries.length, index + delta))
    if (next !== index) get().setLog(get().entries, next)
  },

  clearLog: () => {
    set({ entries: [], index: 0, canUndo: false, canRedo: false })
    void deleteRecord('history', HISTORY_DB_KEY).catch(() => undefined)
  },

  showToast: (message) => set({ toast: { id: Date.now() + Math.random(), message } }),
  dismissToast: (id) => {
    if (get().toast?.id === id) set({ toast: null })
  },
}))

/** Keep at most this many log entries (mirrors the snapshot limit). */
export const HISTORY_LOG_LIMIT = 50

let persistTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersist(get: () => HistoryState): void {
  if (typeof indexedDB === 'undefined') return // jsdom/test environments
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const { entries, index } = get()
    const snapshots = readSnapshots()
    if (!snapshots) return
    const record: PersistedHistory = {
      id: HISTORY_DB_KEY,
      entries: entries.slice(-HISTORY_LOG_LIMIT),
      snapshots: snapshots.slice(-HISTORY_SNAPSHOT_LIMIT),
      index: Math.min(index, entries.length),
    }
    putRecord('history', record).catch(() => undefined) // quota or privacy mode — degrade silently
  }, PERSIST_DEBOUNCE_MS)
}

/**
 * Bridge to the timeline store's temporal stack. Declared as a setter to avoid
 * a circular import: timelineStore owns the zundo store and registers it here.
 */
type TemporalLike = {
  pastStates: unknown[]
  futureStates: unknown[]
}
let temporalRef: TemporalLike | null = null

export function registerTemporalStore(t: TemporalLike | null): void {
  temporalRef = t
}

function readSnapshots(): unknown[] | null {
  return temporalRef ? [...temporalRef.pastStates] : null
}

/** Snapshot cap used when persisting (memory guard for large projects). */
export const HISTORY_SNAPSHOT_LIMIT = 50

/** Restore persisted history. Returns null when nothing was stored. */
export async function loadPersistedHistory(): Promise<PersistedHistory | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const record = await getRecord<PersistedHistory>('history', HISTORY_DB_KEY)
    return record ?? null
  } catch {
    return null
  }
}
