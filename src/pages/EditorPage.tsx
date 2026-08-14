import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import { usePlayback } from '@/hooks/usePlayback'
import { ProjectHeader } from '@/ui/common/ProjectHeader'
import { MediaBrowser } from '@/ui/media/MediaBrowser'
import { Preview } from '@/ui/preview/Preview'
import { Timeline } from '@/ui/timeline/Timeline'
import { Inspector } from '@/ui/inspector/Inspector'

export function EditorPage() {
  const hydrate = useTimelineStore((s) => s.hydrate)
  const hydrated = useTimelineStore((s) => s.hydrated)
  const playback = usePlayback()

  React.useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <ProjectHeader />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r md:block">
          <MediaBrowser />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Preview playback={playback} />
          <Timeline />
        </div>
        <aside className="hidden w-72 shrink-0 border-l lg:block">
          <Inspector />
        </aside>
      </div>
      {!hydrated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      )}
    </div>
  )
}