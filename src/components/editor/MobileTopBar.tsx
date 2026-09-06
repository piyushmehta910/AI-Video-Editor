import * as React from 'react'
import {
  Check,
  Download,
  FilePlus,
  History,
  Home,
  MoreVertical,
  Pencil,
  Redo2,
  Save,
  Search,
  Settings,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { ExportDialog } from '@/ui/export/ExportDialog'
import { NewProjectDialog } from '@/components/editor/NewProjectDialog'
import { OpenProjectDialog } from '@/components/editor/OpenProjectDialog'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9', '3:2', '2:3'] as const

function dimsForAspect(current: { width: number; height: number }, ratio: number): { width: number; height: number } {
  const max = Math.max(current.width, current.height)
  if (ratio >= 1) {
    const h = Math.round(max / ratio)
    return { width: max, height: Math.max(2, h) }
  }
  const w = Math.round(max * ratio)
  return { width: Math.max(2, w), height: max }
}

interface MobileTopBarProps {
  onOpenMedia?: () => void
}

export function MobileTopBar({ onOpenMedia: _onOpenMedia }: MobileTopBarProps) {
  const project = useTimelineStore((s) => s.project)
  const renameProject = useTimelineStore((s) => s.renameProject)
  const save = useTimelineStore((s) => s.save)
  const saving = useTimelineStore((s) => s.saving)
  const dirty = useTimelineStore((s) => s.dirty)
  const setProjectSettings = useTimelineStore((s) => s.setProjectSettings)
  const aiDirectorOpen = useEditorStore((s) => s.aiDirectorOpen)
  const setAIDirectorOpen = useEditorStore((s) => s.setAIDirectorOpen)

  const { canUndo, canRedo } = useUndoRedo()

  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [newProjectOpen, setNewProjectOpen] = React.useState(false)
  const [openProjectOpen, setOpenProjectOpen] = React.useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false)
  const [justSaved, setJustSaved] = React.useState(false)

  // Keep name draft in sync if project name changes externally
  React.useEffect(() => {
    if (!editingName) setNameDraft(project.name)
  }, [project.name, editingName])

  const toggleCommandPalette = () => {
    useEditorStore.setState({ commandPaletteOpen: !useEditorStore.getState().commandPaletteOpen })
    setMoreMenuOpen(false)
  }

  const toggleHistoryPanel = () => {
    useEditorStore.getState().toggleHistoryPanel()
    setMoreMenuOpen(false)
  }

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
    <header className="relative z-30 flex h-11 w-full shrink-0 items-center border-b border-border/80 bg-background/98 px-2 backdrop-blur-xl gap-1"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* ── Left: Home + Project Title ── */}
      <div className="flex min-w-0 items-center gap-1 flex-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 rounded-lg hover:bg-muted/80"
        >
          <Link to="/" title="Home">
            <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex size-6 items-center justify-center rounded-md text-[11px] font-black shadow-xs">
              CF
            </div>
          </Link>
        </Button>

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
            className="h-7 min-w-0 flex-1 max-w-[140px] rounded-lg border border-violet-500/50 bg-muted/80 px-2 text-xs font-bold outline-none ring-2 ring-violet-500/30 text-foreground"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(project.name)
              setEditingName(true)
            }}
            className="group flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors truncate"
          >
            <span className="truncate max-w-[90px]">{project.name}</span>
            {dirty && !saving && (
              <span className="size-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" aria-label="Unsaved changes" />
            )}
            <Pencil className="size-2.5 shrink-0 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {/* Aspect ratio quick pill */}
        <span className="hidden xs:inline-flex items-center rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
          {project.aspectRatio}
        </span>
      </div>

      {/* ── Center: Undo / Redo ── */}
      <div className="flex items-center shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          onClick={() => useTimelineStore.getState().undo()}
          disabled={!canUndo}
          aria-label="Undo"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          onClick={() => useTimelineStore.getState().redo()}
          disabled={!canRedo}
          aria-label="Redo"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>

      {/* ── Right: AI Director + Save + Export + More ── */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* AI Director quick launch */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'size-8 p-0 rounded-lg transition-colors',
            aiDirectorOpen
              ? 'bg-violet-500/20 text-violet-400'
              : 'text-muted-foreground hover:text-violet-400',
          )}
          onClick={() => setAIDirectorOpen(!aiDirectorOpen)}
          aria-label="AI Director"
          title="AI Director"
        >
          <Sparkles className="size-4" />
        </Button>

        {/* Save status */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'size-8 p-0 rounded-lg transition-all',
            justSaved && 'text-emerald-500',
            dirty && !saving && !justSaved && 'text-amber-500',
            !dirty && !justSaved && !saving && 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => void handleSave()}
          disabled={saving}
          aria-label="Save"
        >
          {saving ? (
            <Save className="size-3.5 animate-pulse text-violet-500" />
          ) : justSaved ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <Save className={cn('size-3.5', dirty && 'text-amber-500')} />
          )}
        </Button>

        {/* Export CTA */}
        <Button
          onClick={() => setExportOpen(true)}
          size="sm"
          className="h-7 gap-1 px-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm shadow-violet-500/20 active:scale-95 transition-all"
          data-testid="mobile-export-button"
        >
          <Download className="size-3 shrink-0" />
          <span>Export</span>
        </Button>

        {/* More menu */}
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => setMoreMenuOpen((o) => !o)}
          aria-label="More options"
        >
          <MoreVertical className="size-4" />
        </Button>
      </div>

      {/* ── Overflow Bottom Sheet ── */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setMoreMenuOpen(false)}
          />
          <div className="relative bg-card border-t border-border/80 rounded-t-2xl px-4 pt-3 pb-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            {/* Drag handle */}
            <div className="mx-auto h-1 w-10 rounded-full bg-border/80 mb-1" />

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project Settings</span>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Aspect Ratio */}
            <div className="flex items-center justify-between gap-3 py-0.5">
              <div>
                <p className="text-xs font-semibold text-foreground">Canvas Ratio</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Changes the output dimensions</p>
              </div>
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
                <SelectTrigger className="h-8 w-24 text-xs font-semibold border-border/60 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050]">
                  {ASPECT_RATIOS.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border/50 pt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 justify-start gap-2 text-xs font-semibold rounded-xl"
                onClick={() => { setNewProjectOpen(true); setMoreMenuOpen(false) }}
              >
                <FilePlus className="size-4 text-violet-500 shrink-0" />
                New Project
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 justify-start gap-2 text-xs font-semibold rounded-xl"
                onClick={() => { setOpenProjectOpen(true); setMoreMenuOpen(false) }}
              >
                <Home className="size-4 text-blue-500 shrink-0" />
                Open Project
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 justify-start gap-2 text-xs font-semibold rounded-xl"
                onClick={toggleHistoryPanel}
              >
                <History className="size-4 text-amber-500 shrink-0" />
                History Log
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 justify-start gap-2 text-xs font-semibold rounded-xl"
                onClick={toggleCommandPalette}
              >
                <Search className="size-4 text-emerald-500 shrink-0" />
                Search Actions
              </Button>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 gap-2 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <Link to="/settings" search={{ from: 'editor' }} onClick={() => setMoreMenuOpen(false)}>
                  <Settings className="size-3.5" />
                  Settings & API Keys
                </Link>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}
      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
      <OpenProjectDialog open={openProjectOpen} onClose={() => setOpenProjectOpen(false)} />
    </header>
  )
}
