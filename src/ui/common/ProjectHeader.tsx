import * as React from 'react'
import { Download, Pencil } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/ui/export/ExportDialog'

export function ProjectHeader() {
  const project = useTimelineStore((s) => s.project)
  const renameProject = useTimelineStore((s) => s.renameProject)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)

  const commitName = () => {
    renameProject(nameDraft.trim() || 'Untitled Project')
    setEditingName(false)
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b px-3">
      {editingName ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') {
              setNameDraft(project.name)
              setEditingName(false)
            }
          }}
          className="h-7 w-40 rounded-md border bg-muted/40 px-2 text-sm font-semibold outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNameDraft(project.name)
            setEditingName(true)
          }}
          title="Rename project"
          className="group flex shrink-0 items-center gap-1 text-sm font-semibold"
        >
          <span className="truncate">{project.name}</span>
          <Pencil className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}

      <span className="text-muted-foreground hidden text-xs md:block">
        {project.aspectRatio}
      </span>

      <span className="text-muted-foreground hidden text-xs font-mono md:block">
        {project.fps} fps
      </span>

      <span className="text-muted-foreground hidden text-xs font-mono md:block">
        {project.width}×{project.height}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setExportOpen(true)}
          title="Export project"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>

      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}
    </div>
  )
}
