import { create } from 'zustand'

export type MediaTab = 'media' | 'generated' | 'transitions' | 'text'
export type MediaView = 'grid' | 'list'
export type MediaFilter = 'all' | 'video' | 'audio' | 'image' | 'generated'
export type MediaSort = 'dateAdded' | 'name' | 'duration' | 'type'
export type GeneratedSubTab = 'all' | 'images' | 'voice' | 'avatars' | 'animations'
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
  mediaView: MediaView
  mediaFilter: MediaFilter
  mediaSort: MediaSort
  generatedSubTab: GeneratedSubTab
  /** When enabled, dropping audio snaps its length to the video underneath. */
  linkAudio: boolean
  mode: EditorMode
  aiDirectorOpen: boolean
  historyPanelOpen: boolean

  toggleLeft: () => void
  setLeftOpen: (open: boolean) => void
  toggleInspector: () => void
  setToolPanelSection: (section: string | null) => void
  setMediaTab: (tab: MediaTab) => void
  setMediaSearch: (q: string) => void
  setMediaView: (view: MediaView) => void
  setMediaFilter: (filter: MediaFilter) => void
  setMediaSort: (sort: MediaSort) => void
  setGeneratedSubTab: (tab: GeneratedSubTab) => void
  toggleLinkAudio: () => void
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
  mediaView: 'grid',
  mediaFilter: 'all',
  mediaSort: 'dateAdded',
  generatedSubTab: 'all',
  linkAudio: persisted('clipforge-link-audio', false),
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
  setMediaView: (view) => set({ mediaView: view }),
  setMediaFilter: (filter) => set({ mediaFilter: filter }),
  setMediaSort: (sort) => set({ mediaSort: sort }),
  setGeneratedSubTab: (tab) => set({ generatedSubTab: tab }),
  toggleLinkAudio: () =>
    set((s) => {
      persist('clipforge-link-audio', !s.linkAudio)
      return { linkAudio: !s.linkAudio }
    }),
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
