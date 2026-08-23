import { Keyboard } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

/**
 * Help entry points for the keyboard shortcut system: a toolbar button that
 * opens the cheat sheet and the VS Code-style overlay that flashes unknown
 * key combos.
 */

export function ShortcutHelpButton() {
  const open = useEditorStore((s) => s.shortcutsOpen)
  const setOpen = useEditorStore((s) => s.setShortcutsOpen)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Keyboard shortcuts"
          className={`h-8 w-8 shrink-0 p-0 sm:h-7 sm:w-7 ${open ? 'bg-violet-500/20 text-violet-400' : ''}`}
          onClick={() => setOpen(!open)}
        >
          <Keyboard className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
    </Tooltip>
  )
}

/**
 * Briefly displays the pressed (unrecognised) key combo, e.g. "Ctrl Shift Q",
 * so users get feedback about why nothing happened. Pointer-transparent and
 * hidden from assistive tech — it is decorative feedback only.
 */
export function ShortcutKeystrokeOverlay() {
  const hint = useEditorStore((s) => s.keysHint)
  if (!hint) return null
  return (
    <div
      aria-hidden
      data-testid="keys-hint"
      className="bg-card border-border/80 pointer-events-none fixed right-4 bottom-4 z-[110] flex items-center gap-1 rounded-lg border px-3 py-2 shadow-xl"
    >
      <span className="text-muted-foreground mr-1 text-[10px] tracking-wide uppercase">Keys</span>
      {hint.split(' ').map((key) => (
        <kbd
          key={key}
          className="bg-background border-border/80 text-foreground rounded border px-1.5 py-0.5 font-mono text-[11px]"
        >
          {key}
        </kbd>
      ))}
    </div>
  )
}
