import * as React from 'react'
import { Plus, Scissors, Pencil, Move, Merge, Trash2, X, History } from 'lucide-react'
import { useHistoryStore, type HistoryType } from '@/stores/historyStore'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<HistoryType, React.ComponentType<{ className?: string }>> = {
  add: Plus,
  remove: Trash2,
  move: Move,
  edit: Pencil,
  split: Scissors,
  merge: Merge,
}

/**
 * Collapsible sidebar listing every document history step. The current
 * position is highlighted; clicking an entry walks undo/redo to reach it.
 */
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const entries = useHistoryStore((s) => s.entries)
  const index = useHistoryStore((s) => s.index)
  const { jumpTo } = useUndoRedo()

  // Newest first; each row shows the action that PRODUCED the state at i+1.
  const rows = entries.map((entry, i) => ({ entry, i })).reverse()

  return (
    <aside className="bg-card/95 flex w-60 shrink-0 flex-col border-l backdrop-blur" data-testid="history-panel">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <History className="size-3.5" />
          History
          <span className="text-muted-foreground ml-1 font-normal">
            {index}/{entries.length}
          </span>
        </div>
        <button onClick={onClose} aria-label="Close history panel" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {rows.length === 0 && (
          <p className="text-muted-foreground px-2 py-6 text-center text-[11px] leading-relaxed">
            Edits you make will appear here.
          </p>
        )}
        {rows.map(({ entry, i }) => {
          const Icon = TYPE_ICON[entry.type] ?? Pencil
          const applied = i < index
          const current = i === index - 1
          return (
            <button
              key={entry.id}
              onClick={() => jumpTo(i + 1)}
              title={current ? 'Current state' : applied ? 'Click to undo to here' : 'Click to redo to here'}
              className={cn(
                'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] leading-tight',
                current ? 'bg-violet-500/15 text-foreground' : applied ? 'text-foreground/80 hover:bg-muted' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className={cn('mt-0.5 size-3 shrink-0', current ? 'text-violet-400' : '')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{entry.description}</span>
                <span className="text-muted-foreground block text-[9px]">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </span>
              {!applied && <span className="mt-0.5 text-[8px] tracking-wide uppercase opacity-60">redo</span>}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
