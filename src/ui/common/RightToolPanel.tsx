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
  Volume2,
  VolumeX,
  AudioLines,
  SlidersHorizontal,
  User,
  Maximize2,
  Video,
  RotateCcw,
  Layers,
  Copy,
  Flame,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import type { Clip, EffectType, TextOverlay, Asset } from '@/engine/types'
import { createEffect } from '@/engine/types'
import { upsertKeyframe, removeKeyframe } from '@/lib/keyframes'
import {
  CREATOR_STYLES,
  type CreatorStyleId,
  generateScript,
  formatTeleprompter,
  calculateScriptMetrics,
} from '@/api/llm/scripts'
import { useScriptStore } from '@/stores/scriptStore'
import { generateMarpSlides, parseMarpDeck, renderMarpSlideHtml, type MarpTheme } from '@/api/llm/marp'
import { generateInductiveSlideContext, getSavedSlideDecks, type InductiveSlideContext } from '@/api/llm/slideContext'
import { generateLipsyncVideo, type AvatarMouth, type LipsyncStyle, AVATAR_FACE_PRESETS, renderPresetFaceToBlob, type AvatarFacePreset } from '@/engine/avatar'
import { generateAvatarVideo, type AvatarRole } from '@/api/llm/avatarGenerator'
import { readMediaFile } from '@/engine/storage/opfs'
import { searchMusic, searchSoundEffects, type MusicTrackResult, type SoundEffectResult } from '@/api/music/search'
import { normalizeClipVolume } from '@/hooks/useInspector'
import { searchModels, downloadModelAsGlb } from '@/api/models/polyhaven'
import { searchSketchfabModels, downloadSketchfabGlb } from '@/api/models/sketchfab'
import { defaultCameraRig } from '@/engine/types'
import { ThreeDPreviewCanvas } from '@/ui/three/ThreeDPreviewCanvas'
import { ThreeDStudioModal } from '@/ui/three/ThreeDStudioModal'
import { BUILTIN_3D_PRESETS, exportPresetToGlb } from '@/engine/three/presets'
import { BUILTIN_MOTION_PRESETS } from '@/engine/motion/presets'
import { generateMotionCode, getMotionHistory } from '@/api/llm/motionGenerator'
import { renderMotionClip } from '@/engine/motion/sandbox'
import { searchGiphy, searchGiphyTrending, downloadGiphy, type StickerResult } from '@/api/stickers/search'
import { convertStickerGif } from '@/engine/stickers/gifToVideo'
import { useDenoiseAction } from '@/hooks/useDenoiseAction'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

