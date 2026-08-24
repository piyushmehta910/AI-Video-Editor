import * as React from 'react'
import { Download, Home, Pencil, Settings } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { ExportDialog } from '@/ui/export/ExportDialog'
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
  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)

  const commitName = () => {
    renameProject(nameDraft.trim() || 'Untitled Project')
    setEditingName(false)
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-1.5 text-xs font-medium"
      >
        <Link to="/" title="Home">
          <div className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded text-[10px] font-bold">
            CF
          </div>
          <Home className="size-3.5" />
        </Link>
      </Button>

      <div className="bg-border h-4 w-px" />
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
        <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 text-xs hover:bg-muted">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASPECT_RATIOS.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(project.fps)}
        onValueChange={(v) => setProjectSettings({ fps: Number(v) })}
      >
        <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 text-xs font-mono hover:bg-muted">
          <SelectValue /> <span className="text-muted-foreground">fps</span>
        </SelectTrigger>
        <SelectContent>
          {FPS_OPTIONS.map((f) => (
            <SelectItem key={f} value={String(f)}>{f} fps</SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        <SelectContent>
          {RESOLUTIONS.map((r) => (
            <SelectItem key={r.label} value={`${r.w}x${r.h}`}>
              {r.label} · {r.w}×{r.h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
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
    </div>
  )
}
