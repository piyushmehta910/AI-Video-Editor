import * as React from 'react'
import {
  Box,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Mic,
  Plus,
  Search,
  Sparkles,
  Square,
  Type,
  X,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore, type MediaFilter, type MediaSort, type GeneratedSubTab } from '@/stores/editorStore'
import type { Asset, TransitionType } from '@/engine/types'
import { getMediaUrl } from '@/engine/storage/opfs'
import { useMediaImport } from '@/hooks/useMediaImport'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/onboarding/EmptyState'
import { cn } from '@/lib/utils'
import { DragPreviewLayer } from './DragPreview'
import { applyAssetDropRules } from './afterAdd'
import { isGenerated, generatedCategory } from './generatedAssets'
import { ImportButton } from './ImportButton'
import { MediaItem } from './MediaItem'

const TABS: { value: 'media' | 'generated' | 'transitions' | 'text'; label: string }[] = [
  { value: 'media', label: 'Media' },
  { value: 'generated', label: 'Generated' },
  { value: 'transitions', label: 'Transitions' },
  { value: 'text', label: 'Text' },
]

const FILTERS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Images' },
  { value: 'generated', label: 'Generated' },
]

const SORTS: { value: MediaSort; label: string }[] = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'name', label: 'Name' },
  { value: 'duration', label: 'Duration' },
  { value: 'type', label: 'Type' },
]

const GENERATED_SUBTABS: { value: GeneratedSubTab; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Sparkles className="size-3" /> },
  { value: 'images', label: 'Images', icon: <ImageIcon className="size-3" /> },
  { value: 'voice', label: 'Voice', icon: <Mic className="size-3" /> },
  { value: 'avatars', label: 'Avatars', icon: <Film className="size-3" /> },
  { value: 'animations', label: 'Animations', icon: <Sparkles className="size-3" /> },
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

export function MediaBin() {
  const assets = useTimelineStore((s) => s.assets)
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
  const recordVideoRef = React.useRef<HTMLVideoElement>(null)

  // Live preview of an in-progress recording.
  React.useEffect(() => {
    if (recordVideoRef.current && recordingStream) {
      recordVideoRef.current.srcObject = recordingStream
    }
  }, [recordingStream])

  const visibleAssets = React.useMemo(() => {
    let list = assets
    if (tab === 'generated') {
      list = list.filter(isGenerated)
      if (genSubTab !== 'all') list = list.filter((a) => generatedCategory(a) === genSubTab)
    } else if (tab === 'media') {
      list = list.filter((a) => !isGenerated(a))
      if (filter === 'video') list = list.filter((a) => a.type === 'video')
      else if (filter === 'audio') list = list.filter((a) => a.type === 'audio')
      else if (filter === 'image') list = list.filter((a) => a.type === 'image')
      else if (filter === 'generated') list = list.filter(isGenerated)
    }
    list = list.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
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

  /** Add honoring the image→5s rule and link-audio auto-fit. */
  const quickAdd = (asset: Asset) => {
    const clip = addAssetToTimeline(asset.id)
    if (clip) applyAssetDropRules(clip, asset)
  }

  return (
    <div className="flex h-full w-full flex-col bg-muted/30" data-testid="media-bin">
      <DragPreviewLayer />

      {/* Search + view toggle */}
      <div className="shrink-0 border-b px-2 py-2">
        <div className="flex items-center gap-1.5">
          <div className="bg-muted/60 flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2">
            <Search className="text-muted-foreground size-3.5 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library…"
              data-testid="media-search"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex overflow-hidden rounded-md border">
            <button
              onClick={() => setView('grid')}
              title="Grid view"
              aria-label="Grid view"
              className={cn('p-1.5', view === 'grid' ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:text-foreground')}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              title="List view"
              aria-label="List view"
              data-testid="list-view-button"
              className={cn('p-1.5', view === 'list' ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:text-foreground')}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + import */}
      <div className="flex shrink-0 items-center gap-0.5 border-b px-1.5 py-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              tab === value ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto">
          <ImportButton onFiles={(f) => void handleFiles(f)} onRecord={(k) => void startRecording(k)} busy={importing} />
        </div>
      </div>

      {/* Filters / sort / generated sub-tabs */}
      {(tab === 'media' || tab === 'generated') && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b px-2 py-1.5">
          {tab === 'media' ? (
            <>
              <div className="flex flex-wrap items-center gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    data-testid={`filter-${f.value}`}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      filter === f.value
                        ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                        : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <label className="ml-auto flex items-center gap-1 text-[10px] text-neutral-500">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as MediaSort)}
                  className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-[10px]"
                  data-testid="media-sort"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {GENERATED_SUBTABS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setGenSubTab(s.value)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                    genSubTab === s.value
                      ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200',
                  )}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
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
                    <span className="shrink-0 font-mono">{job.progress >= 100 ? '✓' : `${Math.round(job.progress)}%`}</span>
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
            <p className="text-sm font-medium">Drop to import</p>
          </div>
        )}

        {(tab === 'media' || tab === 'generated') && (
          <>
            {visibleAssets.length === 0 && tab === 'media' && <EmptyState onImport={() => document.querySelector<HTMLInputElement>('[data-testid="import-button"]')?.click()} />}
            {visibleAssets.length === 0 && tab === 'generated' && (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
                  <Plus className="text-muted-foreground size-6" />
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">AI-generated results land here automatically.</p>
              </div>
            )}
            {view === 'grid' ? (
              <div className="grid grid-cols-2 gap-2" data-testid="media-grid">
                {visibleAssets.map((asset) => (
                  <MediaItem
                    key={asset.id}
                    asset={asset}
                    view="grid"
                    generated={tab === 'generated' || isGenerated(asset)}
                    onAdd={() => quickAdd(asset)}
                    onPreview={() => void openPreview(asset)}
                    onDelete={() => void deleteAsset(asset.id)}
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
                    onAdd={() => quickAdd(asset)}
                    onPreview={() => void openPreview(asset)}
                    onDelete={() => void deleteAsset(asset.id)}
                    onDuplicate={() => void duplicateAsset(asset)}
                  />
                ))}
              </div>
            )}
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

      {/* Link audio toggle footer */}
      {tab === 'media' && (
        <div className="flex shrink-0 items-center justify-between border-t px-2 py-1.5">
          <span className="text-[10px] text-neutral-500" title="When enabled, dropped or added audio clips are trimmed to match the video underneath them">
            Link audio to video
          </span>
          <button
            role="switch"
            aria-checked={linkAudio}
            data-testid="link-audio-toggle"
            onClick={toggleLinkAudio}
            className={cn(
              'relative h-4 w-7 rounded-full transition-colors',
              linkAudio ? 'bg-violet-600' : 'bg-neutral-700',
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
      <p className="text-muted-foreground text-xs">3D model loaded in viewport: {name}</p>
    </div>
  )
}

function labelFor(type: TransitionType): string {
  return TRANSITIONS.find((t) => t.type === type)?.label ?? type
}
