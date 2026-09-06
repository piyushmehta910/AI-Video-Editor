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

// Small icon-label button used for both modes
function ActionBtn({
  icon: Icon,
  label,
  iconColor,
  active,
  danger,
  onClick,
}: {
  icon: React.ElementType
  label: string
  iconColor?: string
  active?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-xs transition-all active:scale-90 select-none flex-1 min-w-[46px]',
        danger
          ? 'text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20'
          : active
            ? 'bg-violet-500/15 text-violet-300 font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
      )}
    >
      <Icon className={cn('size-[18px] shrink-0', danger ? 'text-rose-400' : active ? 'text-violet-400' : iconColor)} />
      <span className="text-[10px] leading-none font-medium">{label}</span>
    </button>
  )
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

  // Clip name for deselect label
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
    if (store.selection.clipIds.length) store.duplicateClips(store.selection.clipIds)
  }

  const handleDelete = () => {
    const store = useTimelineStore.getState()
    if (store.selection.clipIds.length) store.deleteClips(store.selection.clipIds, false)
  }

  const handleOpenProperties = () => {
    useEditorStore.getState().setRightPanelTab('properties')
    onOpenDrawer('inspector')
  }

  const propertiesActive = activeDrawer === 'inspector' && rightPanelTab === 'properties'
  const isStandardTool = Boolean(toolPanelSection && ['text', 'captions', 'voiceover', 'audio', 'effects', 'transitions'].includes(toolPanelSection))

  return (
    <div
      className="shrink-0 border-t border-border/70 bg-background/98 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {hasSelection ? (
        /* ── Mode B: Clip Selected — instant edit actions ── */
        <div className="flex items-center gap-0.5 px-1 py-1">
          {/* Deselect / clip name badge */}
          <button
            type="button"
            onClick={() => select([], null)}
            className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0 border border-border/40 active:scale-95 transition-all"
          >
            <X className="size-3.5 shrink-0" />
            <span className="max-w-[68px] truncate text-[11px]">
              {selectedClip ? selectedClip.name : `${selection.clipIds.length} clips`}
            </span>
          </button>

          {/* Clip actions */}
          <div className="flex flex-1 items-center justify-around">
            <ActionBtn
              icon={Scissors}
              label="Split"
              iconColor="text-violet-400"
              onClick={handleSplit}
            />
            <ActionBtn
              icon={SlidersHorizontal}
              label="Edit"
              iconColor="text-blue-400"
              active={propertiesActive}
              onClick={handleOpenProperties}
            />
            <ActionBtn
              icon={CopyPlus}
              label="Duplicate"
              iconColor="text-cyan-400"
              onClick={handleDuplicate}
            />
            <ActionBtn
              icon={Trash2}
              label="Delete"
              danger
              onClick={handleDelete}
            />
          </div>
        </div>
      ) : (
        /* ── Mode A: Studio Tools ── */
        <div className="flex items-center px-0.5 py-1 gap-0">
          <ActionBtn
            icon={Film}
            label="Media"
            iconColor="text-emerald-400"
            active={activeDrawer === 'media'}
            onClick={() => onOpenDrawer(activeDrawer === 'media' ? null : 'media')}
          />
          <ActionBtn
            icon={Type}
            label="Text"
            iconColor="text-amber-400"
            active={activeDrawer === 'tools' && toolPanelSection === 'text'}
            onClick={() => onSelectTool('text')}
          />
          <ActionBtn
            icon={Captions}
            label="Captions"
            iconColor="text-sky-400"
            active={activeDrawer === 'tools' && toolPanelSection === 'captions'}
            onClick={() => onSelectTool('captions')}
          />
          <ActionBtn
            icon={Music}
            label="Audio"
            iconColor="text-emerald-400"
            active={activeDrawer === 'tools' && (toolPanelSection === 'voiceover' || toolPanelSection === 'audio')}
            onClick={() => onSelectTool('voiceover')}
          />
          <ActionBtn
            icon={Sparkles}
            label="Effects"
            iconColor="text-pink-400"
            active={activeDrawer === 'tools' && toolPanelSection === 'effects'}
            onClick={() => onSelectTool('effects')}
          />
          <ActionBtn
            icon={Zap}
            label="FX"
            iconColor="text-yellow-400"
            active={activeDrawer === 'tools' && toolPanelSection === 'transitions'}
            onClick={() => onSelectTool('transitions')}
          />
          <ActionBtn
            icon={LayoutGrid}
            label="Tools"
            iconColor="text-indigo-400"
            active={activeDrawer === 'tools' && !isStandardTool}
            onClick={() => onOpenDrawer(activeDrawer === 'tools' ? null : 'tools')}
          />
        </div>
      )}
    </div>
  )
}
