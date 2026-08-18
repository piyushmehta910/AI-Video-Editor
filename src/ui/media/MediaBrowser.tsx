import * as React from 'react'
import { ChevronLeft, Clapperboard, Film, FolderUp, Image, Music, Plus, Sparkles, Trash2, Type } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Asset, TrackType } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/engine/types'
import { StockMediaSearch } from './StockMediaSearch'
import { AvatarGeneratorDialog } from '@/ui/avatar/AvatarGeneratorDialog'
import { AIToolsDialog } from '@/ui/tools/AIToolsDialog'
import { AddTextDialog } from './AddTextDialog'

const ACCEPTED =
  '.mp4,.m4v,.mov,.webm,.mkv,.avi,.mpg,.mpeg,.ts,.ogv,.3gp,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,audio/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,image/*'

function AssetIcon({ type }: { type: Asset['type'] }) {
  if (type === 'video') return <Film className="size-3.5" />
  if (type === 'audio') return <Music className="size-3.5" />
  return <Image className="size-3.5" />
}

const TOOLS = [
  {
    key: 'avatar',
    icon: Clapperboard,
    label: 'Avatar Lip-Sync',
    desc: 'Generate an on-device lip-sync avatar from an image + audio',
    color: 'text-violet-600 dark:text-violet-400',
  },
  {
    key: 'ai',
    icon: Sparkles,
    label: 'AI Tools',
    desc: 'Wav2Lip neural lip-sync, auto captions & noise cancellation',
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  {
    key: 'text',
    icon: Type,
    label: 'Text & Titles',
    desc: 'Add styled text overlays with animation',
    color: 'text-sky-600 dark:text-sky-400',
  },
] as const

export function MediaBrowser({ onCollapse }: { onCollapse?: () => void }) {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const deleteAsset = useTimelineStore((s) => s.deleteAsset)
  const addClip = useTimelineStore((s) => s.addClip)
  const project = useTimelineStore((s) => s.project)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [avatarOpen, setAvatarOpen] = React.useState(false)
  const [aiToolsOpen, setAIToolsOpen] = React.useState(false)
  const [textOpen, setTextOpen] = React.useState(false)
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

  const openTool = (key: string) => {
    if (key === 'avatar') setAvatarOpen(true)
    else if (key === 'ai') setAIToolsOpen(true)
    else setTextOpen(true)
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

      <Tabs defaultValue="assets" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="mx-2 mt-2 w-auto self-start rounded-md bg-muted">
          <TabsTrigger value="assets" className="px-3 text-xs">
            <Film className="size-3.5" /> Assets
          </TabsTrigger>
          <TabsTrigger value="stock" className="px-3 text-xs">
            <Image className="size-3.5" /> Stock
          </TabsTrigger>
          <TabsTrigger value="tools" className="px-3 text-xs">
            <Sparkles className="size-3.5" /> AI Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="min-h-0 flex-1">
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
                  onAdd={() => handleAdd(asset)}
                  onDelete={() => void deleteAsset(asset.id)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="min-h-0 flex-1 overflow-y-auto">
          <StockMediaSearch />
        </TabsContent>

        <TabsContent value="tools" className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {TOOLS.map((tool) => (
              <button
                key={tool.key}
                type="button"
                onClick={() => openTool(tool.key)}
                className="group flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-violet-500/50 hover:bg-accent"
              >
                <div className="bg-muted group-hover:bg-background flex size-9 shrink-0 items-center justify-center rounded-md">
                  <tool.icon className={cn('size-4.5', tool.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{tool.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{tool.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <AvatarGeneratorDialog open={avatarOpen} onClose={() => setAvatarOpen(false)} />
      <AIToolsDialog open={aiToolsOpen} onClose={() => setAIToolsOpen(false)} />
      <AddTextDialog open={textOpen} onClose={() => setTextOpen(false)} />
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
        <div className="bg-muted flex aspect-video w-full items-center justify-center">
          <Type className="text-muted-foreground size-6" />
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