import * as React from 'react'
import {
  FolderOpen,
  FolderUp,
  LayoutGrid,
  List,
  LoaderCircle,
  Search,
  Sparkles,
  Square,
  Video,
  X,
  Check,
  Globe,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import type { Asset } from '@/engine/types'
import { getMediaUrl } from '@/engine/storage/opfs'
import { useMediaImport } from '@/hooks/useMediaImport'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VirtualList } from '@/components/common/VirtualList'
import { DragPreviewLayer } from './DragPreview'
import { applyAssetDropRules } from './afterAdd'
import { isGenerated, generatedCategory } from './generatedAssets'
import { MediaItem } from './MediaItem'
import { MediaSourcePreview } from './MediaSourcePreview'
import { OnlineAssetSearch } from './OnlineAssetSearch'

const ACCEPTED =
  '.mp4,.webm,.mov,.avi,.m4v,.mkv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.aac,.ogg,.m4a,video/*,audio/*,image/*'

const TABS: { value: 'media' | 'online'; label: string; icon: React.ReactNode }[] = [
  { value: 'media', label: 'Project Media', icon: <FolderOpen className="size-3.5" /> },
  { value: 'online', label: 'Stock Search', icon: <Globe className="size-3.5" /> },
]

export function MediaBin() {
  const assets = useTimelineStore((s) => s.assets)
  const deleteAsset = useTimelineStore((s) => s.deleteAsset)
  const addAssetToTimeline = useTimelineStore((s) => s.addAssetToTimeline)

  const tab = useEditorStore((s) => s.mediaTab)
  const setTab = useEditorStore((s) => s.setMediaTab)
  const search = useEditorStore((s) => s.mediaSearch)
  const setSearch = useEditorStore((s) => s.setMediaSearch)
  const view = useEditorStore((s) => s.mediaView)
  const setView = useEditorStore((s) => s.setMediaView)
  const sort = useEditorStore((s) => s.mediaSort)
  const genSubTab = useEditorStore((s) => s.generatedSubTab)
  const linkAudio = useEditorStore((s) => s.linkAudio)
  const toggleLinkAudio = useEditorStore((s) => s.toggleLinkAudio)

  const { jobs, importing, recording, recordingStream, importFiles, startRecording, stopRecording, cancelRecording } =
    useMediaImport()

  const [dragOver, setDragOver] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [previewAsset, setPreviewAsset] = React.useState<{ asset: Asset; url: string } | null>(null)
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null)
  const recordVideoRef = React.useRef<HTMLVideoElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [recordSeconds, setRecordSeconds] = React.useState(0)

  // Recording timer
  React.useEffect(() => {
    if (!recording) {
      setRecordSeconds(0)
      return
    }
    const timer = window.setInterval(() => {
      setRecordSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const selectedAsset = React.useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  )

  // Live preview of an in-progress recording.
  React.useEffect(() => {
    if (recordVideoRef.current && recordingStream) {
      recordVideoRef.current.srcObject = recordingStream
    }
  }, [recordingStream, recording])

  // Release camera / stop recording when switching tabs or unmounting
  React.useEffect(() => {
    if (tab !== 'media' && recording) {
      cancelRecording()
    }
  }, [tab, recording, cancelRecording])

  React.useEffect(() => {
    return () => {
      cancelRecording()
    }
  }, [cancelRecording])

  // Count metrics for filters and tabs
  const tabCounts = React.useMemo(() => {
    const rawMedia = assets.filter((a) => !isGenerated(a))
    const generated = assets.filter((a) => isGenerated(a))
    return {
      media: rawMedia.length,
      generated: generated.length,
      online: 0,
    }
  }, [assets])

  const visibleAssets = React.useMemo(() => {
    let list = assets
    if (tab === 'generated') {
      list = list.filter(isGenerated)
      if (genSubTab !== 'all') list = list.filter((a) => generatedCategory(a) === genSubTab)
    } else {
      // Default: 'media' tab (raw uploaded + recorded assets)
      list = list.filter((a) => !isGenerated(a))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.name.toLowerCase().includes(q))
    }

    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'duration':
          return (b.duration ?? 0) - (a.duration ?? 0)
        case 'type':
          return a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
        default:
          return (b.importedAt ?? 0) - (a.importedAt ?? 0)
      }
    })
    return sorted
  }, [assets, tab, genSubTab, search, sort])

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length) return
    await importFiles(files)
  }

  const duplicateAsset = async (asset: Asset) => {
    try {
      const url = await getMediaUrl(asset.filePath)
      const blob = await (await fetch(url)).blob()
      const ext = asset.name.match(/\.[^.]+$/)?.[0] ?? ''
      const copy = new File([blob], `${asset.name} (copy)${ext}`, { type: asset.mime })
      void importFiles([copy])
      setNotice({ kind: 'ok', text: `Duplicating ${asset.name}…` })
    } catch {
      setNotice({ kind: 'error', text: `Could not duplicate ${asset.name}` })
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

  /** Add honoring the image→5s rule and link-audio auto-fit. */
  const quickAdd = (asset: Asset) => {
    const clip = addAssetToTimeline(asset.id)
    if (clip) applyAssetDropRules(clip, asset)
  }

  return (
    <div className="flex h-full w-full flex-col bg-card/40 select-none" data-testid="media-bin">
      <DragPreviewLayer />

      {/* ── 1. Top Buttons & Tabs ── */}
      <div className="shrink-0 border-b border-border/80 bg-card/60 p-2 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {/* Top Two Buttons: Import and Record Video */}
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 gap-1.5 text-xs font-semibold hover:bg-violet-500/10 hover:border-violet-500/50 hover:text-violet-600 dark:hover:text-violet-300 transition"
            data-testid="import-button"
          >
            {importing ? <LoaderCircle className="size-3.5 animate-spin text-violet-500" /> : <FolderUp className="size-3.5 text-violet-500" />}
            Import
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={recording !== null}
            onClick={() => void startRecording('webcam')}
            className={cn(
              'h-8 gap-1.5 text-xs font-semibold transition',
              recording === 'webcam'
                ? 'border-red-500 bg-red-500/15 text-red-500 animate-pulse'
                : 'hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500',
            )}
            data-testid="record-video-button"
          >
            <Video className="size-3.5 text-red-500" />
            Record Video
          </Button>
        </div>

        {/* Tab Switcher: Project Media | Stock Search */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/30 p-0.5">
          {TABS.map(({ value, label, icon }) => {
            const count = tabCounts[value as keyof typeof tabCounts] ?? 0
            const active = (tab === 'online' ? 'online' : 'media') === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold transition',
                  active
                    ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {icon}
                <span className="truncate">{label}</span>
                {value === 'media' && count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[9px] font-mono',
                      active ? 'bg-violet-500/20 text-violet-400' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'online' ? (
        <OnlineAssetSearch />
      ) : (
        <>
          {/* ── 2. Search, Browse Files & Filter Chips (No Sort) ── */}
          <div className="shrink-0 border-b border-border/60 bg-card/30 p-2 space-y-1.5">
            {/* Search Bar + Grid/List View */}
            <div className="flex items-center gap-1.5">
              <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-background px-2 text-xs">
                <Search className="size-3.5 text-muted-foreground shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search media…"
                  data-testid="media-search"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70 text-foreground"
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="flex overflow-hidden rounded-md border bg-muted/30 p-0.5">
                <button
                  onClick={() => setView('grid')}
                  title="Grid view"
                  aria-label="Grid view"
                  className={cn('p-1 rounded transition', view === 'grid' ? 'bg-card text-violet-400 shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                >
                  <LayoutGrid className="size-3.5" />
                </button>
                <button
                  onClick={() => setView('list')}
                  title="List view"
                  aria-label="List view"
                  data-testid="list-view-button"
                  className={cn('p-1 rounded transition', view === 'list' ? 'bg-card text-violet-400 shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                >
                  <List className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Browse Files Button / Quick Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/80 bg-muted/20 py-1.5 text-xs font-medium text-muted-foreground hover:border-violet-500/60 hover:bg-violet-500/5 hover:text-violet-600 dark:hover:text-violet-300 transition"
              data-testid="browse-files-button"
            >
              <FolderOpen className="size-3.5 text-violet-500" />
              <span>Browse Files</span>
            </button>
          </div>

          {/* ── 3. Asset Cards & Workspace Content ── */}
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

            {/* Recording bar + live webcam preview */}
            {recording && (
              <div className="mb-3 rounded-xl border border-red-500/50 bg-red-950/25 p-2.5 shadow-md" data-testid="recording-bar">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                    </span>
                    <span className="text-xs font-semibold text-red-300">
                      Recording {recording === 'screen' ? 'Screen' : 'Webcam'}
                    </span>
                    <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                      {formatTimer(recordSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-white"
                      onClick={cancelRecording}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 gap-1 px-2.5 text-[11px] font-bold shadow-xs bg-red-600 hover:bg-red-500"
                      onClick={stopRecording}
                      data-testid="stop-recording-button"
                    >
                      <Square className="size-3 fill-white" /> Stop & Save
                    </Button>
                  </div>
                </div>
                {/* Live Video Preview Stream */}
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/90 border border-red-500/30">
                  <video
                    ref={recordVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="size-full object-cover"
                  />
                  <div className="absolute bottom-1.5 left-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-xs">
                    <Video className="size-2.5 text-red-400" />
                    <span>Live Camera Feed</span>
                  </div>
                </div>
              </div>
            )}

        {/* Import progress */}
        {jobs.length > 0 && (
          <div className="mb-2 space-y-1" data-testid="import-progress">
            {jobs.map((job) =>
              job.progress < 0 ? (
                <div
                  key={job.id}
                  className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
                >
                  <span className="font-medium">{job.name}</span> — {job.stage}
                </div>
              ) : (
                <div
                  key={job.id}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-[11px]',
                    job.progress < 100 ? 'border-violet-500/40 bg-violet-500/5' : 'border-emerald-500/40 bg-emerald-500/10',
                  )}
                >
                  <div className="flex justify-between gap-2">
                    <span className="truncate">
                      {job.progress < 100 ? `Processing ${job.name}… ${Math.round(job.progress)}%` : `${job.name} — Done`}
                    </span>
                    <span className="shrink-0 font-mono">
                      {job.progress >= 100 ? <Check className="size-3 text-emerald-500 inline" /> : `${Math.round(job.progress)}%`}
                    </span>
                  </div>
                  {job.progress < 100 && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-800">
                      <div className="h-full rounded-full bg-violet-500 transition-[width]" style={{ width: `${job.progress}%` }} />
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        )}

        {dragOver && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-violet-500 bg-violet-500/10">
            <p className="text-sm font-medium">Drop files to import</p>
          </div>
        )}

        {/* Embedded Source Monitor / Media Preview in Left Panel */}
        {selectedAsset && (
          <div className="mb-2.5 shrink-0 animate-in fade-in duration-200">
            <MediaSourcePreview
              asset={selectedAsset}
              onClose={() => setSelectedAssetId(null)}
              onAddToTimeline={quickAdd}
              onPopout={(a) => void openPreview(a)}
            />
          </div>
        )}


        {visibleAssets.length === 0 && tab === 'generated' && (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-xl border border-violet-500/20 text-violet-400">
              <Sparkles className="size-6" />
            </div>
          </div>
        )}

        {/* Asset Grid / List — virtualized so 500+ assets don't kill the DOM */}
        {view === 'grid' ? (
          <VirtualList
            items={visibleAssets}
            itemHeight={140}
            itemKey={(a) => a.id}
            className="relative"
            innerClassName="grid grid-cols-2 gap-2 px-0"
            emptyState={null}
            renderItem={(asset) => (
              <MediaItem
                asset={asset}
                view="grid"
                generated={tab === 'generated' || isGenerated(asset)}
                isSelected={selectedAssetId === asset.id}
                onSelect={() => setSelectedAssetId(asset.id)}
                onAdd={() => quickAdd(asset)}
                onPreview={() => setSelectedAssetId(asset.id)}
                onDelete={() => {
                  if (selectedAssetId === asset.id) setSelectedAssetId(null)
                  void deleteAsset(asset.id)
                }}
                onDuplicate={() => void duplicateAsset(asset)}
              />
            )}
          />
        ) : (
          <VirtualList
            items={visibleAssets}
            itemHeight={56}
            itemKey={(a) => a.id}
            className="relative"
            innerClassName="flex flex-col gap-1"
            emptyState={null}
            renderItem={(asset) => (
              <MediaItem
                asset={asset}
                view="list"
                generated={tab === 'generated' || isGenerated(asset)}
                isSelected={selectedAssetId === asset.id}
                onSelect={() => setSelectedAssetId(asset.id)}
                onAdd={() => quickAdd(asset)}
                onPreview={() => setSelectedAssetId(asset.id)}
                onDelete={() => {
                  if (selectedAssetId === asset.id) setSelectedAssetId(null)
                  void deleteAsset(asset.id)
                }}
                onDuplicate={() => void duplicateAsset(asset)}
              />
            )}
          />
        )}
      </div>

      {/* ── 4. Link Audio Toggle Footer ── */}
      {tab === 'media' && (
        <div className="flex shrink-0 items-center justify-between border-t border-border/80 bg-card/60 px-3 py-2">
          <span className="text-[11px] text-muted-foreground" title="When enabled, dropped or added audio clips are trimmed to match the video underneath them">
            Link audio to video duration
          </span>
          <button
            role="switch"
            aria-checked={linkAudio}
            data-testid="link-audio-toggle"
            onClick={toggleLinkAudio}
            className={cn(
              'relative h-4 w-7 rounded-full transition-colors',
              linkAudio ? 'bg-violet-600' : 'bg-muted-foreground/30',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-3 rounded-full bg-white transition-all',
                linkAudio ? 'left-3.5' : 'left-0.5',
              )}
            />
          </button>
        </div>
      )}
      </>
      )}

      {/* ── 5. Fullscreen Popout Preview Modal ── */}
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
            ) : previewAsset.asset.type === 'video' ? (
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
