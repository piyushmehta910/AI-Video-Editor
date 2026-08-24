import * as React from 'react'
import {
  Box,
  Film,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Mic,
  Search,
  Sparkles,
  Square,
  Video,
  X,
  Check,
  Globe,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore, type MediaFilter, type MediaSort, type GeneratedSubTab } from '@/stores/editorStore'
import type { Asset } from '@/engine/types'
import { getMediaUrl } from '@/engine/storage/opfs'
import { useMediaImport } from '@/hooks/useMediaImport'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/onboarding/EmptyState'
import { cn } from '@/lib/utils'
import { DragPreviewLayer } from './DragPreview'
import { applyAssetDropRules } from './afterAdd'
import { isGenerated, generatedCategory, isRecording } from './generatedAssets'
import { ImportButton } from './ImportButton'
import { MediaItem } from './MediaItem'
import { MediaSourcePreview } from './MediaSourcePreview'
import { OnlineAssetSearch } from './OnlineAssetSearch'

const TABS: { value: 'media' | 'generated' | 'online' | 'recordings'; label: string; icon: React.ReactNode }[] = [
  { value: 'media', label: 'Media', icon: <FolderOpen className="size-3.5" /> },
  { value: 'generated', label: 'AI Gen', icon: <Sparkles className="size-3.5" /> },
  { value: 'online', label: 'Online API', icon: <Globe className="size-3.5" /> },
  { value: 'recordings', label: 'Record', icon: <Video className="size-3.5" /> },
]

const FILTERS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Images' },
  { value: 'model', label: '3D Models' },
]

const SORTS: { value: MediaSort; label: string }[] = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'duration', label: 'Duration' },
  { value: 'type', label: 'Type' },
]

