import * as React from 'react'
import {
  Box,
  Film,
  FolderUp,
  Image as ImageIcon,
  Music,
  Plus,
  Search,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore, type MediaTab } from '@/stores/editorStore'
import type { Asset, TransitionType } from '@/engine/types'
import { getMediaUrl } from '@/engine/storage/opfs'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/onboarding/EmptyState'
import { cn } from '@/lib/utils'

const ACCEPTED =
  '.mp4,.m4v,.mov,.webm,.mkv,.avi,.mpg,.mpeg,.ts,.ogv,.3gp,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,audio/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,image/*,.glb,.gltf,model/gltf-binary,model/gltf+json'

const TABS: { value: MediaTab; label: string }[] = [
  { value: 'media', label: 'Media' },
  { value: 'generated', label: 'Generated' },
  { value: 'transitions', label: 'Transitions' },
  { value: 'text', label: 'Text' },
]

/** Assets produced by in-app AI tools carry these markers in their names. */
const GENERATED_MARKERS = [
  'denoised',
  'lipsync',
  'avatar',
  'generated',
  'slide',
  'sticker',
  'upscale',
  'reframe',
  'bg-removed',
  'nobg',
]

const TRANSITIONS: { type: TransitionType; label: string; duration: number }[] = [
  { type: 'cut', label: 'Cut', duration: 0 },
  { type: 'dissolve', label: 'Dissolve', duration: 0.5 },
  { type: 'wipe-left', label: 'Wipe left', duration: 0.5 },
  { type: 'wipe-right', label: 'Wipe right', duration: 0.5 },
  { type: 'wipe-up', label: 'Wipe up', duration: 0.5 },
  { type: 'wipe-down', label: 'Wipe down', duration: 0.5 },
  { type: 'slide', label: 'Slide', duration: 0.5 },
  { type: 'zoom', label: 'Zoom', duration: 0.5 },
]

const TEXT_TEMPLATES: { name: string; text: string; fontSize: number; animation: 'fade-in' | 'slide-up' | 'pop' | 'typewriter'; color: string }[] = [
  { name: 'Title', text: 'Your Title Here', fontSize: 64, animation: 'fade-in', color: '#ffffff' },
  { name: 'Subtitle', text: 'A supporting subtitle', fontSize: 36, animation: 'slide-up', color: '#e5e7eb' },
  { name: 'Lower third', text: 'Name — Role', fontSize: 28, animation: 'slide-up', color: '#ffffff' },
  { name: 'Callout', text: 'NEW!', fontSize: 72, animation: 'pop', color: '#fbbf24' },
  { name: 'Caption', text: 'Spoken words appear here', fontSize: 24, animation: 'typewriter', color: '#ffffff' },
]

function AssetIcon({ type }: { type: Asset['type'] }) {
  if (type === 'video') return <Film className="size-3.5" />
  if (type === 'audio') return <Music className="size-3.5" />
  if (type === 'model') return <Box className="size-3.5" />
  return <ImageIcon className="size-3.5" />
}

function isGenerated(asset: Asset): boolean {
  const name = asset.name.toLowerCase()
  return GENERATED_MARKERS.some((marker) => name.includes(marker))
}

