import * as React from 'react'
import {
  ChevronLeft,
  FolderUp,
  Search,
  Loader2,
  Play,
  Pause,
  Download,
  Music,
  Smile,
  Box,
  Clapperboard,
  Sparkles,
  Image,
  FileText,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import type { Clip, EffectType, TextOverlay } from '@/engine/types'
import { createEffect } from '@/engine/types'
import { generateSlides, renderSlidePng, type SlideTheme } from '@/api/llm/slides'
import { generateLipsyncVideo, type AvatarMouth } from '@/engine/avatar'
import { readMediaFile } from '@/engine/storage/opfs'
import { searchMusic, type MusicTrackResult } from '@/api/music/search'
import { searchModels, downloadModelAsGlb, type PolyHavenModel } from '@/api/models/polyhaven'
import { searchGiphy, searchGiphyTrending, downloadGiphy, type StickerResult } from '@/api/stickers/search'
import { useDenoiseAction } from '@/hooks/useDenoiseAction'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type ToolSection =
  | 'effects'
  | 'audio'
  | 'captions'
  | '3d'
  | 'transitions'
  | 'stickers'
  | 'speed'
  | 'keyframe'
  | 'crop'
  | 'slide'
  | 'avatar'

export const TOOL_SECTIONS: { id: ToolSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'captions', label: 'Captions', icon: FileText },
  { id: '3d', label: '3D', icon: Box },
  { id: 'transitions', label: 'Transitions', icon: ChevronLeft },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'speed', label: 'Speed', icon: Play },
  { id: 'keyframe', label: 'Keyframe', icon: Play },
  { id: 'crop', label: 'Crop', icon: Image },
  { id: 'slide', label: 'Slides', icon: FileText },
  { id: 'avatar', label: 'Avatar', icon: Clapperboard },
]

function getSelectedClip(): Clip | null {
  const { selection, project } = useTimelineStore.getState()
  const id = selection.clipIds[0]
  if (!id) return null
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === id)
    if (clip) return clip
  }
  return null
}

function EmptyHint({ text, icon: Icon }: { text: string; icon?: React.FC<{ className?: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
      {Icon && <Icon className="text-muted-foreground size-8 opacity-40" />}
      <p className="text-muted-foreground text-center text-xs leading-relaxed">{text}</p>
    </div>
  )
}

function SectionNotice({ kind, text }: { kind: 'ok' | 'error'; text: string }) {
  return (
    <div
      className={cn(
        'rounded-md border px-2.5 py-1.5 text-[11px]',
        kind === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      )}
    >
      {text}
    </div>
  )
}

function EffectSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-muted-foreground font-mono text-[10px]">{value.toFixed(2)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step ?? 0.01}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

// ─── Slide Section ────────────────────────────────────────────────────────────
function SlideSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [topic, setTopic] = React.useState('')
  const [count, setCount] = React.useState(4)
  const [theme, setTheme] = React.useState<SlideTheme>('clean')
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const generate = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      setProgress('Generating slide content...')
      const deck = await generateSlides({ topic: topic.trim(), count })
      const files: File[] = []
      for (let i = 0; i < deck.slides.length; i++) {
        setProgress(`Rendering slide ${i + 1}/${deck.slides.length}...`)
        const blob = await renderSlidePng(deck.slides[i], i + 1, deck.slides.length, theme, 1280, 720)
        files.push(new File([blob], `slide-${i + 1}-${Date.now()}.png`, { type: 'image/png' }))
      }
      setProgress('Importing to timeline...')
      const { imported } = await importFiles(files)
      if (imported.length) {
        setSuccess(`Generated ${imported.length} slides and added them to the timeline.`)
        const store = useTimelineStore.getState()
        const videoTrack = store.project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const perSlide = 5
          imported.forEach((asset, idx) => {
            const newClip = store.addClip(asset.id, videoTrack.id)
            if (newClip) {
              store.updateClip(newClip.id, {
                startTime: idx * perSlide,
                duration: perSlide,
              })
            }
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Topic</Label>
        <Input
          placeholder="e.g. Introduction to Machine Learning"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void generate() }}
          className="h-8 text-xs"
          disabled={busy}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Slides (1–6)</Label>
          <Input
            type="number"
            min={1}
            max={6}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(6, Number(e.target.value))))}
            className="h-8 text-xs"
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as SlideTheme)} disabled={busy}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="gradient">Gradient</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" className="w-full" onClick={() => void generate()} disabled={busy || !topic.trim()}>
        {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
        {busy ? progress || 'Generating...' : 'Generate Slides'}
      </Button>
      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}
    </div>
  )
}

