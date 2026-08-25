import * as React from 'react'
import { Download, FolderOpen, Home, Pencil, Settings, FilePlus } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/ui/export/ExportDialog'
import { NewProjectDialog } from '@/components/editor/NewProjectDialog'
import { OpenProjectDialog } from '@/components/editor/OpenProjectDialog'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9', '3:2', '2:3'] as const
const FPS_OPTIONS = [24, 25, 30, 48, 50, 60]
const RESOLUTIONS = [
  { label: '360p', w: 640, h: 360 },
  { label: '480p', w: 854, h: 480 },
  { label: '720p', w: 1280, h: 720 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '1440p', w: 2560, h: 1440 },
  { label: '4K', w: 3840, h: 2160 },
]

function dimsForAspect(current: { width: number; height: number }, ratio: number): { width: number; height: number } {
  const max = Math.max(current.width, current.height)
  if (ratio >= 1) {
    const h = Math.round(max / ratio)
    return { width: max, height: Math.max(2, h) }
  }
  const w = Math.round(max * ratio)
  return { width: Math.max(2, w), height: max }
}

export function ProjectHeader() {
  const project = useTimelineStore((s) => s.project)
  const renameProject = useTimelineStore((s) => s.renameProject)
  const setProjectSettings = useTimelineStore((s) => s.setProjectSettings)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false)
  const [openProjectOpen, setOpenProjectOpen] = React.useState(false)
  const dirty = useTimelineStore((s) => s.dirty)
  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)

  const commitName = () => {
    renameProject(nameDraft.trim() || 'Untitled Project')
    setEditingName(false)
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-background/95 px-2 backdrop-blur overflow-x-auto no-scrollbar">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-1.5 text-xs font-medium shrink-0"
      >
        <Link to="/" title="Home">
          <div className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded text-[10px] font-bold">
            CF
          </div>
          <Home className="size-3.5" />
        </Link>
      </Button>

      <div className="bg-border h-4 w-px shrink-0" />
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
          className="h-7 w-28 sm:w-40 rounded-md border bg-muted/40 px-2 text-xs sm:text-sm font-semibold outline-none shrink-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNameDraft(project.name)
            setEditingName(true)
          }}
          title="Rename project"
          className="group flex shrink-0 items-center gap-1 text-xs sm:text-sm font-semibold max-w-[110px] sm:max-w-[180px]"
        >
          <span className="truncate">{project.name}</span>
          {dirty && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-500" title="Unsaved changes (auto-saves)" />}
          <Pencil className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}

      {/* Open Project Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/40 rounded-md shrink-0 transition-colors"
        onClick={() => setOpenProjectOpen(true)}
        title="Open a saved project"
      >
        <FolderOpen className="size-3.5 text-violet-500" />
      </Button>

      {/* New Project / Reset Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary border border-primary/20 hover:border-primary/40 rounded-md shrink-0 transition-colors"
        onClick={() => setResetConfirmOpen(true)}
        title="Start a new empty project"
      >
        <FilePlus className="size-3.5" />
        <span className="hidden lg:inline">New Project</span>
      </Button>

      {/* Aspect Ratio */}
      <Select
        value={project.aspectRatio}
        onValueChange={(v) => {
          const ratio = ASPECT_RATIOS.find((r) => r === v)
          if (ratio) {
            const [w, h] = ratio.split(':').map(Number)
            const dims = dimsForAspect(project, w / h)
            setProjectSettings({ aspectRatio: v, width: dims.width, height: dims.height })
          }
        }}
      >
        <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 text-xs hover:bg-muted shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[10050]">
          {ASPECT_RATIOS.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* FPS */}
      <div className="hidden sm:flex shrink-0">
        <Select
          value={String(project.fps)}
          onValueChange={(v) => setProjectSettings({ fps: Number(v) })}
        >
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 text-xs font-mono hover:bg-muted">
            <SelectValue /> <span className="text-muted-foreground">fps</span>
          </SelectTrigger>
          <SelectContent className="z-[10050]">
            {FPS_OPTIONS.map((f) => (
              <SelectItem key={f} value={String(f)}>{f} fps</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resolution */}
      <div className="hidden md:flex shrink-0">
        <Select
          value={`${project.width}x${project.height}`}
          onValueChange={(v) => {
            const [w, h] = v.split('x').map(Number)
            const ratio = w / h
            let bestLabel = project.aspectRatio
            let bestDiff = Infinity
            for (const a of ASPECT_RATIOS) {
              const [aw, ah] = a.split(':').map(Number)
              const diff = Math.abs(aw / ah - ratio)
              if (diff < bestDiff) { bestDiff = diff; bestLabel = a }
            }
            setProjectSettings({ width: w, height: h, aspectRatio: bestLabel })
          }}
        >
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 text-xs font-mono hover:bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[10050]">
            {RESOLUTIONS.map((r) => (
              <SelectItem key={r.label} value={`${r.w}x${r.h}`}>
                {r.label} · {r.w}×{r.h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-1 shrink-0">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-violet-600 dark:text-violet-400 font-semibold"
          onClick={() => setExportOpen(true)}
          title="Export project"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-8"
        >
          <Link to="/settings" title="Settings">
            <Settings className="size-3.5" />
          </Link>
        </Button>
      </div>

      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}

      {/* New Project Setup Modal */}
      <NewProjectDialog open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)} />

      {/* Open Project Picker */}
      <OpenProjectDialog open={openProjectOpen} onClose={() => setOpenProjectOpen(false)} />
    </div>
  )
}
