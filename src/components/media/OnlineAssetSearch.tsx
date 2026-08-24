import * as React from 'react'
import {
  Search,
  Loader2,
  Download,
  Plus,
  Play,
  Pause,
  Image as ImageIcon,
  Music,
  Box,
  Smile,
  Sparkles,
  Check,
  AlertCircle,
  X,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { searchStockImages, downloadStockImage, type StockImageResult } from '@/api/stock/search'
import { searchMusic, type MusicTrackResult } from '@/api/music/search'
import { searchModels, downloadModelAsGlb, type PolyHavenModel } from '@/api/models/polyhaven'
import { searchGiphy, downloadGiphy, type StickerResult } from '@/api/stickers/search'
import { convertStickerGif } from '@/engine/stickers/gifToVideo'
import { needsProxy, proxyFetch } from '@/api/proxy'

type OnlineCategory = 'all' | 'images' | 'music' | '3d' | 'stickers'

interface SearchResultItem {
  id: string
  type: 'image' | 'music' | 'model' | 'sticker'
  title: string
  subtitle?: string
  previewUrl?: string
  thumbnailUrl?: string
  source: string
  originalData: StockImageResult | MusicTrackResult | PolyHavenModel | StickerResult
}

export function OnlineAssetSearch() {
  const addAssetToTimeline = useTimelineStore((s) => s.addAssetToTimeline)
  const importFiles = useTimelineStore((s) => s.importFiles)

  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState<OnlineCategory>('all')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<SearchResultItem[]>([])
  const [activeAudioUrl, setActiveAudioUrl] = React.useState<string | null>(null)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const handleSearch = React.useCallback(async (searchQuery: string, cat: OnlineCategory) => {
    const q = searchQuery.trim()
    if (!q) {
      setResults([])
      return
    }

    setLoading(true)
    setNotice(null)
    const combined: SearchResultItem[] = []

    try {
      const promises: Promise<void>[] = []

      // 1. Stock Images
      if (cat === 'all' || cat === 'images') {
        promises.push(
          searchStockImages(q, { maxResults: cat === 'images' ? 16 : 8 })
            .then((imgs) => {
              for (const img of imgs) {
                combined.push({
                  id: `img-${img.id}`,
                  type: 'image',
                  title: `Photo by ${img.author || 'Creator'}`,
                  subtitle: img.source,
                  thumbnailUrl: img.thumb || img.full,
                  previewUrl: img.full,
                  source: img.source,
                  originalData: img,
                })
              }
            })
            .catch(() => {}),
        )
      }

      // 2. Music & Audio
      if (cat === 'all' || cat === 'music') {
        promises.push(
          searchMusic(q, { maxResults: cat === 'music' ? 12 : 6 })
            .then((tracks) => {
              for (const tr of tracks) {
                combined.push({
                  id: `music-${tr.id}`,
                  type: 'music',
                  title: tr.title,
                  subtitle: `${tr.artist} · ${Math.round(tr.duration)}s`,
                  previewUrl: tr.previewUrl,
                  source: tr.source,
                  originalData: tr,
                })
              }
            })
            .catch(() => {}),
        )
      }

      // 3. 3D GLB Models (Poly Haven CC0)
      if (cat === 'all' || cat === '3d') {
        promises.push(
          searchModels(q, { maxResults: cat === '3d' ? 12 : 6 })
            .then((models) => {
              for (const mod of models) {
                combined.push({
                  id: `model-${mod.id}`,
                  type: 'model',
                  title: mod.name || mod.id,
                  subtitle: `Poly Haven · ${mod.polycount ? `${Math.round(mod.polycount / 1000)}k polys` : '3D Model'}`,
                  thumbnailUrl: `https://cdn.polyhaven.org/asset_img/primary/${encodeURIComponent(mod.id)}.png?width=256`,
                  source: 'Poly Haven',
                  originalData: mod,
                })
              }
            })
            .catch(() => {}),
        )
      }

      // 4. GIF Stickers (Giphy)
      if (cat === 'all' || cat === 'stickers') {
        promises.push(
          searchGiphy(q, { limit: cat === 'stickers' ? 16 : 8 })
            .then((stickers) => {
              for (const st of stickers) {
                combined.push({
                  id: `sticker-${st.id}`,
                  type: 'sticker',
                  title: st.title || 'Animated Sticker',
                  subtitle: 'Giphy',
                  thumbnailUrl: st.preview || st.url,
                  previewUrl: st.url,
                  source: 'Giphy',
                  originalData: st,
                })
              }
            })
            .catch(() => {}),
        )
      }

      await Promise.all(promises)
      setResults(combined)
    } catch {
      setNotice({ kind: 'error', text: 'Search request failed. Please check network.' })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleImportItem = async (item: SearchResultItem, addToTimeline: boolean) => {
    setImportingId(item.id)
    setNotice(null)

    try {
      let fileToImport: File | null = null

      if (item.type === 'image') {
        fileToImport = await downloadStockImage(item.originalData as StockImageResult)
      } else if (item.type === 'music') {
        const tr = item.originalData as MusicTrackResult
        if (!tr.previewUrl) throw new Error('No preview audio stream available for this track.')
        const res = needsProxy(tr.previewUrl)
          ? await proxyFetch(tr.previewUrl, {}, 30000)
          : await fetch(tr.previewUrl)
        const blob = await res.blob()
        fileToImport = new File([blob], `${tr.title.replace(/[^\w\s-]/g, '') || 'music-track'}.mp3`, {
          type: blob.type || 'audio/mpeg',
        })
      } else if (item.type === 'model') {
        const mod = item.originalData as PolyHavenModel
        fileToImport = await downloadModelAsGlb(mod.id)
      } else if (item.type === 'sticker') {
        const st = item.originalData as StickerResult
        const gifFile = await downloadGiphy(st)
        const converted = await convertStickerGif(gifFile, st.id)
        fileToImport = converted.webmFile
      }

      if (!fileToImport) {
        throw new Error('Could not download asset file.')
      }

      const { imported, errors } = await importFiles([fileToImport])
      if (errors.length > 0 || !imported.length) {
        throw new Error(errors[0] || 'Import failed.')
      }

      const importedAsset = imported[0]
      if (addToTimeline && importedAsset) {
        addAssetToTimeline(importedAsset.id)
      }

      setNotice({
        kind: 'ok',
        text: `Imported "${item.title}" ${addToTimeline ? 'and added to timeline' : 'to media library'}!`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setNotice({ kind: 'error', text: msg })
    } finally {
      setImportingId(null)
    }
  }

  const toggleAudioPlay = (url?: string) => {
    if (!url) return
    if (activeAudioUrl === url) {
      audioRef.current?.pause()
      setActiveAudioUrl(null)
    } else {
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.play().catch(() => {})
        setActiveAudioUrl(url)
      }
    }
  }

  const categories: Array<{ id: OnlineCategory; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'all', label: 'All Sources', icon: Sparkles },
    { id: 'images', label: 'Photos', icon: ImageIcon },
    { id: 'music', label: 'Music & SFX', icon: Music },
    { id: '3d', label: '3D Models', icon: Box },
    { id: 'stickers', label: 'GIF Stickers', icon: Smile },
  ]

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Hidden audio element for previewing music */}
      <audio
        ref={audioRef}
        onEnded={() => setActiveAudioUrl(null)}
        onError={() => setActiveAudioUrl(null)}
        className="hidden"
      />

      {/* Top Search Controls */}
      <div className="space-y-2 border-b border-border/80 p-2.5 bg-muted/10 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSearch(query, category)
            }}
            placeholder="Search photos, music, 3D models, stickers..."
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-16 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="absolute right-1 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setResults([])
                }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
            <Button
              size="sm"
              onClick={() => void handleSearch(query, category)}
              disabled={loading || !query.trim()}
              className="h-6 px-2 text-[10px] font-semibold bg-violet-600 hover:bg-violet-500 text-white"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </div>

        {/* Source Categories Filter Pills */}
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => {
            const Icon = c.icon
            const active = category === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory(c.id)
                  if (query.trim()) void handleSearch(query, c.id)
                }}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition',
                  active
                    ? 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold shadow-xs'
                    : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/30',
                )}
              >
                <Icon className="size-2.5" />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-[11px] shrink-0 border-b',
            notice.kind === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive',
          )}
        >
          {notice.kind === 'ok' ? <Check className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
          <span className="flex-1 truncate">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Results Container */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
            <Loader2 className="size-6 animate-spin text-violet-500" />
            <p className="text-xs font-semibold">Searching online libraries...</p>
            <p className="text-[10px] opacity-70">Querying Unsplash, Pexels, Deezer, Poly Haven & Giphy</p>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {results.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-border/80 bg-card p-2 transition hover:border-violet-500/60 hover:shadow-md hover:bg-muted/20"
              >
                {/* Visual Thumbnail or Audio Icon */}
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted/40 flex items-center justify-center">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="size-full object-cover transition duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : item.type === 'music' ? (
                    <div className="flex flex-col items-center justify-center gap-1 text-violet-500">
                      <Music className="size-6" />
                      {item.previewUrl && (
                        <button
                          type="button"
                          onClick={() => toggleAudioPlay(item.previewUrl)}
                          className="rounded-full bg-violet-600 p-1 text-white shadow-md hover:scale-110 transition"
                          title="Preview Audio"
                        >
                          {activeAudioUrl === item.previewUrl ? <Pause className="size-3" /> : <Play className="size-3" />}
                        </button>
                      )}
                    </div>
                  ) : (
                    <Box className="size-6 text-muted-foreground" />
                  )}

                  {/* Source Badge */}
                  <span className="absolute top-1 left-1 rounded bg-black/60 backdrop-blur-xs px-1 py-0.2 text-[8px] font-mono text-white/90">
                    {item.source}
                  </span>
                </div>

                {/* Info Text */}
                <div className="mt-1.5 min-w-0">
                  <p className="truncate text-[11px] font-bold text-foreground" title={item.title}>
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="truncate text-[9px] text-muted-foreground">{item.subtitle}</p>
                  )}
                </div>

                {/* 1-Click Action Buttons */}
                <div className="mt-2 flex items-center gap-1 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={importingId === item.id}
                    onClick={() => void handleImportItem(item, false)}
                    className="h-6 flex-1 gap-1 px-1 text-[9px] font-semibold hover:border-violet-500 hover:text-violet-500"
                    title="Import to project media library"
                  >
                    {importingId === item.id ? (
                      <Loader2 className="size-2.5 animate-spin" />
                    ) : (
                      <Download className="size-2.5" />
                    )}
                    Import
                  </Button>
                  <Button
                    size="sm"
                    disabled={importingId === item.id}
                    onClick={() => void handleImportItem(item, true)}
                    className="h-6 gap-1 bg-violet-600 hover:bg-violet-500 px-2 text-[9px] font-semibold text-white shadow-xs"
                    title="Import and place on timeline"
                  >
                    <Plus className="size-2.5" />
                    Timeline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : query.trim() ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-1.5">
            <Search className="size-6 opacity-40" />
            <p className="text-xs font-semibold">No online assets found</p>
            <p className="text-[10px] opacity-70">Try searching for broader terms like &quot;city&quot;, &quot;ambient&quot;, &quot;robot&quot;, &quot;fire&quot;.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
              <Sparkles className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">Universal Online Asset Search</p>
              <p className="text-[10px] text-muted-foreground max-w-[220px] leading-relaxed">
                Search and download millions of free stock photos, music tracks, 3D GLB models, and animated stickers directly into your project.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1 pt-1 max-w-[240px]">
              {['Cyberpunk', 'Lo-Fi Chill', 'Nature 4K', 'Robot 3D', 'Subscribe', 'Space'].map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => {
                    setQuery(keyword)
                    void handleSearch(keyword, category)
                  }}
                  className="rounded-full border border-border/80 bg-muted/30 px-2 py-0.5 text-[9px] font-medium text-foreground hover:border-violet-500 hover:bg-violet-500/10 transition"
                >
                  +{keyword}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
