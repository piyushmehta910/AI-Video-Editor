import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { TopToolbar } from '@/components/editor/TopToolbar'
import { MediaBin } from '@/components/media/MediaBin'
import { PreviewCanvas } from '@/components/editor/PreviewCanvas'
import { InspectorPanel } from '@/components/inspector/InspectorPanel'
import { MiddleToolsInspector } from '@/components/inspector/MiddleToolsInspector'
import { Timeline } from '@/ui/timeline/Timeline'
import type { ToolSection } from '@/ui/common/toolSections'
import { HistoryPanel } from '@/components/history/HistoryPanel'
import { HistoryToast } from '@/components/history/HistoryToast'
import { PanelErrorBoundary } from '@/components/editor/PanelErrorBoundary'
import { Button } from '@/components/ui/button'

const DEFAULT_TIMELINE_HEIGHT = 224
const MIN_TIMELINE_HEIGHT = 80
const MAX_TIMELINE_HEIGHT = 800

const DEFAULT_LEFT_WIDTH = 270
const MIN_LEFT_WIDTH = 200
const MAX_LEFT_WIDTH = 480

const DEFAULT_RIGHT_WIDTH = 300
const MIN_RIGHT_WIDTH = 250
const MAX_RIGHT_WIDTH = 580

function loadNum(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(key))
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/**
 * 4-panel editor workspace (CSS grid):
 *   ┌──────────┬──────────────────────┬───────────┐
 *   │ MediaBin │    PreviewCanvas     │ Inspector │
 *   │  270px   │       flexible       │   300px   │
 *   ├──────────┴──────────────────────┴───────────┤
 *   │                Timeline                     │
 *   └─────────────────────────────────────────────┘
 * All panels are collapsible; both sidebars and the timeline are drag-resizable.
 */
