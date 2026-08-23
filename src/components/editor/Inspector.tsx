import { MousePointerClick } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Inspector as ClipInspector } from '@/ui/inspector/Inspector'
import { Button } from '@/components/ui/button'

/**
 * Right-rail inspector. Context-aware: shows properties for the selected
 * timeline clip, or an actionable empty state when nothing is selected.
 * Clip property sections themselves live in @/ui/inspector/Inspector.
 */
export function Inspector({ onOpenMedia }: { onOpenMedia?: () => void }) {
  const selection = useTimelineStore((s) => s.selection)

  if (selection.clipIds.length === 0) {
    return (
      <div className="bg-muted/30 flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
          <MousePointerClick className="text-muted-foreground size-6" />
        </div>
        <div>
          <p className="text-sm font-semibold">No clip selected</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Select a clip in the timeline to edit its transform, appearance, audio and text
            properties here.
          </p>
        </div>
        {onOpenMedia && (
          <Button size="sm" variant="outline" onClick={onOpenMedia}>
            Browse media
          </Button>
        )}
      </div>
    )
  }

  return <ClipInspector />
}
