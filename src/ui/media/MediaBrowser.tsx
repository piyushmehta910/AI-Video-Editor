import * as React from 'react'
import { Check, ChevronLeft, Film, FolderUp, Image, Music, Play, Plus, Scan, Trash2 } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, TrackType } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/engine/types'
import { analyzeAsset } from '@/api/llm/analysis'
import { MediaSourcePreview } from '@/components/media/MediaSourcePreview'

const ACCEPTED =
  '.mp4,.m4v,.mov,.webm,.mkv,.avi,.mpg,.mpeg,.ts,.ogv,.3gp,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,audio/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,image/*'

function AssetIcon({ type }: { type: Asset['type'] }) {
  if (type === 'video') return <Film className="size-3.5" />
  if (type === 'audio') return <Music className="size-3.5" />
  return <Image className="size-3.5" />
}

export function MediaBrowser({ onCollapse }: { onCollapse?: () => void }) {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const deleteAsset = useTimelineStore((s) => s.deleteAsset)
  const addClip = useTimelineStore((s) => s.addClip)
  const project = useTimelineStore((s) => s.project)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null)

  const selectedAsset = React.useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  )

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
        setNotice({ kind: 'ok', text: `Imported ${imported.length} ${imported.length === 1 ? 'file' : 'files'} to the library — use + to add them to the timeline` })
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
    <div className="flex h-full w-full flex-col bg-muted/30">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
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
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCollapse}
            title="Hide panel"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1">
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
          className="relative h-full overflow-y-auto p-2"
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

          {/* Embedded Source Monitor / Media Preview */}
          {selectedAsset && (
            <div className="mb-2.5 shrink-0 animate-in fade-in duration-200">
              <MediaSourcePreview
                asset={selectedAsset}
                onClose={() => setSelectedAssetId(null)}
                onAddToTimeline={(a) => handleAdd(a)}
              />
            </div>
          )}

          {assets.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
              <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
                <Plus className="text-muted-foreground size-6" />
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
                isSelected={selectedAssetId === asset.id}
                onSelect={() => setSelectedAssetId(asset.id)}
                onPreview={() => setSelectedAssetId(asset.id)}
                onAdd={() => handleAdd(asset)}
                onDelete={() => {
                  if (selectedAssetId === asset.id) setSelectedAssetId(null)
                  void deleteAsset(asset.id)
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyzeButton({ asset }: { asset: Asset }) {
  const [state, setState] = React.useState<'idle' | 'running' | 'done'>('idle')
  const [progress, setProgress] = React.useState(0)
  const [stage, setStage] = React.useState('')
  const abortRef = React.useRef<AbortController | null>(null)

  const run = async () => {
    if (state === 'running') return
    const abort = new AbortController()
    abortRef.current = abort
    setState('running')
    setProgress(0)
    setStage('starting…')
    try {
      await analyzeAsset(asset, {
        signal: abort.signal,
        onProgress: (p) => {
          setStage(p.stage)
          setProgress(Math.round(p.progress * 100))
        },
      })
      setState('done')
      window.setTimeout(() => setState('idle'), 4000)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState('idle')
      } else {
        setState('idle')
      }
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setState('idle')
    setProgress(0)
  }

  if (state === 'running') {
    return (
      <div className="ml-auto flex flex-col items-end gap-0.5" title={`Analyzing ${asset.name}… ${progress}%`}>
        <span className="text-[10px] tabular-nums capitalize">{stage} {progress}%</span>
        <div className="bg-muted h-1 w-10 overflow-hidden rounded-full">
          <div className="bg-violet-500 h-full rounded-full transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            cancel()
          }}
          className="text-destructive text-[9px] underline hover:no-underline"
          title="Cancel analysis"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('ml-auto size-5', state === 'done' && 'text-emerald-500')}
      onClick={(e) => {
        e.stopPropagation()
        void run()
      }}
      title={state === 'done' ? 'Analyzed — transcript + scenes + captions ready' : `Analyze ${asset.name} (transcript + scenes + captions)`}
    >
      {state === 'done' ? <Check className="size-3" /> : <Scan className="size-3" />}
    </Button>
  )
}

function MediaItem({
  asset,
  isSelected,
  onSelect,
  onPreview,
  onAdd,
  onDelete,
}: {
  asset: Asset
  isSelected?: boolean
  onSelect?: () => void
  onPreview?: () => void
  onAdd: () => void
  onDelete: () => void
}) {
  const [confirm, setConfirm] = React.useState(false)
  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-all hover:shadow-md',
        isSelected
          ? 'border-violet-500 bg-violet-500/15 ring-2 ring-violet-500/60 shadow-sm'
          : 'bg-card hover:border-violet-500/50',
      )}
      onClick={onSelect || onPreview}
      onDoubleClick={onAdd}
      title={`${asset.name}\n${asset.width ? `${asset.width}×${asset.height}` : ''}${asset.duration ? ` · ${formatSeconds(asset.duration)}` : ''} — click to preview · double-click to add`}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {asset.thumbnailUrl ? (
          <img src={asset.thumbnailUrl} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <AssetIcon type={asset.type} />
          </div>
        )}
        {asset.duration != null && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 font-mono text-[9px] text-white">
            {formatSeconds(asset.duration)}
          </span>
        )}
        <div className="absolute top-1 right-1 flex gap-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="secondary"
            size="icon"
            className="size-6 bg-black/75 text-white hover:bg-violet-600 shadow"
            onClick={(e) => {
              e.stopPropagation()
              if (onPreview) onPreview()
            }}
            title="Preview in Source Monitor"
          >
            <Play className="size-3 fill-white ml-0.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-6 bg-black/75 text-white hover:bg-violet-600 shadow"
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
            className={cn(
              'size-6 shadow transition-colors',
              confirm ? 'bg-destructive text-white' : 'bg-black/75 text-white hover:bg-destructive',
            )}
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
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1 px-1.5 py-1">
        <AssetIcon type={asset.type} />
        <span className="truncate text-[11px]">{asset.name}</span>
        {(asset.type === 'video' || asset.type === 'audio') && <AnalyzeButton asset={asset} />}
      </div>
    </div>
  )
}
