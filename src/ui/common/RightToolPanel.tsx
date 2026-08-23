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
  Code,
  Plus,
  ScrollText,
  ArrowLeftRight,
  Diamond,
  Gauge,
  Crop,
  Presentation,
  ImagePlus,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import type { Clip, EffectType, TextOverlay } from '@/engine/types'
import { createEffect } from '@/engine/types'
import { upsertKeyframe, removeKeyframe } from '@/lib/keyframes'
import { generateSlides, renderSlidePng, type SlideTheme } from '@/api/llm/slides'
import { generateMarpSlides, type MarpTheme } from '@/api/llm/marp'
import { generateLipsyncVideo, type AvatarMouth } from '@/engine/avatar'
import { readMediaFile } from '@/engine/storage/opfs'
import { searchMusic, type MusicTrackResult } from '@/api/music/search'
import { searchModels, downloadModelAsGlb } from '@/api/models/polyhaven'
import { searchSketchfabModels, downloadSketchfabGlb } from '@/api/models/sketchfab'
import { defaultCameraRig } from '@/engine/types'
import { Checkbox } from '@/components/ui/checkbox'
import { searchGiphy, searchGiphyTrending, downloadGiphy, type StickerResult } from '@/api/stickers/search'
import { convertStickerGif } from '@/engine/stickers/gifToVideo'
import { useDenoiseAction } from '@/hooks/useDenoiseAction'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type ToolSection =
  | 'insights'
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
  | 'design'
  | 'script'
  | 'images'

const TOOL_SECTIONS: { id: ToolSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'captions', label: 'Captions', icon: FileText },
  { id: '3d', label: '3D', icon: Box },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'speed', label: 'Speed', icon: Gauge },
  { id: 'keyframe', label: 'Keyframe', icon: Diamond },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'slide', label: 'Slides', icon: Presentation },
  { id: 'avatar', label: 'Avatar', icon: Clapperboard },
  { id: 'design', label: 'Design', icon: Code },
  { id: 'script', label: 'Script', icon: ScrollText },
  { id: 'images', label: 'Images', icon: ImagePlus },
]

