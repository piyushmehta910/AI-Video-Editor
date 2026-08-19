import * as React from 'react'
import { ChevronLeft, ChevronRight, Clapperboard, SlidersHorizontal, Waves, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { usePlayback } from '@/hooks/usePlayback'
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ProjectHeader } from '@/ui/common/ProjectHeader'
import { CapabilityBanner } from '@/ui/common/CapabilityBanner'
import { useCapabilities } from '@/hooks/useCapabilities'
import { MediaBrowser } from '@/ui/media/MediaBrowser'
import { Preview } from '@/ui/preview/Preview'
import { Timeline } from '@/ui/timeline/Timeline'
import { Inspector } from '@/ui/inspector/Inspector'
import { AIDirector } from '@/ui/ai/AIDirector'
import { Button } from '@/components/ui/button'

const PIPELINE_PROMPTS: Record<string, string> = {
  'video-to-reel': 'Reframe this project into a vertical 9:16 Reel and keep the highlights.',
  'pdf-to-lesson': 'Make a one-minute Hindi video lesson from this PDF.',
  'article-to-video': 'Turn this article into a video.',
  'avatar-sales-video': 'Create a 30-second sales video using my avatar.',
}

const DEFAULT_TIMELINE_HEIGHT = 224
const MIN_TIMELINE_HEIGHT = 120

function loadNum(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(key))
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export function EditorPage() {
  const hydrate = useTimelineStore((s) => s.hydrate)
  const hydrated = useTimelineStore((s) => s.hydrated)
  const playback = usePlayback()
  useEditorShortcuts(playback)
  const { caps } = useCapabilities()
  const isMobile = useIsMobile()

  const [initialPrompt, setInitialPrompt] = React.useState<string | undefined>(undefined)
  const [mobileView, setMobileView] = React.useState<'preview' | 'timeline'>(() =>
    localStorage.getItem('clipforge-mobile-view') === 'timeline' ? 'timeline' : 'preview',
  )
  const [mobilePanel, setMobilePanel] = React.useState<'media' | 'inspector' | null>(null)
  const [leftOpen, setLeftOpen] = React.useState(() => localStorage.getItem('clipforge-left-open') !== '0')
  const [rightOpen, setRightOpen] = React.useState(() => localStorage.getItem('clipforge-right-open') !== '0')
  const [timelineHeight, setTimelineHeight] = React.useState(() =>
    loadNum('clipforge-timeline-height', DEFAULT_TIMELINE_HEIGHT),
  )
  const resizeRef = React.useRef<{ startY: number; startH: number } | null>(null)

  React.useEffect(() => {
    void hydrate()
    const key = sessionStorage.getItem('clipforge-pipeline')
    if (key && PIPELINE_PROMPTS[key]) {
      sessionStorage.removeItem('clipforge-pipeline')
      setInitialPrompt(PIPELINE_PROMPTS[key])
    }
  }, [hydrate])

  const setMobileViewPersisted = (v: 'preview' | 'timeline') => {
    setMobileView(v)
    localStorage.setItem('clipforge-mobile-view', v)
  }

  const setLeftOpenPersisted = (v: boolean) => {
    setLeftOpen(v)
    localStorage.setItem('clipforge-left-open', v ? '1' : '0')
  }

  const setRightOpenPersisted = (v: boolean) => {
    setRightOpen(v)
    localStorage.setItem('clipforge-right-open', v ? '1' : '0')
  }

  const openMedia = React.useCallback(() => {
    if (isMobile) setMobilePanel('media')
    else setLeftOpenPersisted(true)
  }, [isMobile])

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    resizeRef.current = { startY: e.clientY, startH: timelineHeight }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r) return
    const next = Math.max(MIN_TIMELINE_HEIGHT, r.startH - (e.clientY - r.startY))
    setTimelineHeight(next)
    localStorage.setItem('clipforge-timeline-height', String(next))
  }

  const onResizeEnd = () => {
    resizeRef.current = null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectHeader />
      {caps && <CapabilityBanner caps={caps} />}

      <div className="relative flex min-h-0 flex-1">
        {leftOpen ? (
          <aside className="hidden w-64 shrink-0 border-r md:block">
            <MediaBrowser onCollapse={() => setLeftOpenPersisted(false)} />
          </aside>
        ) : (
          <div className="hidden w-8 shrink-0 flex-col items-center border-r py-2 md:flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setLeftOpenPersisted(true)}
              title="Show Media panel"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile view switcher + panel toggles */}
          <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1 md:hidden">
            <Button
              variant={mobileView === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setMobileViewPersisted('preview')}
            >
              <Clapperboard className="size-3.5" />
              Preview
            </Button>
            <Button
              variant={mobileView === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setMobileViewPersisted('timeline')}
            >
              <Waves className="size-3.5" />
              Timeline
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant={mobilePanel === 'media' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setMobilePanel(mobilePanel === 'media' ? null : 'media')}
              >
                <Clapperboard className="size-3.5" />
                Media
              </Button>
              <Button
                variant={mobilePanel === 'inspector' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}
              >
                <SlidersHorizontal className="size-3.5" />
                Inspector
              </Button>
            </div>
          </div>

          {isMobile ? (
            mobileView === 'timeline' ? (
              <Timeline fill />
            ) : (
              <Preview playback={playback} onOpenMedia={openMedia} />
            )
          ) : (
            <>
              <Preview playback={playback} onOpenMedia={openMedia} />
              <div
                className="group relative hidden h-1.5 shrink-0 cursor-row-resize items-center justify-center border-y bg-muted/50 hover:bg-violet-500/20 md:flex"
                onPointerDown={onResizeStart}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                title="Drag to resize timeline"
              >
                <div className="bg-border group-hover:bg-violet-500 h-0.5 w-8 rounded-full" />
              </div>
              <Timeline height={timelineHeight} />
            </>
          )}
        </div>

        {rightOpen ? (
          <aside className="hidden w-72 shrink-0 border-l lg:block">
            <Inspector onCollapse={() => setRightOpenPersisted(false)} />
          </aside>
        ) : (
          <div className="hidden w-8 shrink-0 flex-col items-center border-l py-2 lg:flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setRightOpenPersisted(true)}
              title="Show Inspector panel"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        )}

        {/* Mobile bottom sheet for Media / Inspector */}
        {mobilePanel && (
          <div className="absolute inset-0 z-40 flex flex-col justify-end md:hidden">
            <button
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobilePanel(null)}
              aria-label="Close panel"
            />
            <div className="bg-background relative flex max-h-[70svh] flex-col rounded-t-2xl border-t shadow-2xl">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
                <span className="text-xs font-semibold tracking-wide uppercase">
                  {mobilePanel === 'media' ? 'Media' : 'Inspector'}
                </span>
                <button
                  onClick={() => setMobilePanel(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close panel"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {mobilePanel === 'media' ? <MediaBrowser /> : <Inspector />}
              </div>
            </div>
          </div>
        )}
      </div>
      {!hydrated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      )}
      <AIDirector initialPrompt={initialPrompt} />
    </div>
  )
}