import { create } from 'zustand'

export interface ScriptScene {
  title: string
  text: string
  durationSeconds: number
  visualCue?: string
  onScreenText?: string
}

export interface ProjectScript {
  topic: string
  title: string
  hook: string
  hookVisual?: string
  scenes: ScriptScene[]
  cta: string
  ctaVisual?: string
  creatorStyle?: string
  targetDurationSeconds: number
}

interface ScriptState {
  script: ProjectScript | null
  setScript: (script: ProjectScript | null) => void
  updateScript: (patch: Partial<ProjectScript>) => void
  updateScene: (index: number, patch: Partial<ScriptScene>) => void
  addScene: (scene?: Partial<ScriptScene>) => void
  removeScene: (index: number) => void
  reorderScenes: (fromIndex: number, toIndex: number) => void
  clear: () => void
}

export const useScriptStore = create<ScriptState>()((set) => ({
  script: null,
  setScript: (script) => set({ script }),
  updateScript: (patch) =>
    set((state) => (state.script ? { script: { ...state.script, ...patch } } : state)),
  updateScene: (index, patch) =>
    set((state) => {
      if (!state.script) return state
      const scenes = [...state.script.scenes]
      if (!scenes[index]) return state
      scenes[index] = { ...scenes[index], ...patch }
      return { script: { ...state.script, scenes } }
    }),
  addScene: (scene) =>
    set((state) => {
      if (!state.script) return state
      const newScene: ScriptScene = {
        title: scene?.title || `Scene ${state.script.scenes.length + 1}`,
        text: scene?.text || 'Describe what happens next in this beat...',
        durationSeconds: scene?.durationSeconds || 8,
        visualCue: scene?.visualCue || 'Dynamic B-Roll cut',
        onScreenText: scene?.onScreenText || '',
      }
      return { script: { ...state.script, scenes: [...state.script.scenes, newScene] } }
    }),
  removeScene: (index) =>
    set((state) => {
      if (!state.script) return state
      const scenes = state.script.scenes.filter((_, i) => i !== index)
      return { script: { ...state.script, scenes } }
    }),
  reorderScenes: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.script) return state
      const scenes = [...state.script.scenes]
      const [moved] = scenes.splice(fromIndex, 1)
      scenes.splice(toIndex, 0, moved)
      return { script: { ...state.script, scenes } }
    }),
  clear: () => set({ script: null }),
}))

export function getScript(): ProjectScript | null {
  return useScriptStore.getState().script
}

export function setScript(script: ProjectScript | null): void {
  useScriptStore.getState().setScript(script)
}