const GENERATED_SUBTABS: { value: GeneratedSubTab; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Sparkles className="size-3" /> },
  { value: 'avatars', label: 'Avatars', icon: <Film className="size-3" /> },
  { value: 'voice', label: 'Voice / TTS', icon: <Mic className="size-3" /> },
  { value: 'animations', label: 'Slides & FX', icon: <Sparkles className="size-3" /> },
  { value: 'images', label: 'Images', icon: <ImageIcon className="size-3" /> },
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
  const filter = useEditorStore((s) => s.mediaFilter)
  const setFilter = useEditorStore((s) => s.setMediaFilter)
  const sort = useEditorStore((s) => s.mediaSort)
  const setSort = useEditorStore((s) => s.setMediaSort)
  const genSubTab = useEditorStore((s) => s.generatedSubTab)
  const setGenSubTab = useEditorStore((s) => s.setGeneratedSubTab)
  const linkAudio = useEditorStore((s) => s.linkAudio)
  const toggleLinkAudio = useEditorStore((s) => s.toggleLinkAudio)

  const { jobs, importing, recording, recordingStream, importFiles, startRecording, stopRecording } =
    useMediaImport()

  const [dragOver, setDragOver] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [previewAsset, setPreviewAsset] = React.useState<{ asset: Asset; url: string } | null>(null)
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null)
  const recordVideoRef = React.useRef<HTMLVideoElement>(null)

  const selectedAsset = React.useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  )

  // Live preview of an in-progress recording.
  React.useEffect(() => {
    if (recordVideoRef.current && recordingStream) {
      recordVideoRef.current.srcObject = recordingStream
    }
  }, [recordingStream])

  // Count metrics for filters and tabs
  const tabCounts = React.useMemo(() => {
    const rawMedia = assets.filter((a) => !isGenerated(a) && !isRecording(a))
    const generated = assets.filter((a) => isGenerated(a))
    const recordings = assets.filter((a) => isRecording(a))
    return {
      media: rawMedia.length,
      generated: generated.length,
      recordings: recordings.length,
    }
  }, [assets])

  const filterCounts = React.useMemo(() => {
    const baseList =
      tab === 'generated'
        ? assets.filter(isGenerated)
        : tab === 'recordings'
          ? assets.filter(isRecording)
          : assets.filter((a) => !isGenerated(a) && !isRecording(a))

    return {
      all: baseList.length,
      video: baseList.filter((a) => a.type === 'video').length,
      audio: baseList.filter((a) => a.type === 'audio').length,
      image: baseList.filter((a) => a.type === 'image').length,
      model: baseList.filter((a) => a.type === 'model').length,
    }
  }, [assets, tab])

  const visibleAssets = React.useMemo(() => {
    let list = assets
    if (tab === 'generated') {
      list = list.filter(isGenerated)
      if (genSubTab !== 'all') list = list.filter((a) => generatedCategory(a) === genSubTab)
    } else if (tab === 'recordings') {
      list = list.filter(isRecording)
      if (filter === 'video') list = list.filter((a) => a.type === 'video')
      else if (filter === 'audio') list = list.filter((a) => a.type === 'audio')
    } else {
      // Default: 'media' tab (raw uploaded assets)
      list = list.filter((a) => !isGenerated(a) && !isRecording(a))
      if (filter === 'video') list = list.filter((a) => a.type === 'video')
      else if (filter === 'audio') list = list.filter((a) => a.type === 'audio')
      else if (filter === 'image') list = list.filter((a) => a.type === 'image')
      else if (filter === 'model') list = list.filter((a) => a.type === 'model')
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
  }, [assets, tab, filter, genSubTab, search, sort])

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

      {/* ── 1. Header & Tabs ── */}
      <div className="shrink-0 border-b border-border/80 bg-card/60 p-2 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground">Media Library</span>
            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.2 text-[10px] font-mono font-semibold text-violet-600 dark:text-violet-400">
              {assets.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <ImportButton onFiles={(f) => void handleFiles(f)} onRecord={(k) => void startRecording(k)} busy={importing} />
          </div>
        </div>

        {/* Tab Switcher: Project Media | AI Generated | Online API Search | Recordings */}
        <div className="grid grid-cols-4 gap-0.5 rounded-lg border bg-muted/30 p-0.5">
          {TABS.map(({ value, label, icon }) => {
            const count = tabCounts[value as keyof typeof tabCounts] ?? 0
            const active = tab === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  'flex items-center justify-center gap-1 rounded-md py-1 text-[10px] font-semibold transition',
                  active
                    ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {icon}
                <span className="truncate">{label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1 text-[8px] font-mono',
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
          {/* ── 2. Search, Filter Chips & Sort Controls ── */}
          <div className="shrink-0 border-b border-border/60 bg-card/30 p-2 space-y-1.5">
        {/* Search Bar + Grid/List View */}
        <div className="flex items-center gap-1.5">
          <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-background px-2 text-xs">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab === 'generated' ? 'AI assets' : tab === 'recordings' ? 'recordings' : 'media'}…`}
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

        {/* Filter Pills & Sort Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
          {tab === 'generated' ? (
            <div className="flex flex-wrap items-center gap-1">
              {GENERATED_SUBTABS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setGenSubTab(s.value)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition',
                    genSubTab === s.value
                      ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-xs'
                      : 'border-border/60 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                  )}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {FILTERS.map((f) => {
                const count = filterCounts[f.value as keyof typeof filterCounts] ?? 0
                if (count === 0 && f.value !== 'all') return null
                return (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    data-testid={`filter-${f.value}`}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition flex items-center gap-1',
                      filter === f.value
                        ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-xs'
                        : 'border-border/60 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                    )}
                  >
                    <span>{f.label}</span>
                    {count > 0 && <span className="font-mono text-[9px] opacity-80">({count})</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <span className="font-medium">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as MediaSort)}
              className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] outline-none text-foreground"
              data-testid="media-sort"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
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

        {/* Recording bar + live preview */}
        {recording && (
          <div className="mb-2 rounded-lg border border-red-500/50 bg-red-500/10 p-2" data-testid="recording-bar">
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-300">
                Recording {recording === 'screen' ? 'screen' : 'webcam'}…
              </span>
              <Button variant="secondary" size="sm" className="ml-auto h-6 gap-1 px-2 text-[11px]" onClick={stopRecording} data-testid="stop-recording-button">
                <Square className="size-3" /> Stop
              </Button>
            </div>
            {recordingStream && (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- live recording monitor
              <video ref={recordVideoRef} autoPlay muted playsInline className="mt-2 max-h-32 w-full rounded-md object-cover" />
            )}
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

        {/* Clean Empty States */}
        {visibleAssets.length === 0 && tab === 'media' && (
          <EmptyState onImport={() => document.querySelector<HTMLInputElement>('[data-testid="import-button"]')?.click()} />
        )}
        {visibleAssets.length === 0 && tab === 'generated' && (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-xl border border-violet-500/20 text-violet-400">
              <Sparkles className="size-6" />
            </div>
            <h4 className="text-xs font-semibold text-foreground">No AI Assets Generated Yet</h4>
            <p className="text-muted-foreground text-[11px] leading-relaxed max-w-[200px]">
              Clips generated from Avatar Generator, Slides, TTS, and 3D Studio land here automatically.
            </p>
          </div>
        )}
        {visibleAssets.length === 0 && tab === 'recordings' && (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-xl border border-red-500/20 text-red-400">
              <Video className="size-6" />
            </div>
            <h4 className="text-xs font-semibold text-foreground">No Recordings Yet</h4>
            <p className="text-muted-foreground text-[11px] leading-relaxed max-w-[200px]">
              Use the Import button at top to record screen, webcam, or microphone.
            </p>
            <div className="flex gap-1.5 pt-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void startRecording('screen')}>
                Record Screen
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void startRecording('webcam')}>
                Record Webcam
              </Button>
            </div>
          </div>
        )}

        {/* Asset Grid / List */}
        {view === 'grid' ? (
          <div className="grid grid-cols-2 gap-2" data-testid="media-grid">
            {visibleAssets.map((asset) => (
              <MediaItem
                key={asset.id}
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
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1" data-testid="media-list">
            {visibleAssets.map((asset) => (
              <MediaItem
                key={asset.id}
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
            ))}
          </div>
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
            ) : previewAsset.asset.type === 'model' ? (
              <ModelPlaceholder name={previewAsset.asset.name} />
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

function ModelPlaceholder({ name }: { name: string }) {
  return (
    <div className="bg-muted flex aspect-video w-[480px] max-w-full flex-col items-center justify-center gap-2 rounded-lg">
      <Box className="text-muted-foreground size-10" />
      <p className="text-muted-foreground text-xs">3D model loaded: {name}</p>
    </div>
  )
}