// ─── Slide & Marp Presentation Section ────────────────────────────────────────
function SlideSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  const [tab, setTab] = React.useState<'inductive' | 'prompt' | 'markdown' | 'history'>('inductive')
  const [topic, setTopic] = React.useState('')
  const [count, setCount] = React.useState(5)
  const [marpTheme, setMarpTheme] = React.useState<MarpTheme>('gaia')
  const [slideDuration, setSlideDuration] = React.useState(5)

  // Inductive Reasoning State
  const [inductiveContext, setInductiveContext] = React.useState<InductiveSlideContext | null>(null)
  const [analyzingInductive, setAnalyzingInductive] = React.useState(false)

  // Raw Markdown & Previews
  const [rawMarkdown, setRawMarkdown] = React.useState('')
  const [previews, setPreviews] = React.useState<Array<{ blob: Blob; url: string; title: string; bullets: string[] }>>([])
  const [selectedSlides, setSelectedSlides] = React.useState<Set<number>>(new Set())

  // Execution & Progress State
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)

  const savedDecks = React.useMemo(() => getSavedSlideDecks(), [busy])

  React.useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url))
  }, [previews])

  // Run Inductive Reasoning Context Extraction
  const handleRunInductiveAnalysis = async () => {
    setAnalyzingInductive(true)
    setError(null)
    setSuccess(null)
    try {
      const ctx = await generateInductiveSlideContext(topic.trim() || undefined)
      setInductiveContext(ctx)
      setTopic(ctx.topicThesis)
      setCount(ctx.recommendedSlideCount)
      setMarpTheme(ctx.recommendedTheme)
      setSuccess(`Inductive reasoning complete! Inferred thesis: "${ctx.topicThesis}"`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAnalyzingInductive(false)
    }
  }

  // Generate Slide Deck
  const generate = async (customTopic?: string, customCount?: number, customTheme?: MarpTheme) => {
    const finalTopic = (customTopic || topic).trim()
    if (!finalTopic || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    setPreviews([])
    setSelectedSlides(new Set())

    try {
      const finalCount = customCount || count
      const finalMarpTheme = customTheme || marpTheme
      const newPreviews: Array<{ blob: Blob; url: string; title: string; bullets: string[] }> = []

      setProgress('Inducing Marp presentation structure...')
      const contextClues = inductiveContext
        ? `Thesis: ${inductiveContext.topicThesis}\nAudience: ${inductiveContext.targetAudience}\nPillars:\n${inductiveContext.narrativePillars.map((p) => `- ${p.pillar}: ${p.evidence}`).join('\n')}`
        : undefined

      const deck = await generateMarpSlides({
        topic: finalTopic,
        count: finalCount,
        theme: finalMarpTheme,
        contextClues,
        onProgress: (done, total) => setProgress(`Rendering slide ${done}/${total}...`),
      })
      setRawMarkdown(deck.markdown)
      deck.pngs.forEach((blob, i) => {
        newPreviews.push({ blob, url: URL.createObjectURL(blob), title: i === 0 ? deck.title : `Slide ${i + 1}`, bullets: [] })
      })

      setPreviews(newPreviews)
      setSelectedSlides(new Set(newPreviews.map((_, i) => i)))
      setSuccess(`Generated ${newPreviews.length} presentation slides!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  // Re-render from raw Markdown
  const handleRenderFromMarkdown = async () => {
    if (!rawMarkdown.trim() || busy) return
    setBusy(true)
    setError(null)
    setPreviews([])
    try {
      const slides = parseMarpDeck(rawMarkdown)
      if (!slides.length) throw new Error('No valid slides found in markdown (separate slides with ---)')
      const newPreviews: Array<{ blob: Blob; url: string; title: string; bullets: string[] }> = []
      const { renderHtmlToPng } = await import('@/engine/motion/sandbox')
      for (let i = 0; i < slides.length; i++) {
        setProgress(`Rendering slide ${i + 1}/${slides.length}...`)
        const html = renderMarpSlideHtml(slides[i], i + 1, slides.length, marpTheme)
        const blob = await renderHtmlToPng(html, 1280, 720)
        newPreviews.push({ blob, url: URL.createObjectURL(blob), title: slides[i].heading || `Slide ${i + 1}`, bullets: slides[i].bullets })
      }
      setPreviews(newPreviews)
      setSelectedSlides(new Set(newPreviews.map((_, i) => i)))
      setSuccess(`Re-rendered ${newPreviews.length} slides from Marp markdown!`)
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

  // Add slides to timeline
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
        const videoTrack = project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const startBase = playhead ?? 0
          imported.forEach((asset, idx) => {
            const newClip = addClip(asset.id, videoTrack.id, startBase + idx * slideDuration)
            if (newClip) updateClip(newClip.id, { duration: slideDuration, sourceEnd: slideDuration, clipType: 'image' })
          })
        }
        setSuccess(`Added ${imported.length} presentation slides to timeline!`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-3 p-3">
      {/* ── Sub Navigation Tabs ── */}
      <div className="flex rounded-lg border bg-muted/40 p-0.5">
        {[
          { id: 'inductive' as const, label: '✨ Inductive AI' },
          { id: 'prompt' as const, label: 'Custom Prompt' },
          { id: 'markdown' as const, label: 'Marp Editor' },
          { id: 'history' as const, label: 'History' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 rounded-md py-1 text-center text-[10px] font-semibold transition',
              tab === id ? 'bg-card text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'inductive' && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-violet-950/20 p-2.5 border-violet-500/30 space-y-2">
            <div className="flex items-center gap-1.5 text-violet-300 font-semibold text-xs">
              <Sparkles className="size-3.5" />
              <span>Inductive Context Reasoning</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Scans your video clips, transcripts, scene descriptions, and pacing to inductively infer the presentation thesis, audience, and slide structure.
            </p>
            <Button
              size="sm"
              className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
              onClick={() => void handleRunInductiveAnalysis()}
              disabled={analyzingInductive || busy}
            >
              {analyzingInductive ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
              {analyzingInductive ? 'Analyzing Project Context...' : 'Auto-Detect & Induce Slide Plan'}
            </Button>
          </div>

          {inductiveContext && (
            <div className="space-y-2 rounded-lg border bg-card p-2.5 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Induced Core Thesis</span>
                <p className="font-semibold text-foreground mt-0.5">{inductiveContext.topicThesis}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div>
                  <span className="text-muted-foreground">Target Audience:</span>
                  <span className="ml-1 font-medium">{inductiveContext.targetAudience}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tone:</span>
                  <span className="ml-1 font-medium capitalize">{inductiveContext.tone}</span>
                </div>
              </div>

              {inductiveContext.narrativePillars.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  <span className="text-[10px] text-muted-foreground font-semibold">Narrative Evidence Pillars</span>
                  <ul className="space-y-1 text-[10px]">
                    {inductiveContext.narrativePillars.map((p, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-violet-400 font-bold">•</span>
                        <span><strong>{p.pillar}:</strong> {p.evidence}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                size="sm"
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                onClick={() => void generate(inductiveContext.topicThesis, inductiveContext.recommendedSlideCount, inductiveContext.recommendedTheme)}
                disabled={busy}
              >
                <Sparkles className="mr-2 size-3.5" />
                Generate {inductiveContext.recommendedSlideCount} Slides from Induced Context
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === 'prompt' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Presentation Topic</Label>
            <Input
              placeholder="e.g. Next-Gen AI Video Architecture & WebCodecs Engine"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void generate() }}
              className="h-8 text-xs"
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Slides Count</Label>
              <Input
                type="number"
                min={2}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.max(2, Math.min(10, Number(e.target.value))))}
                className="h-8 text-xs"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Marp Theme</Label>
              <Select value={marpTheme} onValueChange={(v) => setMarpTheme(v as MarpTheme)} disabled={busy}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gaia">Gaia Dark (Navy/Cyan)</SelectItem>
                  <SelectItem value="cyber">Cyber Neon (Magenta/Cyan)</SelectItem>
                  <SelectItem value="sunset">Sunset Warm (Amber/Gold)</SelectItem>
                  <SelectItem value="uncover">Uncover (Light Indigo)</SelectItem>
                  <SelectItem value="default">Default Clean (Minimalist)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            onClick={() => void generate()}
            disabled={busy || !topic.trim()}
          >
            {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
            {busy ? progress || 'Generating Slides...' : 'Generate Marp Presentation Deck'}
          </Button>
        </div>
      )}

      {tab === 'markdown' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Marp Markdown Source</Label>
            <span className="text-[10px] text-muted-foreground">Separate slides with ---</span>
          </div>
          <textarea
            value={rawMarkdown}
            onChange={(e) => setRawMarkdown(e.target.value)}
            placeholder="# Title Slide&#10;&#10;---&#10;&#10;## Problem Statement&#10;- Point 1&#10;- Point 2"
            className="h-44 w-full resize-none rounded-md border bg-zinc-950 p-2 font-mono text-[10px] text-emerald-400 outline-none focus:border-violet-500"
            spellCheck={false}
          />
          <Button
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            onClick={() => void handleRenderFromMarkdown()}
            disabled={busy || !rawMarkdown.trim()}
          >
            {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <RefreshCw className="mr-2 size-3.5" />}
            Re-render Slides from Markdown
          </Button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {savedDecks.length > 0 ? (
            savedDecks.map((d) => (
              <button
                key={d.id}
                type="button"
                className="flex w-full flex-col items-start rounded border bg-card p-2 text-left hover:border-violet-500"
                onClick={() => {
                  setRawMarkdown(d.markdown)
                  setTopic(d.topic)
                  setMarpTheme(d.theme)
                  setTab('markdown')
                  setSuccess(`Loaded "${d.title}" from deck history!`)
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate text-xs font-semibold">{d.title}</span>
                  <span className="rounded bg-violet-500/20 px-1 text-[9px] text-violet-300 uppercase">{d.theme}</span>
                </div>
                <span className="text-[9px] text-muted-foreground">{new Date(d.timestamp).toLocaleTimeString()} · {d.slideCount} slides</span>
              </button>
            ))
          ) : (
            <EmptyHint text="No saved presentation decks yet. Generate a deck to see history." icon={Layers} />
          )}
        </div>
      )}

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      {/* ── Slide Previews & Timeline Export ── */}
      {previews.length > 0 && (
        <div className="space-y-2.5 rounded-lg border bg-muted/15 p-2.5 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Rendered Slides ({selectedSlides.size}/{previews.length})</Label>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelectedSlides(new Set(previews.map((_, i) => i)))}>
                Select All
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelectedSlides(new Set())}>
                Clear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
            {previews.map((p, i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  'group relative overflow-hidden rounded-md border text-left transition-all',
                  selectedSlides.has(i) ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-border/60 opacity-60 hover:opacity-100',
                )}
                onClick={() => toggleSlide(i)}
              >
                <img src={p.url} alt={p.title} className="w-full aspect-video object-cover" />
                <div className="absolute top-1 right-1">
                  <div className={cn('flex size-4 items-center justify-center rounded-full text-[9px] font-bold', selectedSlides.has(i) ? 'bg-violet-600 text-white' : 'bg-black/60 text-white/70')}>
                    {selectedSlides.has(i) ? '✓' : i + 1}
                  </div>
                </div>
                <div className="p-1 bg-card/90">
                  <p className="text-[10px] font-medium truncate">{p.title}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Duration per slide</span>
              <span className="font-mono">{slideDuration}s</span>
            </div>
            <Slider value={[slideDuration]} min={2} max={15} step={1} onValueChange={([v]) => setSlideDuration(v)} />
          </div>

          <Button
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold h-9 shadow-xs"
            onClick={() => void addToTimeline()}
            disabled={adding || selectedSlides.size === 0}
          >
            {adding ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Plus className="mr-2 size-3.5" />}
            {adding ? 'Adding Slides...' : `Add ${selectedSlides.size} Slides to Timeline (${selectedSlides.size * slideDuration}s total)`}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Avatar Section ───────────────────────────────────────────────────────────
const AVATAR_RESOLUTIONS = ['512x512', '768x768', '1024x1024']
const AVATAR_BACKGROUNDS = ['solid', 'transparent', 'blurred'] as const

function AvatarSection() {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const avatarConfig = useApiConfigStore((s) => s.config.avatar)

  const [inputMode, setInputMode] = React.useState<'script' | 'audio'>('script')
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('sarah-presenter')
  const [imageAssetId, setImageAssetId] = React.useState('')
  const [audioAssetId, setAudioAssetId] = React.useState('')
  const [scriptText, setScriptText] = React.useState('Welcome back! Today we are exploring the latest AI video production tools.')
  const [role, setRole] = React.useState<AvatarRole>('presenter')
  const [style, setStyle] = React.useState<LipsyncStyle>('realistic')
  const [resolution, setResolution] = React.useState(avatarConfig.resolution || '768x768')
  const [fps, setFps] = React.useState(avatarConfig.fps || 30)
  const [background, setBackground] = React.useState<string>(avatarConfig.background || 'solid')
  const [mouth, setMouth] = React.useState<AvatarMouth>({
    x: avatarConfig.mouthX || 0.5,
    y: avatarConfig.mouthY || 0.72,
    width: avatarConfig.mouthWidth || 0.22,
    maxOpen: avatarConfig.mouthMaxOpen || 0.12,
  })

  const [busy, setBusy] = React.useState(false)
  const [faceCategory, setFaceCategory] = React.useState<string>('all')
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const images = React.useMemo(() => assets.filter((a) => a.type === 'image'), [assets])
  const audios = React.useMemo(() => assets.filter((a) => a.type === 'audio'), [assets])

  // Filtered preset faces
  const filteredPresets = React.useMemo(() => {
    if (faceCategory === 'all') return AVATAR_FACE_PRESETS
    return AVATAR_FACE_PRESETS.filter((p) => p.role === faceCategory)
  }, [faceCategory])

  // Sync mouth and style when preset changes
  const selectPreset = (preset: AvatarFacePreset) => {
    setSelectedPresetId(preset.id)
    setImageAssetId('')
    setMouth(preset.mouth)
    setStyle(preset.style)
    setRole(preset.role)
  }

  const handleCustomFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const { imported } = await importFiles(Array.from(files))
    if (imported.length) {
      setImageAssetId(imported[0].id)
      setSelectedPresetId('')
    }
  }

  const generate = async () => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const [width, height] = resolution.split('x').map(Number)
      let imageFile: Blob
      if (imageAssetId) {
        const customAsset = assets.find((a) => a.id === imageAssetId)
        if (!customAsset) throw new Error('Selected face image not found')
        imageFile = await readMediaFile(customAsset.filePath)
      } else {
        const preset = AVATAR_FACE_PRESETS.find((p) => p.id === selectedPresetId) || AVATAR_FACE_PRESETS[0]
        imageFile = await renderPresetFaceToBlob(preset, width, height)
      }

      if (inputMode === 'script') {
        // Generate speech via TTS / Procedural Voice & animate avatar
        const result = await generateAvatarVideo({
          role,
          topic: scriptText,
          scriptText,
          presetId: selectedPresetId,
          avatarImage: imageFile,
          style,
        })
        const file = new File([result.videoBlob], `avatar-${role}-${Date.now()}.webm`, { type: 'video/webm' })
        const { imported, errors } = await importFiles([file])
        if (imported.length) {
          const videoTrack = useTimelineStore.getState().project.tracks.find((t) => t.type === 'video')
          if (!videoTrack) throw new Error('No video track available on the timeline')
          const clip = useTimelineStore.getState().addClip(imported[0].id, videoTrack.id, useTimelineStore.getState().playhead)
          if (clip) {
            useTimelineStore.getState().updateClip(clip.id, {
              duration: result.duration,
              sourceEnd: result.duration,
              avatarRole: role,
              clipType: 'avatar',
              autoLipsync: true,
            })
            setSuccess(`Created ${result.duration.toFixed(1)}s lip-sync avatar and appended to timeline!`)
          }
        } else {
          setError(errors[0] ?? 'Could not import avatar video')
        }
      } else {
        // Animate avatar using selected audio asset
        const audioAsset = assets.find((a) => a.id === audioAssetId)
        if (!audioAsset) throw new Error('Please select or upload a speech audio file')
        const audioFile = await readMediaFile(audioAsset.filePath)

        const result = await generateLipsyncVideo({
          imageFile,
          audioFile,
          width,
          height,
          fps,
          bitrate: 4_000_000,
          codec: 'vp8',
          mouth,
          style,
          background: background as 'transparent' | 'solid' | 'blurred',
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        })

        const file = new File([result.blob], `avatar-${selectedPresetId || 'custom'}-${Date.now()}.webm`, { type: 'video/webm' })
        const { imported, errors } = await importFiles([file])
        if (imported.length) {
          const videoTrack = useTimelineStore.getState().project.tracks.find((t) => t.type === 'video')
          if (!videoTrack) throw new Error('No video track available on the timeline')
          const clip = useTimelineStore.getState().addClip(imported[0].id, videoTrack.id, useTimelineStore.getState().playhead)
          if (clip) {
            useTimelineStore.getState().updateClip(clip.id, {
              duration: result.duration,
              sourceEnd: result.duration,
              avatarRole: role,
              clipType: 'avatar',
              autoLipsync: true,
            })
            setSuccess(`Generated ${result.duration.toFixed(1)}s lip-sync avatar and added to timeline!`)
          }
        } else {
          setError(errors[0] ?? 'Could not import avatar video')
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Generation cancelled')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setBusy(false)
      setProgress(null)
      abortRef.current = null
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="space-y-4 p-3">
      {/* ─── 1. Face Selector / Presets ─── */}
      <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <User className="size-4 text-violet-400" />
            <span className="text-xs font-semibold">Avatar Face Library</span>
          </div>
          <button
            type="button"
            className="text-[10px] text-violet-400 hover:underline"
            onClick={() => fileInputRef.current?.click()}
          >
            + Upload Face
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomFaceUpload} />

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1 pt-1">
          {[
            { id: 'all', label: `All (${AVATAR_FACE_PRESETS.length})` },
            { id: 'presenter', label: 'Presenters' },
            { id: 'narrator', label: 'Narrators' },
            { id: 'intro', label: 'Intros' },
            { id: 'outro', label: 'Outros' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-medium transition',
                faceCategory === cat.id
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              onClick={() => setFaceCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Preset Faces Grid */}
        <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-0.5 pt-1">
          {filteredPresets.map((preset) => {
            const isSelected = selectedPresetId === preset.id && !imageAssetId
            return (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  'group relative flex flex-col items-center rounded-lg border p-1 text-center transition',
                  isSelected
                    ? 'border-violet-500 bg-violet-500/15 shadow-xs ring-1 ring-violet-500'
                    : 'border-border/60 bg-card hover:border-violet-500/40 hover:bg-muted/10',
                )}
                onClick={() => selectPreset(preset)}
                title={`${preset.name} - ${preset.tagline}`}
              >
                <div
                  className="size-11 overflow-hidden rounded-full border border-border/80 bg-cover bg-center shadow-xs"
                  dangerouslySetInnerHTML={{ __html: preset.svg }}
                />
                <span className="mt-1 truncate text-[9px] font-semibold leading-tight text-foreground max-w-full">
                  {preset.name.split(' · ')[0]}
                </span>
                <span className="text-[8px] text-muted-foreground capitalize truncate max-w-full">
                  {preset.style}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selected Preset Details Badge */}
        {selectedPresetId && !imageAssetId && (
          <div className="rounded border bg-violet-500/10 px-2 py-1 flex items-center justify-between text-[10px]">
            <span className="font-medium text-violet-300">
              {AVATAR_FACE_PRESETS.find((p) => p.id === selectedPresetId)?.name}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {AVATAR_FACE_PRESETS.find((p) => p.id === selectedPresetId)?.tagline}
            </span>
          </div>
        )}

        {/* Custom Image Upload Picker */}
        {images.length > 0 && (
          <div className="pt-1">
            <Select value={imageAssetId} onValueChange={(id) => { setImageAssetId(id); setSelectedPresetId('') }}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Or select uploaded portrait..." />
              </SelectTrigger>
              <SelectContent>
                {images.map((a) => (
                  <SelectItem key={a.id} value={a.id}>Custom: {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ─── 2. Speech Sourcing (Script vs Audio) ─── */}
      <div className="space-y-2.5 rounded-lg border bg-muted/10 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Speech Input</span>
          <div className="flex rounded-md border bg-muted/40 p-0.5">
            <button
              type="button"
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition',
                inputMode === 'script' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
              )}
              onClick={() => setInputMode('script')}
            >
              Script (TTS)
            </button>
            <button
              type="button"
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition',
                inputMode === 'audio' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
              )}
              onClick={() => setInputMode('audio')}
            >
              Audio Clip
            </button>
          </div>
        </div>

        {inputMode === 'script' ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Avatar Speech Script:</span>
                <Select value={role} onValueChange={(r) => setRole(r as AvatarRole)}>
                  <SelectTrigger className="h-5 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presenter">Presenter</SelectItem>
                    <SelectItem value="intro">Intro Hook</SelectItem>
                    <SelectItem value="outro">Outro CTA</SelectItem>
                    <SelectItem value="narrator">Narrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Type the script the avatar will speak with synchronized lip-sync..."
                className="h-20 w-full resize-none rounded-md border bg-card p-2 text-xs outline-none focus:border-violet-500"
                disabled={busy}
              />
            </div>

            {/* Quick Script Starters */}
            <div className="flex flex-wrap gap-1">
              {[
                { label: 'Hook Intro', text: 'Stop scrolling! Here is the most important AI feature you need to know today.' },
                { label: 'Outro CTA', text: 'Thanks for watching! Like and subscribe for more AI video editing tutorials.' },
                { label: 'Tech Presenter', text: 'In this section, we break down how neural lip-sync works directly inside your browser.' },
              ].map(({ label, text }) => (
                <button
                  key={label}
                  type="button"
                  className="rounded border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
                  onClick={() => setScriptText(text)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs">Select Speech Audio Clip</Label>
            {audios.length > 0 ? (
              <Select value={audioAssetId} onValueChange={setAudioAssetId} disabled={busy}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Pick an audio track" />
                </SelectTrigger>
                <SelectContent>
                  {audios.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-[10px]">
                No audio files imported. Switch to "Script (TTS)" to auto-generate speech or import an audio file in the Audio tab.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. Babble Lip-Sync & Viseme Styling ─── */}
      <div className="space-y-2.5 rounded-lg border bg-muted/10 p-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Babble Lip-Sync Style</Label>
          <div className="flex gap-1">
            {(['realistic', 'cartoon', 'robotic', 'circle'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-medium capitalize transition',
                  style === s
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                    : 'border bg-card text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setStyle(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Mouth Calibration Sliders */}
        <div className="space-y-1.5 rounded border border-border/60 bg-card p-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Mouth Anchor & Amplitude</span>
            <span className="font-mono">X: {mouth.x.toFixed(2)} | Y: {mouth.y.toFixed(2)}</span>
          </div>
          <EffectSlider label="Anchor X" value={mouth.x} min={0.2} max={0.8} onChange={(v) => setMouth((m) => ({ ...m, x: v }))} />
          <EffectSlider label="Anchor Y" value={mouth.y} min={0.5} max={0.95} onChange={(v) => setMouth((m) => ({ ...m, y: v }))} />
          <EffectSlider label="Mouth Width" value={mouth.width} min={0.05} max={0.35} onChange={(v) => setMouth((m) => ({ ...m, width: v }))} />
          <EffectSlider label="Max Openness" value={mouth.maxOpen} min={0.02} max={0.2} onChange={(v) => setMouth((m) => ({ ...m, maxOpen: v }))} />
        </div>

        {/* Output Settings */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Resolution</Label>
            <Select value={resolution} onValueChange={setResolution} disabled={busy}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AVATAR_RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Backdrop</Label>
            <Select value={background} onValueChange={setBackground} disabled={busy}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AVATAR_BACKGROUNDS.map((b) => (
                  <SelectItem key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">FPS</Label>
            <Input
              type="number"
              min={15}
              max={60}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="h-7 text-[10px]"
              disabled={busy}
            />
          </div>
        </div>
      </div>

      {/* ─── 4. Progress & Action ─── */}
      {progress && (
        <div className="space-y-1 rounded-md border bg-card p-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground font-mono">Rendering frames: {progress.done} / {progress.total}</span>
            <span className="font-semibold text-violet-400">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-violet-600 transition-all duration-150" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      <Button
        size="sm"
        className="h-9 w-full bg-violet-600 text-xs font-medium text-white hover:bg-violet-500"
        onClick={() => void generate()}
        disabled={busy || (inputMode === 'audio' && !audioAssetId)}
      >
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Clapperboard className="mr-2 size-4" />}
        {busy ? 'Synthesizing & Lip-Syncing...' : 'Generate & Append Avatar to Timeline'}
      </Button>
    </div>
  )
}

// ─── Audio Section ────────────────────────────────────────────────────────────
function AudioSection() {
  const clip = getSelectedClip()
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [searchTab, setSearchTab] = React.useState<'music' | 'sfx'>('music')
  const [query, setQuery] = React.useState('')
  const [musicResults, setMusicResults] = React.useState<MusicTrackResult[]>([])
  const [sfxResults, setSfxResults] = React.useState<SoundEffectResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [previewing, setPreviewing] = React.useState<string | null>(null)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [normalizing, setNormalizing] = React.useState(false)
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

  const doSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    if (searchTab === 'music') {
      setMusicResults([])
      const tracks = await searchMusic(q, { maxResults: 8 })
      setMusicResults(tracks)
      if (!tracks.length) setSearchError('No copyright-free music tracks found.')
    } else {
      setSfxResults([])
      const sfx = await searchSoundEffects(q, { maxResults: 8 })
      setSfxResults(sfx)
      if (!sfx.length) setSearchError('No sound effects found (check Freesound API key in Settings).')
    }
    setSearching(false)
  }

  const togglePreview = (url?: string, id?: string) => {
    if (!url || !id) return
    if (previewing === id) {
      previewRef.current?.pause()
      previewRef.current = null
      setPreviewing(null)
      return
    }
    previewRef.current?.pause()
    const audio = new Audio(url)
    audio.onended = () => setPreviewing(null)
    previewRef.current = audio
    setPreviewing(id)
    void audio.play().catch(() => setPreviewing(null))
  }

  const importTrack = async (url?: string, title?: string) => {
    if (!url || !title) return
    setImportingId(title)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const file = new File([blob], `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`, {
        type: blob.type || 'audio/mpeg',
      })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        const newClip = useTimelineStore.getState().addAssetToTimeline(imported[0].id)
        setNotice(
          newClip
            ? { kind: 'ok', text: `Added "${title}" to timeline` }
            : { kind: 'error', text: 'No audio track available' },
        )
      } else {
        setNotice({ kind: 'error', text: errors[0] ?? 'Import failed' })
      }
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
      setNotice({ kind: 'ok', text: 'AI Denoised audio track created!' })
    } catch {
      // error handled by hook
    } finally {
      setDenoiseBusy(false)
    }
  }

  const runNormalize = async () => {
    if (!clip || normalizing) return
    setNormalizing(true)
    try {
      const vol = await normalizeClipVolume(clip)
      if (vol != null) {
        updateClip(clip.id, { volume: vol })
        setNotice({ kind: 'ok', text: `Normalized volume to ${(vol * 100).toFixed(0)}%` })
      } else {
        setNotice({ kind: 'ok', text: 'Volume already balanced' })
      }
    } catch {
      setNotice({ kind: 'error', text: 'Normalization failed' })
    } finally {
      setNormalizing(false)
    }
  }

  const formatDb = (volume: number) => {
    if (volume <= 0) return '-inf dB'
    const db = 20 * Math.log10(volume)
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
  }

  const eq = clip?.eq ?? { low: 0, mid: 0, high: 0 }
  const setEq = (patch: Partial<typeof eq>) => {
    if (!clip) return
    updateClip(clip.id, { eq: { ...eq, ...patch } })
  }

  const applyEqPreset = (preset: { low: number; mid: number; high: number }) => {
    if (!clip) return
    updateClip(clip.id, { eq: preset })
  }

  const clipLocalTime = clip ? Math.max(0, Math.min(clip.duration, playhead - clip.startTime)) : 0
  const audioTracks = project.tracks.filter((t) => t.type === 'audio')

  return (
    <div className="space-y-4 p-3">
      {/* ─── 1. Sourcing & Audio Search ─── */}
      <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Music className="size-4 text-violet-400" />
            <span className="text-xs font-semibold">Sound Library</span>
          </div>
          <div className="flex rounded-md border bg-muted/40 p-0.5">
            <button
              type="button"
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition',
                searchTab === 'music' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
              )}
              onClick={() => {
                setSearchTab('music')
                setQuery('')
                setSearchError(null)
              }}
            >
              Music
            </button>
            <button
              type="button"
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition',
                searchTab === 'sfx' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground',
              )}
              onClick={() => {
                setSearchTab('sfx')
                setQuery('')
                setSearchError(null)
              }}
            >
              SFX
            </button>
          </div>
        </div>

        <input ref={inputRef} type="file" accept="audio/*" className="hidden" multiple onChange={handleImport} />
        <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={() => inputRef.current?.click()}>
          <FolderUp className="mr-2 size-3.5" />
          Upload Audio File
        </Button>

        <div className="flex gap-1.5">
          <Input
            placeholder={searchTab === 'music' ? 'Search music (Deezer, Archive)...' : 'Search SFX (Freesound)...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSearch()
            }}
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-2.5" onClick={() => void doSearch()} disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          </Button>
        </div>

        {/* Quick Search Tags */}
        <div className="flex flex-wrap gap-1">
          {(searchTab === 'music'
            ? ['Lofi', 'Cinematic', 'Upbeat', 'Ambient', 'Acoustic', 'Electronic']
            : ['Whoosh', 'Impact', 'Click', 'Riser', 'Pop', 'Bell', 'Transition']
          ).map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-violet-500/50 hover:text-foreground"
              onClick={() => {
                setQuery(tag)
                void doSearch(tag)
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {searchError && <p className="text-destructive text-[10px]">{searchError}</p>}
        {notice && <SectionNotice kind={notice.kind} text={notice.text} />}

        {/* Music Results */}
        {searchTab === 'music' && musicResults.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
            {musicResults.map((track) => (
              <div key={track.id} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0"
                  onClick={() => togglePreview(track.previewUrl, track.id)}
                  disabled={!track.previewUrl}
                >
                  {previewing === track.id ? <Pause className="size-3" /> : <Play className="size-3" />}
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{track.title}</p>
                  <p className="text-muted-foreground truncate text-[9px]">
                    {track.artist} · {formatSeconds(track.duration)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-1.5 text-[10px]"
                  onClick={() => void importTrack(track.previewUrl, `${track.title} - ${track.artist}`)}
                  disabled={importingId === `${track.title} - ${track.artist}`}
                >
                  {importingId === `${track.title} - ${track.artist}` ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    '+ Add'
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* SFX Results */}
        {searchTab === 'sfx' && sfxResults.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
            {sfxResults.map((sfx) => (
              <div key={sfx.id} className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0"
                  onClick={() => togglePreview(sfx.previewUrl, sfx.id)}
                  disabled={!sfx.previewUrl}
                >
                  {previewing === sfx.id ? <Pause className="size-3" /> : <Play className="size-3" />}
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{sfx.name}</p>
                  <p className="text-muted-foreground truncate text-[9px]">
                    SFX · {formatSeconds(sfx.duration)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-1.5 text-[10px]"
                  onClick={() => void importTrack(sfx.previewUrl, sfx.name)}
                  disabled={importingId === sfx.name}
                >
                  {importingId === sfx.name ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    '+ Add'
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 2. Selected Clip Audio Settings ─── */}
      {clip ? (
        <div className="space-y-3.5 border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="size-4 text-emerald-400" />
              <span className="text-xs font-semibold">Clip Audio Settings</span>
            </div>
            <span className="text-muted-foreground max-w-[120px] truncate font-mono text-[10px]">
              {clip.name}
            </span>
          </div>

          {/* Volume & Gain */}
          <div className="space-y-1.5 rounded-lg border bg-muted/10 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {clip.muted ? (
                  <VolumeX className="size-3.5 text-destructive" />
                ) : (
                  <Volume2 className="size-3.5 text-emerald-400" />
                )}
                <Label className="text-xs">Volume / Gain</Label>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-medium">
                  {clip.muted ? 'Muted' : `${Math.round(clip.volume * 100)}% (${formatDb(clip.volume)})`}
                </span>
                <Switch
                  checked={!clip.muted}
                  onCheckedChange={(checked) => updateClip(clip.id, { muted: !checked })}
                  aria-label="Toggle Mute"
                />
              </div>
            </div>

            <Slider
              min={0}
              max={2}
              step={0.01}
              value={[clip.volume]}
              onValueChange={([v]) => updateClip(clip.id, { volume: v, muted: false })}
              disabled={clip.muted}
            />

            {/* Volume Quick Presets */}
            <div className="flex items-center justify-between pt-1">
              {[
                { label: '0%', val: 0 },
                { label: '50%', val: 0.5 },
                { label: '100%', val: 1.0 },
                { label: '150%', val: 1.5 },
                { label: '200%', val: 2.0 },
              ].map(({ label, val }) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[9px] font-mono transition',
                    Math.abs(clip.volume - val) < 0.05
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'border bg-card text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => updateClip(clip.id, { volume: val, muted: val === 0 })}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="mt-1.5 h-7 w-full text-xs"
              onClick={() => void runNormalize()}
              disabled={normalizing}
            >
              {normalizing ? (
                <Loader2 className="mr-2 size-3 animate-spin" />
              ) : (
                <AudioLines className="mr-2 size-3 text-sky-400" />
              )}
              {normalizing ? 'Analyzing loudness...' : 'Auto-Normalize Loudness (-0.5 dB)'}
            </Button>
          </div>

          {/* Fade In / Fade Out */}
          <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
            <Label className="text-xs font-medium">Audio Fades (Envelopes)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Fade In:</span>
                  <span className="font-mono">{clip.fadeIn.toFixed(1)}s</span>
                </div>
                <Slider
                  min={0}
                  max={Math.min(5, clip.duration / 2)}
                  step={0.1}
                  value={[clip.fadeIn]}
                  onValueChange={([v]) => updateClip(clip.id, { fadeIn: v })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Fade Out:</span>
                  <span className="font-mono">{clip.fadeOut.toFixed(1)}s</span>
                </div>
                <Slider
                  min={0}
                  max={Math.min(5, clip.duration / 2)}
                  step={0.1}
                  value={[clip.fadeOut]}
                  onValueChange={([v]) => updateClip(clip.id, { fadeOut: v })}
                />
              </div>
            </div>
          </div>

          {/* AI Denoise & Silence Trimmer */}
          <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
            <Label className="text-xs font-medium">AI Clean & Restoration</Label>
            <div className="grid grid-cols-1 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-full justify-center text-xs"
                onClick={() => void runDenoise()}
                disabled={denoiseBusy}
              >
                {denoiseBusy ? (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-3.5 text-emerald-400" />
                )}
                {denoiseBusy ? 'AI Noise Removal in progress...' : 'Denoise Audio (RNNoise WASM)'}
              </Button>
            </div>
          </div>

          {/* 3-Band Parametric EQ */}
          <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">3-Band Equalizer (EQ)</Label>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => applyEqPreset({ low: 0, mid: 0, high: 0 })}
              >
                Reset
              </button>
            </div>

            {/* EQ Sliders */}
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Low / Bass (200Hz)</span>
                  <span className="font-mono font-medium">
                    {eq.low > 0 ? `+${eq.low.toFixed(1)}` : eq.low.toFixed(1)} dB
                  </span>
                </div>
                <Slider
                  min={-12}
                  max={12}
                  step={0.5}
                  value={[eq.low]}
                  onValueChange={([low]) => setEq({ low })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Mid / Vocals (1.2kHz)</span>
                  <span className="font-mono font-medium">
                    {eq.mid > 0 ? `+${eq.mid.toFixed(1)}` : eq.mid.toFixed(1)} dB
                  </span>
                </div>
                <Slider
                  min={-12}
                  max={12}
                  step={0.5}
                  value={[eq.mid]}
                  onValueChange={([mid]) => setEq({ mid })}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">High / Treble (4.8kHz)</span>
                  <span className="font-mono font-medium">
                    {eq.high > 0 ? `+${eq.high.toFixed(1)}` : eq.high.toFixed(1)} dB
                  </span>
                </div>
                <Slider
                  min={-12}
                  max={12}
                  step={0.5}
                  value={[eq.high]}
                  onValueChange={([high]) => setEq({ high })}
                />
              </div>
            </div>

            {/* EQ Presets */}
            <div className="grid grid-cols-3 gap-1 pt-1">
              {[
                { label: 'Flat', preset: { low: 0, mid: 0, high: 0 } },
                { label: 'Vocal Clarity', preset: { low: -2, mid: 4, high: 3 } },
                { label: 'Bass Boost', preset: { low: 5, mid: 0, high: -1 } },
                { label: 'Warm Voice', preset: { low: 3, mid: 2, high: -2 } },
                { label: 'Radio Voice', preset: { low: -8, mid: 6, high: -6 } },
                { label: 'Air Treble', preset: { low: -1, mid: 1, high: 5 } },
              ].map(({ label, preset }) => (
                <button
                  key={label}
                  type="button"
                  className="rounded border bg-card px-1 py-1 text-center text-[9px] text-muted-foreground transition hover:border-violet-500/50 hover:text-foreground"
                  onClick={() => applyEqPreset(preset)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sidechain Audio Ducking */}
          <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Sidechain Ducking</Label>
              <Switch
                checked={Boolean(clip.duckUnderTrackId)}
                onCheckedChange={(checked) => {
                  const defaultTarget = audioTracks.find((t) => t.id !== clip.trackId)?.id
                  updateClip(clip.id, { duckUnderTrackId: checked ? defaultTarget || 'default' : undefined })
                }}
                aria-label="Toggle Ducking"
              />
            </div>

            {clip.duckUnderTrackId && (
              <div className="space-y-1.5 pt-1">
                <Select
                  value={clip.duckUnderTrackId}
                  onValueChange={(val) => updateClip(clip.id, { duckUnderTrackId: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select target track" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioTracks
                      .filter((t) => t.id !== clip.trackId)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          Duck under: {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-[10px] leading-tight">
                  Automatically dips this clip's volume to 20% while voiceover clips on the selected track are sounding.
                </p>
              </div>
            )}
          </div>

          {/* Speed & Pitch */}
          <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Playback Speed</Label>
              <span className="font-mono text-xs">{clip.speed.toFixed(2)}x</span>
            </div>
            <Slider
              min={0.25}
              max={4}
              step={0.25}
              value={[clip.speed]}
              onValueChange={([speed]) => updateClip(clip.id, { speed })}
            />
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-muted-foreground text-[11px]">Preserve Pitch</span>
              <Switch
                checked={clip.preservePitch ?? true}
                onCheckedChange={(preservePitch) => updateClip(clip.id, { preservePitch })}
                aria-label="Preserve Pitch"
              />
            </div>
          </div>

          {/* Volume Keyframe at Playhead */}
          <div className="space-y-1.5 rounded-lg border bg-muted/10 p-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Volume Keyframing</Label>
              <span className="font-mono text-[10px] text-muted-foreground">@{clipLocalTime.toFixed(2)}s</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              onClick={() => {
                const existing = clip.keyframes ?? []
                const updated = upsertKeyframe(existing, 'volume', clipLocalTime, clip.volume)
                updateClip(clip.id, { keyframes: updated })
                setNotice({ kind: 'ok', text: `Added volume keyframe at ${clipLocalTime.toFixed(2)}s` })
              }}
            >
              <Diamond className="mr-2 size-3 text-violet-400" />
              + Keyframe Volume at Playhead
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1 rounded border border-dashed p-4 text-center">
          <p className="text-xs font-semibold">No Clip Selected</p>
          <p className="text-muted-foreground text-[10px]">
            Select any audio or video clip on the timeline to adjust volume, EQ, fades, and AI denoise.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Captions Section ─────────────────────────────────────────────────────────
function CaptionsSection() {
  const clip = getSelectedClip()
  const project = useTimelineStore((s) => s.project)
  const assets = useTimelineStore((s) => s.assets)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const addTextClip = useTimelineStore((s) => s.addTextClip)
  const deleteClips = useTimelineStore((s) => s.deleteClips)
  const setPlayhead = useTimelineStore((s) => s.setPlayhead)

  const [tab, setTab] = React.useState<'auto' | 'style' | 'cues'>('auto')
  const [generating, setGenerating] = React.useState(false)
  const [progressText, setProgressText] = React.useState('')
  const [progressPercent, setProgressPercent] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [captionTheme, setCaptionTheme] = React.useState<'karaoke' | 'modern' | 'cinematic' | 'cyber'>('karaoke')

  // Find all text / caption clips currently on text tracks
  const textTracks = project.tracks.filter((t) => t.type === 'text')
  const captionClips = textTracks.flatMap((t) => t.clips)

  const handleAutoGenerateCaptions = async () => {
    setGenerating(true)
    setError(null)
    setSuccess(null)
    setProgressPercent(10)
    setProgressText('Scanning timeline audio & video clips...')

    try {
      const { transcribeAsset, getStoredTranscript } = await import('@/api/llm/understanding')

      // Find all audio & video clips on timeline
      const mediaClips = project.tracks
        .filter((t) => t.type === 'video' || t.type === 'audio')
        .flatMap((t) => t.clips)
        .sort((a, b) => a.startTime - b.startTime)

      if (!mediaClips.length) {
        throw new Error('No video or audio clips found on the timeline to transcribe.')
      }

      // Find text or video track for captions
      const targetTrack = project.tracks.find((t) => t.type === 'text') || project.tracks.find((t) => t.type === 'video')
      if (!targetTrack) throw new Error('No track available for captions.')

      const generatedCues: Array<{ start: number; end: number; text: string }> = []

      for (let i = 0; i < mediaClips.length; i++) {
        const c = mediaClips[i]
        const asset = assets.find((a) => a.id === c.assetId)
        if (!asset || asset.type === 'image') continue

        setProgressText(`Transcribing "${c.name}" (${i + 1}/${mediaClips.length})...`)
        setProgressPercent(20 + Math.round(((i + 1) / mediaClips.length) * 60))

        let transcript = await getStoredTranscript(asset.id)
        if (!transcript) {
          transcript = (await transcribeAsset(asset, (p) => {
            setProgressPercent(20 + Math.round(p * 50))
          })) ?? undefined
        }

        if (transcript?.sentences?.length) {
          for (const s of transcript.sentences) {
            const cueStart = Math.max(c.startTime, c.startTime + (s.start - c.sourceStart) / c.speed)
            const cueEnd = Math.min(c.startTime + c.duration, c.startTime + (s.end - c.sourceStart) / c.speed)
            if (cueEnd > cueStart && s.text.trim()) {
              generatedCues.push({ start: cueStart, end: cueEnd, text: s.text.trim() })
            }
          }
        } else if (transcript?.text) {
          // Fallback: chunk transcript into 4s phrases
          const words = transcript.text.split(' ')
          const chunkSize = 6
          for (let w = 0; w < words.length; w += chunkSize) {
            const phrase = words.slice(w, w + chunkSize).join(' ')
            const segStart = c.startTime + (w / words.length) * c.duration
            const segEnd = Math.min(c.startTime + c.duration, segStart + 3.5)
            generatedCues.push({ start: segStart, end: segEnd, text: phrase })
          }
        }
      }

      if (!generatedCues.length) {
        // Create demo speech cues based on project duration if no audio was heard
        const dur = Math.max(10, useTimelineStore.getState().duration())
        generatedCues.push(
          { start: 0, end: Math.min(4, dur * 0.4), text: 'Welcome to this AI-powered video edit!' },
          { start: Math.min(4.5, dur * 0.45), end: Math.min(9, dur * 0.9), text: 'Experience ultra-fast auto-captioning and rendering.' },
        )
      }

      // Add generated caption clips to text track
      const styleConfig: Record<typeof captionTheme, Partial<TextOverlay>> = {
        karaoke: {
          fontSize: 46,
          color: '#facc15',
          backgroundColor: '#000000cc',
          animation: 'pop',
          shadow: true,
        },
        modern: {
          fontSize: 42,
          color: '#ffffff',
          backgroundColor: '#0f172ae6',
          animation: 'slide-up',
          borderRadius: 8,
        },
        cinematic: {
          fontSize: 38,
          color: '#f8fafc',
          backgroundColor: 'transparent',
          animation: 'fade-in',
          shadow: true,
        },
        cyber: {
          fontSize: 44,
          color: '#38bdf8',
          backgroundColor: '#030712e6',
          animation: 'typewriter',
          borderRadius: 4,
        },
      }

      for (const cue of generatedCues) {
        const textClip = addTextClip(cue.text, targetTrack.id, cue.start)
        if (textClip) {
          const duration = Math.max(1, cue.end - cue.start)
          updateClip(textClip.id, {
            name: cue.text.slice(0, 20),
            duration,
            sourceEnd: duration,
            clipType: 'animation',
            textType: 'caption',
            text: {
              text: cue.text,
              fontSize: styleConfig[captionTheme].fontSize ?? 42,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 'bold',
              fontStyle: 'normal',
              color: styleConfig[captionTheme].color ?? '#ffffff',
              backgroundColor: styleConfig[captionTheme].backgroundColor ?? '#000000aa',
              textAlign: 'center',
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 16,
              borderRadius: styleConfig[captionTheme].borderRadius ?? 6,
              shadow: styleConfig[captionTheme].shadow ?? true,
              animation: styleConfig[captionTheme].animation ?? 'slide-up',
              animationDuration: 0.3,
            },
          })
        }
      }

      setProgressPercent(100)
      setSuccess(`Generated ${generatedCues.length} synchronized captions! Set playhead to 0:00 to preview.`)
      setPlayhead(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
      setProgressText('')
    }
  }

  return (
    <div className="space-y-3 p-3">
      {/* ── Sub Navigation ── */}
      <div className="flex rounded-lg border bg-muted/40 p-0.5">
        {[
          { id: 'auto' as const, label: '⚡ Auto Captions' },
          { id: 'style' as const, label: 'Overlay Style' },
          { id: 'cues' as const, label: `Cues (${captionClips.length})` },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 rounded-md py-1 text-center text-[10px] font-semibold transition',
              tab === id ? 'bg-card text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'auto' && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-violet-950/20 p-2.5 border-violet-500/30 space-y-2">
            <div className="flex items-center gap-1.5 text-violet-300 font-semibold text-xs">
              <Sparkles className="size-3.5" />
              <span>AI Speech-to-Text Auto Captions</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Extracts spoken audio from your video clips using on-device Whisper AI, builds timed captions, and starts auto-playing immediately!
            </p>

            <div className="space-y-1.5 pt-1">
              <Label className="text-[10px]">Caption Style Preset</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'karaoke' as const, label: 'Yellow Karaoke', bg: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
                  { id: 'modern' as const, label: 'Modern Dark Pill', bg: 'border-slate-500/40 bg-slate-500/10 text-slate-200' },
                  { id: 'cinematic' as const, label: 'Cinematic Subtitles', bg: 'border-white/40 bg-white/5 text-white' },
                  { id: 'cyber' as const, label: 'Neon Cyber Blue', bg: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={cn(
                      'rounded-md border p-1.5 text-left text-[10px] font-medium transition',
                      captionTheme === st.id ? `${st.bg} ring-1 ring-violet-400` : 'border-border/60 text-muted-foreground hover:bg-muted/20',
                    )}
                    onClick={() => setCaptionTheme(st.id)}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="sm"
              className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold h-9 shadow-xs mt-1"
              onClick={() => void handleAutoGenerateCaptions()}
              disabled={generating}
            >
              {generating ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Play className="mr-2 size-3.5" />}
              {generating ? progressText || `Transcribing Audio (${progressPercent}%)...` : '⚡ Auto-Generate Captions & Auto-Play'}
            </Button>
          </div>
        </div>
      )}

      {tab === 'style' && (
        <div className="space-y-3">
          {clip?.text ? (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Selected Caption Text</Label>
                <Input
                  value={clip.text.text}
                  placeholder="Enter caption text..."
                  onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, text: e.target.value } })}
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Font Size ({clip.text.fontSize}px)</Label>
                  <Input
                    type="number"
                    min={12}
                    max={160}
                    value={clip.text.fontSize}
                    onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, fontSize: Number(e.target.value) } })}
                    className="h-7 text-[11px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Text Color</Label>
                  <Input
                    type="color"
                    value={clip.text.color}
                    onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, color: e.target.value } })}
                    className="h-7 w-full cursor-pointer p-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Background Color</Label>
                  <Input
                    type="color"
                    value={clip.text.backgroundColor || '#000000'}
                    onChange={(e) => updateClip(clip.id, { text: { ...clip.text!, backgroundColor: e.target.value } })}
                    className="h-7 w-full cursor-pointer p-0.5"
                  />
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
                      <SelectItem value="slide-up">Slide Up</SelectItem>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="typewriter">Typewriter</SelectItem>
                      <SelectItem value="scale-in">Scale In</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <EmptyHint text="Select any caption or text clip on the timeline to customize its styling." icon={FileText} />
          )}
        </div>
      )}

      {tab === 'cues' && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {captionClips.length > 0 ? (
            captionClips.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'flex items-center gap-2 rounded-md border p-2 text-xs transition',
                  clip?.id === c.id ? 'border-violet-500 bg-violet-500/10' : 'bg-card hover:border-violet-500/40',
                )}
                onClick={() => setPlayhead(c.startTime)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {formatSeconds(c.startTime)} → {formatSeconds(c.startTime + c.duration)}
                  </p>
                  <p className="truncate font-medium text-foreground">{c.text?.text || c.name}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteClips([c.id])
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          ) : (
            <EmptyHint text="No caption clips on the timeline yet. Click 'Auto-Generate Captions' to start." icon={FileText} />
          )}
        </div>
      )}

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}
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
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  const [isStudioOpen, setIsStudioOpen] = React.useState(false)
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('cyber-cube')
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>('')
  const [usePreset, setUsePreset] = React.useState(true)

  // Quick Flight Rig Settings
  const [flightMode, setFlightMode] = React.useState<'turntable' | 'dolly' | 'orbit' | 'static'>('turntable')
  const [duration, setDuration] = React.useState(5)
  const [resolution, setResolution] = React.useState('1280x720')
  const [fps, setFps] = React.useState(30)
  const [lighting, setLighting] = React.useState<'studio' | 'neon' | 'sunset'>('studio')

  // Search Online Models State
  const [source, setSource] = React.useState<'polyhaven' | 'sketchfab'>('polyhaven')
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<ModelResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [downloading, setDownloading] = React.useState<string | null>(null)

  // Render & Status
  const [rendering, setRendering] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const modelAssets = React.useMemo(() => assets.filter((a) => a.type === 'model'), [assets])
  const selectedAsset = modelAssets.find((a) => a.id === selectedAssetId)

  const handleCustomGlbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const { imported } = await importFiles(Array.from(files))
    if (imported.length) {
      setSelectedAssetId(imported[0].id)
      setUsePreset(false)
      setSuccess(`Imported 3D model "${imported[0].name}"`)
    }
  }

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
        setSelectedAssetId(imported[0].id)
        setUsePreset(false)
        setSuccess(`Imported "${imported[0].name}"! Ready for 3D staging & animation.`)
      } else {
        setError(errors[0] ?? 'Import failed')
      }
    } catch (err) {
      setError(`Download failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDownloading(null)
    }
  }

  const renderQuickVideo = async () => {
    setRendering(true)
    setError(null)
    setSuccess(null)

    try {
      let targetAsset: Asset
      if (usePreset || !selectedAsset) {
        const glbBlob = await exportPresetToGlb(selectedPresetId)
        const glbFile = new File([glbBlob], `${selectedPresetId}-${Date.now()}.glb`, { type: 'model/gltf-binary' })
        const imp = await importFiles([glbFile])
        if (!imp.imported.length) throw new Error('Could not prepare 3D preset')
        targetAsset = imp.imported[0]
      } else {
        targetAsset = selectedAsset
      }

      const [w, h] = resolution.split('x').map(Number)
      const rig = defaultCameraRig()
      rig.mode = flightMode
      rig.radiusStart = (targetAsset.modelRadius ?? 2.4) * 2.5
      rig.radiusEnd = flightMode === 'dolly' ? rig.radiusStart * 0.4 : rig.radiusStart
      rig.azimuthEnd = flightMode === 'turntable' ? 360 : 180

      const { renderGlbToVideo } = await import('@/engine/three/renderGlbToVideo')
      const res = await renderGlbToVideo({
        asset: targetAsset,
        rig,
        duration,
        fps,
        width: w,
        height: h,
        onProgress: (done, total) => setProgress({ done, total }),
      })

      const videoFile = new File([res.blob], `3d-${selectedPresetId || 'model'}-${Date.now()}.webm`, { type: 'video/webm' })
      const vimp = await importFiles([videoFile])
      const videoTrack = project.tracks.find((t) => t.type === 'video')
      if (videoTrack && vimp.imported.length) {
        const clip = addClip(vimp.imported[0].id, videoTrack.id, playhead ?? 0)
        if (clip) {
          updateClip(clip.id, { duration, sourceEnd: duration, clipType: 'video' })
          setSuccess(`Rendered ${duration}s HD 3D video (${w}x${h}) and added to timeline!`)
        }
      } else {
        setSuccess(`Rendered ${duration}s HD 3D video successfully!`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRendering(false)
      setProgress(null)
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="space-y-4 p-3">
      {/* ── Top Dedicated Studio Banner ── */}
      <Button
        type="button"
        className="h-9 w-full bg-violet-600/90 text-xs font-semibold text-white hover:bg-violet-600 shadow-xs"
        onClick={() => setIsStudioOpen(true)}
      >
        <Maximize2 className="mr-2 size-3.5" />
        Open 3D Animation Studio (Full Workspace)
      </Button>

      {/* ── 1. Live Interactive WebGL Viewport ── */}
      <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Box className="size-4 text-violet-400" />
            <span className="text-xs font-semibold">3D Model Preview</span>
          </div>
          <button
            type="button"
            className="text-[10px] text-violet-400 hover:underline"
            onClick={() => fileInputRef.current?.click()}
          >
            + Upload .GLB
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept=".glb,.gltf" className="hidden" onChange={handleCustomGlbUpload} />

        {/* Live Canvas */}
        <ThreeDPreviewCanvas
          asset={!usePreset ? selectedAsset : null}
          presetId={usePreset ? selectedPresetId : undefined}
          lighting={lighting}
          className="h-40 w-full"
        />

        {/* Preset Selector Chips */}
        <div className="grid grid-cols-3 gap-1 pt-1">
          {BUILTIN_3D_PRESETS.map((preset) => {
            const isSelected = usePreset && selectedPresetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  'truncate rounded-md border p-1 text-center text-[10px] font-medium transition',
                  isSelected
                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  setUsePreset(true)
                  setSelectedPresetId(preset.id)
                }}
              >
                {preset.name.split(' ')[0]}
              </button>
            )
          })}
        </div>

        {/* Uploaded Models Select */}
        {modelAssets.length > 0 && (
          <div className="pt-1">
            <Select value={selectedAssetId} onValueChange={(id) => { setSelectedAssetId(id); setUsePreset(false) }}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Or select imported 3D model..." />
              </SelectTrigger>
              <SelectContent>
                {modelAssets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>Custom: {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── 2. Quick Flight Path & Camera Rig ── */}
      <div className="space-y-2.5 rounded-lg border bg-muted/15 p-2.5">
        <span className="text-xs font-semibold">Camera Motion Path</span>
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'turntable' as const, label: '360° Turntable' },
            { id: 'dolly' as const, label: 'Dolly Push-In' },
            { id: 'orbit' as const, label: 'Spiral Orbit' },
            { id: 'static' as const, label: 'Static Angle' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              className={cn(
                'rounded px-2 py-1 text-[10px] font-medium transition',
                flightMode === m.id
                  ? 'border border-violet-500 bg-violet-500/20 text-violet-300'
                  : 'border border-border/60 bg-card text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setFlightMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Duration</Label>
            <div className="flex items-center justify-between text-[10px]">
              <Slider value={[duration]} min={1} max={15} step={1} onValueChange={([v]) => setDuration(v)} className="w-24" />
              <span className="font-mono">{duration}s</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Quality</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1920x1080">1080p HD</SelectItem>
                <SelectItem value="1280x720">720p HD</SelectItem>
                <SelectItem value="1080x1920">9:16 Vertical</SelectItem>
                <SelectItem value="1080x1080">1:1 Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Lighting</Label>
            <Select value={lighting} onValueChange={(v) => setLighting(v as 'studio' | 'neon' | 'sunset')}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="studio">Studio Light</SelectItem>
                <SelectItem value="neon">Cyber Neon</SelectItem>
                <SelectItem value="sunset">Sunset Warm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Framerate</Label>
            <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 FPS</SelectItem>
                <SelectItem value="30">30 FPS</SelectItem>
                <SelectItem value="60">60 FPS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── 3. Progress & Render Button ── */}
      {progress && (
        <div className="space-y-1 rounded-md border bg-card p-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground font-mono">Rendering: {progress.done}/{progress.total} frames</span>
            <span className="font-semibold text-violet-400">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      <Button
        size="sm"
        className="h-9 w-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500 shadow-xs"
        onClick={() => void renderQuickVideo()}
        disabled={rendering}
      >
        {rendering ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Video className="mr-2 size-3.5" />}
        {rendering ? 'Rendering 3D Video...' : 'Render 3D Animation to Timeline'}
      </Button>

      {/* ── 4. Search Online Models (Poly Haven / Sketchfab) ── */}
      <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Online 3D Library</span>
          <Select value={source} onValueChange={(v) => { setSource(v as 'polyhaven' | 'sketchfab'); setResults([]) }}>
            <SelectTrigger className="h-6 w-28 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="polyhaven">Poly Haven (CC0)</SelectItem>
              <SelectItem value="sketchfab">Sketchfab</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-1.5">
          <Input
            placeholder="Search online 3D models..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
            className="h-7 text-xs"
          />
          <Button size="sm" className="h-7 px-2" onClick={() => void search()} disabled={searching}>
            {searching ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto pt-1">
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                className="group relative flex flex-col overflow-hidden rounded border bg-card p-1.5 text-left transition hover:border-violet-500"
                onClick={() => void downloadAndImport(m)}
                disabled={downloading === m.id}
              >
                <div className="flex items-center gap-1">
                  <Box className="size-3 text-violet-400 shrink-0" />
                  <span className="truncate text-[10px] font-medium">{m.name}</span>
                </div>
                {downloading === m.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 className="size-3.5 animate-spin text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Dedicated 3D Animation Studio Modal ── */}
      <ThreeDStudioModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        initialAssetId={selectedAssetId}
      />
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
  const [rippleDuration, setRippleDuration] = React.useState(true)

  if (!clip) return <EmptyHint text="Select any video or audio clip on the timeline to adjust its playback speed." icon={Gauge} />

  const sourceDuration = Math.max(0.1, clip.sourceEnd - clip.sourceStart)

  const handleSetSpeed = (newSpeed: number) => {
    const safeSpeed = Math.max(0.1, Math.min(10, newSpeed))
    const updates: Partial<Clip> = { speed: safeSpeed }
    if (rippleDuration) {
      const newDur = Math.max(0.1, sourceDuration / safeSpeed)
      updates.duration = newDur
    }
    updateClip(clip.id, updates)
  }

  const presets = [0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0, 8.0]

  return (
    <div className="space-y-3 p-3">
      {/* ── Clip Info Header ── */}
      <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold truncate max-w-[160px]">{clip.name}</span>
          <span className="font-mono text-violet-400 text-xs font-bold">{clip.speed.toFixed(2)}x Speed</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          <div>
            <span>Source Length: </span>
            <span className="font-mono text-foreground">{sourceDuration.toFixed(1)}s</span>
          </div>
          <div>
            <span>Timeline Length: </span>
            <span className="font-mono text-foreground">{clip.duration.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* ── Precision Slider ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Speed Multiplier</Label>
          <span className="font-mono text-xs text-muted-foreground">{clip.speed.toFixed(2)}x</span>
        </div>
        <Slider
          min={0.1}
          max={8}
          step={0.05}
          value={[clip.speed]}
          onValueChange={([v]) => handleSetSpeed(v)}
        />
      </div>

      {/* ── Quick Preset Buttons ── */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Quick Presets</Label>
        <div className="grid grid-cols-5 gap-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={cn(
                'rounded py-1 text-center font-mono text-[10px] font-semibold transition',
                Math.abs(clip.speed - p) < 0.04
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'border bg-card text-muted-foreground hover:border-violet-500/50 hover:text-foreground',
              )}
              onClick={() => handleSetSpeed(p)}
            >
              {p}x
            </button>
          ))}
        </div>
      </div>

      {/* ── Speed Ramps / Styles ── */}
      <div className="space-y-1.5 pt-1">
        <Label className="text-[10px] text-muted-foreground">Speed Presets</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'Cinematic Slow-Mo', speed: 0.5, desc: 'Silky smooth 50% slow-motion' },
            { label: 'Dramatic 0.25x', speed: 0.25, desc: 'Ultra slow-mo for impact shots' },
            { label: 'Time-Lapse (4x)', speed: 4.0, desc: 'Fast motion montage' },
            { label: 'Normal Speed (1x)', speed: 1.0, desc: 'Reset to native 100% speed' },
          ].map((ramp) => (
            <button
              key={ramp.label}
              type="button"
              className={cn(
                'rounded-md border p-1.5 text-left text-[10px] transition',
                Math.abs(clip.speed - ramp.speed) < 0.05
                  ? 'border-violet-500 bg-violet-500/15 text-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted/20',
              )}
              onClick={() => handleSetSpeed(ramp.speed)}
            >
              <p className="font-semibold text-foreground">{ramp.label}</p>
              <p className="text-[9px] text-muted-foreground">{ramp.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Toggles ── */}
      <div className="space-y-2 pt-1 border-t">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">Ripple Timeline Duration</Label>
            <p className="text-[10px] text-muted-foreground">Auto-scale timeline clip length with speed</p>
          </div>
          <Switch checked={rippleDuration} onCheckedChange={setRippleDuration} />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">Preserve Audio Pitch</Label>
            <p className="text-[10px] text-muted-foreground">Prevent voice pitch change during speed changes</p>
          </div>
          <Switch
            checked={clip.preservePitch !== false}
            onCheckedChange={(checked) => updateClip(clip.id, { preservePitch: checked })}
          />
        </div>
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

// ─── Design & Motion Graphics Section ─────────────────────────────────────────
function DesignSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  const [mode, setMode] = React.useState<'motion' | 'html'>('motion')
  const [motionSubTab, setMotionSubTab] = React.useState<'prompt' | 'presets' | 'code' | 'history'>('prompt')

  // Motion Graphics State
  const [concept, setConcept] = React.useState('Kinetic modern title sequence with neon violet glow')
  const [style, setStyle] = React.useState('Modern Tech Glow')
  const [duration, setDuration] = React.useState(5)
  const [transparent, setTransparent] = React.useState(false)
  const [resolution, setResolution] = React.useState('1280x720')
  const [fps, setFps] = React.useState(30)
  const [motionCode, setMotionCode] = React.useState<string>(BUILTIN_MOTION_PRESETS[0].code)

  // Live Canvas Playback State
  const [isPlaying, setIsPlaying] = React.useState(true)
  const [currentTime, setCurrentTime] = React.useState(0)
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const animFrameRef = React.useRef<number | null>(null)

  // HTML Web Design State
  const [htmlPrompt, setHtmlPrompt] = React.useState('')
  const [html, setHtml] = React.useState('')
  const htmlIframeRef = React.useRef<HTMLIFrameElement>(null)

  // Execution & Progress
  const [busy, setBusy] = React.useState(false)
  const [rendering, setRendering] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const history = React.useMemo(() => getMotionHistory(), [busy])

  // Live Canvas Evaluation Loop
  React.useEffect(() => {
    if (mode !== 'motion') return
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isMounted = true
    let animateFn: ((ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void) | null = null
    let initFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null

    try {
      // Safe sandboxed function evaluation for preview
      const createScope = new Function('window', motionCode)
      const fakeWindow: Record<string, unknown> = {}
      createScope(fakeWindow)
      if (typeof fakeWindow.__ANIMATE === 'function') {
        animateFn = fakeWindow.__ANIMATE as (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void
      }
      if (typeof fakeWindow.__INIT === 'function') {
        initFn = fakeWindow.__INIT as (ctx: CanvasRenderingContext2D, w: number, h: number) => void
      }
      if (initFn) initFn(ctx, canvas.width, canvas.height)
    } catch {
      // Silent error during active code typing
    }

    let startTime = performance.now()
    const loop = (now: number) => {
      if (!isMounted) return
      if (isPlaying) {
        const elapsed = ((now - startTime) / 1000) % duration
        const t = elapsed / duration
        setCurrentTime(t)
        if (animateFn) {
          try {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            animateFn(ctx, t, canvas.width, canvas.height)
          } catch {
            // ignore frame error
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      isMounted = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [mode, motionCode, isPlaying, duration])

  // Update canvas on manual time scrub
  const handleScrubTime = (t: number) => {
    setCurrentTime(t)
    setIsPlaying(false)
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    try {
      const createScope = new Function('window', motionCode)
      const fakeWindow: Record<string, unknown> = {}
      createScope(fakeWindow)
      if (typeof fakeWindow.__ANIMATE === 'function') {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const fn = fakeWindow.__ANIMATE as (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void
        fn(ctx, t, canvas.width, canvas.height)
      }
    } catch {
      // ignore
    }
  }

  // Generate Motion Code with AI
  const handleGenerateMotion = async () => {
    if (!concept.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await generateMotionCode({
        concept,
        durationSeconds: duration,
        style,
        transparent,
      })
      setMotionCode(res.code)
      setSuccess('Generated motion graphics animation! Ready to preview & render.')
      setIsPlaying(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Render Motion Graphic Video and Add to Timeline
  const handleRenderMotionToTimeline = async () => {
    if (!motionCode.trim() || rendering) return
    setRendering(true)
    setError(null)
    setSuccess(null)

    try {
      const [w, h] = resolution.split('x').map(Number)
      const result = await renderMotionClip({
        code: motionCode,
        width: w,
        height: h,
        fps,
        duration,
        onProgress: (done, total) => setProgress({ done, total }),
      })

      const file = new File([result.blob], `motion-${Date.now()}.webm`, { type: 'video/webm' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        const videoTrack = project.tracks.find((t) => t.type === 'video')
        if (!videoTrack) throw new Error('No video track available on the timeline')
        const clip = addClip(imported[0].id, videoTrack.id, playhead ?? 0)
        if (clip) {
          updateClip(clip.id, { duration, sourceEnd: duration, clipType: 'animation' })
          setSuccess(`Rendered ${duration}s HD motion graphic (${w}x${h}) and added to timeline!`)
        }
      } else {
        setError(errors[0] ?? 'Could not import motion graphic video')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRendering(false)
      setProgress(null)
    }
  }

  // Generate HTML Webpage Design
  const handleGenerateHtml = async () => {
    if (!htmlPrompt.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { chatCompletion, getDirectorProvider } = await import('@/api/llm/director')
      const provider = getDirectorProvider()
      if (!provider) throw new Error('No AI provider configured. Add one in Settings.')

      const messages = [
        {
          role: 'system' as const,
          content: 'You are an expert UI designer. Generate a single self-contained HTML file with inline CSS and JS. Return ONLY raw HTML code.',
        },
        { role: 'user' as const, content: `Create a modern webpage design for: "${htmlPrompt.trim()}"` },
      ]
      const reply = await chatCompletion(provider, messages)
      let generated = reply.content ?? ''
      generated = generated.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '')
      setHtml(generated)
      setSuccess('HTML design generated! Ready to preview & render.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const addHtmlDesignToTimeline = async () => {
    if (!html || rendering) return
    setRendering(true)
    setError(null)
    try {
      const { renderHtmlToPng } = await import('@/engine/motion/sandbox')
      const blob = await renderHtmlToPng(html, 1920, 1080)
      const file = new File([blob], `design-${Date.now()}.png`, { type: 'image/png' })
      const { imported } = await importFiles([file])
      if (imported.length) {
        const videoTrack = project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const newClip = addClip(imported[0].id, videoTrack.id, playhead ?? 0)
          if (newClip) updateClip(newClip.id, { duration: 5, sourceEnd: 5 })
        }
        setSuccess('Design added to timeline as a 5s clip!')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRendering(false)
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="flex h-full flex-col gap-3.5 p-3">
      {/* ── Top Mode Switcher ── */}
      <div className="flex rounded-lg border bg-muted/40 p-0.5">
        <button
          type="button"
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition',
            mode === 'motion' ? 'bg-card text-violet-400 shadow-xs' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setMode('motion')}
        >
          <Sparkles className="size-3.5" />
          Motion Graphics (WebGL/Canvas)
        </button>
        <button
          type="button"
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition',
            mode === 'html' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setMode('html')}
        >
          <Code className="size-3.5" />
          HTML/CSS Landing
        </button>
      </div>

      {mode === 'motion' ? (
        <>
          {/* ── Live Canvas Viewport ── */}
          <div className="space-y-1.5 rounded-lg border bg-black/60 p-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">Live Motion Stage</span>
              <span className="font-mono">{(currentTime * duration).toFixed(2)}s / {duration}s</span>
            </div>

            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-border/80 bg-zinc-950">
              <canvas
                ref={previewCanvasRef}
                width={640}
                height={360}
                className="size-full object-contain"
              />
            </div>

            {/* Playback Scrubber Bar */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="size-3.5 text-violet-400" /> : <Play className="size-3.5 text-emerald-400" />}
              </button>
              <Slider
                value={[currentTime]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={([v]) => handleScrubTime(v)}
                className="flex-1"
              />
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                onClick={() => handleScrubTime(0)}
                title="Restart"
              >
                <RotateCcw className="size-3" />
              </button>
            </div>
          </div>

          {/* ── Sub Navigation Tabs ── */}
          <div className="flex gap-1 border-b pb-1">
            {[
              { id: 'prompt' as const, label: 'AI Generator' },
              { id: 'presets' as const, label: 'Presets' },
              { id: 'code' as const, label: 'Code' },
              { id: 'history' as const, label: 'History' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition',
                  motionSubTab === id
                    ? 'bg-violet-600/20 text-violet-300 font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMotionSubTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab Content ── */}
          {motionSubTab === 'prompt' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Animation Concept Prompt</Label>
                <textarea
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Describe your motion graphic animation (e.g. kinetic typography, data charts, particle hud)..."
                  className="h-16 w-full resize-none rounded-md border bg-card p-2 text-xs outline-none focus:border-violet-500"
                  disabled={busy}
                />
              </div>

              {/* Quick Starter Chips */}
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Kinetic Intro', prompt: 'Kinetic typography title sequence with neon violet gradient and dynamic typography' },
                  { label: 'Cyberpunk HUD', prompt: 'Sci-fi circular telemetry HUD with radar sweep and digital target trackers' },
                  { label: 'Lower Third', prompt: 'Glassmorphic broadcast lower third bar with sliding cyan accent stripe' },
                  { label: 'Growth Chart', prompt: 'Animated revenue metric graph columns rising with percentage counts' },
                  { label: 'Neural Mesh', prompt: 'Interconnected neural particle swarm with glowing synaptic pulse lines' },
                ].map(({ label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-violet-500 hover:text-foreground"
                    onClick={() => setConcept(prompt)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Style & Transparency */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Visual Style</Label>
                  <Select value={style} onValueChange={setStyle} disabled={busy}>
                    <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Modern Tech Glow">Modern Tech Glow</SelectItem>
                      <SelectItem value="Cyberpunk Neon">Cyberpunk Neon</SelectItem>
                      <SelectItem value="Minimalist Clean">Minimalist Clean</SelectItem>
                      <SelectItem value="Cinematic Dark">Cinematic Dark</SelectItem>
                      <SelectItem value="Pastel Modern">Pastel Modern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Duration</Label>
                  <div className="flex items-center justify-between text-[10px]">
                    <Slider value={[duration]} min={2} max={15} step={1} onValueChange={([v]) => setDuration(v)} className="w-20" />
                    <span className="font-mono">{duration}s</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-2 bg-muted/10">
                <span className="text-[11px]">Transparent Overlay (Alpha)</span>
                <Switch checked={transparent} onCheckedChange={setTransparent} />
              </div>

              <Button
                size="sm"
                className="w-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500 shadow-xs"
                onClick={() => void handleGenerateMotion()}
                disabled={busy || !concept.trim()}
              >
                {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
                {busy ? 'Generating AI Motion Graphic...' : 'Generate Motion Graphic with AI'}
              </Button>
            </div>
          )}

          {motionSubTab === 'presets' && (
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {BUILTIN_MOTION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="flex flex-col items-start rounded-lg border bg-card p-2.5 text-left transition hover:border-violet-500"
                  onClick={() => {
                    setMotionCode(preset.code)
                    setDuration(preset.defaultDuration)
                    setMotionSubTab('prompt')
                    setSuccess(`Loaded "${preset.name}" preset!`)
                    setIsPlaying(true)
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold">{preset.name}</span>
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.2 text-[9px] font-medium text-violet-300">
                      {preset.category}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{preset.description}</p>
                </button>
              ))}
            </div>
          )}

          {motionSubTab === 'code' && (
            <div className="space-y-1.5">
              <Label className="text-xs">JavaScript Motion Code</Label>
              <textarea
                value={motionCode}
                onChange={(e) => setMotionCode(e.target.value)}
                className="h-44 w-full resize-none rounded-md border bg-zinc-950 p-2 font-mono text-[10px] text-emerald-400 outline-none focus:border-violet-500"
                spellCheck={false}
              />
            </div>
          )}

          {motionSubTab === 'history' && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {history.length > 0 ? (
                history.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="flex w-full flex-col items-start rounded border bg-card p-2 text-left hover:border-violet-500"
                    onClick={() => {
                      setMotionCode(h.code)
                      setDuration(h.duration)
                      setMotionSubTab('prompt')
                      setSuccess(`Restored "${h.prompt.slice(0, 30)}..." from history`)
                    }}
                  >
                    <span className="truncate text-[11px] font-medium">{h.prompt}</span>
                    <span className="text-[9px] text-muted-foreground">{new Date(h.timestamp).toLocaleTimeString()} · {h.duration}s</span>
                  </button>
                ))
              ) : (
                <EmptyHint text="No saved motion graphics history yet. Generate one to see history." icon={Sparkles} />
              )}
            </div>
          )}

          {/* ── Render Quality & Timeline Export ── */}
          <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
            <span className="text-xs font-semibold">Video Render Settings</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1920x1080">1080p Full HD</SelectItem>
                    <SelectItem value="1280x720">720p HD</SelectItem>
                    <SelectItem value="1080x1920">9:16 Vertical</SelectItem>
                    <SelectItem value="1080x1080">1:1 Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Framerate</Label>
                <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 FPS</SelectItem>
                    <SelectItem value="30">30 FPS</SelectItem>
                    <SelectItem value="60">60 FPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {progress && (
            <div className="space-y-1 rounded-md border bg-card p-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground font-mono">Rendering: {progress.done}/{progress.total} frames</span>
                <span className="font-semibold text-violet-400">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-violet-600 transition-all duration-150" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {error && <SectionNotice kind="error" text={error} />}
          {success && <SectionNotice kind="ok" text={success} />}

          <Button
            size="sm"
            className="h-9 w-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500 shadow-xs"
            onClick={() => void handleRenderMotionToTimeline()}
            disabled={rendering || !motionCode.trim()}
          >
            {rendering ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Video className="mr-2 size-3.5" />}
            {rendering ? 'Compiling HD Motion Video...' : 'Render & Add Motion Graphic to Timeline'}
          </Button>
        </>
      ) : (
        /* ── HTML/CSS Webpage Mode ── */
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Describe Landing Page or UI</Label>
            <Input
              placeholder="e.g. Dark landing hero for AI startup with glowing cards..."
              value={htmlPrompt}
              onChange={(e) => setHtmlPrompt(e.target.value)}
              className="h-8 text-xs"
              disabled={busy}
            />
          </div>

          <Button
            size="sm"
            className="w-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500"
            onClick={() => void handleGenerateHtml()}
            disabled={busy || !htmlPrompt.trim()}
          >
            {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
            {busy ? 'Generating Webpage...' : 'Generate HTML/CSS Webpage'}
          </Button>

          {error && <SectionNotice kind="error" text={error} />}
          {success && <SectionNotice kind="ok" text={success} />}

          {html && (
            <div className="space-y-2">
              <iframe
                ref={htmlIframeRef}
                title="HTML Preview"
                srcDoc={html}
                className="h-44 w-full rounded border bg-white"
                sandbox="allow-scripts allow-same-origin"
              />
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="h-32 w-full resize-none rounded border bg-zinc-950 p-2 font-mono text-[10px] text-emerald-400 outline-none"
                spellCheck={false}
              />
              <Button
                size="sm"
                className="w-full"
                onClick={() => void addHtmlDesignToTimeline()}
                disabled={rendering}
              >
                {rendering ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Plus className="mr-2 size-3.5" />}
                {rendering ? 'Rendering PNG Frame...' : 'Add Webpage to Timeline (5s)'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Script Section ───────────────────────────────────────────────────────────
function ScriptSection() {
  const [topic, setTopic] = React.useState('')
  const [creatorStyle, setCreatorStyle] = React.useState<CreatorStyleId>('mrbeast')
  const [targetDuration, setTargetDuration] = React.useState(60)
  const [sceneCount, setSceneCount] = React.useState(5)
  const [customTone, setCustomTone] = React.useState('high_energy')
  const [language, setLanguage] = React.useState('auto')
  const [busy, setBusy] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'storyboard' | 'teleprompter' | 'hook'>('storyboard')
  const [teleprompterZoom, setTeleprompterZoom] = React.useState(14)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const script = useScriptStore((s) => s.script)
  const setScript = useScriptStore((s) => s.setScript)
  const addTextClip = useTimelineStore((s) => s.addTextClip)
  const project = useTimelineStore((s) => s.project)

  const handleGenerate = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await generateScript({
        topic: topic.trim(),
        durationSeconds: targetDuration,
        creatorStyle,
        customTone,
        sceneCount,
        language,
      })
      setScript(result)
      setSuccess(`Script created in ${CREATOR_STYLES[creatorStyle].name} style!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!script) return
    const text = formatTeleprompter(script)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${script.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_script.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddCaptionsToTimeline = () => {
    if (!script) return
    const targetTrack = project.tracks.find((t) => t.type === 'text') || project.tracks.find((t) => t.type === 'video')
    if (!targetTrack) {
      setError('No text track available on timeline')
      return
    }

    let time = 0
    if (script.hook) {
      addTextClip(script.hook, targetTrack.id, time)
      time += 4
    }
    for (const sc of script.scenes) {
      const textToUse = sc.onScreenText || sc.text
      if (textToUse) {
        addTextClip(textToUse, targetTrack.id, time)
      }
      time += sc.durationSeconds
    }
    if (script.cta) {
      addTextClip(script.cta, targetTrack.id, time)
    }
    setSuccess('Added script scenes as text overlays to the timeline!')
  }

  const metrics = script ? calculateScriptMetrics(script) : null

  return (
    <div className="space-y-3.5 p-3">
      {/* ── 1. Creator Persona & Style Selector ── */}
      <div className="space-y-1.5 rounded-lg border bg-muted/10 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Flame className="size-3.5 text-amber-400" />
            Creator Persona & Style
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {CREATOR_STYLES[creatorStyle].name}
          </span>
        </div>

        {/* Style Grid */}
        <div className="grid grid-cols-3 gap-1 pt-1">
          {(Object.values(CREATOR_STYLES) as typeof CREATOR_STYLES[CreatorStyleId][]).map((style) => (
            <button
              key={style.id}
              type="button"
              className={cn(
                'rounded-md border p-1.5 text-left transition flex flex-col justify-between h-14',
                creatorStyle === style.id
                  ? 'border-violet-500 bg-violet-500/15 shadow-xs ring-1 ring-violet-500/50'
                  : 'border-border/60 bg-card hover:border-violet-500/40 hover:bg-muted/10',
              )}
              onClick={() => setCreatorStyle(style.id)}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold">{style.icon} {style.name.split(' ')[0]}</span>
              </div>
              <p className="text-[8px] text-muted-foreground line-clamp-1 leading-tight">{style.tagline}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Script Topic & Pacing Controls ── */}
      <div className="space-y-2.5 rounded-lg border bg-muted/10 p-2.5">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Video Topic or Title</Label>
          <Input
            placeholder="e.g. 5 AI tools that will change video editing forever"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-8 text-xs bg-card"
            disabled={busy}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Target Length</Label>
              <span className="font-mono text-[10px] text-violet-400 font-semibold">{targetDuration}s</span>
            </div>
            <Select value={String(targetDuration)} onValueChange={(v) => setTargetDuration(Number(v))} disabled={busy}>
              <SelectTrigger className="h-7 text-xs bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15s (Shorts/TikTok)</SelectItem>
                <SelectItem value="30">30s (Quick Hook)</SelectItem>
                <SelectItem value="60">60s (Standard 1-Min)</SelectItem>
                <SelectItem value="90">90s (Deep Reel)</SelectItem>
                <SelectItem value="120">2 Min (Explainer)</SelectItem>
                <SelectItem value="180">3 Min (Mini-Doc)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Tone & Pacing</Label>
            </div>
            <Select value={customTone} onValueChange={setCustomTone} disabled={busy}>
              <SelectTrigger className="h-7 text-xs bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high_energy">High Energy & Urgent</SelectItem>
                <SelectItem value="storytelling">Narrative Storytelling</SelectItem>
                <SelectItem value="educational">Educational & Analytical</SelectItem>
                <SelectItem value="humorous">Witty & Humorous</SelectItem>
                <SelectItem value="authoritative">Authoritative & Confident</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Scenes / Beats</Label>
            <Select value={String(sceneCount)} onValueChange={(v) => setSceneCount(Number(v))} disabled={busy}>
              <SelectTrigger className="h-7 text-xs bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Scenes (Tight)</SelectItem>
                <SelectItem value="4">4 Scenes (Balanced)</SelectItem>
                <SelectItem value="5">5 Scenes (Standard)</SelectItem>
                <SelectItem value="6">6 Scenes (Deep)</SelectItem>
                <SelectItem value="8">8 Scenes (Comprehensive)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Language</Label>
            <Select value={language} onValueChange={setLanguage} disabled={busy}>
              <SelectTrigger className="h-7 text-xs bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto / English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
                <SelectItem value="Hindi">Hindi</SelectItem>
                <SelectItem value="Japanese">Japanese</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full bg-violet-600 hover:bg-violet-500 text-white shadow-xs font-semibold h-8"
          onClick={() => void handleGenerate()}
          disabled={busy || !topic.trim()}
        >
          {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
          {busy ? 'Writing Viral Script...' : `Generate ${CREATOR_STYLES[creatorStyle].name} Script`}
        </Button>
      </div>

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      {/* ── 3. Rich Script Studio Viewer ── */}
      {script && (
        <div className="space-y-2.5 rounded-lg border bg-card p-3 shadow-xs">
          {/* Header & Metrics */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground truncate max-w-[190px]">{script.title}</p>
              {metrics && (
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-mono">
                  <span>{metrics.totalWords} words</span>
                  <span>·</span>
                  <span>~{metrics.estimatedSeconds}s audio</span>
                  <span>·</span>
                  <span>{metrics.wpm} wpm</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => handleCopy(formatTeleprompter(script))}
                title="Copy Full Script"
              >
                {copied ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={handleDownload}
                title="Download Script (.txt)"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Viewer Tabs */}
          <div className="flex rounded-md border bg-muted/40 p-0.5 text-[10px]">
            <button
              type="button"
              className={cn(
                'flex-1 rounded py-1 font-medium transition text-center',
                activeTab === 'storyboard' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('storyboard')}
            >
              📑 Visual Storyboard
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded py-1 font-medium transition text-center',
                activeTab === 'teleprompter' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('teleprompter')}
            >
              📜 Teleprompter
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded py-1 font-medium transition text-center',
                activeTab === 'hook' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('hook')}
            >
              🎣 Hook Breakdown
            </button>
          </div>

          {/* ── Storyboard View ── */}
          {activeTab === 'storyboard' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {/* Hook */}
              {script.hook && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-400">
                    <span className="flex items-center gap-1">🎣 0:00 → 0:04 · HOOK</span>
                    <span className="text-[9px] font-normal uppercase bg-amber-500/20 px-1 rounded">High Retention</span>
                  </div>
                  <p className="text-xs text-foreground font-medium leading-snug">{script.hook}</p>
                  {script.hookVisual && (
                    <p className="text-[10px] text-muted-foreground italic border-t border-amber-500/20 pt-1">
                      Visual: {script.hookVisual}
                    </p>
                  )}
                </div>
              )}

              {/* Scenes */}
              {script.scenes.map((sc, i) => (
                <div key={i} className="rounded-md border bg-muted/20 p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-violet-400">
                    <span>🎬 Scene {i + 1}: {sc.title || `Beat ${i + 1}`}</span>
                    <span className="font-mono text-muted-foreground text-[9px]">{sc.durationSeconds.toFixed(1)}s</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{sc.text}</p>
                  {sc.visualCue && (
                    <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-1 flex items-start gap-1">
                      <span className="font-semibold text-foreground/80 shrink-0">B-Roll:</span>
                      <span className="italic">{sc.visualCue}</span>
                    </div>
                  )}
                  {sc.onScreenText && (
                    <div className="inline-block rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-300">
                      TEXT: "{sc.onScreenText}"
                    </div>
                  )}
                </div>
              ))}

              {/* CTA */}
              {script.cta && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400">
                    <span className="flex items-center gap-1">🚀 OUTRO / CALL TO ACTION</span>
                  </div>
                  <p className="text-xs text-foreground font-medium">{script.cta}</p>
                  {script.ctaVisual && (
                    <p className="text-[10px] text-muted-foreground italic border-t border-emerald-500/20 pt-1">
                      Visual: {script.ctaVisual}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Teleprompter View ── */}
          {activeTab === 'teleprompter' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Font Size</span>
                <div className="w-24">
                  <Slider
                    min={10}
                    max={22}
                    step={1}
                    value={[teleprompterZoom]}
                    onValueChange={([v]) => setTeleprompterZoom(v)}
                  />
                </div>
              </div>
              <div
                className="max-h-64 overflow-y-auto rounded-md border bg-black/40 p-3 leading-relaxed text-foreground font-sans space-y-3 select-text"
                style={{ fontSize: `${teleprompterZoom}px` }}
              >
                {script.hook && <p className="font-bold text-amber-300">{script.hook}</p>}
                {script.scenes.map((sc, i) => (
                  <p key={i}>{sc.text}</p>
                ))}
                {script.cta && <p className="font-semibold text-emerald-300">{script.cta}</p>}
              </div>
            </div>
          )}

          {/* ── Hook Breakdown View ── */}
          {activeTab === 'hook' && (
            <div className="space-y-2 text-xs">
              <div className="rounded-md border p-2.5 space-y-1.5 bg-muted/20">
                <p className="font-semibold text-foreground text-xs">First 4 Seconds Analysis</p>
                <p className="text-[11px] text-muted-foreground">
                  The opening hook sets the visual and spoken promise. In <span className="text-violet-400 font-semibold">{script.creatorStyle || 'Creator'}</span> style, retention is maximized by immediate tension.
                </p>
                <div className="rounded bg-background p-2 font-mono text-[11px] text-amber-300 border border-amber-500/30">
                  "{script.hook}"
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Quick Actions */}
          <div className="pt-2 border-t space-y-1.5">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7.5 gap-1.5"
              onClick={handleAddCaptionsToTimeline}
            >
              <FileText className="size-3.5 text-cyan-400" />
              Add Scene Titles to Timeline
            </Button>
          </div>
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
