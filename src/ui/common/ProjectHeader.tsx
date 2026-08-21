import * as React from 'react'
import { Download, Pencil, Settings, Share2, SlidersHorizontal, User, Palette, LogOut } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExportDialog } from '@/ui/export/ExportDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const RESOLUTIONS = [
  { label: '360p', w: 640, h: 360 },
  { label: '480p', w: 854, h: 480 },
  { label: '720p', w: 1280, h: 720 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '1440p', w: 2560, h: 1440 },
  { label: '4K', w: 3840, h: 2160 },
]

const ASPECT_RATIOS = [
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '21:9', ratio: 21 / 9 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 },
] as const

function dimsForAspect(current: { width: number; height: number }, ratio: number): { width: number; height: number } {
  const max = Math.max(current.width, current.height)
  if (ratio >= 1) {
    const h = Math.round(max / ratio)
    return { width: max, height: Math.max(2, h) }
  }
  const w = Math.round(max * ratio)
  return { width: Math.max(2, w), height: max }
}

function SettingsSelects() {
  const project = useTimelineStore((s) => s.project)
  const setProjectSettings = useTimelineStore((s) => s.setProjectSettings)

  const fpsLabel = project.fps.toString()

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={`${project.width}x${project.height}`}
        onValueChange={(v) => {
          const [w, h] = v.split('x').map(Number)
          const ratio = w / h
          const match = ASPECT_RATIOS.reduce((best, a) =>
            Math.abs(a.ratio - ratio) < Math.abs(best.ratio - ratio) ? a : best,
          )
          setProjectSettings({ width: w, height: h, aspectRatio: match.label })
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-full px-2 font-mono text-[11px]">
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

      <Select value={fpsLabel} onValueChange={(v) => setProjectSettings({ fps: Number(v) })}>
        <SelectTrigger size="sm" className="h-8 w-full px-2 font-mono text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[24, 25, 30, 48, 50, 60].map((f) => (
            <SelectItem key={f} value={String(f)}>
              {f} fps
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={project.aspectRatio}
        onValueChange={(v) => {
          const preset = ASPECT_RATIOS.find((a) => a.label === v)
          if (preset) {
            const dims = dimsForAspect(project, preset.ratio)
            setProjectSettings({ aspectRatio: v, width: dims.width, height: dims.height })
          } else {
            setProjectSettings({ aspectRatio: v })
          }
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-full px-2 text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASPECT_RATIOS.map((a) => (
            <SelectItem key={a.label} value={a.label}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ProjectHeader() {
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)
  const duration = useTimelineStore((s) => s.duration())
  const renameProject = useTimelineStore((s) => s.renameProject)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(project.name)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const commitName = () => {
    renameProject(nameDraft.trim() || 'Untitled Project')
    setEditingName(false)
  }

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:gap-3 sm:px-3">
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
          className="h-7 w-36 rounded-md border bg-muted/40 px-2 text-sm font-semibold outline-none sm:w-44"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNameDraft(project.name)
            setEditingName(true)
          }}
          title="Rename project"
          className="group flex max-w-[110px] shrink-0 items-center gap-1 text-sm font-semibold sm:max-w-[180px]"
        >
          <span className="truncate">{project.name}</span>
          <Pencil className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}

      {/* Desktop: inline project settings */}
      <div className="hidden items-center gap-3 md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <SettingsSelects />
            </div>
          </TooltipTrigger>
          <TooltipContent>Resolution · Frame rate · Aspect ratio</TooltipContent>
        </Tooltip>
      </div>

      {/* Mobile: project settings popover */}
      <div className="relative md:hidden">
        <Button
          variant={settingsOpen ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 gap-1 px-2 text-xs"
          onClick={() => setSettingsOpen((o) => !o)}
          title="Project settings"
        >
          <SlidersHorizontal className="size-3.5" />
          Project
        </Button>
        {settingsOpen && (
          <div className="absolute top-full left-0 z-50 mt-1 w-60 rounded-lg border bg-card p-2.5 shadow-xl">
            <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
              Resolution · FPS · Aspect
            </p>
            <SettingsSelects />
          </div>
        )}
      </div>

      <span className="text-muted-foreground hidden font-mono text-xs md:block">
        {formatSeconds(playhead)} / {formatSeconds(duration)}
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

        {/* Brand Kit Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Brand Kit">
              <Palette className="size-3.5" />
              <span className="hidden sm:inline">Brand Kit</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" side="bottom" align="end">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Brand Kits</div>
            <DropdownMenuItem onClick={() => { /* TODO: implement */ }}>Default Brand Kit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { /* TODO: implement */ }}>Create New Brand Kit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { /* TODO: implement */ }}>Manage Brand Kits…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Account Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Account menu">
              <User className="size-3.5" />
              <span className="hidden sm:inline">Account</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" side="bottom" align="end">
            <div className="px-2 py-1 border-b">
              <p className="text-xs font-medium truncate">{project.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">user@clipforge.ai</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { /* TODO: implement */ }}>
              <Settings className="size-3.5 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { /* TODO: implement */ }}>
              <Share2 className="size-3.5 mr-2" /> Share Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => { /* TODO: implement */ }}>
              <LogOut className="size-3.5 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}
    </div>
  )
}