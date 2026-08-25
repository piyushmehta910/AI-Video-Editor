import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  FilePlus,
  Monitor,
  Smartphone,
  Square,
  LayoutGrid,
  Film,
  Sliders,
  X,
  Check,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
}

interface PresetOption {
  id: string
  title: string
  aspectRatio: string
  subtitle: string
  width: number
  height: number
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'youtube',
    title: 'YouTube & Desktop',
    aspectRatio: '16:9',
    subtitle: 'Standard landscape video',
    width: 1920,
    height: 1080,
    icon: Monitor,
    badge: '16:9',
  },
  {
    id: 'shorts',
    title: 'Shorts, Reels & TikTok',
    aspectRatio: '9:16',
    subtitle: 'Full vertical mobile format',
    width: 1080,
    height: 1920,
    icon: Smartphone,
    badge: '9:16',
  },
  {
    id: 'instagram_square',
    title: 'Square Feed',
    aspectRatio: '1:1',
    subtitle: '1:1 square social post',
    width: 1080,
    height: 1080,
    icon: Square,
    badge: '1:1',
  },
  {
    id: 'social_portrait',
    title: 'Social Portrait',
    aspectRatio: '4:5',
    subtitle: '4:5 tall feed post',
    width: 1080,
    height: 1350,
    icon: LayoutGrid,
    badge: '4:5',
  },
  {
    id: 'cinema',
    title: 'Cinematic Ultrawide',
    aspectRatio: '21:9',
    subtitle: '21:9 widescreen film',
    width: 2560,
    height: 1080,
    icon: Film,
    badge: '21:9',
  },
  {
    id: 'custom',
    title: 'Custom Dimensions',
    aspectRatio: 'Custom',
    subtitle: 'Enter any width × height',
    width: 1920,
    height: 1080,
    icon: Sliders,
    badge: 'Custom',
  },
]

const RESOLUTION_SCALES: Record<string, { label: string; scale: number; desc: string }> = {
  '720p': { label: '720p HD', scale: 0.6667, desc: 'Fast rendering' },
  '1080p': { label: '1080p Full HD', scale: 1, desc: 'Standard quality' },
  '1440p': { label: '1440p 2K', scale: 1.3333, desc: 'Crisp resolution' },
  '4k': { label: '4K Ultra HD', scale: 2, desc: 'Maximum quality' },
}

