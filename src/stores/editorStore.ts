import { create } from 'zustand'

export type MediaTab = 'media' | 'generated' | 'transitions' | 'text'
export type EditorMode = 'human' | 'hybrid' | 'ai'

/**
 * UI-only editor state (panel visibility, bin tabs, mode switches).
 * Timeline data state — playhead, zoom, clip selection — deliberately stays in
 * timelineStore so there is a single source of truth for playback/rendering.
 */
export interface EditorUIState {
  leftOpen: boolean
  inspectorOpen: boolean
  toolPanelSection: string | null
  mediaTab: MediaTab
  mediaSearch: string
  mode: EditorMode
  aiDirectorOpen: boolean
  historyPanelOpen: boolean

  toggleLeft: () => void
  setLeftOpen: (open: boolean) => void
  toggleInspector: () => void
  setToolPanelSection: (section: string | null) => void
  setMediaTab: (tab: MediaTab) => void
  setMediaSearch: (q: string) => void
  setMode: (mode: EditorMode) => void
  toggleAIDirector: () => void
  setAIDirectorOpen: (open: boolean) => void
  toggleHistoryPanel: () => void
}

function persisted(key: string, fallback: boolean): boolean {
  try {
    return localStorage.getItem(key) === null ? fallback : localStorage.getItem(key) === '1'
  } catch {
    return fallback
  }
}

function persist(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // ignore storage errors
  }
}

export const useEditorStore = create<EditorUIState>()((set) => ({
  leftOpen: persisted('clipforge-left-open', true),
  inspectorOpen: persisted('clipforge-inspector-open', true),
  toolPanelSection: null,
  mediaTab: 'media',
  mediaSearch: '',
  mode: (localStorage.getItem('clipforge-mode') as EditorMode) || 'hybrid',
  aiDirectorOpen: false,
  historyPanelOpen: false,

  toggleLeft: () =>
    set((s) => {
      persist('clipforge-left-open', !s.leftOpen)
      return { leftOpen: !s.leftOpen }
    }),
  setLeftOpen: (open) => {
    persist('clipforge-left-open', open)
    set({ leftOpen: open })
  },
  toggleInspector: () =>
    set((s) => {
      persist('clipforge-inspector-open', !s.inspectorOpen)
      return { inspectorOpen: !s.inspectorOpen }
    }),
  setToolPanelSection: (section) => set({ toolPanelSection: section }),
  setMediaTab: (tab) => set({ mediaTab: tab }),
  setMediaSearch: (q) => set({ mediaSearch: q }),
  setMode: (mode) => {
    try {
      localStorage.setItem('clipforge-mode', mode)
    } catch {
      // ignore storage errors
    }
    set({ mode })
  },
  toggleAIDirector: () => set((s) => ({ aiDirectorOpen: !s.aiDirectorOpen })),
  setAIDirectorOpen: (open) => set({ aiDirectorOpen: open }),
  toggleHistoryPanel: () => set((s) => ({ historyPanelOpen: !s.historyPanelOpen })),
}))
