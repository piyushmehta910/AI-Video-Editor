import * as React from 'react'
import { FolderOpen, Film, X, Clock } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Project } from '@/engine/types'
import { Button } from '@/components/ui/button'

export interface OpenProjectDialogProps {
  open: boolean
  onClose: () => void
}

function formatModified(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return `Today ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function OpenProjectDialog({ open, onClose }: OpenProjectDialogProps) {
  const listProjects = useTimelineStore((s) => s.listProjects)
  const loadProject = useTimelineStore((s) => s.loadProject)
  const [projects, setProjects] = React.useState<Project[] | null>(null)

  React.useEffect(() => {
    if (!open) return
    setProjects(null)
    let cancelled = false
    listProjects().then((list) => {
      if (!cancelled) setProjects(list)
    })
    return () => {
      cancelled = true
    }
  }, [open, listProjects])

  if (!open) return null

  const handleOpen = async (id: string) => {
    await loadProject(id)
    onClose()
  }

  return (
    <div
      style={{ zIndex: 99999 }}
      className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/60 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0 shadow-xs">
              <FolderOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Open Project</h2>
              <p className="text-xs text-muted-foreground">
                Your current project is saved automatically — you can come back anytime.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Project list */}
        {projects === null ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No saved projects yet.</div>
        ) : (
          <ul className="space-y-1.5" data-testid="open-project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void handleOpen(p.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5 text-left transition hover:border-violet-500/50 hover:bg-violet-500/5"
                  data-testid={`open-project-${p.id}`}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Film className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {formatModified(p.modifiedAt)}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                    Open
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" className="w-full rounded-xl" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
