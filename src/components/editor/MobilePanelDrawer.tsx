import * as React from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { MediaBin } from '@/components/media/MediaBin'
import { RightPanelContainer } from '@/components/inspector/RightPanelContainer'
import { PanelErrorBoundary } from '@/components/editor/PanelErrorBoundary'
import { useEditorStore } from '@/stores/editorStore'
import { getToolMeta, type ToolSection } from '@/ui/common/toolSections'
import { cn } from '@/lib/utils'

interface MobilePanelDrawerProps {
  drawer: 'media' | 'inspector' | 'tools' | null
  onClose: () => void
}

export function MobilePanelDrawer({ drawer, onClose }: MobilePanelDrawerProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const toolPanelSection = useEditorStore((s) => s.toolPanelSection)
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab)

  if (!drawer) return null

  const activeToolMeta = getToolMeta((toolPanelSection as ToolSection) || 'text')

  const title =
    drawer === 'media'
      ? 'Media Library & Assets'
      : drawer === 'inspector' || rightPanelTab === 'properties'
        ? 'Clip Properties'
        : `${activeToolMeta.label} Studio`

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop (tap to close) */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
        aria-label="Close drawer"
      />

      {/* Slide-up Container */}
      <div
        className={cn(
          'relative flex flex-col bg-background/95 border-t border-border shadow-2xl rounded-t-2xl backdrop-blur-2xl transition-all duration-200 ease-out overflow-hidden',
          isExpanded ? 'h-[88vh]' : 'h-[52vh]',
        )}
      >
        {/* Drawer Drag Bar & Header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-3 bg-muted/20 select-none">
          {/* Top handle pill for visual clue */}
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 rounded-full bg-border" />
            <span className="text-xs font-bold tracking-tight text-foreground truncate max-w-[200px]">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Expand / Minimize Toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded((e) => !e)}
              className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              title={isExpanded ? 'Collapse to half height' : 'Expand to full height'}
              aria-label={isExpanded ? 'Collapse drawer' : 'Expand drawer'}
            >
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              title="Close panel"
              aria-label="Close panel"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Panel Content Viewport */}
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
