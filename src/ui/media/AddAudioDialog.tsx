import * as React from 'react'
import { AudioWaveform, FolderUp, Loader2, Music, Play, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/engine/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { searchMusic, type MusicTrackResult } from '@/api/music/search'
import { useDenoise } from '@/hooks/useDenoise'

interface Props {
  open: boolean
  onClose: () => void
}

function float32ToWav(buffer: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = buffer.length * bytesPerSample
  const totalSize = 44 + dataSize
  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

export function AddAudioDialog({ open, onClose }: Props) {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const project = useTimelineStore((s) => s.project)

  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // search state
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<MusicTrackResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [previewing, setPreviewing] = React.useState<string | null>(null)
  const [importingId, setImportingId] = React.useState<string | null>(null)

  // denoise state
  const [denoiseAssetId, setDenoiseAssetId] = React.useState('')
  const denoise = useDenoise(
    React.useMemo(
      () => ({
        onProgress: () => {},
        onError: (err: string) => setNotice({ kind: 'error', text: `Denoise failed: ${err}` }),
      }),
      [],
    ),
  )

  const audioAssets = React.useMemo(() => assets.filter((a) => a.type === 'audio'), [assets])

  const audioTrackId = React.useMemo(() => project.tracks.find((t) => t.type === 'audio')?.id, [project.tracks])

  const close = () => {
    previewRef.current?.pause()
    previewRef.current = null
    denoise.terminate()
    onClose()
  }

  React.useEffect(() => {
    if (!open) {
      setNotice(null)
      setBusy(false)
      setResults([])
      setSearchError(null)
      setQuery('')
    }
  }, [open])

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length) return
    setBusy(true)
    try {
      const { imported, errors } = await importFiles(files)
      if (errors.length && !imported.length) {
        setNotice({ kind: 'error', text: `Could not import: ${errors[0]}` })
      } else {
        setNotice({ kind: 'ok', text: `Added ${imported.length} audio clip${imported.length === 1 ? '' : 's'} to the timeline` })
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const addExisting = (assetId: string) => {
    if (!audioTrackId) return
    addClip(assetId, audioTrackId)
    setNotice({ kind: 'ok', text: 'Added to the timeline' })
  }

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

  const doDenoise = async () => {
    if (!denoiseAssetId || denoise.processing) return
    const asset = assets.find((a) => a.id === denoiseAssetId)
    if (!asset) return
    setBusy(true)
    setNotice(null)
    try {
      const file = await import('@/engine/storage/opfs').then((m) => m.readMediaFile(asset.filePath))
      const result = await denoise.denoiseFromFile(file)
      const wav = float32ToWav(result.denoisedAudio, result.sampleRate)
      const outFile = new File([wav], `${asset.name}-denoised.wav`, { type: 'audio/wav' })
      const { imported, errors } = await importFiles([outFile])
      if (imported.length) {
        setNotice({ kind: 'ok', text: `Denoised audio added to the timeline` })
      } else {
        setNotice({ kind: 'error', text: errors[0] ?? 'Could not import denoised audio' })
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const previewRef = React.useRef<HTMLAudioElement | null>(null)

  React.useEffect(() => {
    return () => previewRef.current?.pause()
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
            <Music className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Add Audio</h3>
            <p className="text-muted-foreground text-[11px]">Import, search copyright-free music or denoise</p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy || denoise.processing}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <Tabs defaultValue="browse" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3 self-start rounded-md bg-muted">
            <TabsTrigger value="browse" className="px-3 text-xs">
              <FolderUp className="size-3.5" /> Browse
            </TabsTrigger>
            <TabsTrigger value="search" className="px-3 text-xs">
              <Search className="size-3.5" /> Search
            </TabsTrigger>
            <TabsTrigger value="denoise" className="px-3 text-xs">
              <Sparkles className="size-3.5" /> Denoise
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {notice && (
              <div
                className={cn(
                  'mb-3 rounded-md border px-2.5 py-1.5 text-[11px]',
                  notice.kind === 'error'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                {notice.text}
              </div>
            )}

            <TabsContent value="browse" className="space-y-3">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <FolderUp className="size-4" />
                {busy ? 'Importing…' : 'Browse audio files'}
              </Button>

              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-2 text-xs font-medium">Audio library</p>
                {audioAssets.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No audio assets yet. Import an MP3, WAV or M4A to get started.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {audioAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5"
                      >
                        <Music className="text-muted-foreground size-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs">{asset.name}</p>
                          {asset.duration ? (
                            <p className="text-muted-foreground font-mono text-[10px]">{formatSeconds(asset.duration)}</p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => addExisting(asset.id)}
                        >
                          <Plus className="size-3.5" />
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="search" className="space-y-3">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Search copyright-free music…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void doSearch() }}
                  className="h-7 text-xs"
                />
                <Button size="sm" className="h-7 px-2" onClick={() => void doSearch()} disabled={searching || !query.trim()}>
                  {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                </Button>
              </div>

              {searchError && <p className="text-destructive text-[10px]">{searchError}</p>}

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
            </TabsContent>

            <TabsContent value="denoise" className="space-y-3">
              <p className="text-muted-foreground text-xs">
                Remove background noise from a clip using RNNoise — runs 100% in-browser. The denoised audio is added to the timeline as a new clip.
              </p>

              <div className="flex flex-col gap-1.5">
                <p className="text-muted-foreground text-xs font-medium">Source audio</p>
                {audioAssets.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Import an audio clip first to denoise it.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {audioAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors',
                          denoiseAssetId === asset.id
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border bg-muted/40 hover:border-emerald-500/30',
                        )}
                        onClick={() => setDenoiseAssetId(asset.id)}
                      >
                        <AudioWaveform className="text-muted-foreground size-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs">{asset.name}</p>
                          {asset.duration ? (
                            <p className="text-muted-foreground font-mono text-[10px]">{formatSeconds(asset.duration)}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => void doDenoise()}
                disabled={busy || denoise.processing || !denoiseAssetId}
              >
                {busy || denoise.processing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {busy || denoise.processing ? 'Denoising…' : 'Denoise & add to timeline'}
              </Button>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={close} disabled={busy || denoise.processing}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}