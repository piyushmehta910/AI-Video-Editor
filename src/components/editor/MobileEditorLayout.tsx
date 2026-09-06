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
  const [isLandscape, setIsLandscape] = React.useState(false)

  const historyPanelOpen = useEditorStore((s) => s.historyPanelOpen)
  const toggleHistoryPanel = useEditorStore((s) => s.toggleHistoryPanel)

  // Detect landscape orientation
  React.useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)')
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsLandscape(e.matches)
    update(mql)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

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

  const handleOpenDrawer = React.useCallback((drawer: 'media' | 'inspector' | 'tools' | null) => {
    setActiveDrawer(drawer)
  }, [])

  // Auto-open clip properties when user taps a clip on the timeline
  React.useEffect(() => {
    const unsub = useTimelineStore.subscribe((state, prev) => {
      const hasClip = state.selection.clipIds.length > 0
      const hadClip = prev.selection.clipIds.length > 0
      if (hasClip && !hadClip) {
        // Switch to properties tab automatically
        useEditorStore.getState().setRightPanelTab('properties')
        // Auto-open inspector when clip is first selected for quick editing
        setActiveDrawer('inspector')
      }
      if (!hasClip && hadClip) {
        // Close inspector when clip is deselected to restore full timeline view
        setActiveDrawer((prev) => (prev === 'inspector' ? null : prev))
      }
    })
    return unsub
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground overflow-hidden">
      {/* 1. Compact Mobile Top Bar */}
      <MobileTopBar onOpenMedia={() => handleOpenDrawer('media')} />

      {/* 2. Dual-Zone Split Workspace: Preview Canvas (top) + Timeline (bottom) */}
      {/* In landscape: side-by-side — canvas left, timeline right */}
      <div
        className={`relative flex min-h-0 flex-1 overflow-hidden ${
          isLandscape ? 'flex-row' : 'flex-col'
        }`}
      >
        {/* Zone 1: Video Preview Canvas */}
        <div
          className={`shrink-0 overflow-hidden bg-black flex flex-col ${
            isLandscape
              ? 'w-[48%] h-full border-r border-border/60'
              : 'border-b border-border/60'
          }`}
          style={isLandscape ? undefined : { flex: '0 0 37vh' }}
        >
          <PanelErrorBoundary panelName="Preview">
            <PreviewCanvas playback={playback} onOpenMedia={() => handleOpenDrawer('media')} />
          </PanelErrorBoundary>
        </div>

        {/* Zone 2: Timeline */}
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden bg-muted/10">
          <PanelErrorBoundary panelName="Timeline">
            <Timeline fill onOpenTool={handleOpenTool} />
          </PanelErrorBoundary>
        </div>
      </div>

      {/* 3. Contextual Thumb Action Bar (sticky bottom) */}
      <MobileActionBar
        activeDrawer={activeDrawer}
        onOpenDrawer={handleOpenDrawer}
        onSelectTool={handleSelectTool}
      />

      {/* 4. Slide-up Panel Drawer (Media, Inspector, Tools) */}
      <MobilePanelDrawer
        drawer={activeDrawer}
        onClose={() => handleOpenDrawer(null)}
      />

      {/* History sidebar overlay (from overflow menu) */}
      {historyPanelOpen && <HistoryPanel onClose={toggleHistoryPanel} />}

      <HistoryToast />
    </div>
  )
}
