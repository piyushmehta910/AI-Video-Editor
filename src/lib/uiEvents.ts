/**
 * Cross-component dialog open events. TopToolbar owns the New/Open/Export
 * dialogs; surfaces like the command palette reach them without prop-drilling
 * by dispatching these window events.
 */
export const DIALOG_EVENTS = {
  newProject: 'clipforge:new-project',
  openProject: 'clipforge:open-project',
  export: 'clipforge:export',
} as const

export type DialogEventKey = keyof typeof DIALOG_EVENTS

export function openEditorDialog(kind: DialogEventKey) {
  window.dispatchEvent(new Event(DIALOG_EVENTS[kind]))
}