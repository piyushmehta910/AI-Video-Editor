import * as React from 'react'
import { Clapperboard, Film, SlidersHorizontal, Sparkles, Waves, X } from 'lucide-react'
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
import { RightToolPanel, type ToolSection, TOOL_SECTIONS } from '@/ui/common/RightToolPanel'
import { AIDirector } from '@/ui/ai/AIDirector'
import { Button } from '@/components/ui/button'
import { EditorLayout } from '@/components/editor/EditorLayout'
import { ShortcutsModal } from '@/components/shortcuts/ShortcutsModal'
import { CommandPalette } from '@/components/editor/CommandPalette'
import { ShortcutKeystrokeOverlay } from '@/components/shortcuts/ShortcutHelp'
import { OnboardingTour, TOUR_DISMISSED_KEY } from '@/components/onboarding/OnboardingTour'
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
  const [mobilePanel, setMobilePanel] = React.useState<'media' | 'inspector' | 'tools' | null>(null)
  const [mobileToolSection, setMobileToolSection] = React.useState<ToolSection>('script')

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
      <CommandPalette />
      <ShortcutKeystrokeOverlay />
      {isMobile ? (
        <>
          {/* Mobile keeps the compact single-column workspace */}
          <ProjectHeader />
          {caps && <CapabilityBanner caps={caps} />}

          <div className="flex shrink-0 items-center gap-1 border-b bg-muted/20 px-2 py-1 overflow-x-auto no-scrollbar">
            <Button
              variant={mobileView === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 text-xs shrink-0"
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
              className="h-8 gap-1 text-xs shrink-0"
              onClick={() => {
                setMobileView('timeline')
                localStorage.setItem('clipforge-mobile-view', 'timeline')
              }}
            >
              <Waves className="size-3.5" />
              Timeline
            </Button>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <Button
                variant={mobilePanel === 'media' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setMobilePanel(mobilePanel === 'media' ? null : 'media')}
              >
                <Film className="size-3.5 text-emerald-500" />
                Media
              </Button>
              <Button
                variant={mobilePanel === 'inspector' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}
              >
                <SlidersHorizontal className="size-3.5 text-blue-500" />
                Inspector
              </Button>
              <Button
                variant={mobilePanel === 'tools' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1 text-xs text-violet-600 dark:text-violet-400 font-semibold"
                onClick={() => setMobilePanel(mobilePanel === 'tools' ? null : 'tools')}
              >
                <Sparkles className="size-3.5 text-violet-500" />
                AI Tools
              </Button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {mobileView === 'timeline' ? (
              <Timeline
                fill
                onOpenTool={(tool) => {
                  setMobileToolSection(tool as ToolSection)
                  setMobilePanel('tools')
                }}
              />
            ) : (
              <Preview playback={playback} />
            )}
          </div>

          {mobilePanel && (
            <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden">
              <button
                className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
                onClick={() => setMobilePanel(null)}
                aria-label="Close panel"
              />
              <div className="bg-background relative flex max-h-[82svh] flex-col rounded-t-2xl border-t shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
                <div className="flex h-11 shrink-0 items-center justify-between border-b px-4 bg-muted/20">
                  <span className="text-xs font-bold tracking-wide uppercase text-foreground">
                    {mobilePanel === 'media'
                      ? 'Media Bin & Assets'
                      : mobilePanel === 'inspector'
                        ? 'Clip Inspector'
                        : `${mobileToolSection} Studio`}
                  </span>
                  <button
                    onClick={() => setMobilePanel(null)}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    aria-label="Close panel"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {mobilePanel === 'tools' && (
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b px-3 py-1.5 bg-muted/10 shrink-0">
                    {TOOL_SECTIONS.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition',
                          mobileToolSection === sec.id
                            ? 'bg-violet-600 text-white shadow-xs font-bold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        onClick={() => setMobileToolSection(sec.id)}
                      >
                        <sec.icon className="size-3" />
                        {sec.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {mobilePanel === 'media' && <MediaBrowser />}
                  {mobilePanel === 'inspector' && <InspectorPanel />}
                  {mobilePanel === 'tools' && (
                    <RightToolPanel
                      section={mobileToolSection}
                      onCollapse={() => setMobilePanel(null)}
                    />
                  )}
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
