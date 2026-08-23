import * as React from 'react'
import { ChevronDown, FolderUp, LoaderCircle, MonitorUp, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecordingKind } from '@/hooks/useMediaImport'

/**
 * Import entry point: primary file-picker button plus a dropdown with
 * "Record Screen" / "Record Webcam". Shows a spinner while a recording is
 * being finalized or files are processing.
 */
export function ImportButton({
  onFiles,
  onRecord,
  busy,
}: {
  onFiles: (files: FileList | File[]) => void
  onRecord: (kind: RecordingKind) => void
  busy?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = React.useState(false)

  const ACCEPTED =
    '.mp4,.webm,.mov,.avi,.m4v,.mkv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.aac,.ogg,.m4a,video/*,audio/*,image/*'

  React.useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpen])

  return (
    <div className="relative flex shrink-0 items-center">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        data-testid="import-button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex h-7 items-center gap-1 rounded-l-md border border-r-0 px-2 text-[11px] font-medium transition-colors hover:bg-muted disabled:opacity-50',
          'border-border text-foreground',
        )}
        title="Import video, audio and image files"
      >
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <FolderUp className="size-3.5" />}
        Import
      </button>
      <button
        type="button"
        aria-label="More import options"
        data-testid="import-more-button"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((o) => !o)
        }}
        className="border-border flex h-7 items-center rounded-r-md border px-1 transition-colors hover:bg-muted"
      >
        <ChevronDown className="size-3" />
      </button>

      {menuOpen && (
        <div className="bg-card absolute top-full right-0 z-40 mt-1 flex w-48 flex-col gap-0.5 rounded-lg border p-1 shadow-xl">
          <button
            className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs"
            onClick={() => {
              setMenuOpen(false)
              onRecord('screen')
            }}
          >
            <MonitorUp className="size-3.5" />
            Record Screen
          </button>
          <button
            className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs"
            onClick={() => {
              setMenuOpen(false)
              onRecord('webcam')
            }}
          >
            <Video className="size-3.5" />
            Record Webcam
          </button>
        </div>
      )}
    </div>
  )
}
