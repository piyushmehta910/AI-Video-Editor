import { Keyboard, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const GROUPS: Array<{ title: string; items: Array<{ keys: string; label: string }> }> = [
  {
    title: 'Playback & navigation',
    items: [
      { keys: 'Space', label: 'Play / Pause' },
      { keys: '← / →', label: 'Step one frame' },
      { keys: 'Shift+← / Shift+→', label: 'Seek ± 1 second' },
      { keys: '↑ / ↓', label: 'Seek ± 5 seconds' },
      { keys: 'Home / End', label: 'Go to start / end' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: 'Ctrl+Z', label: 'Undo' },
      { keys: 'Ctrl+Shift+Z / Ctrl+Y', label: 'Redo' },
      { keys: 'Ctrl+S', label: 'Save project' },
      { keys: 'Ctrl+C / Ctrl+X / Ctrl+V', label: 'Copy / Cut / Paste' },
      { keys: 'Ctrl+D', label: 'Duplicate selected' },
      { keys: 'Delete / Backspace', label: 'Delete selected' },
      { keys: 'Shift+Delete', label: 'Ripple-delete selected' },
      { keys: 'Ctrl+K (or I)', label: 'Split at playhead' },
      { keys: 'Ctrl+A', label: 'Select all clips' },
      { keys: 'Shift+← / Shift+→', label: 'Nudge selected clip 1 frame' },
      { keys: '[ / ]', label: 'Trim selected clip start / end' },
    ],
  },
  {
    title: 'Timeline & view',
    items: [
      { keys: 'Ctrl+= / Ctrl+-', label: 'Zoom in / out' },
      { keys: 'Ctrl+0', label: 'Reset zoom' },
      { keys: 'Ctrl+wheel', label: 'Zoom on the timeline' },
      { keys: 'Click ruler / track', label: 'Move playhead' },
      { keys: 'Shift+drag clip', label: 'Disable snapping' },
    ],
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}

export function ShortcutsDialog({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85svh] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
            <Keyboard className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Keyboard Shortcuts</h3>
            <p className="text-muted-foreground text-[11px]">Works when the editor has focus</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
                {group.title}
              </p>
              <div className="flex flex-col divide-y divide-border/60 rounded-lg border bg-muted/30">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="text-xs">{item.label}</span>
                    <span className="flex flex-wrap justify-end gap-1">{item.keys.split(' / ').map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}