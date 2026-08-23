import * as React from 'react'
import { Clapperboard, SlidersHorizontal, Waves, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { usePlayback } from '@/hooks/usePlayback'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useEditorStore } from '@/stores/editorStore'
import { ProjectHeader } from '@/ui/common/ProjectHeader'
import { CapabilityBanner } from '@/ui/common/CapabilityBanner'
import { useCapabilities } from '@/hooks/useCapabilities'
import { MediaBrowser } from '@/ui/media/MediaBrowser'
import { Preview } from '@/ui/preview/Preview'
import { Timeline } from '@/ui/timeline/Timeline'
import { InspectorPanel } from '@/components/inspector/InspectorPanel'
import { AIDirector } from '@/ui/ai/AIDirector'
import { Button } from '@/components/ui/button'
import { EditorLayout } from '@/components/editor/EditorLayout'
import { ShortcutsModal } from '@/components/shortcuts/ShortcutsModal'
import { ShortcutKeystrokeOverlay } from '@/components/shortcuts/ShortcutHelp'
import { OnboardingTour, TOUR_DISMISSED_KEY } from '@/components/onboarding/OnboardingTour'

const PIPELINE_PROMPTS: Record<string, string> = {
  'video-to-reel': 'Reframe this project into a vertical 9:16 Reel and keep the highlights.',
  'pdf-to-lesson': 'Make a one-minute Hindi video lesson from this PDF.',
  'article-to-video': 'Turn this article into a video.',
  'avatar-sales-video': 'Create a 30-second sales video using my avatar.',
}

export function EditorPage() {
  const hydrate = useTimelineStore((s) => s.hydrate)
  const hydrated = useTimelineStore((s) => s.hydrated)
  const welcomeLoaded = useTimelineStore((s) => s.welcomeLoaded)
  const playback = usePlayback()
  useKeyboardShortcuts(playback)
  const { caps } = useCapabilities()
  const isMobile = useIsMobile()
  const aiDirectorOpen = useEditorStore((s) => s.aiDirectorOpen)
  const setAIDirectorOpen = useEditorStore((s) => s.setAIDirectorOpen)

  const [tourOpen, setTourOpen] = React.useState(false)

  const [initialPrompt, setInitialPrompt] = React.useState<string | undefined>(undefined)
  const [mobileView, setMobileView] = React.useState<'preview' | 'timeline'>(() =>
    localStorage.getItem('clipforge-mobile-view') === 'timeline' ? 'timeline' : 'preview',
  )
  const [mobilePanel, setMobilePanel] = React.useState<'media' | 'inspector' | null>(null)

  React.useEffect(() => {
    void hydrate()
    const key = sessionStorage.getItem('clipforge-pipeline')
    if (key && PIPELINE_PROMPTS[key]) {
      sessionStorage.removeItem('clipforge-pipeline')
      setInitialPrompt(PIPELINE_PROMPTS[key])
    }
  }, [hydrate])

  // One-shot tour after the Welcome Project is generated (desktop only).
  React.useEffect(() => {
    if (!welcomeLoaded || isMobile) return
    let dismissed = false
    try {
      dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === '1'
    } catch {
      // ignore storage errors
    }
    if (!dismissed) {
      const t = window.setTimeout(() => setTourOpen(true), 600)
      return () => window.clearTimeout(t)
    }
  }, [welcomeLoaded, isMobile])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Global shortcut UI (both layouts) */}
      <ShortcutsModal />
      <ShortcutKeystrokeOverlay />
      {isMobile ? (
        <>
          {/* Mobile keeps the compact single-column workspace */}
          <ProjectHeader />
          {caps && <CapabilityBanner caps={caps} />}

          <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
            <Button
              variant={mobileView === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setMobileView('preview')
                localStorage.setItem('clipforge-mobile-view', 'preview')
              }}
            >
              <Clapperboard className="size-3.5" />
              Preview
            </Button>
            <Button
              variant={mobileView === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setMobileView('timeline')
                localStorage.setItem('clipforge-mobile-view', 'timeline')
              }}
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

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {mobileView === 'timeline' ? <Timeline fill /> : <Preview playback={playback} />}
          </div>

          {mobilePanel && (
            <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden">
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
                  {mobilePanel === 'media' ? <MediaBrowser /> : <InspectorPanel />}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {caps && <CapabilityBanner caps={caps} />}
          <EditorLayout playback={playback} />
        </>
      )}

      {!hydrated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      )}
      {tourOpen && <OnboardingTour onFinish={() => setTourOpen(false)} />}
      {/* AI Director — floating on both desktop and mobile */}
      <AIDirector
        initialPrompt={initialPrompt}
        open={isMobile ? undefined : aiDirectorOpen}
        onOpenChange={isMobile ? undefined : setAIDirectorOpen}
      />
    </div>
  )
}