export function MediaBin() {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const deleteAsset = useTimelineStore((s) => s.deleteAsset)
  const addAssetToTimeline = useTimelineStore((s) => s.addAssetToTimeline)
  const addTextClip = useTimelineStore((s) => s.addTextClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const select = useTimelineStore((s) => s.select)
  const playhead = useTimelineStore((s) => s.playhead)
  const project = useTimelineStore((s) => s.project)

  const tab = useEditorStore((s) => s.mediaTab)
  const setTab = useEditorStore((s) => s.setMediaTab)
  const search = useEditorStore((s) => s.mediaSearch)
  const setSearch = useEditorStore((s) => s.setMediaSearch)

  const [busy, setBusy] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [previewAsset, setPreviewAsset] = React.useState<{ asset: Asset; url: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const visibleAssets = assets
    .filter((a) => (tab === 'generated' ? isGenerated(a) : !isGenerated(a)))
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))

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
      } else {
        setNotice({ kind: 'ok', text: `Imported ${imported.length} ${imported.length === 1 ? 'file' : 'files'} — right-click a thumbnail to add it` })
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const openPreview = async (asset: Asset) => {
    try {
      const url = await getMediaUrl(asset.filePath)
      setPreviewAsset({ asset, url })
    } catch {
      setNotice({ kind: 'error', text: `Could not open ${asset.name}` })
    }
  }

  const applyTransition = (type: TransitionType, duration: number) => {
    const store = useTimelineStore.getState()
    const clipId = store.selection.clipIds[0]
    if (!clipId) {
      setNotice({ kind: 'error', text: 'Select a clip first, then click a transition' })
      return
    }
    const clip = store.project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId)
    updateClip(clipId, { transitions: { ...(clip?.transitions ?? {}), in: { type, duration } } })
    setNotice({ kind: 'ok', text: `${labelFor(type)} applied to clip start` })
  }

  const addTextTemplate = (tpl: (typeof TEXT_TEMPLATES)[number]) => {
    const textTrack = project.tracks.find((t) => t.type === 'text')
    if (!textTrack) return
    const clip = addTextClip(tpl.text, textTrack.id, playhead)
    if (clip) {
      updateClip(clip.id, {
        text: clip.text
          ? { ...clip.text, fontSize: tpl.fontSize, color: tpl.color, animation: tpl.animation }
          : undefined,
      })
      select([clip.id], textTrack.id)
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-muted/30" data-testid="media-bin">
      {/* Search */}
      <div className="shrink-0 border-b px-2 py-2">
        <div className="bg-muted/60 flex h-8 items-center gap-1.5 rounded-lg border px-2">
          <Search className="text-muted-foreground size-3.5 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library…"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-0.5 border-b px-1.5 py-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              tab === value
                ? 'bg-violet-500/20 text-violet-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {label}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 shrink-0 gap-1 px-2 text-[11px]"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <FolderUp className="size-3.5" />
          Import
        </Button>
      </div>

      {/* Content */}
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
        className="relative min-h-0 flex-1 overflow-y-auto p-2"
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

        {(tab === 'media' || tab === 'generated') && (
          <>
            {visibleAssets.length === 0 && tab === 'media' && (
              <EmptyState onImport={() => inputRef.current?.click()} />
            )}
            {visibleAssets.length === 0 && tab === 'generated' && (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
                  <Plus className="text-muted-foreground size-6" />
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  AI-generated results land here automatically.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {visibleAssets.map((asset) => (
                <MediaItem
                  key={asset.id}
                  asset={asset}
                  onAdd={() => addAssetToTimeline(asset.id)}
                  onPreview={() => void openPreview(asset)}
                  onDelete={() => void deleteAsset(asset.id)}
                />
              ))}
            </div>
          </>
        )}

        {tab === 'transitions' && (
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground px-1 pb-1 text-[11px]">Click to apply to the selected clip's start.</p>
            {TRANSITIONS.map(({ type, label, duration }) => (
              <button
                key={type}
                type="button"
                onClick={() => applyTransition(type, duration)}
                className="hover:border-violet-500/50 hover:bg-violet-500/5 flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors"
              >
                {label}
                {duration > 0 && <span className="text-muted-foreground font-mono text-[10px]">{duration}s</span>}
              </button>
            ))}
          </div>
        )}

        {tab === 'text' && (
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground px-1 pb-1 text-[11px]">Click to insert at the playhead on the text track.</p>
            {TEXT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => addTextTemplate(tpl)}
                className="hover:border-violet-500/50 hover:bg-violet-500/5 flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Type className="size-3.5" />
                  {tpl.name}
                </span>
                <span
                  className="truncate text-[13px] leading-tight"
                  style={{ color: tpl.color, fontWeight: tpl.fontSize >= 56 ? 700 : 500 }}
                >
                  {tpl.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Asset preview modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => setPreviewAsset(null)}
        >
          <div className="flex max-h-full max-w-2xl flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-xs text-white/80">
              <span className="truncate font-medium">{previewAsset.asset.name}</span>
              <button onClick={() => setPreviewAsset(null)} aria-label="Close preview" className="hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            {previewAsset.asset.type === 'audio' ? (
              <audio src={previewAsset.url} controls autoPlay className="w-full" />
            ) : previewAsset.asset.type === 'video' || previewAsset.asset.type === 'model' ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- raw asset preview, not content playback
              <video src={previewAsset.url} controls autoPlay className="max-h-[70vh] rounded-lg" />
            ) : (
              <img src={previewAsset.url} alt={previewAsset.asset.name} className="max-h-[70vh] rounded-lg object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function labelFor(type: TransitionType): string {
  return TRANSITIONS.find((t) => t.type === type)?.label ?? type
}

function MediaItem({
  asset,
  onAdd,
  onPreview,
  onDelete,
}: {
  asset: Asset
  onAdd: () => void
  onPreview: () => void
  onDelete: () => void
}) {
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  React.useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  return (
    <div
      className="group hover:border-violet-500/50 relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md"
      onDoubleClick={onAdd}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
      title={`${asset.name}\n${asset.width ? `${asset.width}×${asset.height}` : ''}${asset.duration ? ` · ${formatSeconds(asset.duration)}` : ''} — double-click or right-click to add`}
    >
      {asset.thumbnailUrl ? (
        <img src={asset.thumbnailUrl} alt={asset.name} className="aspect-video w-full object-cover" />
      ) : (
        <div className="bg-muted flex aspect-video w-full items-center justify-center">
          <AssetIcon type={asset.type} />
        </div>
      )}
      <div className="flex items-center gap-1 px-1.5 py-1">
        <AssetIcon type={asset.type} />
        <span className="truncate text-[11px]">{asset.name}</span>
      </div>
      <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon"
          className="bg-background/90 size-6"
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          title="Add to timeline"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y}>
          <ContextRow label="Add to timeline" onClick={onAdd} icon={<Plus className="size-3.5" />} />
          <ContextRow label="Preview" onClick={onPreview} icon={<Film className="size-3.5" />} />
          <div className="bg-border my-1 h-px" />
          <ContextRow
            label={confirmDelete ? 'Confirm delete?' : 'Delete'}
            destructive
            onClick={() => {
              if (confirmDelete) {
                onDelete()
              } else {
                setConfirmDelete(true)
                setTimeout(() => setConfirmDelete(false), 2000)
              }
            }}
            icon={<Trash2 className="size-3.5" />}
          />
        </ContextMenu>
      )}
    </div>
  )
}

function ContextMenu({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const clampedX = Math.min(x, window.innerWidth - 180)
  const clampedY = Math.min(y, window.innerHeight - 130)
  return (
    <div
      className="bg-card fixed z-50 flex w-44 flex-col gap-0.5 rounded-lg border p-1 shadow-xl"
      style={{ left: clampedX, top: clampedY }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function ContextRow({
  label,
  icon,
  onClick,
  destructive,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}