const FPS_OPTIONS = [
  { value: 24, label: '24 fps', desc: 'Cinema' },
  { value: 25, label: '25 fps', desc: 'PAL' },
  { value: 30, label: '30 fps', desc: 'Web / Standard' },
  { value: 50, label: '50 fps', desc: 'PAL Motion' },
  { value: 60, label: '60 fps', desc: 'Smooth Motion' },
]

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const resetProject = useTimelineStore((s) => s.resetProject)

  const [projectName, setProjectName] = React.useState('Untitled Project')
  const [selectedPresetId, setSelectedPresetId] = React.useState('youtube')
  const [selectedQuality, setSelectedQuality] = React.useState('1080p')
  const [selectedFps, setSelectedFps] = React.useState(30)
  const [customWidth, setCustomWidth] = React.useState(1920)
  const [customHeight, setCustomHeight] = React.useState(1080)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Reset form whenever modal opens
  React.useEffect(() => {
    if (open) {
      setProjectName(`Project ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)
      setSelectedPresetId('youtube')
      setSelectedQuality('1080p')
      setSelectedFps(30)
      setCustomWidth(1920)
      setCustomHeight(1080)
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [open])

  if (!open) return null

  const isCustom = selectedPresetId === 'custom'
  const selectedPreset = PRESET_OPTIONS.find((p) => p.id === selectedPresetId) || PRESET_OPTIONS[0]
  const quality = RESOLUTION_SCALES[selectedQuality] || RESOLUTION_SCALES['1080p']

  const finalWidth = isCustom
    ? Math.max(16, Math.min(7680, customWidth || 1920))
    : Math.round(selectedPreset.width * quality.scale)
  const finalHeight = isCustom
    ? Math.max(16, Math.min(4320, customHeight || 1080))
    : Math.round(selectedPreset.height * quality.scale)

  const computedAspect = isCustom
    ? `${finalWidth}:${finalHeight}`
    : selectedPreset.aspectRatio

  const handleCreate = () => {
    resetProject({
      name: projectName.trim() || 'Untitled Project',
      aspectRatio: computedAspect,
      width: finalWidth,
      height: finalHeight,
      fps: selectedFps,
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
        className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150 max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0 shadow-xs">
              <FilePlus className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                New Project Setup
                <span className="rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold">
                  All Options
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure your canvas aspect ratio, resolution, and platform presets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto pr-0.5 flex-1">
          {/* Project Name Input */}
          <div className="space-y-1">
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
              className="w-full h-8.5 rounded-lg border border-border bg-muted/30 px-3 text-xs sm:text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none ring-offset-background focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition"
            />
          </div>

          {/* Platform & Aspect Ratio Presets Grid */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Aspect Ratio & Platform Presets</span>
              <span className="text-[10px] font-mono text-violet-500 font-bold">
                {computedAspect} ({finalWidth}×{finalHeight})
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {PRESET_OPTIONS.map((preset) => {
                const Icon = preset.icon
                const isSelected = selectedPresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={cn(
                      'relative flex flex-col items-start p-2.5 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-violet-600 bg-violet-500/10 shadow-sm shadow-violet-500/10 ring-1 ring-violet-500'
                        : 'border-border/70 bg-muted/15 hover:bg-muted/40 hover:border-border',
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div
                        className={cn(
                          'flex size-6 items-center justify-center rounded-lg',
                          isSelected
                            ? 'bg-violet-600 text-white shadow-xs'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      {preset.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-600 dark:text-violet-300 font-mono">
                          {preset.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-foreground truncate w-full">
                      {preset.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate w-full">
                      {preset.id === 'custom' ? 'Custom size' : `${preset.width}×${preset.height}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Width & Height Inputs (visible when Custom is selected) */}
          {isCustom && (
            <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-3 space-y-2 animate-in fade-in duration-150">
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                <Sliders className="size-3.5" /> Custom Dimensions
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold">Width (px)</label>
                  <input
                    type="number"
                    min={16}
                    max={7680}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value) || 1920)}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs font-mono font-bold outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold">Height (px)</label>
                  <input
                    type="number"
                    min={16}
                    max={4320}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value) || 1080)}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs font-mono font-bold outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quality & Resolution + FPS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
            {/* Quality / Resolution */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Resolution Quality</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {finalWidth}×{finalHeight}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(RESOLUTION_SCALES).map(([key, info]) => {
                  const isSelected = selectedQuality === key && !isCustom
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isCustom}
                      onClick={() => setSelectedQuality(key)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg border text-left text-xs font-semibold transition disabled:opacity-40',
                        isSelected
                          ? 'border-violet-600 bg-violet-500/10 text-violet-600 dark:text-violet-300 font-bold'
                          : 'border-border/60 bg-muted/15 text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{info.label}</span>
                        {isSelected && <Check className="size-3 text-violet-500 shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Frame Rate (FPS) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Frame Rate</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                {FPS_OPTIONS.map((f) => {
                  const isSelected = selectedFps === f.value
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setSelectedFps(f.value)}
                      className={cn(
                        'px-1.5 py-1.5 rounded-lg border text-center text-xs font-semibold transition flex flex-col items-center justify-center gap-0.5',
                        isSelected
                          ? 'border-violet-600 bg-violet-500/10 text-violet-600 dark:text-violet-300 font-bold'
                          : 'border-border/60 bg-muted/15 text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                      )}
                    >
                      <span className="font-mono text-[11px]">{f.value}</span>
                      <span className="text-[8px] text-muted-foreground/80 leading-none truncate max-w-full">
                        {f.desc.split(' ')[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Live Project Specification Summary Box */}
          <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-mono text-[11px] text-foreground font-semibold">
              <span className="rounded bg-violet-500/15 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 font-bold">
                {computedAspect}
              </span>
              <span>{finalWidth}×{finalHeight} px</span>
              <span>•</span>
              <span>{selectedFps} fps</span>
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Media assets stay preserved.
            </span>
          </div>
        </div>

        {/* Actions — always visible footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-lg px-3 text-xs font-semibold">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            className="rounded-lg px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-violet-500/20"
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

