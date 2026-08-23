import * as React from 'react'
import { Search, X } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { SHORTCUT_DEFS, comboLabel, type ShortcutCategory } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

const CATEGORY_ORDER: ShortcutCategory[] = ['Playback', 'Editing', 'Navigation', 'Tools', 'View']

const CATEGORY_HINTS: Record<ShortcutCategory, string> = {
  Playback: 'Playhead movement and shuttle control',
  Editing: 'Cutting, copying and clip transforms',
  Navigation: 'Moving around the timeline',
  Tools: 'Mouse tool switching and helpers',
  View: 'Zoom, fit and application help',
}

/**
 * Searchable keyboard-shortcuts cheat sheet. Open with ? (or the toolbar
 * help button); closes on Escape or backdrop click. Filter matches command
 * descriptions, category names and key labels.
 */
export function ShortcutsModal() {
  const open = useShortcutsOpen()
  const setOpen = useSetShortcutsOpen()
  const [query, setQuery] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)

  // Fresh search each time the sheet opens; focus it for immediate typing.
  React.useEffect(() => {
    if (open) {
      setQuery('')
      // Wait a tick so the input exists before focusing.
      window.setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  const q = query.trim().toLowerCase()
  const filtered = SHORTCUT_DEFS.filter((def) => {
    if (!q) return true
    return (
      def.description.toLowerCase().includes(q) ||
      def.category.toLowerCase().includes(q) ||
      def.keys.some((k) => k.toLowerCase().includes(q))
    )
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="shortcuts-modal">
      <button
        type="button"
        aria-label="Close shortcuts"
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="bg-card relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Keyboard Shortcuts</h2>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts…"
              aria-label="Search shortcuts"
              className="bg-background focus:border-[#60a5fa] border-border/80 h-8 w-full rounded-md border pr-2 pl-7 text-xs outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts dialog"
            title="Close (Esc)"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-xs">
              No shortcuts match “{query}”.
            </p>
          ) : (
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {CATEGORY_ORDER.map((category) => {
                const defs = filtered.filter((d) => d.category === category)
                if (!defs.length) return null
                return (
                  <section key={category}>
                    <h3 className="text-foreground text-[12px] font-bold tracking-widest uppercase">{category}</h3>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">{CATEGORY_HINTS[category]}</p>
                    <ul className="mt-2 space-y-1">
                      {defs.map((def) => (
                        <li
                          key={def.id + def.combos.join('|')}
                          className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-xs odd:bg-muted/40"
                        >
                          <span>{def.description}</span>
                          <span className="flex shrink-0 gap-1" aria-label={def.keys.map(comboLabel).join(' or ')}>
                            {def.keys.map((key) => (
                              <kbd
                                key={key}
                                className={cn(
                                  'bg-background border-border/80 text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]',
                                )}
                              >
                                {key}
                              </kbd>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function useShortcutsOpen(): boolean {
  return useEditorStore((s) => s.shortcutsOpen)
}
function useSetShortcutsOpen() {
  return useEditorStore((s) => s.setShortcutsOpen)
}
