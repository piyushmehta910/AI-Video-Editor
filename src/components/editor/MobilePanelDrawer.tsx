import * as React from 'react'
import { ChevronDown, ChevronUp, GripHorizontal, X } from 'lucide-react'
import { MediaBin } from '@/components/media/MediaBin'
import { RightPanelContainer } from '@/components/inspector/RightPanelContainer'
import { PanelErrorBoundary } from '@/components/editor/PanelErrorBoundary'
import { useEditorStore } from '@/stores/editorStore'
import { getToolMeta, type ToolSection } from '@/ui/common/toolSections'
import { cn } from '@/lib/utils'

type DrawerMode = 'media' | 'inspector' | 'tools' | null

interface MobilePanelDrawerProps {
  drawer: DrawerMode
  onClose: () => void
}

// Snap heights for the two modes
const HALF_H = 'h-[55vh]'
const FULL_H = 'h-[90vh]'

export function MobilePanelDrawer({ drawer, onClose }: MobilePanelDrawerProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStart = React.useRef<{ y: number; expanded: boolean } | null>(null)
  const toolPanelSection = useEditorStore((s) => s.toolPanelSection)
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab)

  // Reset expanded state each time drawer type changes
  const prevDrawer = React.useRef<DrawerMode>(null)
  React.useEffect(() => {
    if (drawer !== prevDrawer.current) {
      setIsExpanded(false)
      prevDrawer.current = drawer
    }
  }, [drawer])

  // Touch drag on handle to snap between half / full
  const handleHandlePointerDown = (e: React.PointerEvent) => {
    dragStart.current = { y: e.clientY, expanded: isExpanded }
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleHandlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return
    const dy = dragStart.current.y - e.clientY // positive = dragging up
    if (Math.abs(dy) > 36) {
      if (dy > 0 && !isExpanded) setIsExpanded(true)
      else if (dy < 0 && isExpanded) setIsExpanded(false)
    }
  }

  const handleHandlePointerUp = () => {
    dragStart.current = null
    setIsDragging(false)
  }

  if (!drawer) return null

  const activeToolMeta = getToolMeta((toolPanelSection as ToolSection) || 'text')

  const title =
    drawer === 'media'
      ? 'Media Library'
      : rightPanelTab === 'properties' || drawer === 'inspector'
        ? 'Clip Inspector'
        : `${activeToolMeta.label} Studio`

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Scrim / backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150',
          // Keep scrim thinner when in half mode so canvas above is visible through it
          isExpanded ? 'bg-black/50' : 'bg-black/30',
        )}
        onClick={onClose}
        aria-label="Close drawer"
      />

      {/* Slide-up sheet */}
      <div
        className={cn(
          'relative flex flex-col rounded-t-2xl border border-border/40 bg-background/98 shadow-2xl backdrop-blur-2xl overflow-hidden',
          'animate-in slide-in-from-bottom duration-250 ease-out',
          isDragging ? 'transition-none' : 'transition-[height] duration-250 ease-out',
          isExpanded ? FULL_H : HALF_H,
        )}
      >
        {/* ── Drag Handle + Title Row ── */}
        <div
          className="flex h-11 shrink-0 items-center justify-between px-3 bg-muted/10 border-b border-border/40 select-none"
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerUp}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="size-4 text-muted-foreground/50 shrink-0" />
            <span className="text-xs font-bold tracking-tight text-foreground truncate max-w-[180px]">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {/* Expand / Collapse toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded((e) => !e)}
              className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              aria-label={isExpanded ? 'Collapse drawer' : 'Expand to full height'}
            >
              {isExpanded
                ? <ChevronDown className="size-4" />
                : <ChevronUp className="size-4" />
              }
            </button>
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              aria-label="Close panel"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ── Panel Content ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {drawer === 'media' ? (
            <PanelErrorBoundary panelName="Media Library">
              <div className="h-full w-full overflow-hidden">
                <MediaBin />
              </div>
            </PanelErrorBoundary>
          ) : (
            <PanelErrorBoundary panelName="Inspector & Studios">
              <div className="h-full w-full overflow-hidden">
                <RightPanelContainer />
              </div>
            </PanelErrorBoundary>
          )}
        </div>
      </div>
    </div>
  )
}
