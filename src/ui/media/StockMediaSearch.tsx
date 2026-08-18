import * as React from 'react'
import { Download, Image, Loader2, Search } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface StockResult {
  id: string
  thumb: string
  full: string
  author: string
  source: string
}

export function StockMediaSearch() {
  const config = useApiConfigStore((s) => s.config)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<StockResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])

    const allResults: StockResult[] = []
    const ordered = [...(config.stockImages.order ?? ['unsplash', 'pexels', 'pixabay'])]
    const preferred = config.preferences.preferredStock
    if (preferred && ordered.includes(preferred as 'unsplash' | 'pexels' | 'pixabay')) {
      ordered.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0))
    }
    const providers = ordered

    for (const provider of providers) {
      try {
        if (provider === 'unsplash') {
          const accessKey = config.stockImages.unsplash.accessKey || config.stockImages.unsplash.apiKey
          if (!accessKey) continue
          const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12`, {
            headers: {
              Authorization: `Client-ID ${accessKey}`,
              'Accept-Version': 'v1',
            },
          })
          const data = await res.json()
          for (const photo of data.results ?? []) {
            allResults.push({
              id: photo.id,
              thumb: photo.urls?.small ?? '',
              full: photo.urls?.full ?? photo.urls?.regular ?? '',
              author: photo.user?.name ?? '',
              source: 'Unsplash',
            })
          }
        }

        if (provider === 'pexels' && config.stockImages.pexels.apiKey) {
          const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`, {
            headers: { Authorization: config.stockImages.pexels.apiKey },
          })
          const data = await res.json()
          for (const photo of data.photos ?? []) {
            allResults.push({
              id: String(photo.id),
              thumb: photo.src?.medium ?? '',
              full: photo.src?.original ?? photo.src?.large2x ?? '',
              author: photo.photographer ?? '',
              source: 'Pexels',
            })
          }
        }

        if (provider === 'pixabay' && config.stockImages.pixabay.apiKey) {
          const res = await fetch(`https://pixabay.com/api/?key=${config.stockImages.pixabay.apiKey}&q=${encodeURIComponent(query)}&per_page=12&image_type=photo`)
          const data = await res.json()
          for (const photo of data.hits ?? []) {
            allResults.push({
              id: String(photo.id),
              thumb: photo.webformatURL ?? '',
              full: photo.largeImageURL ?? '',
              author: photo.user ?? '',
              source: 'Pixabay',
            })
          }
        }
      } catch {
        // skip failed providers
      }
    }

    if (!allResults.length) {
      setError('No results. Check your API keys in Settings.')
    }
    setResults(allResults)
    setLoading(false)
  }

  const downloadAndImport = async (result: StockResult) => {
    try {
      const res = await fetch(result.full)
      const blob = await res.blob()
      const ext = result.full.includes('.png') ? '.png' : '.jpg'
      const file = new File([blob], `stock-${result.id}${ext}`, { type: blob.type || 'image/jpeg' })
      await importFiles([file])
    } catch {
      setError('Failed to download image')
    }
  }

  const hasAnyKey =
    config.stockImages.unsplash.accessKey ||
    config.stockImages.unsplash.apiKey ||
    config.stockImages.pexels.apiKey ||
    config.stockImages.pixabay.apiKey

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Image className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold">Stock Images</span>
      </div>

      {!hasAnyKey && (
        <p className="text-muted-foreground text-[10px]">
          Add API keys in Settings → Stock Images to search.
        </p>
      )}

      <div className="flex gap-1.5">
        <Input
          placeholder="Search stock images..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2" onClick={() => void search()} disabled={loading || !hasAnyKey}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </Button>
      </div>

      {error && <p className="text-destructive text-[10px]">{error}</p>}

      {results.length > 0 && (
        <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="group relative overflow-hidden rounded border bg-muted"
              onClick={() => void downloadAndImport(r)}
              title={`${r.source} by ${r.author} — click to import`}
            >
              <img src={r.thumb} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Download className="size-4 text-white" />
              </div>
              <div className="absolute right-0 bottom-0 left-0 bg-black/60 px-1 py-0.5">
                <span className="text-[8px] text-white/70">{r.source}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
