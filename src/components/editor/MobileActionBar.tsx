import * as React from 'react'
import {
  Captions,
  CopyPlus,
  Film,
  LayoutGrid,
  Music,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  X,
  Zap,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import type { ToolSection } from '@/ui/common/toolSections'
import { cn } from '@/lib/utils'

interface MobileActionBarProps {
  activeDrawer: 'media' | 'inspector' | 'tools' | null
  onOpenDrawer: (drawer: 'media' | 'inspector' | 'tools' | null) => void
  onSelectTool: (tool: ToolSection) => void
}

export function MobileActionBar({
  activeDrawer,
  onOpenDrawer,
  onSelectTool,
}: MobileActionBarProps) {
  const selection = useTimelineStore((s) => s.selection)
  const project = useTimelineStore((s) => s.project)
  const select = useTimelineStore((s) => s.select)
  const toolPanelSection = useEditorStore((s) => s.toolPanelSection)
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab)

  const hasSelection = selection.clipIds.length > 0

  // Find selected clip name if single clip
  const selectedClip = React.useMemo(() => {
    if (selection.clipIds.length !== 1) return null
    for (const track of project.tracks) {
      const found = track.clips.find((c) => c.id === selection.clipIds[0])
      if (found) return found
    }
    return null
  }, [project.tracks, selection.clipIds])

  const handleSplit = () => {
    const store = useTimelineStore.getState()
    const t = store.playhead
    for (const id of store.selection.clipIds) {
      for (const track of store.project.tracks) {
        const clip = track.clips.find((c) => c.id === id)
        if (clip && t > clip.startTime + 0.05 && t < clip.startTime + clip.duration - 0.05) {
          store.splitClip(id, t)
          break
        }
      }
    }
  }

  const handleDuplicate = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) {
      store.duplicateClips(store.selection.clipIds)
    }
  }

  const handleDelete = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) {
      store.deleteClips(store.selection.clipIds, false)
    }
  }

  const handleOpenProperties = () => {
    useEditorStore.getState().setRightPanelTab('properties')
    onOpenDrawer('inspector')
  }

  const handleToolClick = (tool: ToolSection) => {
    onSelectTool(tool)
  }

  return (
    <div className="shrink-0 border-t border-border/80 bg-background/95 backdrop-blur-xl select-none pb-[env(safe-area-inset-bottom,0px)]">
      {hasSelection ? (
        /* Mode B: Clip Selected Action Bar */
        <div className="flex h-13 items-center justify-between px-2 gap-1 overflow-x-auto no-scrollbar">
          {/* Deselect / Clip Label */}
          <button
            type="button"
            onClick={() => select([], null)}
            className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0 border border-border/40"
            title="Deselect clip"
          >
            <X className="size-3.5" />
            <span className="max-w-[70px] truncate text-[11px]">
              {selectedClip ? selectedClip.name : `${selection.clipIds.length} clips`}
            </span>
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Split */}
            <button
              type="button"
              onClick={handleSplit}
              className="flex flex-col items-center justify-center rounded-xl p-1.5 text-xs text-foreground hover:bg-muted/80 active:scale-95 transition min-w-11"
              title="Split at playhead"
            >
              <Scissors className="size-4 text-violet-400" />
              <span className="text-[10px] font-medium mt-0.5">Split</span>
            </button>

            {/* Properties */}
            <button
              type="button"
              onClick={handleOpenProperties}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl p-1.5 text-xs active:scale-95 transition min-w-11',
                activeDrawer === 'inspector' && rightPanelTab === 'properties'
                  ? 'bg-violet-500/20 text-violet-400 font-bold'
                  : 'text-foreground hover:bg-muted/80',
              )}
              title="Clip properties & adjustments"
            >
              <SlidersHorizontal className="size-4 text-violet-400" />
              <span className="text-[10px] font-medium mt-0.5">Edit</span>
            </button>

            {/* Duplicate */}
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex flex-col items-center justify-center rounded-xl p-1.5 text-xs text-foreground hover:bg-muted/80 active:scale-95 transition min-w-11"
              title="Duplicate clip"
            >
              <CopyPlus className="size-4 text-cyan-400" />
              <span className="text-[10px] font-medium mt-0.5">Copy</span>
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              className="flex flex-col items-center justify-center rounded-xl p-1.5 text-xs text-rose-400 hover:bg-rose-500/10 active:scale-95 transition min-w-11"
              title="Delete clip"
            >
              <Trash2 className="size-4" />
              <span className="text-[10px] font-medium mt-0.5">Delete</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mode A: Studio Tools Action Bar */
        <div className="flex h-13 items-center justify-around px-1 overflow-x-auto no-scrollbar">
          {/* Media */}
          <button
            type="button"
            onClick={() => onOpenDrawer(activeDrawer === 'media' ? null : 'media')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl p-1 text-xs active:scale-95 transition flex-1 min-w-12',
              activeDrawer === 'media'
                ? 'bg-violet-500/20 text-violet-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Film className="size-4 text-emerald-400" />
            <span className="text-[10px] font-medium mt-0.5">Media</span>
          </button>

          {/* Text */}
          <button
            type="button"
            onClick={() => handleToolClick('text')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl p-1 text-xs active:scale-95 transition flex-1 min-w-12',
              activeDrawer === 'tools' && toolPanelSection === 'text'
                ? 'bg-violet-500/20 text-violet-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Type className="size-4 text-amber-400" />
            <span className="text-[10px] font-medium mt-0.5">Text</span>
          </button>

          {/* Captions */}
          <button
            type="button"
            onClick={() => handleToolClick('captions')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl p-1 text-xs active:scale-95 transition flex-1 min-w-12',
              activeDrawer === 'tools' && toolPanelSection === 'captions'
                ? 'bg-violet-500/20 text-violet-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Captions className="size-4 text-sky-400" />
            <span className="text-[10px] font-medium mt-0.5">Captions</span>
          </button>

          {/* Audio */}
          <button
            type="button"
            onClick={() => handleToolClick('voiceover')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl p-1 text-xs active:scale-95 transition flex-1 min-w-12',
              activeDrawer === 'tools' && (toolPanelSection === 'voiceover' || toolPanelSection === 'audio')
                ? 'bg-violet-500/20 text-violet-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Music className="size-4 text-emerald-400" />
            <span className="text-[10px] font-medium mt-0.5">Audio</span>
          </button>

          {/* Effects */}
          <button
            type="button"
            onClick={() => handleToolClick('effects')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl p-1 text-xs active:scale-95 transition flex-1 min-w-12',
              activeDrawer === 'tools' && toolPanelSection === 'effects'
                ? 'bg-violet-500/20 text-violet-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="size-4 text-pink-400" />
            <span className="text-[10px] font-medium mt-0.5">Effects</span>
          </button>

          {/* Transitions */}
          <button
            type="button"
            onClick={() => handleToolClick('transitions')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl p-1 text-xs active:scale-95 transition flex-1 min-w-12',
              activeDrawer === 'tools' && toolPanelSection === 'transitions'
                ? 'bg-violet-500/20 text-violet-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Zap className="size-4 text-yellow-400" />
            <span className="text-[10px] font-medium mt-0.5">Transitions</span>
          </button>

          {/* More Tools */}
          <button
            type="button"
            onClick={() => onOpenDrawer(activeDrawer === 'tools' ? null : 'tools')}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl p-1 text-xs active:scale-95 transition flex-1 min-w-12',
              activeDrawer === 'tools'
                ? 'bg-violet-500/20 text-violet-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="size-4 text-indigo-400" />
            <span className="text-[10px] font-medium mt-0.5">Tools</span>
          </button>
        </div>
      )}
    </div>
  )
}
