import * as React from 'react'
import { Save, Settings, Share2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { formatTimecode, formatSeconds } from '@/engine/types'
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

const RESOLUTIONS = [
  { label: '360p', w: 640, h: 360 },
  { label: '480p', w: 854, h: 480 },
  { label: '720p', w: 1280, h: 720 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '1440p', w: 2560, h: 1440 },
  { label: '4K', w: 3840, h: 2160 },
]

export function ProjectHeader() {
  const project = useTimelineStore((s) => s.project)
  const saving = useTimelineStore((s) => s.saving)
  const playhead = useTimelineStore((s) => s.playhead)
  const duration = useTimelineStore((s) => s.duration())
  const renameProject = useTimelineStore((s) => s.renameProject)
  const setProjectSettings = useTimelineStore((s) => s.setProjectSettings)
  const save = useTimelineStore((s) => s.save)

  const [exportOpen, setExportOpen] = React.useState(false)

  const fpsLabel = project.fps.toString()

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <input
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
        className="min-w-0 max-w-56 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none transition-colors hover:border-border focus:border-border"
        aria-label="Project name"
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Select
              value={`${project.width}x${project.height}`}
              onValueChange={(v) => {
                const [w, h] = v.split('x').map(Number)
                setProjectSettings({ width: w, height: h })
              }}
            >
              <SelectTrigger size="sm" className="h-7 w-auto px-2 font-mono text-[11px]">
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
            <span className="text-muted-foreground text-xs">·</span>
            <Select value={fpsLabel} onValueChange={(v) => setProjectSettings({ fps: Number(v) })}>
              <SelectTrigger size="sm" className="h-7 w-auto px-2 font-mono text-[11px]">
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
            <span className="text-muted-foreground text-xs">·</span>
            <Select value={project.aspectRatio} onValueChange={(v) => setProjectSettings({ aspectRatio: v })}>
              <SelectTrigger size="sm" className="h-7 w-auto px-2 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['16:9', '9:16', '1:1', '4:5', '21:9'].map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>Resolution · Frame rate · Aspect ratio</TooltipContent>
      </Tooltip>

      <span className="text-muted-foreground hidden font-mono text-xs md:block">
        {formatSeconds(playhead)} / {formatSeconds(duration)}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="sm" asChild className="h-8 px-2">
          <Link to="/settings">
            <Settings />
          </Link>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => void save()} className="h-8 px-2" disabled={saving}>
              <Save className={saving ? 'animate-pulse' : ''} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{saving ? 'Saving…' : 'Save project'}</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={() => setExportOpen(true)} disabled={duration === 0}>
          <Share2 />
          Export
        </Button>
      </div>

      {exportOpen && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}
      <span className="sr-only">{formatTimecode(playhead, project.fps)}</span>
    </div>
  )
}