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

export function MobileTopBar() {
  const project = useTimelineStore((s) => s.project)
  const renameProject = useTimelineStore((s) => s.renameProject)
  const save = useTimelineStore((s) => s.save)
  const saving = useTimelineStore((s) => s.saving)
  const dirty = useTimelineStore((s) => s.dirty)
  const setProjectSettings = useTimelineStore((s) => s.setProjectSettings)

  const { canUndo, canRedo } = useUndoRedo()

  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [newProjectOpen, setNewProjectOpen] = React.useState(false)
  const [openProjectOpen, setOpenProjectOpen] = React.useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false)
  const [justSaved, setJustSaved] = React.useState(false)

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
    <header className="relative z-30 flex h-11 w-full shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-2 backdrop-blur-xl select-none">
      {/* Left: Brand + Project Title */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-1.5 hover:bg-muted/80 rounded-lg"
        >
          <Link to="/" title="Home">
            <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black shadow-xs">
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
            className="h-7 w-28 max-w-[120px] rounded-lg border border-violet-500/50 bg-muted/80 px-2 text-xs font-bold outline-none ring-2 ring-violet-500/30 text-foreground"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(project.name)
              setEditingName(true)
            }}
            title="Tap to rename"
            className="group flex min-w-0 max-w-[110px] items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-bold text-foreground hover:bg-muted/60 transition truncate"
          >
            <span className="truncate">{project.name}</span>
            <Pencil className="size-2.5 shrink-0 text-muted-foreground opacity-60" />
          </button>
        )}
      </div>

      {/* Center: Quick Undo & Redo */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={() => useTimelineStore.getState().undo()}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={() => useTimelineStore.getState().redo()}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>

      {/* Right: Save Status + Export CTA + Overflow Menu */}
      <div className="flex items-center gap-1">
        {/* Save button with status */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground transition-all',
            justSaved && 'text-emerald-500 bg-emerald-500/10',
            dirty && !saving && !justSaved && 'text-amber-500',
          )}
          onClick={() => void handleSave()}
          disabled={saving}
          aria-label={saving ? 'Saving' : justSaved ? 'Saved' : dirty ? 'Unsaved changes' : 'Save'}
          title="Save project"
        >
          {saving ? (
            <Save className="size-3.5 shrink-0 animate-pulse text-violet-500" />
          ) : justSaved ? (
            <Check className="size-3.5 shrink-0 text-emerald-500" />
          ) : (
            <div className="relative">
              <Save className={cn('size-3.5 shrink-0', dirty && 'text-amber-500')} />
              {dirty && (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
          )}
        </Button>

        {/* Primary Export CTA */}
        <Button
          onClick={() => setExportOpen(true)}
          size="sm"
          className="h-7 gap-1 px-2.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 text-white font-bold text-xs rounded-lg shadow-sm shadow-violet-500/20 active:scale-95"
          data-testid="mobile-export-button"
        >
          <Download className="size-3 shrink-0" />
          <span>Export</span>
        </Button>

        {/* More Menu Toggle */}
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

      {/* Overflow Menu Sheet */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setMoreMenuOpen(false)}
          />
          <div className="relative bg-card border-t border-border rounded-t-2xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project Options</span>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Aspect Ratio Picker */}
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs font-semibold text-foreground">Canvas Ratio</span>
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
                <SelectTrigger className="h-7 w-28 text-xs font-semibold border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050]">
                  {ASPECT_RATIOS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 justify-start gap-2 text-xs font-semibold"
                onClick={() => {
                  setNewProjectOpen(true)
                  setMoreMenuOpen(false)
                }}
              >
                <FilePlus className="size-3.5 text-violet-500" />
                New Project
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 justify-start gap-2 text-xs font-semibold"
                onClick={() => {
                  setOpenProjectOpen(true)
                  setMoreMenuOpen(false)
                }}
              >
                <Home className="size-3.5 text-blue-500" />
                Open Project
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 justify-start gap-2 text-xs font-semibold"
                onClick={toggleHistoryPanel}
              >
                <History className="size-3.5 text-amber-500" />
                Undo History
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 justify-start gap-2 text-xs font-semibold"
                onClick={toggleCommandPalette}
              >
                <Search className="size-3.5 text-emerald-500" />
                Search Actions
              </Button>
            </div>

            {/* Bottom Row: Settings & Theme */}
            <div className="flex items-center justify-between border-t pt-2">
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
