import * as React from 'react'
import { Box, Loader2, Search, TriangleAlert } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchModels, downloadModelAsGlb, type PolyHavenModel } from '@/api/models/polyhaven'

export function ModelSearch() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<PolyHavenModel[]>([])
  const [searching, setSearching] = React.useState(false)
  const [downloading, setDownloading] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    try {
      const models = await searchModels(query, { maxResults: 18 })
      if (!models.length) {
        setError('No 3D models matched that search on Poly Haven.')
      }
      setResults(models)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSearching(false)
    }
  }

  const downloadAndImport = async (model: PolyHavenModel) => {
    if (downloading) return
    setDownloading(model.id)
    setError(null)
    try {
      const file = await downloadModelAsGlb(model.id, { resolution: '2k' })
      const { imported, errors } = await importFiles([file])
      if (!imported.length) {
        setError(errors[0] ?? 'Model could not be imported.')
        return
      }
      const asset = imported[0]
      setResults((prev) => prev.filter((r) => r.id !== model.id))
      setError(`Added "${asset.name}" to the timeline.`)
    } catch (err) {
      setError(`Download failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <Box className="text-muted-foreground size-4" />
        <span className="text-xs font-semibold">3D Models</span>
        <span className="text-muted-foreground text-[10px]">Poly Haven (CC0)</span>
      </div>

      <div className="flex gap-1.5">
        <Input
          placeholder="Search 3D models (e.g. armchair, skull, statue)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2" onClick={() => void search()} disabled={searching}>
          {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <TriangleAlert className="size-3 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-muted-foreground text-[10px]">
        Free, CC0 models. Downloading converts the model to a single GLB file and adds it to the timeline.
      </p>

      {results.length > 0 && (
        <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              className="group relative flex flex-col overflow-hidden rounded border bg-muted p-2 text-left transition-colors hover:border-violet-500/50"
              onClick={() => void downloadAndImport(m)}
              disabled={downloading === m.id}
              title={`${m.name} — click to download & add to timeline`}
            >
              <div className="flex items-center gap-1.5">
                <Box className="size-3.5 shrink-0 text-violet-500" />
                <span className="truncate text-[11px] font-medium">{m.name}</span>
              </div>
              <span className="text-muted-foreground truncate text-[9px]">
                {m.categories.slice(0, 3).join(' · ') || 'model'}
                {m.polycount > 0 ? ` · ${m.polycount.toLocaleString()} tris` : ''}
              </span>
              {downloading === m.id && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="size-4 animate-spin text-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}