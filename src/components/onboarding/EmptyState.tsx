import { FolderPlus, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Media Bin empty state: invites importing video, audio, images, or 3D assets.
 */
export function EmptyState({ onImport }: { onImport?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/10 my-2">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-violet-500/30 text-violet-400 shadow-xs">
        <UploadCloud className="size-6 text-violet-500" />
      </div>

      <Button
        size="sm"
        className="gap-1.5 h-8 px-3.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow-xs mt-1"
        onClick={onImport}
        title="Import media"
        aria-label="Import media"
      >
        <FolderPlus className="size-3.5" />
        Browse Files
      </Button>
    </div>
  )
}

