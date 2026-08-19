import * as React from 'react'
import { FolderUp, Music, Plus, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/engine/types'

interface Props {
  open: boolean
  onClose: () => void
}

export function AddAudioDialog({ open, onClose }: Props) {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const project = useTimelineStore((s) => s.project)

  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const audioAssets = React.useMemo(() => assets.filter((a) => a.type === 'audio'), [assets])

  const audioTrackId = React.useMemo(() => project.tracks.find((t) => t.type === 'audio')?.id, [project.tracks])

  const close = () => {
    onClose()
  }

  React.useEffect(() => {
    if (!open) {
      setNotice(null)
      setBusy(false)
    }
  }, [open])

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length) return
    setBusy(true)
    try {
      const { imported, errors } = await importFiles(files)
      if (errors.length && !imported.length) {
        setNotice({ kind: 'error', text: `Could not import: ${errors[0]}` })
      } else {
        setNotice({ kind: 'ok', text: `Added ${imported.length} audio clip${imported.length === 1 ? '' : 's'} to the timeline` })
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const addExisting = (assetId: string) => {
    if (!audioTrackId) return
    addClip(assetId, audioTrackId)
    setNotice({ kind: 'ok', text: 'Added to the timeline' })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
            <Music className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Add Audio</h3>
            <p className="text-muted-foreground text-[11px]">Import audio files to the timeline</p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {notice && (
            <div
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-[11px]',
                notice.kind === 'error'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              )}
            >
              {notice.text}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <FolderUp className="size-4" />
            {busy ? 'Importing…' : 'Browse audio files'}
          </Button>

          <div className="border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">Audio library</p>
            {audioAssets.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No audio assets yet. Import an MP3, WAV or M4A to get started.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {audioAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5"
                  >
                    <Music className="text-muted-foreground size-3.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{asset.name}</p>
                      {asset.duration ? (
                        <p className="text-muted-foreground font-mono text-[10px]">{formatSeconds(asset.duration)}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => addExisting(asset.id)}
                    >
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={close} disabled={busy}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}