import * as React from 'react'
import {
  Copy,
  Film,
  Image as ImageIcon,
  Info,
  Music2,
  Play,
  Plus,
  Presentation,
  Smile,
  Trash2,
  Video,
} from 'lucide-react'
import type { Asset } from '@/engine/types'
import { formatSeconds } from '@/engine/types'
import { cn } from '@/lib/utils'
import { ASSET_DRAG_MIME, beginAssetDrag, setDraggedAsset, clearDraggedAsset } from './dragState'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v >= 100 || u === 0 ? Math.round(v) : Number(v.toFixed(1))} ${units[u]}`
}

function getAssetMediaKind(type: Asset['type'], name?: string): 'video' | 'audio' | 'slide' | 'sticker' | 'image' {
  const n = (name ?? '').toLowerCase()
  if (n.includes('slide') || n.includes('deck') || n.includes('presentation')) return 'slide'
  if (n.includes('sticker') || n.includes('giphy')) return 'sticker'
  if (type === 'video') return 'video'
  if (type === 'audio') return 'audio'
  return 'image'
}

export function AssetIcon({
  type,
  name,
  className = 'size-6',
}: {
  type: Asset['type']
  name?: string
  className?: string
}) {
  const kind = getAssetMediaKind(type, name)
  if (kind === 'slide') return <Presentation className={cn(className, 'text-indigo-400')} />
  if (kind === 'sticker') return <Smile className={cn(className, 'text-amber-400')} />
  if (kind === 'video') return <Video className={cn(className, 'text-sky-400')} />
  if (kind === 'audio') return <Music2 className={cn(className, 'text-violet-400')} />
  return <ImageIcon className={cn(className, 'text-emerald-400')} />
}

function describeAsset(asset: Asset): string {
  const parts: string[] = []
  if (asset.width && asset.height) parts.push(`${asset.width}×${asset.height}`)
  if (asset.duration) parts.push(formatSeconds(asset.duration))
  parts.push(formatBytes(asset.size))
  if (asset.mime) parts.push(asset.mime)
  return parts.join(' · ')
}

interface MediaItemProps {
  asset: Asset
  view: 'grid' | 'list'
  generated?: boolean
  isSelected?: boolean
  onSelect?: () => void
  onAdd: () => void
  onPreview: () => void
  onDelete: () => void
  onDuplicate: () => void
}

export function MediaItem({
  asset,
  view,
  generated,
  isSelected,
  onSelect,
  onAdd,
  onPreview,
  onDelete,
  onDuplicate,
}: MediaItemProps) {
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [propsOpen, setPropsOpen] = React.useState(false)

  React.useEffect(() => {
    if (!menu && !propsOpen) return
    const closeMenu = () => setMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => window.removeEventListener('click', closeMenu)
  }, [menu, propsOpen])

  const startDrag = (e: React.DragEvent) => {
    setDraggedAsset(asset)
    e.dataTransfer.setData(ASSET_DRAG_MIME, asset.id)
    e.dataTransfer.setData('text/plain', asset.name)
    e.dataTransfer.effectAllowed = 'copy'
    beginAssetDrag(e.dataTransfer, asset)
  }

  const endDrag = () => clearDraggedAsset()

  const menuRows = (
    <>
      <ContextRow label="Preview" onClick={onPreview} icon={<Film className="size-3.5" />} />
      <ContextRow label="Add to Timeline" onClick={onAdd} icon={<Plus className="size-3.5" />} />
      <div className="bg-border my-1 h-px" />
      <ContextRow label="Duplicate" onClick={onDuplicate} icon={<Copy className="size-3.5" />} />
      <ContextRow label="Properties" onClick={() => setPropsOpen(true)} icon={<Info className="size-3.5" />} />
      <div className="bg-border my-1 h-px" />
      <ContextRow
        label={confirmDelete ? 'Confirm delete?' : 'Delete'}
        destructive
        onClick={() => {
          if (confirmDelete) {
            onDelete()
            setMenu(null)
          } else {
            setConfirmDelete(true)
            setTimeout(() => setConfirmDelete(false), 2000)
          }
        }}
        icon={<Trash2 className="size-3.5" />}
      />
    </>
  )

  if (view === 'list') {
    return (
      <div
        draggable
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onClick={onSelect || onPreview}
        onDoubleClick={onAdd}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        title={`${asset.name}\n${describeAsset(asset)}\n\nClick to preview · Double-click or drag to add`}
        data-testid="media-item"
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition-all active:cursor-grabbing',
          isSelected
            ? 'border-violet-500 bg-violet-500/15 ring-1 ring-violet-500/60'
            : 'bg-card hover:border-violet-500/50 hover:bg-muted/20',
        )}
      >
        {asset.thumbnailUrl ? (
          <img src={asset.thumbnailUrl} alt="" className="h-8 w-[52px] shrink-0 rounded object-cover" style={{ maxWidth: 52 }} width={52} height={32} />
        ) : (
          <div className="bg-muted flex h-8 w-[52px] shrink-0 items-center justify-center rounded">
            <AssetIcon type={asset.type} name={asset.name} className="size-4" />
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-[11px]" title={asset.name}>
          {generated && <span className="mr-1 rounded bg-violet-600/25 px-1 py-px align-middle text-[8px] font-bold tracking-wider text-violet-300">AI</span>}
          {asset.name}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-neutral-500">
          {asset.duration ? formatSeconds(asset.duration) : '—'} · {formatBytes(asset.size)}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-violet-600 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onPreview()
            }}
            title="Preview in Source Monitor"
          >
            <Play className="size-3 fill-current" />
          </button>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-violet-600 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onAdd()
            }}
            title="Add to timeline"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              'flex size-6 items-center justify-center rounded-md transition-colors',
              confirmDelete ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground hover:bg-destructive hover:text-white',
            )}
            onClick={(e) => {
              e.stopPropagation()
              if (confirmDelete) {
                onDelete()
              } else {
                setConfirmDelete(true)
                setTimeout(() => setConfirmDelete(false), 2000)
              }
            }}
            title={confirmDelete ? 'Click again to confirm delete' : 'Delete asset'}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        {menu && (
          <ContextMenu x={menu.x} y={menu.y}>{menuRows}</ContextMenu>
        )}
        {propsOpen && <PropertiesDialog asset={asset} onClose={() => setPropsOpen(false)} />}
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={startDrag}
      onDragEnd={endDrag}
      onClick={onSelect || onPreview}
      onDoubleClick={onAdd}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
      title={`${asset.name}\n${describeAsset(asset)}\n\nClick to preview · Double-click or drag to add`}
      data-testid="media-item"
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-all hover:shadow-md active:cursor-grabbing',
        isSelected
          ? 'border-violet-500 bg-violet-500/15 ring-2 ring-violet-500/60 shadow-sm'
          : 'bg-card hover:border-violet-500/50',
      )}
    >
      {/* Pure Media Preview */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/30 flex items-center justify-center">
        {asset.thumbnailUrl ? (
          <img src={asset.thumbnailUrl} alt={asset.name} className="h-full w-full object-cover transition group-hover:scale-105 duration-200" width={120} height={80} />
        ) : (
          <div className="bg-muted/40 flex h-full w-full items-center justify-center p-2">
            <AssetIcon type={asset.type} name={asset.name} className="size-8" />
          </div>
        )}
        {asset.duration != null && (
          <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 py-0.2 font-mono text-[9px] text-white">
            {formatSeconds(asset.duration)}
          </span>
        )}
        {generated && (
          <span className="absolute top-1 left-1 rounded bg-violet-600 px-1 py-px text-[8px] font-bold tracking-wider text-white">AI</span>
        )}
        <div className="absolute top-1 right-1 flex items-center gap-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-violet-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onPreview()
            }}
            title="Preview in Source Monitor"
          >
            <Play className="size-3 fill-current" />
          </button>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-md bg-black/75 text-white shadow hover:bg-violet-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onAdd()
            }}
            title="Add to timeline"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              'flex size-6 items-center justify-center rounded-md shadow transition-colors',
              confirmDelete ? 'bg-destructive text-white' : 'bg-black/75 text-white hover:bg-destructive',
            )}
            onClick={(e) => {
              e.stopPropagation()
              if (confirmDelete) {
                onDelete()
              } else {
                setConfirmDelete(true)
                setTimeout(() => setConfirmDelete(false), 2000)
              }
            }}
            title={confirmDelete ? 'Click again to confirm delete' : 'Delete asset'}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y}>{menuRows}</ContextMenu>
      )}
      {propsOpen && <PropertiesDialog asset={asset} onClose={() => setPropsOpen(false)} />}
    </div>
  )
}

function ContextMenu({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const clampedX = Math.min(x, window.innerWidth - 190)
  const clampedY = Math.min(y, window.innerHeight - 220)
  return (
    <div
      data-testid="media-context-menu"
      className="bg-card fixed z-50 flex w-48 flex-col gap-0.5 rounded-lg border p-1 shadow-xl"
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

function PropertiesDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ['Name', asset.name],
    ['Type', asset.type],
    [
      'Resolution',
      asset.width && asset.height ? `${asset.width}×${asset.height}` : '—',
    ],
    ['Duration', asset.duration != null ? formatSeconds(asset.duration) : '—'],
    ['Size', formatBytes(asset.size)],
    ['MIME', asset.mime || '—'],
    ['Added', new Date(asset.importedAt ?? Date.now()).toLocaleString()],
    ['Storage', 'OPFS (Origin Private File System)'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-700 bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold">Asset properties</h3>
        <dl className="space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="shrink-0 text-neutral-500">{k}</dt>
              <dd className="truncate text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <button
          className="mt-4 w-full rounded-lg border border-neutral-700 py-1.5 text-xs hover:bg-muted"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
