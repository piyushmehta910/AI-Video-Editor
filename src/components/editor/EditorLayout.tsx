import * as React from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { TopToolbar } from '@/components/editor/TopToolbar'
import { MediaBin } from '@/components/media/MediaBin'
import { PreviewCanvas } from '@/components/editor/PreviewCanvas'
import { InspectorPanel } from '@/components/inspector/InspectorPanel'
import { Timeline } from '@/ui/timeline/Timeline'
import { RightToolPanel, type ToolSection } from '@/ui/common/RightToolPanel'
import { HistoryPanel } from '@/components/history/HistoryPanel'
import { HistoryToast } from '@/components/history/HistoryToast'
import { Button } from '@/components/ui/button'

const DEFAULT_TIMELINE_HEIGHT = 224
const MIN_TIMELINE_HEIGHT = 80
const MAX_TIMELINE_HEIGHT = 800

const DEFAULT_LEFT_WIDTH = 270
const MIN_LEFT_WIDTH = 200
const MAX_LEFT_WIDTH = 480

function loadNum(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(key))
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/**
 * 4-panel editor workspace (CSS grid):
 *   ┌──────────┬──────────────────────┬───────────┐
 *   │ MediaBin │    PreviewCanvas     │ Inspector │
 *   │  270px   │       flexible       │   280px   │
 *   ├──────────┴──────────────────────┴───────────┤
 *   │                Timeline                     │
 *   └─────────────────────────────────────────────┘
 * All panels are collapsible; the timeline is drag-resizable. The AI tool
 * panel opens as an overlay drawer so tool workflows stay reachable.
 */
export function EditorLayout({ playback }: { playback: PlaybackApi }) {
  const leftOpen = useEditorStore((s) => s.leftOpen)
  const toggleLeft = useEditorStore((s) => s.toggleLeft)
  const setLeftOpen = useEditorStore((s) => s.setLeftOpen)
  const inspectorOpen = useEditorStore((s) => s.inspectorOpen)
  const toggleInspector = useEditorStore((s) => s.toggleInspector)
  const toolPanelSection = useEditorStore((s) => s.toolPanelSection)
  const setToolPanelSection = useEditorStore((s) => s.setToolPanelSection)
  const historyPanelOpen = useEditorStore((s) => s.historyPanelOpen)
  const toggleHistoryPanel = useEditorStore((s) => s.toggleHistoryPanel)

  const [timelineHeight, setTimelineHeight] = React.useState(() =>
    loadNum('clipforge-timeline-height', DEFAULT_TIMELINE_HEIGHT),
  )
  const [leftWidth, setLeftWidth] = React.useState(() =>
    loadNum('clipforge-left-width', DEFAULT_LEFT_WIDTH),
  )

  const openMedia = React.useCallback(() => setLeftOpen(true), [setLeftOpen])

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
              <MediaBin />
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
          <PreviewCanvas playback={playback} onOpenMedia={openMedia} />
          <div
            className="group relative hidden h-2 shrink-0 cursor-row-resize items-center justify-center border-y bg-muted/50 hover:bg-violet-500/20 md:flex"
            onPointerDown={onResizeStart}
            title="Drag to resize timeline"
            style={{ touchAction: 'none' }}
          >
            <div className="bg-border group-hover:bg-violet-500 h-0.5 w-8 rounded-full" />
          </div>
          <Timeline height={timelineHeight} onOpenTool={setToolPanelSection} />
        </div>

        {/* History sidebar */}
        {historyPanelOpen && <HistoryPanel onClose={toggleHistoryPanel} />}

        {inspectorOpen ? (
          <aside className="hidden w-70 shrink-0 border-l lg:block" data-testid="inspector-panel">
            <div className="flex h-full flex-col">
              <div className="flex h-9 shrink-0 items-center justify-end border-b px-1.5">
                <Button variant="ghost" size="icon" className="size-7" onClick={toggleInspector} aria-label="Hide Inspector" title="Hide Inspector">
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <InspectorPanel onOpenMedia={openMedia} />
              </div>
            </div>
          </aside>
        ) : (
          <div className="hidden w-8 shrink-0 flex-col items-center border-l py-2 lg:flex">
            <Button variant="ghost" size="icon" className="size-7" onClick={toggleInspector} aria-label="Show Inspector" title="Show Inspector">
              <ChevronLeft className="size-4 rotate-180" />
            </Button>
          </div>
        )}

        {/* AI tools overlay drawer */}
        {toolPanelSection && (
          <>
            <button
              className="absolute inset-0 z-30 bg-black/30"
              onClick={() => setToolPanelSection(null)}
              aria-label="Close tools"
            />
            <aside className="bg-background absolute inset-y-0 right-0 z-40 flex w-80 max-w-[85vw] flex-col border-l shadow-2xl">
              <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
                <span className="text-xs font-semibold tracking-wide uppercase">{toolPanelSection}</span>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setToolPanelSection(null)} aria-label="Close tools" title="Close tools">
                  <X className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <RightToolPanel section={toolPanelSection as ToolSection} onCollapse={() => setToolPanelSection(null)} />
              </div>
            </aside>
          </>
        )}
        </div>

      <HistoryToast />
    </div>
  )
}
