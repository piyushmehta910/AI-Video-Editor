import * as React from 'react'
import { Check, Download, FilePlus, History, Home, PanelLeft, Pencil, Save, Settings } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import { ExportDialog } from '@/ui/export/ExportDialog'
import { NewProjectDialog } from '@/components/editor/NewProjectDialog'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9', '3:2', '2:3'] as const
const FPS_OPTIONS = [24, 25, 30, 48, 50, 60]
const RESOLUTIONS = [
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

function ToolButton({
  children,
  onClick,
  label,
  disabled,
  active,
  testId,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
  active?: boolean
  testId?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0 rounded-lg transition-all', active && 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 font-bold')}
          onClick={onClick}
          disabled={disabled}
          data-testid={testId}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="text-[11px] font-medium">{label}</TooltipContent>
    </Tooltip>
  )
}

export function TopToolbar() {
  const project = useTimelineStore((s) => s.project)
  const renameProject = useTimelineStore((s) => s.renameProject)
  const save = useTimelineStore((s) => s.save)
  const saving = useTimelineStore((s) => s.saving)

  const toggleLeft = useEditorStore((s) => s.toggleLeft)
  const leftOpen = useEditorStore((s) => s.leftOpen)
  const historyPanelOpen = useEditorStore((s) => s.historyPanelOpen)
  const toggleHistoryPanel = useEditorStore((s) => s.toggleHistoryPanel)

  const setProjectSettings = useTimelineStore((s) => s.setProjectSettings)

  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [newProjectOpen, setNewProjectOpen] = React.useState(false)
  const [justSaved, setJustSaved] = React.useState(false)

  const commitName = () => {
    renameProject(nameDraft.trim() || 'Untitled Project')
    setEditingName(false)
  }

  const handleSave = async () => {
    await save()
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/80 bg-background/80 px-3 backdrop-blur-xl">
      {/* Home navigation & brand badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs font-semibold hover:bg-muted/80 rounded-lg"
          >
            <Link to="/" title="Home">
              <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex size-5 items-center justify-center rounded-md text-[10px] font-black shadow-xs">
                CF
              </div>
              <Home className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline text-foreground font-bold">ClipForge</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-[11px]">Back to Home</TooltipContent>
      </Tooltip>

      <div className="bg-border/80 mx-0.5 h-4 w-px" />

      {/* Media bin toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 shrink-0 p-0 rounded-lg transition', leftOpen && 'bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold')}
            onClick={toggleLeft}
          >
            <PanelLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-[11px]">Toggle Media Library</TooltipContent>
      </Tooltip>

      {/* New Project Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNewProjectOpen(true)}
            className="h-7 gap-1 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground border border-border/40 hover:border-violet-500/40 rounded-lg"
          >
            <FilePlus className="size-3.5 text-violet-500" />
            <span className="hidden md:inline">New</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-[11px]">Create New Project</TooltipContent>
      </Tooltip>

      {/* Project name (editable) */}
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
          className="h-7 w-44 rounded-lg border border-violet-500/50 bg-muted/60 px-2.5 text-xs font-bold outline-none ring-2 ring-violet-500/30 text-foreground"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNameDraft(project.name)
            setEditingName(true)
          }}
          title="Click to rename project"
          className="group flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-foreground hover:bg-muted/60 transition"
        >
          <span className="max-w-48 truncate">{project.name}</span>
          <Pencil className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}

      {/* Project settings (aspect / fps / resolution) — compact, desktop only */}
      <div className="hidden items-center gap-1 xl:flex">
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
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border border-border/40 bg-muted/20 px-2 text-xs font-semibold hover:bg-muted rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[10050]">
            {ASPECT_RATIOS.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(project.fps)} onValueChange={(v) => setProjectSettings({ fps: Number(v) })}>
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border border-border/40 bg-muted/20 px-2 font-mono text-xs hover:bg-muted rounded-md">
            <SelectValue /> <span className="text-muted-foreground">fps</span>
          </SelectTrigger>
          <SelectContent className="z-[10050]">
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
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border border-border/40 bg-muted/20 px-2 font-mono text-xs hover:bg-muted rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[10050]">
            {RESOLUTIONS.map((r) => (
              <SelectItem key={r.label} value={`${r.w}x${r.h}`}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ToolButton label="History & Undo Log" onClick={toggleHistoryPanel} active={historyPanelOpen} testId="history-button">
          <History className="size-4" />
        </ToolButton>

        {/* Save button with feedback */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all', justSaved && 'text-emerald-500 bg-emerald-500/10')}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <Save className="size-3.5 animate-pulse text-violet-500" />
              ) : justSaved ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Save className="size-3.5 text-muted-foreground" />
              )}
              <span className="hidden sm:inline">{saving ? 'Saving…' : justSaved ? 'Saved' : 'Save'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[11px] font-medium">Save Project (Ctrl+S)</TooltipContent>
        </Tooltip>

        <div className="bg-border/80 mx-0.5 h-4 w-px" />

        {/* Settings icon */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Link to="/settings" title="Settings">
                <Settings className="size-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[11px]">Settings & Integrations</TooltipContent>
        </Tooltip>

        <ThemeToggle />

        {/* Primary Export Button */}
        <Button
          onClick={() => setExportOpen(true)}
          size="sm"
          className="h-8 gap-1.5 px-3.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-violet-500/20 text-xs rounded-lg transition-all active:scale-95 shrink-0"
          data-testid="export-button"
        >
          <Download className="size-3.5" />
          <span>Export</span>
        </Button>
      </div>

      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}

      {/* New Project Setup Modal */}
      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  )
}