// ─── Avatar Section ───────────────────────────────────────────────────────────
const AVATAR_RESOLUTIONS = ['512x512', '768x768', '1024x1024']
const AVATAR_BACKGROUNDS = ['transparent', 'solid', 'blurred'] as const

function AvatarSection() {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const avatarConfig = useApiConfigStore((s) => s.config.avatar)

  const [imageAssetId, setImageAssetId] = React.useState('')
  const [audioAssetId, setAudioAssetId] = React.useState('')
  const [resolution, setResolution] = React.useState(avatarConfig.resolution)
  const [fps, setFps] = React.useState(avatarConfig.fps)
  const [background, setBackground] = React.useState<string>(avatarConfig.background || 'solid')
  const [mouth, setMouth] = React.useState<AvatarMouth>({
    x: avatarConfig.mouthX,
    y: avatarConfig.mouthY,
    width: avatarConfig.mouthWidth,
    maxOpen: avatarConfig.mouthMaxOpen,
  })
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const images = React.useMemo(() => assets.filter((a) => a.type === 'image'), [assets])
  const audios = React.useMemo(() => assets.filter((a) => a.type === 'audio'), [assets])

  React.useEffect(() => {
    if (images.length && !imageAssetId) setImageAssetId(images[0].id)
    if (audios.length && !audioAssetId) setAudioAssetId(audios[0].id)
  }, [images, audios])

  const imageAsset = assets.find((a) => a.id === imageAssetId)
  const audioAsset = assets.find((a) => a.id === audioAssetId)
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const generate = async () => {
    if (!imageAsset || !audioAsset || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const [imageFile, audioFile] = await Promise.all([
        readMediaFile(imageAsset.filePath),
        readMediaFile(audioAsset.filePath),
      ])
      const [width, height] = resolution.split('x').map(Number)
      const result = await generateLipsyncVideo({
        imageFile,
        audioFile,
        width,
        height,
        fps,
        bitrate: 3_000_000,
        codec: 'vp8',
        mouth,
        background: background as 'transparent' | 'solid' | 'blurred',
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      const file = new File([result.blob], `${imageAsset.name}-lipsync.webm`, { type: 'video/webm' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        setSuccess(`Generated ${result.duration.toFixed(1)}s lip-sync video`)
      } else {
        setError(errors[0] ?? 'Could not add generated clip')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Cancelled')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setBusy(false)
      setProgress(null)
      abortRef.current = null
    }
  }

  return (
    <div className="space-y-3 p-3">
      {images.length === 0 && audios.length === 0 ? (
        <EmptyHint
          text="Import an avatar image (portrait) and a speech audio clip to generate a lip-sync video. The rendering happens entirely in your browser."
          icon={Clapperboard}
        />
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Avatar Image</Label>
            <Select value={imageAssetId} onValueChange={setImageAssetId} disabled={busy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick an image" />
              </SelectTrigger>
              <SelectContent>
                {images.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Speech Audio</Label>
            <Select value={audioAssetId} onValueChange={setAudioAssetId} disabled={busy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick audio" />
              </SelectTrigger>
              <SelectContent>
                {audios.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Resolution</Label>
              <Select value={resolution} onValueChange={setResolution} disabled={busy}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVATAR_RESOLUTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">FPS</Label>
              <Input type="number" min={15} max={60} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="h-8 text-xs" disabled={busy} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Background</Label>
            <Select value={background} onValueChange={setBackground} disabled={busy}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AVATAR_BACKGROUNDS.map((b) => (
                  <SelectItem key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Mouth Position</Label>
            <EffectSlider label="X" value={mouth.x} min={0.2} max={0.8} onChange={(v) => setMouth((m) => ({ ...m, x: v }))} />
            <EffectSlider label="Y" value={mouth.y} min={0.5} max={0.95} onChange={(v) => setMouth((m) => ({ ...m, y: v }))} />
            <EffectSlider label="Width" value={mouth.width} min={0.05} max={0.35} onChange={(v) => setMouth((m) => ({ ...m, width: v }))} />
            <EffectSlider label="Max Open" value={mouth.maxOpen} min={0.02} max={0.2} onChange={(v) => setMouth((m) => ({ ...m, maxOpen: v }))} />
          </div>
          {progress && (
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-muted-foreground">Rendering {progress.done}/{progress.total}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <Button size="sm" className="w-full" onClick={() => void generate()} disabled={busy || !imageAsset || !audioAsset}>
            {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Clapperboard className="mr-2 size-3.5" />}
            {busy ? 'Generating...' : 'Generate Lip-Sync'}
          </Button>
          {error && <SectionNotice kind="error" text={error} />}
          {success && <SectionNotice kind="ok" text={success} />}
        </>
      )}
    </div>
  )
}

// ─── Audio Section ────────────────────────────────────────────────────────────
function AudioSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<MusicTrackResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [previewing, setPreviewing] = React.useState<string | null>(null)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const previewRef = React.useRef<HTMLAudioElement | null>(null)

  const denoise = useDenoiseAction()
  const [denoiseBusy, setDenoiseBusy] = React.useState(false)

  React.useEffect(() => () => previewRef.current?.pause(), [])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    await importFiles(Array.from(files))
    if (inputRef.current) inputRef.current.value = ''
  }

  const doSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    const tracks = await searchMusic(query.trim(), { maxResults: 8 })
    setResults(tracks)
    if (!tracks.length) setSearchError('No copyright-free tracks found.')
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
      if (imported.length) setNotice({ kind: 'ok', text: `Added "${track.title}"` })
      else setNotice({ kind: 'error', text: errors[0] ?? 'Import failed' })
    } catch {
      setNotice({ kind: 'error', text: 'Download failed' })
    } finally {
      setImportingId(null)
    }
  }

  const runDenoise = async () => {
    if (!clip || denoiseBusy) return
    setDenoiseBusy(true)
    try {
      await denoise.run(clip.id)
      setNotice({ kind: 'ok', text: 'Denoised audio created' })
    } catch {
      // error handled by hook
    } finally {
      setDenoiseBusy(false)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" multiple onChange={handleImport} />
      <Button size="sm" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
        <FolderUp className="mr-2 size-3.5" />
        Import Audio
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
        <div className="relative flex justify-center text-[10px]"><span className="bg-card px-2 text-muted-foreground">or search music</span></div>
      </div>

      <div className="flex gap-1.5">
        <Input
          placeholder="Search copyright-free music..."
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
      {notice && <SectionNotice kind={notice.kind} text={notice.text} />}

      {results.length > 0 && (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {results.map((track) => (
            <div key={track.id} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1">
              <Button variant="ghost" size="icon" className="size-5 shrink-0" onClick={() => togglePreview(track)} disabled={!track.previewUrl}>
                {previewing === track.id ? <Pause className="size-3" /> : <Play className="size-3" />}
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px]">{track.title}</p>
                <p className="text-muted-foreground truncate text-[9px]">{track.artist} · {formatSeconds(track.duration)}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-6 shrink-0 px-1.5 text-[10px]" onClick={() => void importTrack(track)} disabled={importingId === track.id}>
                {importingId === track.id ? <Loader2 className="size-3 animate-spin" /> : '+ Add'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {clip && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-[10px]"><span className="bg-card px-2 text-muted-foreground">clip settings</span></div>
          </div>
          <EffectSlider label="Volume" value={clip.volume} min={0} max={2} onChange={(v) => updateClip(clip.id, { volume: v })} />
          <EffectSlider label="Speed" value={clip.speed} min={0.25} max={4} step={0.25} onChange={(v) => updateClip(clip.id, { speed: v })} />
          <Button size="sm" variant="outline" className="w-full" onClick={() => void runDenoise()} disabled={denoiseBusy}>
            {denoiseBusy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
            {denoiseBusy ? 'Denoising...' : 'Denoise Audio'}
          </Button>
        </>
      )}

      {!clip && results.length === 0 && (
        <EmptyHint text="Import audio files or search copyright-free music to add to your project." icon={Music} />
      )}
    </div>
  )
}

// ─── Captions Section ─────────────────────────────────────────────────────────
function CaptionsSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to edit its text overlay" icon={FileText} />

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Text Content</Label>
        <Input
          value={clip.text?.text ?? ''}
          placeholder="Enter text overlay..."
          onChange={(e) => {
            const existing = clip.text
            const newText: TextOverlay = existing
              ? { ...existing, text: e.target.value }
              : {
                  text: e.target.value,
                  fontSize: 48,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 'bold',
                  fontStyle: 'normal',
                  color: '#ffffff',
                  backgroundColor: '#000000',
                  textAlign: 'center',
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderRadius: 0,
                  shadow: false,
                  animation: 'none',
                  animationDuration: 0.5,
                }
            updateClip(clip.id, { text: newText })
          }}
        />
      </div>
      {clip.text && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Font Size</Label>
              <Input
                type="number"
                min={8}
                max={200}
                value={clip.text.fontSize}
                onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, fontSize: Number(e.target.value) } })}
                className="h-7 text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Color</Label>
              <Input
                type="color"
                value={clip.text.color}
                onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, color: e.target.value } })}
                className="h-7 w-full cursor-pointer p-0.5"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Animation</Label>
            <Select
              value={clip.text.animation}
              onValueChange={(v) => updateClip(clip.id, { text: { ...clip.text!, animation: v as TextOverlay['animation'] } })}
            >
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade-in">Fade In</SelectItem>
                <SelectItem value="fade-out">Fade Out</SelectItem>
                <SelectItem value="slide-up">Slide Up</SelectItem>
                <SelectItem value="slide-down">Slide Down</SelectItem>
                <SelectItem value="typewriter">Typewriter</SelectItem>
                <SelectItem value="scale-in">Scale In</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 3D Section ───────────────────────────────────────────────────────────────
function ThreeDSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<PolyHavenModel[]>([])
  const [searching, setSearching] = React.useState(false)
  const [downloading, setDownloading] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    try {
      const models = await searchModels(query, { maxResults: 12 })
      if (!models.length) setError('No models found on Poly Haven.')
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
    setSuccess(null)
    try {
      const file = await downloadModelAsGlb(model.id, { resolution: '2k' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        setSuccess(`Added "${imported[0].name}" to timeline`)
        setResults((prev) => prev.filter((r) => r.id !== model.id))
      } else {
        setError(errors[0] ?? 'Import failed')
      }
    } catch (err) {
      setError(`Download failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-1.5">
        <Box className="text-muted-foreground size-3.5" />
        <span className="text-[10px] text-muted-foreground">Free CC0 models from Poly Haven</span>
      </div>
      <div className="flex gap-1.5">
        <Input
          placeholder="Search 3D models..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 px-2" onClick={() => void search()} disabled={searching}>
          {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </Button>
      </div>
      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}
      {results.length > 0 && (
        <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              className="group relative flex flex-col overflow-hidden rounded border bg-muted p-2 text-left transition-colors hover:border-violet-500/50"
              onClick={() => void downloadAndImport(m)}
              disabled={downloading === m.id}
            >
              <div className="flex items-center gap-1">
                <Box className="size-3 shrink-0 text-violet-500" />
                <span className="truncate text-[11px] font-medium">{m.name}</span>
              </div>
              <span className="text-muted-foreground truncate text-[9px]">
                {m.categories.slice(0, 2).join(' · ') || 'model'}
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
      {results.length === 0 && !searching && (
        <EmptyHint text="Search for free 3D models (CC0 licensed) to add to your project." icon={Box} />
      )}
    </div>
  )
}

// ─── Transitions Section ──────────────────────────────────────────────────────
const TRANSITION_TYPES: Array<{ type: 'cut' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'slide' | 'zoom'; label: string; desc: string }> = [
  { type: 'cut', label: 'Cut', desc: 'Instant switch' },
  { type: 'dissolve', label: 'Dissolve', desc: 'Smooth crossfade' },
  { type: 'wipe-left', label: 'Wipe Left', desc: 'Slide from right' },
  { type: 'wipe-right', label: 'Wipe Right', desc: 'Slide from left' },
  { type: 'wipe-up', label: 'Wipe Up', desc: 'Slide from bottom' },
  { type: 'wipe-down', label: 'Wipe Down', desc: 'Slide from top' },
  { type: 'slide', label: 'Slide', desc: 'Push transition' },
  { type: 'zoom', label: 'Zoom', desc: 'Scale in/out' },
]

function TransitionsSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to set its entrance and exit transitions." icon={ChevronLeft} />

  const duration = clip.transitions.in?.duration ?? 0.5

  return (
    <div className="space-y-4 p-3">
      <div>
        <Label className="text-xs mb-2 block">In Transition</Label>
        <div className="grid grid-cols-2 gap-1">
          {TRANSITION_TYPES.map((t) => (
            <Button
              key={t.type}
              size="sm"
              variant={clip.transitions.in?.type === t.type ? 'default' : 'outline'}
              className="h-auto flex-col items-start py-1.5"
              onClick={() => updateClip(clip.id, { transitions: { ...clip.transitions, in: { type: t.type, duration } } })}
            >
              <span className="text-[10px] font-medium">{t.label}</span>
              <span className="text-[8px] opacity-60">{t.desc}</span>
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs mb-2 block">Out Transition</Label>
        <div className="grid grid-cols-2 gap-1">
          {TRANSITION_TYPES.map((t) => (
            <Button
              key={t.type}
              size="sm"
              variant={clip.transitions.out?.type === t.type ? 'default' : 'outline'}
              className="h-auto flex-col items-start py-1.5"
              onClick={() => updateClip(clip.id, { transitions: { ...clip.transitions, out: { type: t.type, duration } } })}
            >
              <span className="text-[10px] font-medium">{t.label}</span>
              <span className="text-[8px] opacity-60">{t.desc}</span>
            </Button>
          ))}
        </div>
      </div>
      <EffectSlider
        label="Duration"
        value={duration}
        min={0.1}
        max={2}
        step={0.1}
        onChange={(v) => {
          const inT = clip.transitions.in ? { ...clip.transitions.in, duration: v } : undefined
          const outT = clip.transitions.out ? { ...clip.transitions.out, duration: v } : undefined
          updateClip(clip.id, { transitions: { in: inT, out: outT } })
        }}
      />
    </div>
  )
}

// ─── Stickers Section ─────────────────────────────────────────────────────────
function StickersSection() {
  const config = useApiConfigStore((s) => s.config)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<StickerResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const hasKey = Boolean(config.giphy.apiKey)

  React.useEffect(() => {
    if (hasKey) void loadTrending()
  }, [])

  const loadTrending = async () => {
    setLoading(true)
    setError(null)
    const r = await searchGiphyTrending()
    if (r.length === 0) setError('No trending stickers. Check your Giphy API key in Settings.')
    setResults(r)
    setLoading(false)
  }

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    const r = await searchGiphy(query.trim())
    if (r.length === 0) setError('No stickers found. Try different terms.')
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

  return (
    <div className="space-y-3 p-3">
      {!hasKey && (
        <p className="text-muted-foreground text-[10px]">
          Add a Giphy API key in Settings → Stickers. Get a free key at developers.giphy.com.
        </p>
      )}
      <div className="flex gap-1.5">
        <Input
          placeholder="Search stickers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 px-2" onClick={() => void search()} disabled={loading || !hasKey || !query.trim()}>
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
              title={r.title || 'Sticker'}
            >
              <img src={r.preview} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {importingId === r.id ? <Loader2 className="size-4 animate-spin text-white" /> : <Download className="size-4 text-white" />}
              </div>
            </button>
          ))}
        </div>
      )}
      {results.length === 0 && !loading && (
        <EmptyHint text={hasKey ? 'Search for GIF stickers to add to your timeline.' : 'Add a Giphy API key in Settings to use stickers.'} icon={Smile} />
      )}
    </div>
  )
}

// ─── Effects Section ──────────────────────────────────────────────────────────
function EffectsSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)
  const denoise = useDenoiseAction()
  const [denoiseBusy, setDenoiseBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const runDenoise = async () => {
    if (!clip || denoiseBusy) return
    setDenoiseBusy(true)
    try {
      await denoise.run(clip.id)
      setNotice({ kind: 'ok', text: 'Denoised audio created and added to timeline' })
    } catch {
      setNotice({ kind: 'error', text: denoise.error ?? 'Denoise failed' })
    } finally {
      setDenoiseBusy(false)
    }
  }

  const getEffect = (type: EffectType): number => {
    if (!clip) return 0
    const e = clip.effects.find((fx) => fx.type === type)
    return e?.value ?? 0
  }

  const setEffect = (type: EffectType, value: number) => {
    if (!clip) return
    const existing = clip.effects.findIndex((fx) => fx.type === type)
    const effects = [...clip.effects]
    if (existing >= 0) {
      effects[existing] = { ...effects[existing], value }
    } else {
      effects.push(createEffect(type, value))
    }
    updateClip(clip.id, { effects })
  }

  if (!clip) return <EmptyHint text="Select a clip to adjust its effects." icon={Sparkles} />

  return (
    <div className="space-y-3 p-3">
      {notice && <SectionNotice kind={notice.kind} text={notice.text} />}
      <EffectSlider label="Brightness" value={getEffect('brightness')} min={-1} max={1} onChange={(v) => setEffect('brightness', v)} />
      <EffectSlider label="Contrast" value={getEffect('contrast')} min={-1} max={1} onChange={(v) => setEffect('contrast', v)} />
      <EffectSlider label="Saturation" value={getEffect('saturation')} min={-1} max={1} onChange={(v) => setEffect('saturation', v)} />
      <EffectSlider label="Blur" value={getEffect('blur')} min={0} max={20} step={0.5} onChange={(v) => setEffect('blur', v)} />
      <EffectSlider label="Grayscale" value={getEffect('grayscale')} min={0} max={1} onChange={(v) => setEffect('grayscale', v)} />
      <EffectSlider label="Vignette" value={getEffect('vignette')} min={0} max={1} onChange={(v) => setEffect('vignette', v)} />
      <EffectSlider label="Temperature" value={getEffect('temperature')} min={-1} max={1} onChange={(v) => setEffect('temperature', v)} />
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
        <div className="relative flex justify-center text-[10px]"><span className="bg-card px-2 text-muted-foreground">audio</span></div>
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={() => void runDenoise()} disabled={denoiseBusy}>
        {denoiseBusy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
        {denoiseBusy ? 'Denoising...' : 'Denoise Audio'}
      </Button>
    </div>
  )
}

// ─── Speed Section ────────────────────────────────────────────────────────────
function SpeedSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to adjust its playback speed." icon={Play} />

  const presets = [0.25, 0.5, 1, 1.5, 2, 4]

  return (
    <div className="space-y-3 p-3">
      <EffectSlider
        label="Speed"
        value={clip.speed}
        min={0.25}
        max={4}
        step={0.25}
        onChange={(v) => updateClip(clip.id, { speed: v })}
      />
      <div className="grid grid-cols-6 gap-1">
        {presets.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={clip.speed === p ? 'default' : 'outline'}
            className="h-7 text-[10px]"
            onClick={() => updateClip(clip.id, { speed: p })}
          >
            {p}x
          </Button>
        ))}
      </div>
    </div>
  )
}

// ─── Keyframe Section ─────────────────────────────────────────────────────────
function KeyframeSection() {
  const clip = getSelectedClip()
  if (!clip) return <EmptyHint text="Select a clip to add keyframes for animating properties over time." icon={Play} />

  return (
    <div className="space-y-3 p-3">
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Use the timeline controls to add keyframes. Click the keyframe button on any clip property to set a keyframe at the current playhead position.
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Animatable Properties</Label>
        {['Position X', 'Position Y', 'Scale', 'Rotation', 'Opacity'].map((prop) => (
          <div key={prop} className="flex items-center justify-between rounded border px-2 py-1">
            <span className="text-[11px]">{prop}</span>
            <span className="text-muted-foreground text-[10px]">0</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Crop Section ─────────────────────────────────────────────────────────────
function CropSection() {
  const clip = getSelectedClip()
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to crop or reframe it." icon={Image} />

  const aspectPresets = ['16:9', '9:16', '1:1', '4:5', 'free'] as const

  return (
    <div className="space-y-3 p-3">
      <Label className="text-xs">Aspect Ratio</Label>
      <div className="grid grid-cols-3 gap-1">
        {aspectPresets.map((preset) => {
          const isActive = clip.reframing?.targetAspect === preset || (!clip.reframing && preset === 'free')
          return (
            <Button
              key={preset}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() =>
                updateClip(clip.id, {
                  reframing: {
                    enabled: preset !== 'free',
                    targetAspect: preset,
                    followStrength: 0.6,
                  },
                })
              }
            >
              {preset}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────
interface RightToolPanelProps {
  section: ToolSection
  onCollapse: () => void
}

const SECTION_COMPONENTS: Record<ToolSection, React.FC> = {
  effects: EffectsSection,
  audio: AudioSection,
  captions: CaptionsSection,
  '3d': ThreeDSection,
  transitions: TransitionsSection,
  stickers: StickersSection,
  speed: SpeedSection,
  keyframe: KeyframeSection,
  crop: CropSection,
  slide: SlideSection,
  avatar: AvatarSection,
}

export function RightToolPanel({ section, onCollapse }: RightToolPanelProps) {
  const sectionMeta = TOOL_SECTIONS.find((s) => s.id === section)
  const SectionContent = SECTION_COMPONENTS[section]

  return (
    <div className="flex h-full w-72 flex-col border-l bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          {sectionMeta && <sectionMeta.icon className="size-3.5 text-muted-foreground" />}
          <span className="text-xs font-semibold">{sectionMeta?.label ?? section}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCollapse}>
          <ChevronLeft className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {SectionContent && <SectionContent />}
      </div>
    </div>
  )
}
