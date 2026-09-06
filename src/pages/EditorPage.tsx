import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import { usePlayback } from '@/hooks/usePlayback'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useEditorStore } from '@/stores/editorStore'
import { CapabilityBanner } from '@/ui/common/CapabilityBanner'
import { useCapabilities } from '@/hooks/useCapabilities'
import { AIDirector } from '@/ui/ai/AIDirector'
import { EditorLayout } from '@/components/editor/EditorLayout'
import { MobileEditorLayout } from '@/components/editor/MobileEditorLayout'
import { ShortcutsModal } from '@/components/shortcuts/ShortcutsModal'
import { CommandPalette } from '@/components/editor/CommandPalette'
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

  // Track editor as last visited app view for contextual settings navigation
  React.useEffect(() => {
    try {
      sessionStorage.setItem('clipforge_origin', 'editor')
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Global shortcut UI (both layouts) */}
      <ShortcutsModal />
      <CommandPalette />
      <ShortcutKeystrokeOverlay />

      {isMobile ? (
        /* Mobile-dedicated layout: dual split canvas & timeline, contextual thumb actions, slide-up drawers */
        <MobileEditorLayout playback={playback} />
      ) : (
        /* Desktop layout: completely untouched 4-panel workspace with drag resizers */
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
