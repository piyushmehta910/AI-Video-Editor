import * as React from 'react'
import { Loader2, Music, Play, Plus, Search, Trash2 } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/engine/types'
import { searchMusic, type MusicTrackResult } from '@/api/music/search'

export function MusicSearch() {
  const importFiles = useTimelineStore((s) => s.importFiles)

  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<MusicTrackResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [previewing, setPreviewing] = React.useState<string | null>(null)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const previewRef = React.useRef<HTMLAudioElement | null>(null)

  React.useEffect(() => {
    return () => previewRef.current?.pause()
  }, [])

  const doSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    const tracks = await searchMusic(query.trim(), { maxResults: 8 })
    setResults(tracks)
    if (!tracks.length) setSearchError('No copyright-free tracks found. Try another query.')
    setSearching(false)
  }

  const togglePreview = (track: MusicTrackResult) => {
    if (previewing === track.id) {
      previewRef.current?.pause()
      previewRef.current = null
      setPreviewing(null)
      return
    }
    previewRef.current?.pause()
    if (!track.previewUrl) return
    const audio = new Audio(track.previewUrl)
    audio.onended = () => setPreviewing(null)
    previewRef.current = audio
    setPreviewing(track.id)
    void audio.play().catch(() => setPreviewing(null))
  }

  const importTrack = async (track: MusicTrackResult) => {
    if (!track.previewUrl) return
    setImportingId(track.id)
    try {
      const res = await fetch(track.previewUrl)
      const blob = await res.blob()
      const file = new File([blob], `${track.title}-${track.artist}.mp3`, { type: blob.type || 'audio/mpeg' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) setNotice({ kind: 'ok', text: `Added "${track.title}" to the timeline` })
      else setNotice({ kind: 'error', text: errors[0] ?? 'Could not import track' })
    } catch {
      setNotice({ kind: 'error', text: 'Failed to download track' })
    } finally {
      setImportingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {notice && (
        <div
          className={cn(
            'rounded-md border px-2.5 py-1.5 text-[11px]',
            notice.kind === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          )}
        >
          {notice.text}
        </div>
      )}

      <div className="flex gap-1.5">
        <Input
          placeholder="Search copyright-free music…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void doSearch() }}
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 px-2" onClick={() => void doSearch()} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </Button>
      </div>

      {searchError && <p className="text-destructive text-[10px]">{searchError}</p>}

      {searching && <p className="text-muted-foreground animate-pulse text-xs">Searching…</p>}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map((track) => (
            <div key={track.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => togglePreview(track)}
                disabled={!track.previewUrl}
                title={previewing === track.id ? 'Stop preview' : 'Preview'}
              >
                {previewing === track.id ? <Trash2 className="size-3.5" /> : <Play className="size-3.5" />}
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{track.title}</p>
                <p className="text-muted-foreground truncate text-[10px]">
                  {track.artist} · {formatSeconds(track.duration)} · {track.source}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => void importTrack(track)}
                disabled={importingId === track.id || !track.previewUrl}
              >
                {importingId === track.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {!query && !results.length && (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
            <Music className="text-muted-foreground size-6" />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Search for copyright-free music and add it straight to the timeline.
          </p>
        </div>
      )}
    </div>
  )
}