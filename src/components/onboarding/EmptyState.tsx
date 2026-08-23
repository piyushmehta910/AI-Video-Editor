import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Media Bin empty state for the sample project: invites replacing generated
 * content with the user's own files. Pulsing + button doubles as import.
 */
export function EmptyState({ onImport }: { onImport?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <Button
        size="icon"
        variant="outline"
        className="animate-pulse border-violet-500/50 text-violet-400 hover:bg-violet-500/10 size-12 rounded-xl"
        onClick={onImport}
        title="Import media"
        aria-label="Import media"
      >
        <Plus className="size-6" />
      </Button>
      <div>
        <p className="text-xs font-semibold">Import your own media to replace samples</p>
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
          Drop video, audio or images here — everything stays on your machine.
        </p>
      </div>
    </div>
  )
}