const SECTION_DESCRIPTIONS: Partial<Record<ToolSection, string>> = {
  insights: 'Project health, coverage and quality',
  effects: 'Color, light and stylized looks',
  audio: 'Music, voice and sound cleanup',
  captions: 'Text overlays and titles',
  '3d': 'Search, download and animate models',
  transitions: 'How clips flow into each other',
  stickers: 'Animated GIF overlays',
  speed: 'Clip playback rate presets',
  keyframe: 'Animation basics for clips',
  crop: 'Framing and aspect ratio',
  slide: 'AI presentations via Marp',
  avatar: 'Lip-synced AI presenters',
  design: 'HTML/CSS motion infographics',
  script: 'Structured video scripts',
  images: 'Free stock photo search',
}

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
  const [format, setFormat] = React.useState<'standard' | 'marp'>('marp')
  const [theme, setTheme] = React.useState<SlideTheme>('clean')
  const [marpTheme, setMarpTheme] = React.useState<MarpTheme>('gaia')
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [previews, setPreviews] = React.useState<Array<{ blob: Blob; url: string; title: string; bullets: string[] }>>([])
  const [selectedSlides, setSelectedSlides] = React.useState<Set<number>>(new Set())
  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url))
  }, [previews])

  const generate = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    setPreviews([])
    setSelectedSlides(new Set())
    try {
      const newPreviews: Array<{ blob: Blob; url: string; title: string; bullets: string[] }> = []
      if (format === 'marp') {
        setProgress('Generating Marp deck...')
        const deck = await generateMarpSlides({
          topic: topic.trim(),
          count,
          theme: marpTheme,
          onProgress: (done, total) => setProgress(`Rendering slide ${done}/${total}...`),
        })
        deck.pngs.forEach((blob, i) => {
          newPreviews.push({ blob, url: URL.createObjectURL(blob), title: i === 0 ? deck.title : `Slide ${i + 1}`, bullets: [] })
        })
      } else {
        setProgress('Generating slide content...')
        const deck = await generateSlides({ topic: topic.trim(), count })
        for (let i = 0; i < deck.slides.length; i++) {
          setProgress(`Rendering slide ${i + 1}/${deck.slides.length}...`)
          const blob = await renderSlidePng(deck.slides[i], i + 1, deck.slides.length, theme, 1280, 720)
          const url = URL.createObjectURL(blob)
          newPreviews.push({ blob, url, title: deck.slides[i].title, bullets: deck.slides[i].bullets })
        }
      }
      setPreviews(newPreviews)
      setSelectedSlides(new Set(newPreviews.map((_, i) => i)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const toggleSlide = (idx: number) => {
    setSelectedSlides((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const addToTimeline = async () => {
    if (previews.length === 0 || adding) return
    setAdding(true)
    setError(null)
    try {
      const files = previews
        .filter((_, i) => selectedSlides.has(i))
        .map((p, _, arr) => new File([p.blob], `slide-${arr.indexOf(p) + 1}-${Date.now()}.png`, { type: 'image/png' }))
      if (!files.length) { setAdding(false); return }
      const { imported } = await importFiles(files)
      if (imported.length) {
        const store = useTimelineStore.getState()
        const videoTrack = store.project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const perSlide = 5
          imported.forEach((asset, idx) => {
            const newClip = store.addClip(asset.id, videoTrack.id)
            if (newClip) store.updateClip(newClip.id, { startTime: idx * perSlide, duration: perSlide })
          })
        }
        setSuccess(`Added ${imported.length} slides to timeline`)
        setPreviews([])
        setSelectedSlides(new Set())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
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
          <Input type="number" min={1} max={6} value={count} onChange={(e) => setCount(Math.max(1, Math.min(6, Number(e.target.value))))} className="h-8 text-xs" disabled={busy} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as 'standard' | 'marp')} disabled={busy}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="marp">Marp</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {format === 'marp' ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Marp Theme</Label>
          <Select value={marpTheme} onValueChange={(v) => setMarpTheme(v as MarpTheme)} disabled={busy}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gaia">Gaia (dark)</SelectItem>
              <SelectItem value="uncover">Uncover (light)</SelectItem>
              <SelectItem value="default">Default (white)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as SlideTheme)} disabled={busy}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="gradient">Gradient</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button size="sm" className="w-full" onClick={() => void generate()} disabled={busy || !topic.trim()}>
        {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
        {busy ? progress || 'Generating...' : 'Generate Slides'}
      </Button>
      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      {previews.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Preview ({selectedSlides.size}/{previews.length} selected)</Label>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelectedSlides(new Set(previews.map((_, i) => i)))}>
              Select All
            </Button>
          </div>
          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {previews.map((p, i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  'group relative overflow-hidden rounded border transition-all',
                  selectedSlides.has(i) ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-muted opacity-60 hover:opacity-100',
                )}
                onClick={() => toggleSlide(i)}
              >
                <img src={p.url} alt={p.title} className="w-full" />
                <div className="absolute top-1 right-1">
                  <div className={cn('flex size-4 items-center justify-center rounded-full border text-[10px]', selectedSlides.has(i) ? 'border-violet-500 bg-violet-500 text-white' : 'border-muted bg-card')}>
                    {selectedSlides.has(i) ? '✓' : ''}
                  </div>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-white text-[11px] font-medium truncate">{p.title}</p>
                </div>
              </button>
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={() => void addToTimeline()} disabled={adding || selectedSlides.size === 0}>
            {adding ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Plus className="mr-2 size-3.5" />}
            {adding ? 'Adding...' : `Add ${selectedSlides.size} Slides to Timeline`}
          </Button>
        </div>
      )}
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
  }, [images, audios, imageAssetId, audioAssetId])

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
        const clip = useTimelineStore.getState().addAssetToTimeline(imported[0].id)
        if (clip) setSuccess(`Generated ${result.duration.toFixed(1)}s lip-sync video — added to timeline`)
        else setError('No video track available for the generated clip')
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
    const { imported, errors } = await importFiles(Array.from(files))
    for (const asset of imported) useTimelineStore.getState().addAssetToTimeline(asset.id)
    if (errors.length) setSearchError(errors[0])
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
      if (imported.length) {
        const clip = useTimelineStore.getState().addAssetToTimeline(imported[0].id)
        setNotice(clip
          ? { kind: 'ok', text: `Added "${track.title}" to timeline` }
          : { kind: 'error', text: 'No audio track available' })
      } else setNotice({ kind: 'error', text: errors[0] ?? 'Import failed' })
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
type ModelResult = {
  id: string
  name: string
  categories: string[]
  polycount: number
  source: 'polyhaven' | 'sketchfab'
}

function ThreeDSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [source, setSource] = React.useState<'polyhaven' | 'sketchfab'>('polyhaven')
  const [animateMode, setAnimateMode] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<ModelResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [downloading, setDownloading] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    try {
      if (source === 'sketchfab') {
        const models = await searchSketchfabModels(query, { maxResults: 12 })
        setResults(models.map((m) => ({ ...m, source: 'sketchfab' as const })))
        if (!models.length) setError('No downloadable models found on Sketchfab.')
      } else {
        const models = await searchModels(query, { maxResults: 12 })
        setResults(models.map((m) => ({ ...m, source: 'polyhaven' as const })))
        if (!models.length) setError('No models found on Poly Haven.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSearching(false)
    }
  }

  const downloadAndImport = async (model: ModelResult) => {
    if (downloading) return
    setDownloading(model.id)
    setError(null)
    setSuccess(null)
    try {
      const file =
        model.source === 'sketchfab'
          ? await downloadSketchfabGlb(model.id)
          : await downloadModelAsGlb(model.id, { resolution: '2k' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        if (animateMode) {
          setSuccess(`Loading 3D engine & rendering "${imported[0].name}"...`)
          const asset = imported[0]
          const rig = defaultCameraRig()
          rig.radiusStart = (asset.modelRadius ?? 2.4) * 2.5
          rig.radiusEnd = rig.radiusStart
          // Lazy: three.js + renderer load on first animated-model request only.
          const { renderGlbToVideo } = await import('@/engine/three/renderGlbToVideo')
          const rendered = await renderGlbToVideo({ asset, rig, duration: 5, fps: 30, width: 1280, height: 720 })
          const videoFile = new File([rendered.blob], `${model.name.replace(/\W+/g, '-').toLowerCase()}-anim-${Date.now()}.webm`, { type: 'video/webm' })
          const store = useTimelineStore.getState()
          const vimp = await store.importFiles([videoFile])
          const track = store.project.tracks.find((t) => t.type === 'video')
          if (track && vimp.imported.length) {
            const clip = store.addClip(vimp.imported[0].id, track.id)
            if (clip) store.updateClip(clip.id, { duration: 5, sourceEnd: 5 })
            setSuccess(`Added "${vimp.imported[0].name}" (5s turntable) to timeline`)
          } else {
            setError('Animation render could not be imported')
          }
        } else {
          const clip = useTimelineStore.getState().addAssetToTimeline(imported[0].id)
          if (clip) setSuccess(`Added "${imported[0].name}" to timeline`)
          else setError('No video track available for the model')
        }
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
        <span className="text-[10px] text-muted-foreground">
          {source === 'sketchfab' ? 'Downloadable models from Sketchfab' : 'Free CC0 models from Poly Haven'}
        </span>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Source</Label>
        <Select value={source} onValueChange={(v) => { setSource(v as 'polyhaven' | 'sketchfab'); setResults([]) }} disabled={searching}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="polyhaven">Poly Haven (CC0)</SelectItem>
            <SelectItem value="sketchfab">Sketchfab</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
        <Checkbox checked={animateMode} onCheckedChange={(v) => setAnimateMode(v === true)} className="size-3" />
        Render as 5s turntable video clip
      </label>
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
  const [importPhase, setImportPhase] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const hasKey = Boolean(config.giphy.apiKey)

  React.useEffect(() => {
    if (hasKey) void loadTrending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey])

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
    if (importingId) return
    setImportingId(result.id)
    setImportPhase('Downloading…')
    setError(null)
    try {
      const gifFile = await downloadGiphy(result)
      setImportPhase('Converting to video…')
      // GIF → WebM (cached by sticker id, so re-adding never re-converts).
      const converted = await convertStickerGif(gifFile, result.id, (p) => {
        if (p.phase === 'encoding') {
          setImportPhase(`Encoding frames ${p.done}/${p.total}…`)
        } else if (p.phase === 'decoding') {
          setImportPhase('Decoding animation frames…')
        }
      })
      const { imported } = await importFiles([converted.webmFile])
      if (imported.length) {
        const clip = useTimelineStore.getState().addAssetToTimeline(imported[0].id)
        if (!clip) setError('No video track available for the sticker')
      } else setError('Failed to import sticker')
    } catch {
      setError('Failed to import sticker')
    } finally {
      setImportingId(null)
      setImportPhase(null)
    }
  }

  return (
    <div className="space-y-3 p-3">
      {!hasKey && (
        <p className="text-muted-foreground text-[10px]">
          Add a Giphy API key in Settings → Stickers. Get a free key at developers.giphy.com.
        </p>
      )}
      {hasKey && (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Animated stickers are converted to looping video clips on import. Note: browser encoders can't preserve GIF transparency yet — transparent areas become black.
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
              disabled={importingId === r.id}
            >
              <img src={r.preview} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              {importingId === r.id ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 px-1">
                  <Loader2 className="size-4 animate-spin text-white" />
                  <span className="text-center text-[9px] leading-tight text-white">{importPhase ?? 'Importing…'}</span>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Download className="size-4 text-white" />
                </div>
              )}
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
  const playhead = useTimelineStore((s) => s.playhead)
  const updateClip = useTimelineStore((s) => s.updateClip)

  if (!clip) return <EmptyHint text="Select a clip to view and manage keyframes." icon={Diamond} />

  const keyframes = clip.keyframes ?? []
  const clipLocalTime = Math.max(0, Math.min(clip.duration, playhead - clip.startTime))

  const addKeyframeFor = (prop: string, val: number) => {
    const updated = upsertKeyframe(keyframes, prop, clipLocalTime, val)
    updateClip(clip.id, { keyframes: updated })
  }

  const deleteKeyframe = (id: string) => {
    const updated = removeKeyframe(keyframes, id)
    updateClip(clip.id, { keyframes: updated })
  }

  const clearAll = () => {
    updateClip(clip.id, { keyframes: [] })
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Keyframes: {clip.name}</span>
        <span className="text-muted-foreground font-mono text-[10px]">{keyframes.length} keyframes</span>
      </div>

      <div className="space-y-1 rounded border bg-muted/20 p-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Clip Time:</span>
          <span className="font-mono">{clipLocalTime.toFixed(2)}s / {clip.duration.toFixed(2)}s</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Add Keyframe at Playhead</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => addKeyframeFor('opacity', clip.opacity ?? 1)}
          >
            + Opacity ({((clip.opacity ?? 1) * 100).toFixed(0)}%)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => addKeyframeFor('rotation', clip.rotation ?? 0)}
          >
            + Rotation ({(clip.rotation ?? 0).toFixed(0)}°)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => addKeyframeFor('scale.x', clip.scale?.x ?? 1)}
          >
            + Scale X ({(clip.scale?.x ?? 1).toFixed(2)})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => addKeyframeFor('position.y', clip.position?.y ?? 0)}
          >
            + Pos Y ({(clip.position?.y ?? 0).toFixed(0)})
          </Button>
        </div>
      </div>

      {keyframes.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Active Keyframes</Label>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={clearAll}>
              Clear All
            </Button>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {keyframes.map((kf) => (
              <div key={kf.id} className="flex items-center justify-between rounded border bg-card px-2 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <Diamond className="size-3 text-violet-400" />
                  <span className="font-mono font-medium">{kf.prop}</span>
                  <span className="text-muted-foreground text-[10px] font-mono">@{kf.time.toFixed(2)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]">{typeof kf.value === 'number' ? kf.value.toFixed(2) : kf.value}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteKeyframe(kf.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-xs">No keyframes on this clip yet.</p>
      )}
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

// ─── Design Section ───────────────────────────────────────────────────────────
function DesignSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const [prompt, setPrompt] = React.useState('')
  const [html, setHtml] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [rendering, setRendering] = React.useState(false)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const updatePreview = React.useCallback((code: string) => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(code)
    doc.close()
  }, [])

  React.useEffect(() => {
    if (html) updatePreview(html)
  }, [html, updatePreview])

  const generateDesign = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { chatCompletion, getDirectorProvider } = await import('@/api/llm/director')
      const provider = getDirectorProvider()
      if (!provider) throw new Error('No AI provider configured. Add one in Settings.')

      const systemPrompt = `You are an expert web designer and developer. Generate a SINGLE self-contained HTML file that includes all CSS and JS inline. The design should be visually stunning, modern, and professional.

Rules:
- Return ONLY the raw HTML code, no markdown fences, no explanations
- Include all CSS in a <style> tag in the <head>
- Include all JS in a <script> tag at the end of <body>
- Use modern CSS (flexbox, grid, gradients, animations, backdrop-filter)
- Use a cohesive color palette (dark theme preferred: #0f172a, #1e293b, #334155, #8b5cf6, #06b6d4)
- Make it responsive and beautiful
- Use Google Fonts (Inter, Poppins, or similar) via CDN link
- Add subtle animations and transitions
- The design should fill the full viewport (100vw x 100vh)
- Make it production-quality, not a toy example`

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `Create a stunning web design for: "${prompt.trim()}"

Requirements:
- Modern, professional, visually impressive
- Dark theme with accent colors
- Smooth animations and micro-interactions
- Responsive layout
- Clean typography

Return ONLY the complete HTML code:` },
      ]

      const reply = await chatCompletion(provider, messages)
      let generated = reply.content ?? ''

      // Strip markdown code fences if present
      generated = generated.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '')
      const startIdx = generated.indexOf('<')
      if (startIdx > 0) generated = generated.slice(startIdx)

      setHtml(generated)
      updatePreview(generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const addDesignToTimeline = async () => {
    if (!html || rendering) return
    setRendering(true)
    setError(null)
    try {
      const { renderHtmlToPng } = await import('@/engine/motion/sandbox')
      const blob = await renderHtmlToPng(html, 1920, 1080)
      const file = new File([blob], `design-${Date.now()}.png`, { type: 'image/png' })
      const { imported } = await importFiles([file])
      if (imported.length) {
        const store = useTimelineStore.getState()
        const videoTrack = store.project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const newClip = store.addClip(imported[0].id, videoTrack.id)
          if (newClip) store.updateClip(newClip.id, { duration: 5 })
        }
        setSuccess('Design added to timeline as a 5s clip')
        setHtml('')
        setPrompt('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Describe your design</Label>
        <Input
          placeholder="e.g. Landing page for AI startup, pricing section, hero banner..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void generateDesign() } }}
          className="h-8 text-xs"
          disabled={busy}
        />
      </div>
      <Button size="sm" className="w-full" onClick={() => void generateDesign()} disabled={busy || !prompt.trim()}>
        {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
        {busy ? 'Generating...' : 'Generate Design'}
      </Button>
      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      {html && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-[10px]"><span className="bg-card px-2 text-muted-foreground">preview</span></div>
          </div>
          <div className="overflow-hidden rounded border">
            <iframe
              ref={iframeRef}
              title="Design Preview"
              className="h-40 w-full bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">HTML Code</Label>
            <textarea
              value={html}
              onChange={(e) => { setHtml(e.target.value); updatePreview(e.target.value) }}
              className="h-32 w-full resize-none rounded border bg-muted p-2 font-mono text-[10px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
            />
          </div>
          <Button size="sm" className="w-full" onClick={() => void addDesignToTimeline()} disabled={rendering || !html}>
            {rendering ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Plus className="mr-2 size-3.5" />}
            {rendering ? 'Rendering...' : 'Add Design to Timeline'}
          </Button>
        </>
      )}

      {!html && !busy && (
        <EmptyHint text="Describe a design concept and the AI will generate HTML/CSS/JS code with a live preview. Edit the code and add it to your timeline as an image clip." icon={Code} />
      )}
    </div>
  )
}

// ─── Script Section ───────────────────────────────────────────────────────────
function ScriptSection() {
  const [topic, setTopic] = React.useState('')
  const [scenes, setScenes] = React.useState(4)
  const [tone, setTone] = React.useState('educational')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [script, setScript] = React.useState<string>('')

  const generate = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    setScript('')
    try {
      const { chatCompletion, getDirectorProvider } = await import('@/api/llm/director')
      const provider = getDirectorProvider()
      if (!provider) throw new Error('No AI provider configured. Add one in Settings.')
      const messages = [
        { role: 'system' as const, content: `You write video scripts. Output JSON only:
{
  "title": "Video Title",
  "scenes": [
    { "scene": 1, "visual": "Description of visuals", "narration": "Voiceover text", "duration": 5 }
  ]
}
Rules: ${scenes} scenes. Tone: ${tone}. Each scene 5-10s. No markdown.` },
        { role: 'user' as const, content: `Topic: "${topic.trim()}"` },
      ]
      const reply = await chatCompletion(provider, messages)
      let content = reply.content ?? ''
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      setScript(content)
      setSuccess('Script generated. Copy or save as text file.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Topic</Label>
        <Input placeholder="e.g. How solar panels work" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-8 text-xs" disabled={busy} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Scenes</Label>
          <Input type="number" min={1} max={10} value={scenes} onChange={(e) => setScenes(Math.max(1, Math.min(10, Number(e.target.value))))} className="h-8 text-xs" disabled={busy} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tone</Label>
          <Select value={tone} onValueChange={setTone} disabled={busy}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="educational">Educational</SelectItem>
              <SelectItem value="promotional">Promotional</SelectItem>
              <SelectItem value="storytelling">Storytelling</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" className="w-full" onClick={() => void generate()} disabled={busy || !topic.trim()}>
        {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
        {busy ? 'Generating...' : 'Generate Script'}
      </Button>
      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}
      {script && (
        <div className="space-y-2">
          <Label className="text-xs">Generated Script (JSON)</Label>
          <textarea value={script} readOnly className="h-48 w-full rounded border bg-muted p-2 font-mono text-[10px] leading-relaxed" />
          <Button size="sm" variant="outline" className="w-full" onClick={() => navigator.clipboard.writeText(script)}>Copy JSON</Button>
        </div>
      )}
    </div>
  )
}

// ─── Images Section ───────────────────────────────────────────────────────────
function ImagesSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const config = useApiConfigStore((s) => s.config)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<Array<{ id: string; url: string; thumb: string; alt: string }>>([])
  const [searching, setSearching] = React.useState(false)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    setResults([])
    try {
      const providers = []
      if (config.stockImages.unsplash.enabled && config.stockImages.unsplash.accessKey) {
        providers.push(searchUnsplash(query.trim(), 8))
      }
      if (config.stockImages.pexels.enabled && config.stockImages.pexels.apiKey) {
        providers.push(searchPexels(query.trim(), 8))
      }
      if (config.stockImages.pixabay.enabled && config.stockImages.pixabay.apiKey) {
        providers.push(searchPixabay(query.trim(), 8))
      }
      if (providers.length === 0) {
        setError('Configure at least one stock image provider in Settings.')
        setSearching(false)
        return
      }
      const allResults = (await Promise.all(providers)).flat()
      setResults(allResults.slice(0, 12))
      if (!allResults.length) setError('No images found.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSearching(false)
    }
  }

  const importImage = async (item: { id: string; url: string; alt: string }) => {
    setImportingId(item.id)
    try {
      const res = await fetch(item.url)
      const blob = await res.blob()
      const file = new File([blob], `${item.alt || 'image'}-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        const clip = useTimelineStore.getState().addAssetToTimeline(imported[0].id)
        if (clip) setSuccess(`Added "${imported[0].name}" to timeline`)
        else setError('No video track available for the image')
      } else setError(errors[0] ?? 'Import failed')
    } catch {
      setError('Download failed')
    } finally {
      setImportingId(null)
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex gap-1.5">
        <Input placeholder="Search stock images..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search() }} className="h-8 text-xs" />
        <Button size="sm" className="h-8 px-2" onClick={() => void search()} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </Button>
      </div>
      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}
      {results.length > 0 && (
        <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto">
          {results.map((r) => (
            <button key={r.id} type="button" className="group relative overflow-hidden rounded border bg-muted" onClick={() => void importImage(r)} disabled={importingId === r.id}>
              <img src={r.thumb} alt={r.alt} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {importingId === r.id ? <Loader2 className="size-4 animate-spin text-white" /> : <Download className="size-4 text-white" />}
              </div>
            </button>
          ))}
        </div>
      )}
      {results.length === 0 && !searching && (
        <EmptyHint text="Configure stock image providers in Settings (Unsplash, Pexels, Pixabay) to search images." icon={Image} />
      )}
    </div>
  )
}

async function searchUnsplash(query: string, limit: number) {
  const cfg = useApiConfigStore.getState().config.stockImages.unsplash
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}&client_id=${cfg.accessKey}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map((p: any) => ({ id: p.id, url: p.urls.regular, thumb: p.urls.thumb, alt: p.alt_description || query }))
}

async function searchPexels(query: string, limit: number) {
  const cfg = useApiConfigStore.getState().config.stockImages.pexels
  if (!cfg.apiKey) return []
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}`, { headers: { Authorization: cfg.apiKey } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.photos ?? []).map((p: any) => ({ id: String(p.id), url: p.src.large, thumb: p.src.medium, alt: p.alt || query }))
}

async function searchPixabay(query: string, limit: number) {
  const cfg = useApiConfigStore.getState().config.stockImages.pixabay
  const res = await fetch(`https://pixabay.com/api/?key=${cfg.apiKey}&q=${encodeURIComponent(query)}&per_page=${limit}&image_type=photo`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.hits ?? []).map((h: any) => ({ id: String(h.id), url: h.largeImageURL, thumb: h.webformatURL, alt: h.tags || query }))
}

// ─── Insights Section ─────────────────────────────────────────────────────────
interface InsightIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  fixLabel?: string
  apply: (() => void) | null
}

function InsightsSection() {
  const project = useTimelineStore((s) => s.project)
  const assets = useTimelineStore((s) => s.assets)
  const [scanning, setScanning] = React.useState(false)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [coverage, setCoverage] = React.useState({ transcripts: 0, ocr: 0, playable: 0 })
  const [issues, setIssues] = React.useState<InsightIssue[]>([])

  const stats = React.useMemo(() => {
    const clips = project.tracks.flatMap((t) => t.clips)
    const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0)
    const byType = { video: 0, audio: 0, image: 0, model: 0 } as Record<string, number>
    for (const a of assets) byType[a.type] = (byType[a.type] ?? 0) + 1
    return {
      clipCount: clips.length,
      assetCount: assets.length,
      duration: totalDuration,
      byType,
      tracks: project.tracks.length,
    }
  }, [project, assets])

  const scan = React.useCallback(async () => {
    if (scanning) return
    setScanning(true)
    try {
      const store = useTimelineStore.getState()
      const playableAssets = new Set<string>()
      for (const track of store.project.tracks) {
        for (const clip of track.clips) {
          const asset = store.assets.find((a) => a.id === clip.assetId)
          if (asset && asset.type !== 'image') playableAssets.add(asset.id)
        }
      }
      let transcripts = 0
      let ocrCount = 0
      for (const id of playableAssets) {
        const { getStoredTranscript, getStoredOcr } = await import('@/api/llm/understanding')
        const [t, o] = await Promise.all([getStoredTranscript(id).catch(() => undefined), getStoredOcr(id).catch(() => undefined)])
        if (t) transcripts++
        if (o?.regions?.length) ocrCount++
      }
      setCoverage({ transcripts, ocr: ocrCount, playable: playableAssets.size })

      // Quality check
      type QualityIssueLike = {
        severity: 'error' | 'warning' | 'info'
        message: string
        fix: { kind: string; label?: string; clipIds?: string[]; moveClipId?: string; targetTime?: number }
      }
      const { checkTimeline } = await import('@/ai/quality/checker')
      const found = checkTimeline(store.project, store.assets) as QualityIssueLike[]
      setIssues(
        found.map((i): InsightIssue => ({
          severity: i.severity,
          message: i.message,
          fixLabel: i.fix.kind !== 'none' ? i.fix.label ?? 'Fix' : undefined,
          apply:
            i.fix.kind === 'remove_clip' && i.fix.clipIds?.length
              ? () => useTimelineStore.getState().deleteClips(i.fix.clipIds!)
              : i.fix.kind === 'resolve_overlap' && i.fix.moveClipId && i.fix.targetTime != null
                ? () => {
                    const st = useTimelineStore.getState()
                    const clip = st.project.tracks.flatMap((t) => t.clips).find((c) => c.id === i.fix.moveClipId)
                    if (!clip) return
                    const delta = i.fix.targetTime! - clip.startTime
                    if (Math.abs(delta) >= 0.01) st.moveClip(clip.id, delta)
                  }
                : null,
        })),
      )
    } finally {
      setScanning(false)
    }
  }, [scanning])

  React.useEffect(() => {
    void scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.tracks.length, assets.length])

  const runFullAnalysis = async () => {
    if (analyzing) return
    setAnalyzing(true)
    setError(null)
    try {
      const { analyzeProject } = await import('@/api/llm/analysis')
      await analyzeProject((done, total) => setProgress(`Analyzing clip ${done}/${total}...`))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAnalyzing(false)
      setProgress('')
      void scan()
    }
  }

  const fixable = issues.filter((i) => i.apply).length
  const coveragePct = coverage.playable ? Math.round((coverage.transcripts / coverage.playable) * 100) : 100
  const ocrPct = coverage.playable ? Math.round((coverage.ocr / coverage.playable) * 100) : 100

  return (
    <div className="space-y-4 p-3">
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Clips', value: String(stats.clipCount) },
          { label: 'Assets', value: String(stats.assetCount) },
          { label: 'Duration', value: formatSeconds(stats.duration) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-muted/40 px-2 py-2 text-center">
            <div className="text-sm font-semibold">{s.value}</div>
            <div className="text-muted-foreground text-[9px] uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {stats.byType.video > 0 && <StatChip label={`${stats.byType.video} video`} />}
        {stats.byType.audio > 0 && <StatChip label={`${stats.byType.audio} audio`} />}
        {stats.byType.image > 0 && <StatChip label={`${stats.byType.image} image`} />}
        {stats.byType.model > 0 && <StatChip label={`${stats.byType.model} 3D`} />}
      </div>

      <div className="space-y-2 rounded-lg border p-2.5">
        <CoverageBar label={`Transcripts (${coverage.transcripts}/${coverage.playable})`} pct={coveragePct} />
        <CoverageBar label={`Frame text / OCR (${coverage.ocr}/${coverage.playable})`} pct={ocrPct} />
      </div>

      <Button size="sm" className="h-8 w-full text-xs" onClick={() => void runFullAnalysis()} disabled={analyzing}>
        {analyzing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
        {analyzing ? progress || 'Analyzing...' : 'Analyze project (transcribe + OCR)'}
      </Button>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Quality</span>
          {fixable > 0 && (
            <button
              type="button"
              className="text-[10px] font-medium text-violet-500 hover:underline"
              onClick={() => {
                for (const issue of issues) issue.apply?.()
                void scan()
              }}
            >
              Fix all ({fixable})
            </button>
          )}
        </div>
        {!scanning && issues.length === 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5 shrink-0" />
            No issues found — timeline looks clean.
          </div>
        )}
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2',
              issue.severity === 'error'
                ? 'border-destructive/40 bg-destructive/5'
                : issue.severity === 'warning'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-border bg-muted/30',
            )}
          >
            <div className="flex min-w-0 items-start gap-1.5">
              <AlertTriangle
                className={cn(
                  'mt-0.5 size-3 shrink-0',
                  issue.severity === 'error' ? 'text-destructive' : issue.severity === 'warning' ? 'text-amber-500' : 'text-muted-foreground',
                )}
              />
              <span className="text-[11px] leading-snug">{issue.message}</span>
            </div>
            {issue.apply && (
              <Button variant="ghost" size="sm" className="h-5 shrink-0 px-1.5 text-[10px]" onClick={() => { issue.apply?.(); void scan() }}>
                Fix
              </Button>
            )}
          </div>
        ))}
      </div>

      {error && <SectionNotice kind="error" text={error} />}
      {scanning && <div className="text-center text-[10px] text-muted-foreground">Scanning project...</div>}
    </div>
  )
}

function StatChip({ label }: { label: string }) {
  return <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[9px] text-muted-foreground">{label}</span>
}

function CoverageBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-destructive')} style={{ width: `${pct}%` }} />
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
  insights: InsightsSection,
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
  design: DesignSection,
  script: ScriptSection,
  images: ImagesSection,
}

export function RightToolPanel({ section, onCollapse }: RightToolPanelProps) {
  const sectionMeta = TOOL_SECTIONS.find((s) => s.id === section)
  const SectionContent = SECTION_COMPONENTS[section]

  return (
    <div className="flex h-full w-80 flex-col border-l bg-card">
      <div className="shrink-0 border-b px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {sectionMeta && <sectionMeta.icon className="size-3.5 text-violet-500" />}
            <span className="text-xs font-semibold">{sectionMeta?.label ?? section}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCollapse}>
            <ChevronLeft className="size-4" />
          </Button>
        </div>
        {SECTION_DESCRIPTIONS[section] && (
          <p className="text-muted-foreground mt-0.5 pl-[22px] text-[10px]">{SECTION_DESCRIPTIONS[section]}</p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {SectionContent && <SectionContent />}
      </div>
    </div>
  )
}
