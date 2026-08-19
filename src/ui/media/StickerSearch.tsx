import * as React from 'react'
import { Download, Loader2, Search, Smile } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { useTimelineStore } from '@/stores/timelineStore'
import { searchGiphy, searchGiphyTrending, downloadGiphy, type StickerResult } from '@/api/stickers/search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function StickerSearch() {
  const config = useApiConfigStore((s) => s.config)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<StickerResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const hasKey = Boolean(config.giphy.apiKey)

  const loadTrending = async () => {
    if (!hasKey) return
    setLoading(true)
    setError(null)
    const r = await searchGiphyTrending()
    if (r.length === 0) setError('No stickers found. Check your Giphy API key in Settings.')
    setResults(r)
    setLoading(false)
  }

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    const r = await searchGiphy(query.trim())
    if (r.length === 0) setError('No stickers found. Try a different term or check your API key in Settings.')
    setResults(r)
    setLoading(false)
  }

  const importSticker = async (result: StickerResult) => {
    setImportingId(result.id)
    setError(null)
    try {
      const file = await downloadGiphy(result)
      await importFiles([file])
    } catch {
      setError('Failed to download sticker')
    } finally {
      setImportingId(null)
    }
  }

  React.useEffect(() => {
    void loadTrending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Smile className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold">Stickers</span>
        <span className="text-muted-foreground text-[10px]">Giphy</span>
      </div>

      {!hasKey && (
        <p className="text-muted-foreground text-[10px]">
          Add a Giphy API key in Settings → Stickers to search. Get a free key at developers.giphy.com.
        </p>
      )}

      <div className="flex gap-1.5">
        <Input
          placeholder="Search stickers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2" onClick={() => void search()} disabled={loading || !hasKey || !query.trim()}>
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
              onClick={() => void importSticker(r)}
              title={`${r.title || 'Sticker'} — click to import`}
            >
              <img src={r.preview} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {importingId === r.id ? <Loader2 className="size-4 animate-spin text-white" /> : <Download className="size-4 text-white" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}