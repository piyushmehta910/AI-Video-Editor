import * as React from 'react'
import { Clapperboard, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { usePlayback } from '@/hooks/usePlayback'
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts'
import { ProjectHeader } from '@/ui/common/ProjectHeader'
import { CapabilityBanner } from '@/ui/common/CapabilityBanner'
import { useCapabilities } from '@/hooks/useCapabilities'
import { MediaBrowser } from '@/ui/media/MediaBrowser'
import { Preview } from '@/ui/preview/Preview'
import { Timeline } from '@/ui/timeline/Timeline'
import { Inspector } from '@/ui/inspector/Inspector'
import { AIDirector } from '@/ui/ai/AIDirector'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PIPELINE_PROMPTS: Record<string, string> = {
  'video-to-reel': 'Reframe this project into a vertical 9:16 Reel and keep the highlights.',
  'pdf-to-lesson': 'Make a one-minute Hindi video lesson from this PDF.',
  'article-to-video': 'Turn this article into a video.',
  'avatar-sales-video': 'Create a 30-second sales video using my avatar.',
}

export function EditorPage() {
  const hydrate = useTimelineStore((s) => s.hydrate)
  const hydrated = useTimelineStore((s) => s.hydrated)
  const playback = usePlayback()
  useEditorShortcuts(playback)
  const { caps } = useCapabilities()

  const [initialPrompt, setInitialPrompt] = React.useState<string | undefined>(undefined)
  const [mobilePanel, setMobilePanel] = React.useState<'media' | 'inspector' | null>(null)
  const [leftOpen, setLeftOpen] = React.useState(true)
  const [rightOpen, setRightOpen] = React.useState(true)

  React.useEffect(() => {
    void hydrate()
    const key = sessionStorage.getItem('clipforge-pipeline')
    if (key && PIPELINE_PROMPTS[key]) {
      sessionStorage.removeItem('clipforge-pipeline')
      setInitialPrompt(PIPELINE_PROMPTS[key])
    }
  }, [hydrate])

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <ProjectHeader />
      {caps && <CapabilityBanner caps={caps} />}

      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1 md:hidden">
        <Button
          variant={mobilePanel === 'media' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setMobilePanel(mobilePanel === 'media' ? null : 'media')}
        >
          <Clapperboard className="size-3.5" />
          Media
        </Button>
        <Button
          variant={mobilePanel === 'inspector' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}
        >
          <SlidersHorizontal className="size-3.5" />
          Inspector
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {leftOpen ? (
          <aside className="hidden w-64 shrink-0 border-r md:block">
            <MediaBrowser onCollapse={() => setLeftOpen(false)} />
          </aside>
        ) : (
          <div className="hidden w-8 shrink-0 flex-col items-center border-r py-2 md:flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setLeftOpen(true)}
              title="Show Media panel"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Preview playback={playback} />
          <Timeline />
        </div>
        {rightOpen ? (
          <aside className="hidden w-72 shrink-0 border-l lg:block">
            <Inspector onCollapse={() => setRightOpen(false)} />
          </aside>
        ) : (
          <div className="hidden w-8 shrink-0 flex-col items-center border-l py-2 lg:flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setRightOpen(true)}
              title="Show Inspector panel"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        )}

        {mobilePanel && (
          <div className="absolute inset-0 z-40 flex md:hidden">
            <div
              className={cn(
                'flex h-full w-[min(20rem,85vw)] flex-col border-r bg-background shadow-2xl',
                mobilePanel === 'inspector' && 'ml-auto border-r-0 border-l',
              )}
            >
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
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
              {mobilePanel === 'media' ? <MediaBrowser /> : <Inspector />}
            </div>
            <button
              className="flex-1 bg-black/40"
              onClick={() => setMobilePanel(null)}
              aria-label="Close panel"
            />
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