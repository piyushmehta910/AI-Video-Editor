import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  FilePlus,
  Monitor,
  Smartphone,
  Square,
  LayoutGrid,
  Film,
  X,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
}

interface AspectRatioOption {
  id: string
  title: string
  aspectRatio: string
  subtitle: string
  width: number
  height: number
  icon: React.ComponentType<{ className?: string }>
  badge: string
}

const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: '16:9',
    title: 'YouTube & Desktop',
    aspectRatio: '16:9',
    subtitle: '16:9 Landscape',
    width: 1920,
    height: 1080,
    icon: Monitor,
    badge: '16:9',
  },
  {
    id: '9:16',
    title: 'Shorts, Reels & TikTok',
    aspectRatio: '9:16',
    subtitle: '9:16 Vertical',
    width: 1080,
    height: 1920,
    icon: Smartphone,
    badge: '9:16',
  },
  {
    id: '1:1',
    title: 'Square Feed',
    aspectRatio: '1:1',
    subtitle: '1:1 Square',
    width: 1080,
    height: 1080,
    icon: Square,
    badge: '1:1',
  },
  {
    id: '4:5',
    title: 'Social Portrait',
    aspectRatio: '4:5',
    subtitle: '4:5 Portrait',
    width: 1080,
    height: 1350,
    icon: LayoutGrid,
    badge: '4:5',
  },
  {
    id: '21:9',
    title: 'Cinematic Ultrawide',
    aspectRatio: '21:9',
    subtitle: '21:9 Widescreen',
    width: 2560,
    height: 1080,
    icon: Film,
    badge: '21:9',
  },
]

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const resetProject = useTimelineStore((s) => s.resetProject)

  const [projectName, setProjectName] = React.useState('Untitled Project')
  const [selectedAspect, setSelectedAspect] = React.useState('16:9')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Reset form whenever modal opens
  React.useEffect(() => {
    if (open) {
      setProjectName(`Project ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)
      setSelectedAspect('16:9')
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [open])

  // Escape closes this dialog while open; capture phase prevents the global
  // cancelOperation shortcut from also firing.
  React.useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc, { capture: true })
    return () => window.removeEventListener('keydown', handleEsc, { capture: true })
  }, [open, onClose])

  if (!open) return null

  const selectedOption =
    ASPECT_RATIO_OPTIONS.find((p) => p.aspectRatio === selectedAspect) || ASPECT_RATIO_OPTIONS[0]

  const handleCreate = () => {
    resetProject({
      name: projectName.trim() || 'Untitled Project',
      aspectRatio: selectedOption.aspectRatio,
      width: selectedOption.width,
      height: selectedOption.height,
      fps: 30,
    })
    onClose()
  }

  return createPortal(
    <div
      style={{ zIndex: 99999 }}
      className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0 shadow-xs">
              <FilePlus className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">New Project</h2>
              <p className="text-xs text-muted-foreground">
                Enter your project name and select an aspect ratio.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Option 1: Project Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Project Name</span>
              <span className="text-[10px] text-muted-foreground font-normal">Editable anytime</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') onClose()
              }}
              placeholder="e.g. My Amazing Video"
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-xs sm:text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none ring-offset-background focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition"
            />
          </div>

          {/* Option 2: Select Aspect Ratio */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Aspect Ratio</span>
              <span className="text-[10px] font-mono text-violet-500 font-bold">
                {selectedOption.badge} ({selectedOption.width}×{selectedOption.height})
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ASPECT_RATIO_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isSelected = selectedAspect === opt.aspectRatio
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedAspect(opt.aspectRatio)}
                    className={cn(
                      'relative flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                      isSelected
                        ? 'border-violet-600 bg-violet-500/10 shadow-xs ring-1 ring-violet-500'
                        : 'border-border/70 bg-muted/15 hover:bg-muted/40 hover:border-border',
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        isSelected
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground truncate">
                          {opt.title}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-300 shrink-0">
                          {opt.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {opt.subtitle}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-lg px-3 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            className="rounded-lg px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-violet-500/20 cursor-pointer"
          >
            <FilePlus className="size-3.5 mr-1.5" />
            Create Project
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

