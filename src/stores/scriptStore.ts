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
  clear: () => void
}

export const useScriptStore = create<ScriptState>()((set) => ({
  script: null,
  setScript: (script) => set({ script }),
  clear: () => set({ script: null }),
}))

export function getScript(): ProjectScript | null {
  return useScriptStore.getState().script
}

export function setScript(script: ProjectScript | null): void {
  useScriptStore.getState().setScript(script)
}