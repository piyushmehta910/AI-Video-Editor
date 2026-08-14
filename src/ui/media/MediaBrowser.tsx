import * as React from 'react'
import { Film, FolderUp, Image, Music, Plus, Trash2, Type } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, TrackType } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/engine/types'

const ACCEPTED =
  '.mp4,.m4v,.mov,.webm,.mkv,.avi,.mpg,.mpeg,.ts,.ogv,.3gp,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,audio/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,image/*'

function AssetIcon({ type }: { type: Asset['type'] }) {
  if (type === 'video') return <Film className="size-3.5" />
  if (type === 'audio') return <Music className="size-3.5" />
  return <Image className="size-3.5" />
}

export function MediaBrowser() {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const deleteAsset = useTimelineStore((s) => s.deleteAsset)
  const addClip = useTimelineStore((s) => s.addClip)
  const project = useTimelineStore((s) => s.project)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length) return
    setBusy(true)
    try {
      const { imported, errors } = await importFiles(files)
      if (errors.length && !imported.length) {
        setNotice({ kind: 'error', text: `Could not import: ${errors[0]}` })
      } else if (errors.length) {
        setNotice({ kind: 'error', text: `${imported.length} imported, ${errors.length} failed` })
      } else if (imported.length) {
        setNotice({ kind: 'ok', text: `Added ${imported.length} ${imported.length === 1 ? 'clip' : 'clips'} to the timeline` })
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const targetTrack = (type: Asset['type']): string | undefined => {
    const typeToTrack: Record<Asset['type'], TrackType> = {
      video: 'video',
      image: 'video',
      audio: 'audio',
    }
    const tt = typeToTrack[type]
    return project.tracks.find((t) => t.type === tt)?.id
  }

  const handleAdd = (asset: Asset) => {
    const trackId = targetTrack(asset.type)
    if (!trackId) return
    addClip(asset.id, trackId)
  }

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r bg-muted/30">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-xs font-semibold tracking-wide uppercase">Media</span>
        <span className="text-muted-foreground text-xs">{assets.length}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 px-2"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <FolderUp className="size-4" />
          Import
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div
        className="relative flex-1 overflow-y-auto p-2"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
      >
        {notice && (
          <div
            className={cn(
              'mb-2 rounded-md border px-2.5 py-1.5 text-[11px]',
              notice.kind === 'error'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {notice.text}
          </div>
        )}

        {dragOver && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-violet-500 bg-violet-500/10">
            <p className="text-sm font-medium">Drop to import</p>
          </div>
        )}

        {assets.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Plus className="size-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Import video, image or audio files to start editing.
            </p>
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              Browse files
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {assets.map((asset) => (
            <MediaItem
              key={asset.id}
              asset={asset}
              onAdd={() => handleAdd(asset)}
              onDelete={() => void deleteAsset(asset.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MediaItem({
  asset,
  onAdd,
  onDelete,
}: {
  asset: Asset
  onAdd: () => void
  onDelete: () => void
}) {
  const [confirm, setConfirm] = React.useState(false)
  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-violet-500/50 hover:shadow-md',
      )}
      onDoubleClick={onAdd}
      title={`${asset.name}\n${asset.width ? `${asset.width}×${asset.height}` : ''}${asset.duration ? ` · ${formatSeconds(asset.duration)}` : ''} — double-click to add`}
    >
      {asset.thumbnailUrl ? (
        <img src={asset.thumbnailUrl} alt={asset.name} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted">
          <Type className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center gap-1 px-1.5 py-1">
        <AssetIcon type={asset.type} />
        <span className="truncate text-[11px]">{asset.name}</span>
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon"
          className="size-6 bg-background/90"
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          title="Add to timeline"
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="size-6 bg-background/90"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm) onDelete()
            else {
              setConfirm(true)
              setTimeout(() => setConfirm(false), 1500)
            }
          }}
          title="Delete asset"
        >
          <Trash2 className={cn('size-3.5', confirm && 'text-destructive')} />
        </Button>
      </div>
    </div>
  )
}