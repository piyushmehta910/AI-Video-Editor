import * as React from 'react'
import { Bot, Download, PanelLeft, Pencil, Redo2, Save, Sparkles, Undo2 } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore, type EditorMode } from '@/stores/editorStore'
import { ExportDialog } from '@/ui/export/ExportDialog'
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

const MODES: { value: EditorMode; label: string; hint: string }[] = [
  { value: 'human', label: 'Human', hint: 'Manual editing only' },
  { value: 'hybrid', label: 'Hybrid', hint: 'Manual editing with AI assist' },
  { value: 'ai', label: 'AI', hint: 'AI Director drives the timeline' },
]

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
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
  active?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', active && 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30')}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function TopToolbar() {
  const project = useTimelineStore((s) => s.project)
  const renameProject = useTimelineStore((s) => s.renameProject)
  const undo = useTimelineStore((s) => s.undo)
  const redo = useTimelineStore((s) => s.redo)
  const save = useTimelineStore((s) => s.save)
  const saving = useTimelineStore((s) => s.saving)
  const canUndo = useTimelineStore((s) => s.past.length > 0)
  const canRedo = useTimelineStore((s) => s.future.length > 0)

  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const aiDirectorOpen = useEditorStore((s) => s.aiDirectorOpen)
  const toggleAIDirector = useEditorStore((s) => s.toggleAIDirector)
  const toggleLeft = useEditorStore((s) => s.toggleLeft)
  const leftOpen = useEditorStore((s) => s.leftOpen)

  const setProjectSettings = useTimelineStore((s) => s.setProjectSettings)

  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)
  const [exportOpen, setExportOpen] = React.useState(false)

  const commitName = () => {
    renameProject(nameDraft.trim() || 'Untitled Project')
    setEditingName(false)
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      {/* Media bin hamburger */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 shrink-0 p-0', leftOpen && 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30')}
            onClick={toggleLeft}
          >
            <PanelLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle media bin</TooltipContent>
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
          <span className="max-w-48 truncate">{project.name}</span>
          <Pencil className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}

      {/* Mode switcher */}
      <div className="bg-muted ml-2 flex shrink-0 items-center gap-0.5 rounded-lg p-0.5" role="radiogroup" aria-label="Editing mode">
        {MODES.map(({ value, label, hint }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  mode === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        ))}
      </div>

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
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 text-xs hover:bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASPECT_RATIOS.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(project.fps)} onValueChange={(v) => setProjectSettings({ fps: Number(v) })}>
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 font-mono text-xs hover:bg-muted">
            <SelectValue /> <span className="text-muted-foreground">fps</span>
          </SelectTrigger>
          <SelectContent>
            {FPS_OPTIONS.map((f) => (
              <SelectItem key={f} value={String(f)}>{f}</SelectItem>
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
          <SelectTrigger className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-1.5 font-mono text-xs hover:bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOLUTIONS.map((r) => (
              <SelectItem key={r.label} value={`${r.w}x${r.h}`}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="size-4" />
        </ToolButton>
        <ToolButton label={saving ? 'Saving…' : 'Save project'} onClick={() => void save()} disabled={saving}>
          <Save className={cn('size-4', saving && 'animate-pulse')} />
        </ToolButton>
        <ToolButton label="Export video" onClick={() => setExportOpen(true)}>
          <Download className="size-4" />
        </ToolButton>

        <div className="bg-border mx-1.5 h-5 w-px" />

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-1.5 px-2 text-xs font-medium',
            aiDirectorOpen && 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30',
          )}
          onClick={toggleAIDirector}
        >
          {mode === 'ai' ? <Sparkles className="size-3.5" /> : <Bot className="size-3.5" />}
          AI Director
        </Button>
      </div>

      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}
    </div>
  )
}