export function EditorLayout({ playback }: { playback: PlaybackApi }) {
  const leftOpen = useEditorStore((s) => s.leftOpen)
  const toggleLeft = useEditorStore((s) => s.toggleLeft)
  const setLeftOpen = useEditorStore((s) => s.setLeftOpen)
  const inspectorOpen = useEditorStore((s) => s.inspectorOpen)
  const toggleInspector = useEditorStore((s) => s.toggleInspector)
  const hasSelectedClip = useTimelineStore((s) => s.selection.clipIds.length > 0)
  const toolPanelSection = useEditorStore((s) => s.toolPanelSection)
  const setToolPanelSection = useEditorStore((s) => s.setToolPanelSection)
  const historyPanelOpen = useEditorStore((s) => s.historyPanelOpen)
  const toggleHistoryPanel = useEditorStore((s) => s.toggleHistoryPanel)

  const selectionClipIds = useTimelineStore((s) => s.selection.clipIds)
  const tracks = useTimelineStore((s) => s.project.tracks)
  const isTextClip = React.useMemo(() => {
    if (selectionClipIds.length !== 1) return false
    const id = selectionClipIds[0]
    for (const t of tracks) {
      const clip = t.clips.find((c) => c.id === id)
      if (clip) return Boolean(clip.text)
    }
    return false
  }, [selectionClipIds, tracks])

  const [lastToolSection, setLastToolSection] = React.useState<ToolSection>('text')

  React.useEffect(() => {
    if (toolPanelSection) {
      setLastToolSection(toolPanelSection as ToolSection)
    }
  }, [toolPanelSection])

  const [timelineHeight, setTimelineHeight] = React.useState(() =>
    loadNum('clipforge-timeline-height', DEFAULT_TIMELINE_HEIGHT),
  )
  const [leftWidth, setLeftWidth] = React.useState(() =>
    loadNum('clipforge-left-width', DEFAULT_LEFT_WIDTH),
  )
  const [rightWidth, setRightWidth] = React.useState(() =>
    loadNum('clipforge-right-width', DEFAULT_RIGHT_WIDTH),
  )

  const openMedia = React.useCallback(() => setLeftOpen(true), [setLeftOpen])

  const handleOpenTool = React.useCallback(
    (tool: string) => {
      if (inspectorOpen && toolPanelSection === tool) {
        setToolPanelSection(null)
      } else {
        setToolPanelSection(tool)
        if (!inspectorOpen) toggleInspector()
      }
    },
    [inspectorOpen, toolPanelSection, toggleInspector, setToolPanelSection],
  )

  // Selection-driven inspector: picking a clip surfaces its properties.
  React.useEffect(() => {
    const unsub = useTimelineStore.subscribe((state, prev) => {
      const hasClip = state.selection.clipIds.length > 0
      const hadClip = prev.selection.clipIds.length > 0
      if (hasClip && !hadClip && !useEditorStore.getState().inspectorOpen) {
        useEditorStore.getState().toggleInspector()
      }
    })
    return unsub
  }, [])

  const onLeftResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = leftWidth

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, startW + (ev.clientX - startX)))
      setLeftWidth(next)
      localStorage.setItem('clipforge-left-width', String(next))
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // Super-responsive width auto-clamp on screen size change
  React.useEffect(() => {
    const handleResize = () => {
      const maxAllowed = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, Math.floor(window.innerWidth * 0.45)))
      setRightWidth((curr) => {
        if (curr > maxAllowed) {
          localStorage.setItem('clipforge-right-width', String(maxAllowed))
          return maxAllowed
        }
        return curr
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const onRightResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: PointerEvent) => {
      const maxAllowed = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, window.innerWidth - 340))
      const next = Math.max(MIN_RIGHT_WIDTH, Math.min(maxAllowed, startW - (ev.clientX - startX)))
      setRightWidth(next)
      localStorage.setItem('clipforge-right-width', String(next))
    }

    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = timelineHeight

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, startH - (ev.clientY - startY)))
      setTimelineHeight(next)
      localStorage.setItem('clipforge-timeline-height', String(next))
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopToolbar />

      {/* Content row: media bin | preview | inspector */}
      <div className="relative flex min-h-0 flex-1">
        {leftOpen ? (
          <div
            className="relative hidden shrink-0 md:flex"
            style={{ width: leftWidth }}
            data-testid="media-bin-panel"
          >
            <aside className="w-full h-full border-r overflow-hidden">
              <PanelErrorBoundary panelName="Media Library">
                <MediaBin />
              </PanelErrorBoundary>
            </aside>
            <div
              className="group absolute -right-1 top-0 bottom-0 z-20 w-2 cursor-col-resize flex items-center justify-center hover:bg-violet-500/20 transition"
              onPointerDown={onLeftResizeStart}
              title="Drag to resize Media Bin"
              style={{ touchAction: 'none' }}
            >
              <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-violet-500" />
            </div>
          </div>
        ) : (
          <div className="hidden w-8 shrink-0 flex-col items-center border-r py-2 md:flex">
            <Button variant="ghost" size="icon" className="size-7" onClick={toggleLeft} aria-label="Show Media Bin" title="Show Media Bin">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PanelErrorBoundary panelName="Preview">
            <PreviewCanvas playback={playback} onOpenMedia={openMedia} />
          </PanelErrorBoundary>
          <div
            className="group relative hidden h-2 shrink-0 cursor-row-resize items-center justify-center border-y bg-muted/50 hover:bg-violet-500/20 md:flex"
            onPointerDown={onResizeStart}
            title="Drag to resize timeline"
            style={{ touchAction: 'none' }}
          >
            <div className="bg-border group-hover:bg-violet-500 h-0.5 w-8 rounded-full" />
          </div>
          <PanelErrorBoundary panelName="Timeline">
            <Timeline height={timelineHeight} onOpenTool={handleOpenTool} />
          </PanelErrorBoundary>
        </div>

        {/* History sidebar */}
        {historyPanelOpen && <HistoryPanel onClose={toggleHistoryPanel} />}

        {inspectorOpen ? (
          <div
            className="relative hidden shrink-0 md:flex"
            style={{ width: rightWidth, maxWidth: '45vw' }}
            data-testid="inspector-panel"
          >
            {/* Drag Resizer on Left Edge of Right Panel */}
            <div
              className="group absolute -left-1.5 top-0 bottom-0 z-20 w-3 cursor-col-resize flex items-center justify-center hover:bg-violet-500/20 active:bg-violet-500/30 transition touch-none select-none"
              onPointerDown={onRightResizeStart}
              title="Drag to resize Inspector"
              style={{ touchAction: 'none' }}
            >
              <div className="w-1 h-8 rounded-full bg-border group-hover:bg-violet-500 transition-colors" />
            </div>
            <aside className="w-full h-full border-l overflow-hidden bg-card/60 backdrop-blur-md">
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <PanelErrorBoundary panelName="Inspector">
                    {toolPanelSection ? (
                      <MiddleToolsInspector
                        section={toolPanelSection as ToolSection}
                        onSelectSection={setToolPanelSection}
                        onCollapse={toggleInspector}
                        hasSelectedClip={hasSelectedClip}
                        onShowClipInspector={() => setToolPanelSection(null)}
                      />
                    ) : hasSelectedClip ? (
                      <InspectorPanel
                        onCollapse={toggleInspector}
                        onOpenMiddleTools={() =>
                          setToolPanelSection(isTextClip ? 'text' : (lastToolSection || 'text'))
                        }
                        middleToolLabel={isTextClip ? 'Text Presets' : 'Middle Tools'}
                      />
                    ) : (
                      <MiddleToolsInspector
                        section={null}
                        onSelectSection={setToolPanelSection}
                        onCollapse={toggleInspector}
                        hasSelectedClip={false}
                      />
                    )}
                  </PanelErrorBoundary>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="hidden w-8 shrink-0 flex-col items-center border-l py-2 md:flex bg-card/20">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={toggleInspector}
              aria-label="Show Inspector"
              title="Show Middle Tools & Clip Inspector"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <HistoryToast />
    </div>
  )
}
