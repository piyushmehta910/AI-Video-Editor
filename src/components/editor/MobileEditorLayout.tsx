import * as React from 'react'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { useEditorStore } from '@/stores/editorStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { MobileTopBar } from '@/components/editor/MobileTopBar'
import { MobileActionBar } from '@/components/editor/MobileActionBar'
import { MobilePanelDrawer } from '@/components/editor/MobilePanelDrawer'
import { PreviewCanvas } from '@/components/editor/PreviewCanvas'
import { Timeline } from '@/ui/timeline/Timeline'
import { HistoryPanel } from '@/components/history/HistoryPanel'
import { HistoryToast } from '@/components/history/HistoryToast'
import { PanelErrorBoundary } from '@/components/editor/PanelErrorBoundary'
import type { ToolSection } from '@/ui/common/toolSections'

export function MobileEditorLayout({ playback }: { playback: PlaybackApi }) {
  const [activeDrawer, setActiveDrawer] = React.useState<'media' | 'inspector' | 'tools' | null>(null)

  const historyPanelOpen = useEditorStore((s) => s.historyPanelOpen)
  const toggleHistoryPanel = useEditorStore((s) => s.toggleHistoryPanel)

  const handleOpenTool = React.useCallback((tool: string) => {
    useEditorStore.getState().setToolPanelSection(tool)
    useEditorStore.getState().setRightPanelTab('tools')
    setActiveDrawer('tools')
  }, [])

  const handleSelectTool = React.useCallback((tool: ToolSection) => {
    useEditorStore.getState().setToolPanelSection(tool)
    useEditorStore.getState().setRightPanelTab('tools')
    setActiveDrawer('tools')
  }, [])

  // Auto-switch to properties tab when user selects a clip while drawer is open
  React.useEffect(() => {
    const unsub = useTimelineStore.subscribe((state, prev) => {
      const hasClip = state.selection.clipIds.length > 0
      const hadClip = prev.selection.clipIds.length > 0
      if (hasClip && !hadClip) {
        useEditorStore.getState().setRightPanelTab('properties')
      }
    })
    return unsub
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground overflow-hidden select-none">
      {/* 1. Compact Mobile Top Bar */}
      <MobileTopBar />

      {/* 2. Dual-Zone Split Workspace: Preview Canvas + Timeline */}
      <div className="relative flex min-h-0 flex-1 flex-col landscape:flex-row overflow-hidden">
        {/* Zone 1: Preview Canvas */}
        <div className="h-[36vh] sm:h-[40vh] landscape:h-full landscape:w-[45%] shrink-0 border-b landscape:border-b-0 landscape:border-r border-border/70 flex flex-col overflow-hidden bg-black/90">
          <PanelErrorBoundary panelName="Preview">
            <PreviewCanvas playback={playback} onOpenMedia={() => setActiveDrawer('media')} />
          </PanelErrorBoundary>
        </div>

        {/* Zone 2: Timeline */}
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <PanelErrorBoundary panelName="Timeline">
            <Timeline fill onOpenTool={handleOpenTool} />
          </PanelErrorBoundary>
        </div>
      </div>

      {/* 3. Contextual Thumb Action Bar */}
      <MobileActionBar
        activeDrawer={activeDrawer}
        onOpenDrawer={setActiveDrawer}
        onSelectTool={handleSelectTool}
      />

      {/* 4. Slide-up Panel Drawer (Media, Inspector, Tools) */}
      <MobilePanelDrawer
        drawer={activeDrawer}
        onClose={() => setActiveDrawer(null)}
      />

      {/* History sidebar overlay if opened from more menu */}
      {historyPanelOpen && <HistoryPanel onClose={toggleHistoryPanel} />}

      <HistoryToast />
    </div>
  )
}
