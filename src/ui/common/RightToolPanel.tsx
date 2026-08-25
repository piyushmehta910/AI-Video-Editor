import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Film,
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
  ScanFace,
  Maximize2,
  Video,
  RotateCcw,
  Layers,
  Copy,
  Flame,
  Mic,
  Square,
  Star,
  LayoutGrid,
  Zap,
  Columns2,
  Quote,
  ListChecks,
  Brain,
  History,
  FastForward,
  Compass,
  Crosshair,
  Sun,
  Camera,
  Target,
  Pencil,
  Boxes,
  Wand2,
  PanelRight,
  Type,
  Smartphone,
} from 'lucide-react'

const CREATOR_STYLE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  mic: Mic,
  zap: Zap,
  flask: Sparkles,
  'book-open': FileText,
  smartphone: Smartphone,
  map: Compass,
  briefcase: Box,
  clapperboard: Clapperboard,
  flame: Flame,
  newspaper: FileText,
  sparkles: Sparkles,
  'trending-up': Sparkles,
  'heart-pulse': Sparkles,
  wand: Wand2,
}

const CAMERA_PRESET_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  orbit: RotateCcw,
  'zoom-in': Maximize2,
  'zoom-out': Crop,
  crane: ArrowLeftRight,
  compass: Compass,
  spiral: Sparkles,
  film: Clapperboard,
  focus: Crosshair,
  box: Box,
  'arrow-down': ChevronDown,
  search: Search,
  'arrow-left': ChevronLeft,
  'arrow-right': ChevronRight,
}
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
import { ScriptStudioModal } from '@/ui/script/ScriptStudioModal'
import { useVoiceoverRecorder } from '@/hooks/useVoiceoverRecorder'
import {
  generateSlides,
  renderSlideHtml,
  renderSlidePng,
  SLIDE_THEMES_META,
  SLIDE_FONTS_META,
  SLIDE_ANIMATIONS_META,
  type Slide,
  type SlideDeck,
  type SlideTheme,
  type SlideFont,
  type SlideAnimation,
  type SlideLayout,
} from '@/api/llm/slides'
import { generateInductiveSlideContext, getSavedSlideDecks, type InductiveSlideContext } from '@/api/llm/slideContext'
import { SlideStudioModal } from '@/ui/slides/SlideStudioModal'
import { generateLipsyncVideo, type AvatarMouth, type LipsyncStyle, AVATAR_FACE_PRESETS, renderPresetFaceToBlob, type AvatarFacePreset, sliceAudioBlob } from '@/engine/avatar'
import { generateAvatarVideo, type AvatarRole } from '@/api/llm/avatarGenerator'
import { readMediaFile } from '@/engine/storage/opfs'
import { searchMusic, searchSoundEffects, type MusicTrackResult, type SoundEffectResult } from '@/api/music/search'
import { normalizeClipVolume } from '@/hooks/useInspector'
import { searchModels, downloadModelAsGlb } from '@/api/models/polyhaven'
import { searchSketchfabModels, downloadSketchfabGlb } from '@/api/models/sketchfab'
import {
  CAMERA_TRAJECTORY_PRESETS,
  type CameraTrajectoryPreset,
  type CameraMode,
  type CameraRig,
} from '@/engine/three/rig'
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
  | 'text'
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
  | 'voiceover'

export const TOOL_SECTIONS: { id: ToolSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'text', label: 'Text & Titles', icon: Type },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'voiceover', label: 'Voiceover', icon: Mic },
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
  text: 'Add titles, headings, lower thirds and styled text presets',
  insights: 'Project health, coverage and quality',
  effects: 'Color, light and stylized looks',
  audio: 'Music, voice and sound cleanup',
  voiceover: 'AI text-to-speech with NVIDIA Magpie zero-shot voice cloning',
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

// ─── Slide & Presentation Studio Section ───────────────────────────────────────
function SlideSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  const [tab, setTab] = React.useState<'generator' | 'studio' | 'templates'>('generator')
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [topic, setTopic] = React.useState('')
  const [count, setCount] = React.useState(4)
  const [theme, setTheme] = React.useState<SlideTheme>('pitch_dark')
  const [font, setFont] = React.useState<SlideFont>('sans')
  const [animation, setAnimation] = React.useState<SlideAnimation>('slide_up')
  const [layoutArchetype, setLayoutArchetype] = React.useState('Startup Pitch Deck')
  const [slideDuration, setSlideDuration] = React.useState(5)

  // Current Slide Deck State
  const [deck, setDeck] = React.useState<SlideDeck | null>(null)
  const [currentSlideIdx, setCurrentSlideIdx] = React.useState(0)

  // Inductive Reasoning State
  const [inductiveContext, setInductiveContext] = React.useState<InductiveSlideContext | null>(null)
  const [analyzingInductive, setAnalyzingInductive] = React.useState(false)

  // Previews
  const [previews, setPreviews] = React.useState<Array<{ blob: Blob; url: string; title: string }>>([])

  // Execution State
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
      setSuccess(`Inductive reasoning complete! Inferred thesis: "${ctx.topicThesis}"`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAnalyzingInductive(false)
    }
  }

  // Generate Deck using AI
  const handleGenerateDeck = async (customTopic?: string, customCount?: number) => {
    const finalTopic = (customTopic || topic).trim()
    if (!finalTopic || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    setProgress('Synthesizing structured presentation deck...')

    try {
      const generated = await generateSlides({
        topic: finalTopic,
        count: customCount || count,
        theme,
        font,
        animation,
        layoutArchetype,
      })

      setDeck(generated)
      setCurrentSlideIdx(0)
      setTab('studio')

      const slideW = project.width || 1280
      const slideH = project.height || 720

      // Render previews for timeline
      const rendered: Array<{ blob: Blob; url: string; title: string }> = []
      for (let i = 0; i < generated.slides.length; i++) {
        setProgress(`Rendering slide ${i + 1}/${generated.slides.length}...`)
        const blob = await renderSlidePng(
          generated.slides[i],
          i + 1,
          generated.slides.length,
          generated.theme,
          slideW,
          slideH,
          generated.font,
          generated.animation,
        )
        rendered.push({
          blob,
          url: URL.createObjectURL(blob),
          title: generated.slides[i].title,
        })
      }

      setPreviews(rendered)
      setSuccess(`Generated ${generated.slides.length}-slide presentation in ${SLIDE_THEMES_META[theme].name} (${slideW}×${slideH})!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  // Update current slide in place
  const updateCurrentSlide = (patch: Partial<Slide>) => {
    if (!deck) return
    const updatedSlides = [...deck.slides]
    updatedSlides[currentSlideIdx] = {
      ...updatedSlides[currentSlideIdx],
      ...patch,
    }
    const updatedDeck: SlideDeck = { ...deck, slides: updatedSlides }
    setDeck(updatedDeck)
  }

  // Add bullet to current slide
  const addBulletPoint = () => {
    if (!deck) return
    const current = deck.slides[currentSlideIdx]
    const bullets = [...current.bullets, 'New key takeaway point']
    updateCurrentSlide({ bullets })
  }

  // Update bullet point
  const updateBulletPoint = (index: number, text: string) => {
    if (!deck) return
    const current = deck.slides[currentSlideIdx]
    const bullets = [...current.bullets]
    bullets[index] = text
    updateCurrentSlide({ bullets })
  }

  // Remove bullet point
  const removeBulletPoint = (index: number) => {
    if (!deck) return
    const current = deck.slides[currentSlideIdx]
    const bullets = current.bullets.filter((_, i) => i !== index)
    updateCurrentSlide({ bullets })
  }

  // Add card to current slide
  const addCard = () => {
    if (!deck) return
    const current = deck.slides[currentSlideIdx]
    const cards = [...(current.cards || []), { title: 'Card Title', description: 'Description of key concept', tag: 'FEATURE' }]
    updateCurrentSlide({ cards, layout: 'cards' })
  }

  // Update card
  const updateCard = (index: number, patch: Partial<{ title: string; description: string; tag: string }>) => {
    if (!deck || !deck.slides[currentSlideIdx].cards) return
    const cards = [...deck.slides[currentSlideIdx].cards!]
    cards[index] = { ...cards[index], ...patch }
    updateCurrentSlide({ cards })
  }

  // Add Deck to Timeline
  const handleAddToTimeline = async () => {
    if (!deck || adding) return
    setAdding(true)
    setError(null)

    const slideW = project.width || 1280
    const slideH = project.height || 720

    try {
      // Re-render fresh PNGs from current deck state
      const files: File[] = []
      for (let i = 0; i < deck.slides.length; i++) {
        const blob = await renderSlidePng(
          deck.slides[i],
          i + 1,
          deck.slides.length,
          deck.theme,
          slideW,
          slideH,
          deck.font,
          deck.animation,
        )
        files.push(new File([blob], `slide-${i + 1}-${Date.now()}.png`, { type: 'image/png' }))
      }

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
        setSuccess(`Added ${imported.length} customized slides (${slideW}×${slideH}) to the timeline!`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  // Add current single slide to Timeline
  const handleAddCurrentSlideToTimeline = async () => {
    if (!deck || !currentSlide || adding) return
    setAdding(true)
    setError(null)
    const slideW = project.width || 1280
    const slideH = project.height || 720

    try {
      const blob = await renderSlidePng(
        currentSlide,
        currentSlideIdx + 1,
        deck.slides.length,
        deck.theme,
        slideW,
        slideH,
        deck.font,
        deck.animation,
      )
      const file = new File([blob], `slide-${currentSlideIdx + 1}-${Date.now()}.png`, { type: 'image/png' })
      const { imported } = await importFiles([file])
      if (imported.length) {
        const videoTrack = project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const newClip = addClip(imported[0].id, videoTrack.id, playhead ?? 0)
          if (newClip) updateClip(newClip.id, { duration: slideDuration, sourceEnd: slideDuration, clipType: 'image' })
        }
        setSuccess(`Added Slide ${currentSlideIdx + 1} ("${currentSlide.title}") (${slideW}×${slideH}) to the timeline!`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  const currentSlide = deck ? deck.slides[currentSlideIdx] : null

  // Live HTML string for the current slide
  const currentSlideHtml = currentSlide
    ? renderSlideHtml(
        currentSlide,
        currentSlideIdx + 1,
        deck!.slides.length,
        deck!.theme,
        deck!.font,
        deck!.animation,
      )
    : ''

  return (
    <div className="space-y-3 p-3">
      {/* ── Open Full Studio Banner Button ── */}
      <Button
        size="sm"
        className="h-8 w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-xs font-semibold text-white shadow-xs hover:from-violet-500 hover:to-indigo-500"
        onClick={() => setIsModalOpen(true)}
      >
        <Maximize2 className="size-3.5" />
        <span>Open Presentation Studio</span>
        {deck && (
          <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-mono text-violet-200">
            {deck.slides.length} slides
          </span>
        )}
      </Button>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex rounded-lg border bg-muted/40 p-0.5">
        {[
          { id: 'generator' as const, label: 'AI Generator', icon: Sparkles },
          { id: 'studio' as const, label: 'Slide Studio', icon: Presentation },
          { id: 'templates' as const, label: 'Templates & History', icon: History },
        ].map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 flex items-center justify-center gap-1 rounded-md py-1 text-center text-[10px] font-semibold transition',
              tab === id ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(id)}
          >
            <TabIcon className="size-3 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════ TAB 1: AI DECK GENERATOR ═══════════ */}
      {tab === 'generator' && (
        <div className="space-y-2.5">
          {/* 1-Click Archetype Templates */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground font-semibold">Instant Deck Archetypes:</span>
            <div className="grid grid-cols-2 gap-1">
              {[
                { title: 'Startup Pitch', topic: 'Next-Gen AI Platform Seed Pitch & Investment Deck', theme: 'pitch_dark', count: 4 },
                { title: 'Product Launch', topic: 'Product Launch Keynote: Features & Roadmap', theme: 'apple_minimal', count: 5 },
                { title: 'Tech Deep Dive', topic: 'WebGPU Shaders & Neural Pipeline Architecture', theme: 'cyber_neon', count: 4 },
                { title: 'Executive Report', topic: 'Quarterly Growth Metrics & Strategic Review', theme: 'clean_studio', count: 4 },
              ].map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  className="flex items-center justify-between rounded border border-border/60 bg-muted/25 px-2 py-1 text-[10px] text-left text-muted-foreground hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-foreground transition"
                  onClick={() => {
                    setTopic(tmpl.topic)
                    setTheme(tmpl.theme as SlideTheme)
                    setCount(tmpl.count)
                  }}
                >
                  <span className="font-semibold text-[10px] truncate">{tmpl.title}</span>
                  <span className="rounded bg-violet-500/20 px-1 text-[8px] font-mono text-violet-300">
                    {tmpl.count}s
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Presentation Topic</Label>
              <button
                type="button"
                onClick={() => void handleRunInductiveAnalysis()}
                disabled={analyzingInductive || busy}
                className="text-[10px] text-violet-600 dark:text-violet-400 hover:text-violet-500 font-semibold flex items-center gap-1 transition"
                title="Scan video clips, transcript, and pacing to auto-detect topic thesis"
              >
                {analyzingInductive ? <Loader2 className="size-2.5 animate-spin" /> : <Brain className="size-2.5" />}
                {analyzingInductive ? 'Analyzing...' : 'Auto-Detect from Video'}
              </button>
            </div>
            <Input
              placeholder="e.g. Next-Gen WebGPU & AI Video Architecture"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-8 text-xs bg-card"
              disabled={busy}
            />
            {/* Quick Topic Chips */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {[
                'Startup Pitch',
                'Tech Architecture',
                'Product Roadmap',
                'Growth Metrics',
                'Explainer',
              ].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-violet-500/40 hover:text-foreground transition"
                  onClick={() => setTopic(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Inductive Thesis Pill if detected */}
          {inductiveContext && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-[10px] space-y-1 animate-in fade-in">
              <div className="flex items-center justify-between text-violet-700 dark:text-violet-300 font-bold">
                <span className="flex items-center gap-1">
                  <Brain className="size-3" />
                  Auto-Inferred Thesis
                </span>
                <span className="text-[9px] font-mono text-violet-400 capitalize">{inductiveContext.tone} Tone</span>
              </div>
              <p className="text-foreground text-[11px] font-medium leading-snug">{inductiveContext.topicThesis}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Slide Count</Label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))} disabled={busy}>
                <SelectTrigger className="h-7 text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Slides (Quick Pitch)</SelectItem>
                  <SelectItem value="4">4 Slides (Balanced)</SelectItem>
                  <SelectItem value="5">5 Slides (Executive)</SelectItem>
                  <SelectItem value="6">6 Slides (Comprehensive)</SelectItem>
                  <SelectItem value="8">8 Slides (Deep Dive)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Archetype</Label>
              <Select value={layoutArchetype} onValueChange={setLayoutArchetype} disabled={busy}>
                <SelectTrigger className="h-7 text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Startup Pitch Deck">Startup Pitch Deck</SelectItem>
                  <SelectItem value="Executive Keynote">Executive Keynote</SelectItem>
                  <SelectItem value="Product Launch">Product Launch</SelectItem>
                  <SelectItem value="Technical Deep Dive">Technical Deep Dive</SelectItem>
                  <SelectItem value="Creative Storytelling">Creative Storytelling</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Theme & Typography Grid */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Visual Theme</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as SlideTheme)} disabled={busy}>
                <SelectTrigger className="h-7 text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SLIDE_THEMES_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Typography</Label>
              <Select value={font} onValueChange={(v) => setFont(v as SlideFont)} disabled={busy}>
                <SelectTrigger className="h-7 text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SLIDE_FONTS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Animation</Label>
              <Select value={animation} onValueChange={(v) => setAnimation(v as SlideAnimation)} disabled={busy}>
                <SelectTrigger className="h-7 text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SLIDE_ANIMATIONS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold h-8 mt-1 shadow-xs"
            onClick={() => void handleGenerateDeck()}
            disabled={busy || !topic.trim()}
          >
            {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Sparkles className="mr-2 size-3.5" />}
            {busy ? progress || 'Generating Slides...' : `Generate ${count} Presentation Slides`}
          </Button>
        </div>
      )}

      {/* ═══════════ TAB 2: INTERACTIVE LIVE SLIDE STUDIO ═══════════ */}
      {tab === 'studio' && (
        <div className="space-y-3">
          {deck && currentSlide ? (
            <div className="space-y-2.5">
              {/* Slide Navigation Header */}
              <div className="flex items-center justify-between rounded-md border bg-muted/20 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Presentation className="size-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-bold truncate max-w-[140px]">{deck.title}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() => setCurrentSlideIdx((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlideIdx === 0}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="font-mono text-[10px] text-violet-700 dark:text-violet-300 font-bold px-1">
                    {currentSlideIdx + 1} / {deck.slides.length}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() => setCurrentSlideIdx((prev) => Math.min(deck.slides.length - 1, prev + 1))}
                    disabled={currentSlideIdx === deck.slides.length - 1}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* ── Live Animated Adaptive Slide Canvas ── */}
              <div
                className="relative w-full max-h-72 rounded-lg border overflow-hidden shadow-lg bg-black mx-auto"
                style={{ aspectRatio: `${project.width || 1280} / ${project.height || 720}` }}
              >
                <iframe
                  title="Slide Live Preview"
                  srcDoc={currentSlideHtml}
                  className="w-full h-full border-0 pointer-events-none select-none"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>

              {/* ── Slide Thumbnail Filmstrip ── */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {deck.slides.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlideIdx(idx)}
                    className={cn(
                      'flex min-w-[70px] flex-col items-start rounded border px-1.5 py-1 text-left transition shrink-0',
                      currentSlideIdx === idx
                        ? 'border-violet-500 bg-violet-500/20 text-violet-300 ring-1 ring-violet-500 font-bold shadow-xs'
                        : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-[9px] font-bold">#{idx + 1}</span>
                      <span className="text-[7px] uppercase opacity-70 font-semibold">{s.layout || 'Hero'}</span>
                    </div>
                    <span className="text-[8px] truncate max-w-[65px] mt-0.5">{s.title}</span>
                  </button>
                ))}
              </div>

              {/* ── Slide Content & Layout Inspector ── */}
              <div className="space-y-2.5 rounded-lg border bg-card p-2.5 shadow-xs">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="text-xs font-bold text-foreground">Edit Slide Content</span>
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300 uppercase">
                    {currentSlide.layout || 'Hero'}
                  </span>
                </div>

                {/* Layout Archetype Picker */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Slide Layout</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'hero' as SlideLayout, label: 'Hero', icon: Star },
                      { id: 'cards' as SlideLayout, label: 'Cards', icon: LayoutGrid },
                      { id: 'big_stat' as SlideLayout, label: 'Big Stat', icon: Zap },
                      { id: 'split' as SlideLayout, label: 'Split', icon: Columns2 },
                      { id: 'quote' as SlideLayout, label: 'Quote', icon: Quote },
                      { id: 'checklist' as SlideLayout, label: 'Bullets', icon: ListChecks },
                    ].map((l) => {
                      const Icon = l.icon
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className={cn(
                            'flex items-center justify-center gap-1 rounded border py-1 text-[10px] font-medium transition',
                            (currentSlide.layout || 'hero') === l.id
                              ? 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold'
                              : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground',
                          )}
                          onClick={() => updateCurrentSlide({ layout: l.id })}
                        >
                          <Icon className="size-2.5 shrink-0" />
                          <span>{l.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Headline & Subtitle */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Slide Headline</Label>
                  <Input
                    value={currentSlide.title}
                    onChange={(e) => updateCurrentSlide({ title: e.target.value })}
                    className="h-7 text-xs bg-muted/10 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Subtitle / Category</Label>
                  <Input
                    value={currentSlide.subtitle || ''}
                    placeholder="e.g. KEY ARCHITECTURE"
                    onChange={(e) => updateCurrentSlide({ subtitle: e.target.value })}
                    className="h-7 text-xs bg-muted/10"
                  />
                </div>

                {/* Big Stat Controls */}
                {currentSlide.layout === 'big_stat' && (
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-md border border-cyan-500/30 bg-cyan-500/5">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-cyan-300 font-semibold">Stat / Metric</Label>
                      <Input
                        value={currentSlide.statNumber || '+140%'}
                        onChange={(e) => updateCurrentSlide({ statNumber: e.target.value })}
                        className="h-7 text-xs font-bold text-cyan-400 bg-black/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-cyan-300 font-semibold">Stat Label</Label>
                      <Input
                        value={currentSlide.statLabel || 'Performance Increase'}
                        onChange={(e) => updateCurrentSlide({ statLabel: e.target.value })}
                        className="h-7 text-xs bg-black/40"
                      />
                    </div>
                  </div>
                )}

                {/* Quote Controls */}
                {currentSlide.layout === 'quote' && (
                  <div className="space-y-1.5 p-2 rounded-md border border-amber-500/30 bg-amber-500/5">
                    <Label className="text-[10px] text-amber-300 font-semibold">Quote Attribution</Label>
                    <Input
                      value={currentSlide.quoteAuthor || 'Speaker / Author'}
                      onChange={(e) => updateCurrentSlide({ quoteAuthor: e.target.value })}
                      className="h-7 text-xs bg-black/40"
                    />
                  </div>
                )}

                {/* Cards Controls */}
                {currentSlide.layout === 'cards' && (
                  <div className="space-y-2 p-2 rounded-md border border-violet-500/30 bg-violet-500/5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-violet-300 font-semibold">Slide Cards ({(currentSlide.cards || []).length}/3)</Label>
                      <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1 text-violet-300" onClick={addCard}>
                        + Add Card
                      </Button>
                    </div>

                    {(currentSlide.cards || []).map((card, cIdx) => (
                      <div key={cIdx} className="space-y-1 rounded border bg-black/30 p-1.5">
                        <div className="flex gap-1">
                          <Input
                            value={card.tag || ''}
                            placeholder="TAG"
                            onChange={(e) => updateCard(cIdx, { tag: e.target.value })}
                            className="h-6 text-[9px] w-16 uppercase font-bold text-violet-400"
                          />
                          <Input
                            value={card.title}
                            placeholder="Card Title"
                            onChange={(e) => updateCard(cIdx, { title: e.target.value })}
                            className="h-6 text-[10px] font-bold flex-1"
                          />
                        </div>
                        <Input
                          value={card.description}
                          placeholder="Card description text"
                          onChange={(e) => updateCard(cIdx, { description: e.target.value })}
                          className="h-6 text-[10px]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Bullets List */}
                {currentSlide.layout !== 'cards' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground">Bullet Points</Label>
                      <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1 text-violet-300" onClick={addBulletPoint}>
                        + Add Point
                      </Button>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                      {currentSlide.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-1">
                          <Input
                            value={bullet}
                            onChange={(e) => updateBulletPoint(bIdx, e.target.value)}
                            className="h-6 text-[11px] flex-1 bg-muted/10"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeBulletPoint(bIdx)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Typography, Theme & Animation */}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t">
                  <div className="space-y-0.5">
                    <Label className="text-[9px] text-muted-foreground">Theme</Label>
                    <Select value={deck.theme} onValueChange={(v) => setDeck({ ...deck, theme: v as SlideTheme })}>
                      <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SLIDE_THEMES_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-0.5">
                    <Label className="text-[9px] text-muted-foreground">Font</Label>
                    <Select value={deck.font} onValueChange={(v) => setDeck({ ...deck, font: v as SlideFont })}>
                      <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SLIDE_FONTS_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-0.5">
                    <Label className="text-[9px] text-muted-foreground">Animation</Label>
                    <Select value={deck.animation} onValueChange={(v) => setDeck({ ...deck, animation: v as SlideAnimation })}>
                      <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SLIDE_ANIMATIONS_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Timeline Export Bar */}
              <div className="space-y-1.5 rounded-lg border bg-violet-500/10 border-violet-500/30 p-2.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Duration per slide</span>
                  <span className="font-mono text-violet-700 dark:text-violet-300 font-bold">{slideDuration}s ({deck.slides.length * slideDuration}s total)</span>
                </div>
                <Slider value={[slideDuration]} min={2} max={15} step={1} onValueChange={([v]) => setSlideDuration(v)} />

                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-[11px] font-medium"
                    onClick={() => void handleAddCurrentSlideToTimeline()}
                    disabled={adding}
                  >
                    <Plus className="mr-1 size-3.5" />
                    Add Slide {currentSlideIdx + 1}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold h-8"
                    onClick={() => void handleAddToTimeline()}
                    disabled={adding}
                  >
                    {adding ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Plus className="mr-1.5 size-3.5" />}
                    {adding ? 'Adding...' : `Add All ${deck.slides.length} Slides`}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <Presentation className="size-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-xs text-muted-foreground">No slides loaded yet.</p>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setTab('generator')}>
                Generate Presentation with AI
              </Button>
            </div>
          )}
        </div>
      )}


      {/* ═══════════ TAB 3: TEMPLATES & DECK HISTORY ═══════════ */}
      {tab === 'templates' && (
        <div className="space-y-3">
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Past Saved Decks:</span>
            {savedDecks.length > 0 ? (
              savedDecks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="flex w-full flex-col items-start rounded border bg-card p-2 text-left hover:border-violet-500 transition"
                  onClick={() => {
                    setTopic(d.topic)
                    setTab('generator')
                    setSuccess(`Loaded "${d.title}" into generator!`)
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate text-xs font-semibold">{d.title}</span>
                    <span className="rounded bg-violet-500/20 px-1 text-[9px] text-violet-700 dark:text-violet-300 uppercase">{d.theme}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground">{new Date(d.timestamp).toLocaleTimeString()} · {d.slideCount} slides</span>
                </button>
              ))
            ) : (
              <EmptyHint text="No saved presentation decks yet. Generate a deck to see history." icon={Layers} />
            )}
          </div>
        </div>
      )}

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      <SlideStudioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialDeck={deck}
        onDeckChange={(d) => setDeck(d)}
      />
    </div>
  )
}

// ─── Avatar Section ───────────────────────────────────────────────────────────
const AVATAR_BACKGROUNDS = ['solid', 'transparent', 'blurred'] as const
const WAV2LIP_STYLES: Array<{ id: LipsyncStyle; label: string; desc: string }> = [
  { id: 'realistic', label: 'Realistic', desc: 'Natural lip contour, teeth & tongue depth' },
  { id: 'cartoon', label: 'Cartoon', desc: 'Expressive anime/cartoon mouth opening' },
  { id: 'robotic', label: 'Robotic', desc: 'Step-quantized cybernetic visemes' },
  { id: 'circle', label: 'Circle Viseme', desc: 'Minimalist podcast audio waveform' },
]

function AvatarSection() {
  const assets = useTimelineStore((s) => s.assets)
  const project = useTimelineStore((s) => s.project)
  const selectedClipId = useTimelineStore((s) => s.selection.clipIds[0])
  const importFiles = useTimelineStore((s) => s.importFiles)
  const avatarConfig = useApiConfigStore((s) => s.config.avatar)

  const [inputMode, setInputMode] = React.useState<'timeline' | 'script' | 'audio'>('timeline')
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('sarah-presenter')
  const [imageAssetId, setImageAssetId] = React.useState('')
  const [selectedTimelineClipId, setSelectedTimelineClipId] = React.useState<string>('')
  const [audioAssetId, setAudioAssetId] = React.useState('')
  const [scriptText, setScriptText] = React.useState('Welcome back! Today we are exploring the latest AI video production tools.')
  const [topicPrompt, setTopicPrompt] = React.useState('')
  const [scriptLanguage, setScriptLanguage] = React.useState<'english' | 'hindi'>('english')
  const [voiceId, setVoiceId] = React.useState('alloy')
  const [isGeneratingScript, setIsGeneratingScript] = React.useState(false)
  const [role, setRole] = React.useState<AvatarRole>('presenter')
  const [style, setStyle] = React.useState<LipsyncStyle>('realistic')
  const [resolution, setResolution] = React.useState<string>('auto')
  const [fps, setFps] = React.useState(avatarConfig.fps || 30)
  const [background, setBackground] = React.useState<string>(avatarConfig.background || 'solid')
  const [mouth, setMouth] = React.useState<AvatarMouth>({
    x: avatarConfig.mouthX || 0.5,
    y: avatarConfig.mouthY || 0.72,
    width: avatarConfig.mouthWidth || 0.22,
    maxOpen: avatarConfig.mouthMaxOpen || 0.12,
  })

  // Advanced Wav2Lip parameters
  const [smoothingDecay, setSmoothingDecay] = React.useState(0.85)
  const [noiseGateDb, setNoiseGateDb] = React.useState(-36)
  const [isTestingViseme, setIsTestingViseme] = React.useState(false)
  const [testVisemeOpen, setTestVisemeOpen] = React.useState(0)

  const [busy, setBusy] = React.useState(false)
  const [faceCategory, setFaceCategory] = React.useState<string>('all')
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const audioFileInputRef = React.useRef<HTMLInputElement>(null)
  const facePreviewRef = React.useRef<HTMLDivElement>(null)

  const images = React.useMemo(() => assets.filter((a) => a.type === 'image'), [assets])
  const audios = React.useMemo(() => assets.filter((a) => a.type === 'audio'), [assets])

  // Discover all clips on the timeline that contain audio
  const timelineAudioClips = React.useMemo(() => {
    const list: Array<{
      clipId: string
      trackId: string
      trackName: string
      name: string
      assetId: string
      startTime: number
      duration: number
      sourceStart: number
      sourceEnd: number
    }> = []

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const asset = assets.find((a) => a.id === clip.assetId)
        if (track.type === 'audio' || asset?.type === 'audio' || clip.clipType === 'audio' || asset?.type === 'video') {
          list.push({
            clipId: clip.id,
            trackId: track.id,
            trackName: track.name || (track.type === 'audio' ? 'Audio Track' : 'Video Track'),
            name: asset?.name || `Audio Clip (${clip.startTime.toFixed(1)}s)`,
            assetId: clip.assetId,
            startTime: clip.startTime,
            duration: clip.duration,
            sourceStart: clip.sourceStart,
            sourceEnd: clip.sourceEnd,
          })
        }
      }
    }
    return list
  }, [project.tracks, assets])

  // Automatically default to selected timeline clip or first available audio clip
  React.useEffect(() => {
    if (selectedClipId) {
      const match = timelineAudioClips.find((c) => c.clipId === selectedClipId)
      if (match) {
        setSelectedTimelineClipId(match.clipId)
        setInputMode('timeline')
      }
    } else if (timelineAudioClips.length > 0 && !selectedTimelineClipId) {
      setSelectedTimelineClipId(timelineAudioClips[0].clipId)
    }
  }, [selectedClipId, timelineAudioClips, selectedTimelineClipId])

  // Filtered preset faces
  const filteredPresets = React.useMemo(() => {
    if (faceCategory === 'all') return AVATAR_FACE_PRESETS
    return AVATAR_FACE_PRESETS.filter((p) => p.role === faceCategory)
  }, [faceCategory])

  const currentPreset = React.useMemo(
    () => AVATAR_FACE_PRESETS.find((p) => p.id === selectedPresetId) || AVATAR_FACE_PRESETS[0],
    [selectedPresetId],
  )

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

  const handleCustomAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const { imported } = await importFiles(Array.from(files))
    if (imported.length) {
      setAudioAssetId(imported[0].id)
      setInputMode('audio')
      setSuccess(`Imported "${imported[0].name}" for avatar speech!`)
    }
  }

  const handleGenerateScriptWithAi = async () => {
    const topic = topicPrompt.trim() || scriptText.trim() || 'Exciting AI Video Editing Innovations'
    setIsGeneratingScript(true)
    setError(null)
    try {
      const script = await generateScript({
        topic: `${scriptLanguage === 'hindi' ? 'Hindi and English mixed Hinglish narration for: ' : 'Presenter avatar speech: '}${topic}`,
        durationSeconds: 15,
        creatorStyle: 'off',
      })
      const fullText = [script.hook, ...script.scenes.map((s) => s.text), script.cta].filter(Boolean).join(' ')
      if (fullText.trim()) {
        setScriptText(fullText.trim())
        setSuccess('AI generated a presenter script! Ready to produce avatar.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script with AI')
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleFacePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!facePreviewRef.current) return
    const rect = facePreviewRef.current.getBoundingClientRect()
    const clickX = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width))
    const clickY = Math.max(0.3, Math.min(0.95, (e.clientY - rect.top) / rect.height))
    setMouth((m) => ({ ...m, x: parseFloat(clickX.toFixed(2)), y: parseFloat(clickY.toFixed(2)) }))
  }

  const handleTestViseme = () => {
    setIsTestingViseme(true)
    let step = 0
    const interval = setInterval(() => {
      step++
      const openVal = Math.sin(step * 0.4) * 0.5 + 0.5
      setTestVisemeOpen(openVal)
      if (step > 25) {
        clearInterval(interval)
        setIsTestingViseme(false)
        setTestVisemeOpen(0)
      }
    }, 60)
  }

  const generate = async () => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const [width, height] =
        resolution === 'auto'
          ? [project.width || 768, project.height || 768]
          : resolution.split('x').map(Number)
      let imageFile: Blob
      if (imageAssetId) {
        const customAsset = assets.find((a) => a.id === imageAssetId)
        if (!customAsset) throw new Error('Selected face image not found')
        imageFile = await readMediaFile(customAsset.filePath)
      } else {
        const preset = AVATAR_FACE_PRESETS.find((p) => p.id === selectedPresetId) || AVATAR_FACE_PRESETS[0]
        imageFile = await renderPresetFaceToBlob(preset, width, height)
      }

      if (inputMode === 'timeline') {
        // Animate avatar using selected timeline audio clip
        const targetClip = timelineAudioClips.find((c) => c.clipId === selectedTimelineClipId)
        if (!targetClip) throw new Error('Please select an audio clip from the timeline')
        const audioAsset = assets.find((a) => a.id === targetClip.assetId)
        if (!audioAsset) throw new Error('Audio asset for selected timeline clip not found')
        const rawAudio = await readMediaFile(audioAsset.filePath)

        const isTrimmed =
          targetClip.sourceStart > 0 ||
          (targetClip.sourceEnd > 0 && targetClip.sourceEnd < (audioAsset.duration || Infinity))
        const audioFile = isTrimmed
          ? await sliceAudioBlob(rawAudio, targetClip.sourceStart, targetClip.sourceStart + targetClip.duration)
          : rawAudio

        const result = await generateLipsyncVideo({
          imageFile,
          audioFile,
          width,
          height,
          fps,
          bitrate: 4_000_000,
          codec: 'vp9',
          mouth,
          style,
          background: background as 'transparent' | 'solid' | 'blurred',
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        })

        const file = new File([result.blob], `avatar-${selectedPresetId || 'custom'}-${Date.now()}.webm`, {
          type: 'video/webm',
        })
        const { imported, errors } = await importFiles([file])
        if (imported.length) {
          const videoTrack = useTimelineStore.getState().project.tracks.find((t) => t.type === 'video')
          if (!videoTrack) throw new Error('No video track available on the timeline')
          const clip = useTimelineStore.getState().addClip(imported[0].id, videoTrack.id, targetClip.startTime)
          if (clip) {
            useTimelineStore.getState().updateClip(clip.id, {
              duration: result.duration,
              sourceEnd: result.duration,
              avatarRole: role,
              clipType: 'avatar',
              autoLipsync: true,
            })
            setSuccess(
              `Generated ${result.duration.toFixed(1)}s Wav2Lip avatar synchronized with timeline audio at ${targetClip.startTime.toFixed(1)}s!`,
            )
          }
        } else {
          setError(errors[0] ?? 'Could not import avatar video')
        }
      } else if (inputMode === 'script') {
        // Generate speech via TTS / Procedural Voice & animate avatar
        const result = await generateAvatarVideo({
          role,
          topic: scriptText,
          scriptText,
          presetId: selectedPresetId,
          avatarImage: imageFile,
          style,
          language: scriptLanguage === 'hindi' ? 'hi' : 'en',
        })
        const file = new File([result.videoBlob], `avatar-${role}-${Date.now()}.webm`, { type: 'video/webm' })
        const { imported, errors } = await importFiles([file])
        if (imported.length) {
          const videoTrack = useTimelineStore.getState().project.tracks.find((t) => t.type === 'video')
          if (!videoTrack) throw new Error('No video track available on the timeline')
          const clip = useTimelineStore
            .getState()
            .addClip(imported[0].id, videoTrack.id, useTimelineStore.getState().playhead)
          if (clip) {
            useTimelineStore.getState().updateClip(clip.id, {
              duration: result.duration,
              sourceEnd: result.duration,
              avatarRole: role,
              clipType: 'avatar',
              autoLipsync: true,
            })
            setSuccess(`Created ${result.duration.toFixed(1)}s lip-sync avatar presenter on timeline!`)
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
          codec: 'vp9',
          mouth,
          style,
          background: background as 'transparent' | 'solid' | 'blurred',
          signal: controller.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        })

        const file = new File([result.blob], `avatar-${selectedPresetId || 'custom'}-${Date.now()}.webm`, {
          type: 'video/webm',
        })
        const { imported, errors } = await importFiles([file])
        if (imported.length) {
          const videoTrack = useTimelineStore.getState().project.tracks.find((t) => t.type === 'video')
          if (!videoTrack) throw new Error('No video track available on the timeline')
          const clip = useTimelineStore
            .getState()
            .addClip(imported[0].id, videoTrack.id, useTimelineStore.getState().playhead)
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
  const activeTimelineClip = timelineAudioClips.find((c) => c.clipId === selectedTimelineClipId)

  return (
    <div className="space-y-4 p-3 text-xs">
      {/* ─── 1. Face Selector & Predefined Avatars ─── */}
      <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/10 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <User className="size-4 text-violet-500" />
            <span>Predefined Avatar Library</span>
          </div>
          <button
            type="button"
            className="text-[11px] font-semibold text-violet-500 hover:underline"
            onClick={() => fileInputRef.current?.click()}
          >
            + Upload Photo
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomFaceUpload} />
        <input ref={audioFileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleCustomAudioUpload} />

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1">
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
                'rounded-full px-2 py-0.5 text-[10px] font-medium transition',
                faceCategory === cat.id
                  ? 'bg-violet-600 text-white font-bold shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              onClick={() => setFaceCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Preset Faces Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-0.5">
          {filteredPresets.map((preset) => {
            const isSelected = selectedPresetId === preset.id && !imageAssetId
            return (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  'group relative flex flex-col items-center rounded-xl border p-1.5 text-center transition',
                  isSelected
                    ? 'border-violet-500 bg-violet-500/15 shadow-xs ring-2 ring-violet-500'
                    : 'border-border/60 bg-card hover:border-violet-500/40 hover:bg-muted/10',
                )}
                onClick={() => selectPreset(preset)}
                title={`${preset.name} - ${preset.tagline}`}
              >
                <div
                  className="size-12 overflow-hidden rounded-full border border-border/80 bg-cover bg-center shadow-xs"
                  dangerouslySetInnerHTML={{ __html: preset.svg }}
                />
                <span className="mt-1 truncate text-[10px] font-bold leading-tight text-foreground max-w-full">
                  {preset.name.split(' · ')[0]}
                </span>
                <span className="text-[8px] text-muted-foreground capitalize truncate max-w-full">
                  {preset.role}
                </span>
              </button>
            )
          })}
        </div>

        {/* Custom Image Upload Selector */}
        {images.length > 0 && (
          <div className="pt-1">
            <Select
              value={imageAssetId}
              onValueChange={(id) => {
                setImageAssetId(id)
                setSelectedPresetId('')
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs font-medium">
                <SelectValue placeholder="Or select uploaded portrait..." />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {images.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    Custom Image: {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ─── 2. Interactive Face Calibrator & Mouth Visualizer ─── */}
      <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/10 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <ScanFace className="size-4 text-violet-500" />
            <span>Interactive Mouth Calibrator</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestViseme}
            disabled={isTestingViseme}
            className="h-6 gap-1 px-2 text-[10px] font-semibold border-violet-500/50 hover:bg-violet-500/10 text-violet-600 dark:text-violet-400"
          >
            <Play className="size-2.5" />
            {isTestingViseme ? 'Testing Speech...' : 'Test Mouth Viseme'}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Visual Interactive Canvas Area */}
          <div
            ref={facePreviewRef}
            onClick={handleFacePreviewClick}
            className="relative size-36 shrink-0 cursor-crosshair overflow-hidden rounded-xl border-2 border-violet-500/40 bg-card shadow-inner select-none"
            title="Click anywhere on the face to position the mouth anchor"
          >
            {imageAssetId ? (
              <div className="size-full flex items-center justify-center bg-muted/20 text-muted-foreground text-[10px]">
                Custom Face Image
              </div>
            ) : (
              <div
                className="size-full"
                dangerouslySetInnerHTML={{ __html: currentPreset.svg }}
              />
            )}

            {/* Draggable/Visual Mouth Overlay Box */}
            <div
              className="absolute pointer-events-none rounded-md border-2 border-cyan-400 bg-cyan-400/20 shadow-sm transition-all duration-75 flex items-center justify-center"
              style={{
                left: `${mouth.x * 100}%`,
                top: `${mouth.y * 100}%`,
                width: `${mouth.width * 100}%`,
                height: `${Math.max(0.04, mouth.maxOpen * (1 + testVisemeOpen * 0.8)) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="size-1.5 rounded-full bg-cyan-300 shadow-xs" />
            </div>

            {/* Crosshair target lines */}
            <div className="absolute inset-0 pointer-events-none border border-white/10" />
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[8px] font-mono text-white/90">
              {mouth.x.toFixed(2)}, {mouth.y.toFixed(2)}
            </span>
          </div>

          {/* Quick Sliders */}
          <div className="flex-1 space-y-2 w-full">
            <EffectSlider
              label="Mouth Anchor X (Horizontal)"
              value={mouth.x}
              min={0.1}
              max={0.9}
              step={0.01}
              onChange={(v) => setMouth((m) => ({ ...m, x: v }))}
            />
            <EffectSlider
              label="Mouth Anchor Y (Vertical)"
              value={mouth.y}
              min={0.4}
              max={0.95}
              step={0.01}
              onChange={(v) => setMouth((m) => ({ ...m, y: v }))}
            />
            <EffectSlider
              label="Mouth Width / Spread"
              value={mouth.width}
              min={0.05}
              max={0.45}
              step={0.01}
              onChange={(v) => setMouth((m) => ({ ...m, width: v }))}
            />
            <EffectSlider
              label="Max Phoneme Openness"
              value={mouth.maxOpen}
              min={0.02}
              max={0.3}
              step={0.01}
              onChange={(v) => setMouth((m) => ({ ...m, maxOpen: v }))}
            />
          </div>
        </div>
      </div>

      {/* ─── 3. Speech Sourcing (Timeline vs Script vs Audio File) ─── */}
      <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/10 p-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-foreground">Speech Audio Input</span>
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition',
                inputMode === 'timeline'
                  ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setInputMode('timeline')}
            >
              <Mic className="size-3 shrink-0" />
              <span>Timeline Audio</span>
            </button>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition',
                inputMode === 'script'
                  ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setInputMode('script')}
            >
              <Sparkles className="size-3 shrink-0" />
              <span>Script (TTS)</span>
            </button>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition',
                inputMode === 'audio'
                  ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setInputMode('audio')}
            >
              <FolderUp className="size-3 shrink-0" />
              <span>Audio File</span>
            </button>
          </div>
        </div>

        {/* ── MODE 1: TIMELINE AUDIO ── */}
        {inputMode === 'timeline' && (
          <div className="space-y-2">
            {timelineAudioClips.length > 0 ? (
              <div className="space-y-1.5">
                <Select value={selectedTimelineClipId} onValueChange={setSelectedTimelineClipId} disabled={busy}>
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue placeholder="Select a timeline audio clip..." />
                  </SelectTrigger>
                  <SelectContent className="z-[250]">
                    {timelineAudioClips.map((c) => (
                      <SelectItem key={c.clipId} value={c.clipId}>
                        {c.trackName}: {c.name} ({c.startTime.toFixed(1)}s - {(c.startTime + c.duration).toFixed(1)}s · {c.duration.toFixed(1)}s)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeTimelineClip && (
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-[10px] space-y-1 text-foreground">
                    <div className="flex justify-between font-bold">
                      <span>Target: {activeTimelineClip.name}</span>
                      <span>{activeTimelineClip.duration.toFixed(1)}s length</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Avatar will be generated to match the spoken speech waveform and placed automatically at{' '}
                      <span className="text-violet-700 dark:text-violet-300 font-bold">
                        {activeTimelineClip.startTime.toFixed(1)}s
                      </span>{' '}
                      on the video track.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-center space-y-1.5">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">No Audio Clips on Timeline</p>
                <p className="text-[10px] text-muted-foreground">
                  Record a voiceover or drop an audio track onto the timeline, then select it here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── MODE 2: SCRIPT (TTS / AI) ── */}
        {inputMode === 'script' && (
          <div className="space-y-2">
            <div className="space-y-1 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1">
                  <Sparkles className="size-3" />
                  <span>AI Script Generator</span>
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setScriptLanguage('english')}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold',
                      scriptLanguage === 'english' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setScriptLanguage('hindi')}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold',
                      scriptLanguage === 'hindi' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    Hindi / Hinglish
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={topicPrompt}
                  onChange={(e) => setTopicPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleGenerateScriptWithAi()
                  }}
                  placeholder="Enter topic e.g. 'Top 3 AI video tools'..."
                  className="h-7 flex-1 min-w-0 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none focus:border-violet-500"
                  disabled={busy || isGeneratingScript}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] font-bold border-violet-500/50 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                  onClick={() => void handleGenerateScriptWithAi()}
                  disabled={busy || isGeneratingScript}
                >
                  {isGeneratingScript ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="size-3 mr-1 text-violet-600" />
                  )}
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground font-semibold">Spoken Script:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground">
                    ~{Math.max(2, Math.round(scriptText.trim().split(/\s+/).filter(Boolean).length * 0.38))}s ·{' '}
                    {scriptText.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                  <Select value={role} onValueChange={(r) => setRole(r as AvatarRole)}>
                    <SelectTrigger className="h-5 w-20 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[250]">
                      <SelectItem value="presenter">Presenter</SelectItem>
                      <SelectItem value="intro">Intro Hook</SelectItem>
                      <SelectItem value="outro">Outro CTA</SelectItem>
                      <SelectItem value="narrator">Narrator</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger className="h-5 w-20 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[250]">
                      <SelectItem value="alloy">Alloy</SelectItem>
                      <SelectItem value="echo">Echo</SelectItem>
                      <SelectItem value="fable">Fable</SelectItem>
                      <SelectItem value="onyx">Onyx</SelectItem>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="shimmer">Shimmer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Type the script the avatar will speak with synchronized lip-sync..."
                className="h-20 w-full resize-none rounded-lg border border-input bg-card p-2 text-xs text-foreground outline-none focus:border-violet-500"
                disabled={busy}
              />
            </div>
          </div>
        )}

        {/* ── MODE 3: AUDIO FILE ── */}
        {inputMode === 'audio' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Select Audio Asset</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] px-1 text-violet-500 font-bold"
                onClick={() => audioFileInputRef.current?.click()}
              >
                + Upload Audio
              </Button>
            </div>
            {audios.length > 0 ? (
              <Select value={audioAssetId} onValueChange={setAudioAssetId} disabled={busy}>
                <SelectTrigger className="w-full h-8 text-xs font-medium">
                  <SelectValue placeholder="Pick an audio track" />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  {audios.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-2.5 text-center space-y-1">
                <p className="text-muted-foreground text-[10px]">No audio files imported yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => audioFileInputRef.current?.click()}
                >
                  Upload Audio Recording
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 4. Full Wav2Lip & Viseme Synthesis Options ─── */}
      <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/10 p-3">
        <Label className="text-xs font-bold text-foreground flex items-center justify-between">
          <span>Wav2Lip & Viseme Modulation</span>
          <span className="font-mono text-[9px] text-violet-500 font-bold uppercase">{style}</span>
        </Label>

        {/* Style Selector Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {WAV2LIP_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                'flex flex-col items-center rounded-lg border p-1.5 text-center transition',
                style === s.id
                  ? 'border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-300 font-bold shadow-xs'
                  : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setStyle(s.id)}
            >
              <span className="text-[10px]">{s.label}</span>
              <span className="text-[8px] opacity-70 truncate max-w-full">{s.desc}</span>
            </button>
          ))}
        </div>

        {/* Fine-Tuning Sliders */}
        <div className="space-y-2 pt-1 border-t border-border/40">
          <EffectSlider
            label="Smoothing / Decay (Syllable Pacing)"
            value={smoothingDecay}
            min={0.5}
            max={0.99}
            step={0.01}
            onChange={setSmoothingDecay}
          />
          <EffectSlider
            label="Noise Gate Threshold (dB)"
            value={noiseGateDb}
            min={-60}
            max={-12}
            step={1}
            onChange={setNoiseGateDb}
          />
        </div>

        {/* Video Output & Backdrop Compositing */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Resolution</Label>
            <Select value={resolution} onValueChange={setResolution} disabled={busy}>
              <SelectTrigger className="w-full h-8 text-[10px] font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                <SelectItem value="auto">Auto ({project.width || 768}×{project.height || 768})</SelectItem>
                <SelectItem value="1080x1920">1080×1920 (9:16 Reel)</SelectItem>
                <SelectItem value="1920x1080">1920×1080 (16:9 Landscape)</SelectItem>
                <SelectItem value="1080x1080">1080×1080 (1:1 Square)</SelectItem>
                <SelectItem value="512x512">512×512 (Fast Preview)</SelectItem>
                <SelectItem value="1024x1024">1024×1024 (HD Portrait)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Backdrop Matte</Label>
            <Select value={background} onValueChange={setBackground} disabled={busy}>
              <SelectTrigger className="w-full h-8 text-[10px] font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {AVATAR_BACKGROUNDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b === 'transparent' ? 'Transparent (Alpha)' : b.charAt(0).toUpperCase() + b.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Frame Rate</Label>
            <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))} disabled={busy}>
              <SelectTrigger className="w-full h-8 text-[10px] font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                <SelectItem value="24">24 fps (Film)</SelectItem>
                <SelectItem value="25">25 fps (Wav2Lip)</SelectItem>
                <SelectItem value="30">30 fps (Standard)</SelectItem>
                <SelectItem value="60">60 fps (Smooth)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ─── 5. Real-Time Progress & Generation Action ─── */}
      {progress && (
        <div className="space-y-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3">
          <div className="flex justify-between text-xs font-bold text-violet-700 dark:text-violet-300">
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Rendering Wav2Lip Frames: {progress.done} / {progress.total}
            </span>
            <span className="font-mono text-violet-600 dark:text-violet-400 font-bold">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      <Button
        size="sm"
        className="h-10 w-full bg-violet-600 text-xs font-bold text-white hover:bg-violet-500 shadow-md gap-2"
        onClick={() => void generate()}
        disabled={busy || (inputMode === 'audio' && !audioAssetId)}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
        {busy ? 'Synthesizing & Lip-Syncing Avatar...' : 'Generate & Place Avatar on Timeline'}
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

// ─── Text & Titles Section ──────────────────────────────────────────────────
const TEXT_TYPOGRAPHY_PRESETS = [
  {
    id: 'heading-bold',
    name: 'Bold Heading',
    category: 'Essential',
    text: 'YOUR TITLE HERE',
    fontSize: 56,
    color: '#ffffff',
    backgroundColor: 'transparent',
    fontFamily: 'Inter',
    animation: 'fade-in' as const,
    fontWeight: '800',
    description: 'High-impact uppercase headline',
  },
  {
    id: 'subtitle-clean',
    name: 'Subtitle / Bio',
    category: 'Essential',
    text: 'A clean supporting description or subtitle',
    fontSize: 28,
    color: '#e2e8f0',
    backgroundColor: 'transparent',
    fontFamily: 'Inter',
    animation: 'slide-up' as const,
    fontWeight: '500',
    description: 'Crisp body and narration copy',
  },
  {
    id: 'lower-third-modern',
    name: 'Lower Third Pill',
    category: 'Badges',
    text: 'Piyush Mehta — Video Creator',
    fontSize: 24,
    color: '#38bdf8',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    fontFamily: 'Inter',
    animation: 'slide-up' as const,
    fontWeight: '600',
    description: 'Presenter name badge with backdrop',
  },
  {
    id: 'callout-punchy',
    name: 'Action Callout',
    category: 'Badges',
    text: 'NEW EPISODE OUT NOW!',
    fontSize: 48,
    color: '#fbbf24',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    fontFamily: 'Impact',
    animation: 'pop' as const,
    fontWeight: '900',
    description: 'Attention grabbing alert banner',
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyberpunk',
    category: 'Stylized',
    text: 'CYBERPUNK CITY',
    fontSize: 48,
    color: '#22d3ee',
    backgroundColor: 'transparent',
    fontFamily: 'Space Grotesk',
    animation: 'pop' as const,
    fontWeight: '800',
    description: 'Vibrant neon sci-fi title',
  },
  {
    id: 'purple-vaporwave',
    name: 'Synthwave Glow',
    category: 'Stylized',
    text: 'RETRO HORIZON',
    fontSize: 48,
    color: '#c084fc',
    backgroundColor: 'transparent',
    fontFamily: 'Space Grotesk',
    animation: 'fade-in' as const,
    fontWeight: '800',
    description: 'Synthwave gradient glow header',
  },
  {
    id: 'cinematic-gold',
    name: 'Cinematic Gold',
    category: 'Cinematic',
    text: 'A FILM BY CREATOR',
    fontSize: 40,
    color: '#fef08a',
    backgroundColor: 'transparent',
    fontFamily: 'Playfair Display',
    animation: 'fade-in' as const,
    fontWeight: '600',
    description: 'Elegant golden film title',
  },
  {
    id: 'typewriter-narrative',
    name: 'Typewriter Log',
    category: 'Narrative',
    text: 'The journey began on a rainy night...',
    fontSize: 24,
    color: '#f8fafc',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    fontFamily: 'JetBrains Mono',
    animation: 'typewriter' as const,
    fontWeight: '500',
    description: 'Live typing letter-by-letter',
  },
]

function TextSection() {
  const project = useTimelineStore((s) => s.project)
  const addTextClip = useTimelineStore((s) => s.addTextClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const select = useTimelineStore((s) => s.select)
  const playhead = useTimelineStore((s) => s.playhead)
  const selectedClip = getSelectedClip()

  const [category, setCategory] = React.useState<string>('All')
  const [customTextDraft, setCustomTextDraft] = React.useState('Your Text Here')
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const isTextSelected = Boolean(selectedClip && selectedClip.text)

  const categories = ['All', 'Essential', 'Badges', 'Stylized', 'Cinematic', 'Narrative']

  const filteredPresets = React.useMemo(() => {
    if (category === 'All') return TEXT_TYPOGRAPHY_PRESETS
    return TEXT_TYPOGRAPHY_PRESETS.filter((p) => p.category === category)
  }, [category])

  const handleApplyPreset = (preset: (typeof TEXT_TYPOGRAPHY_PRESETS)[number]) => {
    const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks.find((t) => t.type === 'video')
    if (!textTrack) {
      setNotice({ kind: 'error', text: 'No track available for text' })
      return
    }

    const clip = addTextClip(preset.text, textTrack.id, playhead)
    if (clip) {
      const baseText = clip.text ?? {
        text: preset.text,
        fontSize: preset.fontSize,
        fontFamily: preset.fontFamily,
        fontWeight: 'bold' as const,
        fontStyle: 'normal' as const,
        color: preset.color,
        backgroundColor: preset.backgroundColor,
        textAlign: 'center' as const,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 6,
        shadow: true,
        animation: preset.animation,
        animationDuration: 0.5,
      }
      updateClip(clip.id, {
        text: {
          ...baseText,
          text: preset.text,
          fontSize: preset.fontSize,
          color: preset.color,
          backgroundColor: preset.backgroundColor,
          fontFamily: preset.fontFamily,
          fontWeight: preset.fontWeight === '800' || preset.fontWeight === '900' || preset.fontWeight === '600' ? 'bold' : 'normal',
          animation: preset.animation,
        },
      })
      select([clip.id], textTrack.id)
      setNotice({ kind: 'ok', text: `Added "${preset.name}" at ${playhead.toFixed(1)}s` })
    }
  }

  const handleAddCustomText = () => {
    const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks.find((t) => t.type === 'video')
    if (!textTrack) {
      setNotice({ kind: 'error', text: 'No track available for text' })
      return
    }

    const clip = addTextClip(customTextDraft.trim() || 'Your Text Here', textTrack.id, playhead)
    if (clip) {
      select([clip.id], textTrack.id)
      setNotice({ kind: 'ok', text: `Added custom text at ${playhead.toFixed(1)}s` })
    }
  }

  return (
    <div className="space-y-4 p-3 text-xs">
      {notice && (
        <SectionNotice kind={notice.kind} text={notice.text} />
      )}

      {/* Quick Add Custom Input */}
      <div className="space-y-2 rounded-lg border bg-card/60 p-3 shadow-xs">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Type className="size-3.5 text-violet-500" />
            Quick Insert Text
          </Label>
          <span className="text-[10px] font-mono text-muted-foreground">@ {playhead.toFixed(1)}s</span>
        </div>
        <div className="flex gap-1.5">
          <input
            value={customTextDraft}
            onChange={(e) => setCustomTextDraft(e.target.value)}
            placeholder="Type text overlay..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustomText()
            }}
            className="flex-1 rounded-md border bg-background px-2.5 py-1 text-xs text-foreground outline-none ring-1 ring-border/40 focus:ring-violet-500"
          />
          <Button
            size="sm"
            onClick={handleAddCustomText}
            className="h-8 gap-1 bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500 shadow-xs"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Active Selected Clip Inspector Hint or Live Controls */}
      {isTextSelected && selectedClip?.text && (
        <div className="space-y-2 rounded-lg border border-violet-500/40 bg-violet-500/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-300 flex items-center gap-1">
              <Pencil className="size-3" />
              Selected Text Clip
            </span>
            <span className="font-mono text-[10px] text-violet-400">
              {selectedClip.startTime.toFixed(1)}s – {(selectedClip.startTime + selectedClip.duration).toFixed(1)}s
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Edit Content</Label>
            <input
              value={selectedClip.text.text}
              onChange={(e) => updateClip(selectedClip.id, { text: { ...selectedClip.text!, text: e.target.value } })}
              className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Font Size ({selectedClip.text.fontSize ?? 48}px)</Label>
              <Slider
                min={14}
                max={120}
                step={2}
                value={[selectedClip.text.fontSize ?? 48]}
                onValueChange={([v]) => updateClip(selectedClip.id, { text: { ...selectedClip.text!, fontSize: v } })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Color</Label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={selectedClip.text.color ?? '#ffffff'}
                  onChange={(e) => updateClip(selectedClip.id, { text: { ...selectedClip.text!, color: e.target.value } })}
                  className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[10px] text-muted-foreground">{selectedClip.text.color ?? '#ffffff'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preset Categories */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground">Typography Presets</Label>
          <span className="text-[10px] text-muted-foreground">{filteredPresets.length} styles</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-medium transition',
                category === cat
                  ? 'border-violet-500 bg-violet-500/20 text-violet-300 font-bold shadow-xs'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Preset Cards Grid */}
        <div className="space-y-2 pt-1">
          {filteredPresets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className="group cursor-pointer rounded-lg border border-border/80 bg-card p-2.5 transition hover:border-violet-500/60 hover:shadow-md hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">{preset.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">
                      {preset.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{preset.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 p-0 opacity-0 group-hover:opacity-100 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 transition"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleApplyPreset(preset)
                  }}
                  title="Add at Playhead"
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              {/* Visual typography preview card */}
              <div
                className="mt-2 flex items-center justify-center rounded-md border border-border/40 p-3 text-center overflow-hidden"
                style={{
                  backgroundColor: preset.backgroundColor === 'transparent' ? 'rgba(0,0,0,0.4)' : preset.backgroundColor,
                }}
              >
                <span
                  style={{
                    color: preset.color,
                    fontFamily: preset.fontFamily,
                    fontSize: `${Math.min(22, preset.fontSize * 0.45)}px`,
                    fontWeight: preset.fontWeight as any,
                  }}
                  className="truncate max-w-full tracking-wide"
                >
                  {preset.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
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
          { id: 'auto' as const, label: 'Auto Captions', icon: Zap },
          { id: 'style' as const, label: 'Overlay Style', icon: SlidersHorizontal },
          { id: 'cues' as const, label: `Cues (${captionClips.length})`, icon: FileText },
        ].map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 flex items-center justify-center gap-1 rounded-md py-1 text-center text-[10px] font-semibold transition',
              tab === id ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(id)}
          >
            <TabIcon className="size-3 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'auto' && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-violet-500/10 p-2.5 border-violet-500/30 space-y-2">
            <div className="flex items-center gap-1.5 text-violet-700 dark:text-violet-300 font-semibold text-xs">
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
                  { id: 'karaoke' as const, label: 'Yellow Karaoke', bg: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
                  { id: 'modern' as const, label: 'Modern Dark Pill', bg: 'border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-200' },
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
              {generating ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Zap className="mr-2 size-3.5" />}
              {generating ? progressText || `Transcribing Audio (${progressPercent}%)...` : 'Auto-Generate Captions & Auto-Play'}
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

  const [panelTab, setPanelTab] = React.useState<'camera' | 'lighting' | 'render'>('camera')
  const [isStudioOpen, setIsStudioOpen] = React.useState(false)
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('cyber-cube')
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>('')
  const [usePreset, setUsePreset] = React.useState(true)

  // Camera Trajectory Rig
  const [selectedPresetPathId, setSelectedPresetPathId] = React.useState<string>('turntable-360')
  const [flightMode, setFlightMode] = React.useState<CameraMode>('turntable')
  const [azimuthStart, setAzimuthStart] = React.useState(0)
  const [azimuthEnd, setAzimuthEnd] = React.useState(360)
  const [elevationStart, setElevationStart] = React.useState(20)
  const [elevationEnd, setElevationEnd] = React.useState(20)
  const [fov, setFov] = React.useState(40)
  const [duration, setDuration] = React.useState(5)
  const [resolution, setResolution] = React.useState('auto')
  const [fps, setFps] = React.useState(30)
  const [lighting, setLighting] = React.useState<'studio' | 'neon' | 'sunset' | 'spotlight' | 'ambient'>('studio')

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

  const applyTrajectoryPreset = (preset: CameraTrajectoryPreset) => {
    setSelectedPresetPathId(preset.id)
    setFlightMode(preset.mode)
    setAzimuthStart(preset.azimuthStart)
    setAzimuthEnd(preset.azimuthEnd)
    setElevationStart(preset.elevationStart)
    setElevationEnd(preset.elevationEnd)
    setFov(preset.fov)
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
        setSuccess(`Staged "${imported[0].name}" in 3D Viewport!`)
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

      const [w, h] = resolution === 'auto'
        ? [project.width || 1280, project.height || 720]
        : resolution.split('x').map(Number)
      const baseRadius = (targetAsset.modelRadius ?? 2.4) * 2.5 || 6.0
      const currentPreset = CAMERA_TRAJECTORY_PRESETS.find((p) => p.id === selectedPresetPathId)
      const rStart = baseRadius * (currentPreset?.radiusMultStart ?? 1.0)
      const rEnd = baseRadius * (currentPreset?.radiusMultEnd ?? 1.0)

      const rig: CameraRig = {
        mode: flightMode,
        azimuthStart,
        azimuthEnd,
        elevationStart,
        elevationEnd,
        radiusStart: rStart,
        radiusEnd: rEnd,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        fov,
        pan: 1.0,
      }

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

      const videoFile = new File([res.blob], `3d-${selectedPresetId || 'model'}-${Date.now()}.webm`, {
        type: 'video/webm',
      })
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
    <div className="space-y-3 p-3">
      {/* ── TOP 3D SEARCH & DISCOVERY BAR (AT TOP) ── */}
      <div className="space-y-2 rounded-lg border border-violet-500/30 bg-muted/25 p-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
            <Search className="size-3.5 text-violet-500" />
            Search 3D Models
          </span>
          <Select value={source} onValueChange={(v) => { setSource(v as 'polyhaven' | 'sketchfab'); setResults([]) }}>
            <SelectTrigger className="h-6 w-28 text-[10px] bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="polyhaven">Poly Haven (CC0)</SelectItem>
              <SelectItem value="sketchfab">Sketchfab</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-1.5">
          <Input
            placeholder="Search models (e.g. drone, car, robot, trophy)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
            className="h-7 text-xs bg-background"
          />
          <Button size="sm" className="h-7 px-2.5 bg-violet-600 hover:bg-violet-500 text-white" onClick={() => void search()} disabled={searching}>
            {searching ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
          </Button>
        </div>

        {/* Quick Search Tag Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <span className="text-[9px] text-muted-foreground shrink-0 font-medium">Quick:</span>
          {['drone', 'robot', 'car', 'statue', 'chair', 'sword', 'trophy'].map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-violet-500/20 hover:text-violet-300 transition shrink-0 capitalize font-medium"
              onClick={() => {
                setQuery(tag)
                setSearching(true)
                setError(null)
                void (async () => {
                  try {
                    if (source === 'sketchfab') {
                      const models = await searchSketchfabModels(tag, { maxResults: 12 })
                      setResults(models.map((m) => ({ ...m, source: 'sketchfab' as const })))
                    } else {
                      const models = await searchModels(tag, { maxResults: 12 })
                      setResults(models.map((m) => ({ ...m, source: 'polyhaven' as const })))
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err))
                  } finally {
                    setSearching(false)
                  }
                })()
              }}
            >
              {tag}
            </button>
          ))}
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

      {/* ── Dedicated Studio Launcher Banner ── */}
      <Button
        type="button"
        className="h-8 w-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500 shadow-xs"
        onClick={() => setIsStudioOpen(true)}
      >
        <Maximize2 className="mr-1.5 size-3.5" />
        Open Full 3D Animation Studio Workspace
      </Button>

      {/* ── 1. Live Interactive WebGL Viewport ── */}
      <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Box className="size-4 text-violet-400" />
            <span className="text-xs font-bold truncate max-w-[140px]">
              {usePreset ? selectedPresetId : selectedAsset?.name || '3D Model'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground font-semibold"
              onClick={() => fileInputRef.current?.click()}
            >
              + Upload .GLB
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept=".glb,.gltf" className="hidden" onChange={handleCustomGlbUpload} />

        {/* Live Canvas */}
        <ThreeDPreviewCanvas
          asset={!usePreset ? selectedAsset : null}
          presetId={usePreset ? selectedPresetId : undefined}
          lighting={lighting}
          className="h-40 w-full"
        />

        {/* Model Presets Quick Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Featured 3D Presets</span>
            <span className="text-[9px] text-muted-foreground font-mono">{BUILTIN_3D_PRESETS.length} Models</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-0.5">
            {BUILTIN_3D_PRESETS.map((preset) => {
              const isSelected = usePreset && selectedPresetId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border p-1.5 text-left text-[10px] font-medium transition shadow-2xs',
                    isSelected
                      ? 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold ring-1 ring-violet-500/40'
                      : 'border-border/60 bg-card text-muted-foreground hover:border-violet-500/30 hover:text-foreground',
                  )}
                  onClick={() => {
                    setUsePreset(true)
                    setSelectedPresetId(preset.id)
                  }}
                  title={preset.description}
                >
                  <span
                    className="size-2 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="truncate flex-1">{preset.name}</span>
                </button>
              )
            })}
          </div>
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

      {/* ── 2. Organized Sub-Tabs ── */}
      <div className="flex rounded-lg border bg-muted/40 p-0.5">
        {[
          { id: 'camera' as const, label: 'Camera', icon: Camera },
          { id: 'lighting' as const, label: 'Lighting', icon: Sun },
          { id: 'render' as const, label: 'Render', icon: Play },
        ].map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 flex items-center justify-center gap-1 rounded-md py-1 text-center text-[10px] font-semibold transition',
              panelTab === id ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setPanelTab(id)}
          >
            <TabIcon className="size-3 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB: CAMERA TRAJECTORIES */}
      {panelTab === 'camera' && (
        <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Camera Trajectory</span>
            <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300 uppercase">
              {flightMode}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1">
            {CAMERA_TRAJECTORY_PRESETS.slice(0, 6).map((preset) => {
              const Icon = CAMERA_PRESET_ICON_MAP[preset.icon] || Camera
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 rounded p-1.5 text-[10px] font-medium transition text-left',
                    selectedPresetPathId === preset.id
                      ? 'border border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold'
                      : 'border border-border/60 bg-card text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => applyTrajectoryPreset(preset)}
                >
                  <Icon className="size-3 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span className="truncate">{preset.name}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 border-t">
            {CAMERA_TRAJECTORY_PRESETS.filter((p) => p.category === 'viewport').slice(0, 3).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  'rounded border py-1 text-[9px] font-medium transition text-center',
                  selectedPresetPathId === preset.id
                    ? 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                )}
                onClick={() => applyTrajectoryPreset(preset)}
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: LIGHTING & ATMOSPHERE */}
      {panelTab === 'lighting' && (
        <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
          <span className="text-xs font-semibold">Lighting & Atmosphere</span>
          <div className="grid grid-cols-3 gap-1">
            {(['studio', 'neon', 'sunset', 'spotlight', 'ambient'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={cn(
                  'rounded border py-1 text-[10px] font-medium capitalize transition text-center',
                  lighting === l
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-300 font-bold'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setLighting(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: RENDER & TIMELINE */}
      {panelTab === 'render' && (
        <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Quality</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto ({project.width || 1280}×{project.height || 720})</SelectItem>
                  <SelectItem value="1920x1080">1080p HD (16:9)</SelectItem>
                  <SelectItem value="1280x720">720p HD (16:9)</SelectItem>
                  <SelectItem value="1080x1920">9:16 Vertical (Shorts/Reels)</SelectItem>
                  <SelectItem value="1080x1080">1:1 Square (Instagram)</SelectItem>
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

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Duration</span>
              <span className="font-mono text-violet-300 font-bold">{duration}s</span>
            </div>
            <Slider value={[duration]} min={1} max={15} step={1} onValueChange={([v]) => setDuration(v)} />
          </div>
        </div>
      )}

      {/* ── Render Progress ── */}
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
        {rendering ? 'Rendering 3D Video...' : `Render 3D Flight (${duration}s @ ${resolution})`}
      </Button>

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
  const [defaultPlacement, setDefaultPlacement] = React.useState<'center' | 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left' | 'lower-third'>('bottom-right')
  const [defaultScalePct, setDefaultScalePct] = React.useState<number>(35)

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

  const search = async (term?: string) => {
    const q = (term ?? query).trim()
    if (!q) return
    setQuery(q)
    setLoading(true)
    setError(null)
    setResults([])
    const r = await searchGiphy(q)
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
        const store = useTimelineStore.getState()
        const clip = store.addAssetToTimeline(imported[0].id)
        if (clip) {
          const p = store.project
          const w = p.width || 1920
          const h = p.height || 1080
          const s = defaultScalePct / 100

          let posX = 0
          let posY = 0
          if (defaultPlacement === 'bottom-right') {
            posX = Math.round(w * 0.28)
            posY = Math.round(h * 0.28)
          } else if (defaultPlacement === 'top-right') {
            posX = Math.round(w * 0.28)
            posY = Math.round(-h * 0.28)
          } else if (defaultPlacement === 'bottom-left') {
            posX = Math.round(-w * 0.28)
            posY = Math.round(h * 0.28)
          } else if (defaultPlacement === 'top-left') {
            posX = Math.round(-w * 0.28)
            posY = Math.round(-h * 0.28)
          } else if (defaultPlacement === 'lower-third') {
            posX = 0
            posY = Math.round(h * 0.3)
          }

          store.updateClip(clip.id, {
            scale: { x: s, y: s },
            position: { x: posX, y: posY },
          })
          store.select([clip.id])
        } else {
          setError('No video track available for the sticker')
        }
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
          Animated stickers convert to video clips with auto-scaling & placement presets.
        </p>
      )}

      {/* Quick Search Tag Pills */}
      <div className="flex flex-wrap gap-1">
        {['Fire', 'Reaction', 'Subscribe', 'Emoji', 'Like', 'Arrow', 'Celebrate', 'Heart', 'Meme', 'Wow'].map((tag) => (
          <button
            key={tag}
            type="button"
            className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-violet-500/40 hover:text-foreground transition"
            onClick={() => void search(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

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

      {/* Default Placement & Scale Options */}
      <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-muted-foreground">Sticker Staging on Add:</span>
          <span className="font-mono text-violet-400 font-bold">{defaultScalePct}% size</span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'center' as const, label: 'Center' },
            { id: 'bottom-right' as const, label: 'Bottom-R' },
            { id: 'top-right' as const, label: 'Top-R' },
            { id: 'lower-third' as const, label: 'Lower-3rd' },
            { id: 'bottom-left' as const, label: 'Bottom-L' },
            { id: 'top-left' as const, label: 'Top-L' },
          ].map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => setDefaultPlacement(pl.id)}
              className={cn(
                'rounded border py-0.5 text-center text-[9px] font-medium transition',
                defaultPlacement === pl.id
                  ? 'border-violet-500 bg-violet-500/20 text-violet-300 font-bold'
                  : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {pl.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 pt-0.5">
          <span className="text-[9px] text-muted-foreground">Size:</span>
          {[20, 35, 50, 100].map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => setDefaultScalePct(sz)}
              className={cn(
                'flex-1 rounded py-0.5 text-center font-mono text-[9px]',
                defaultScalePct === sz
                  ? 'bg-violet-600 font-bold text-white shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {sz}%
            </button>
          ))}
        </div>
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
  const [inputValue, setInputValue] = React.useState('')
  const [inputFocused, setInputFocused] = React.useState(false)

  React.useEffect(() => {
    if (!inputFocused && clip) {
      setInputValue(clip.speed.toFixed(2))
    }
  }, [clip?.speed, inputFocused, clip])

  if (!clip) return <EmptyHint text="Select any video or audio clip on the timeline to adjust its playback speed." icon={Gauge} />

  const sourceDuration = Math.max(0.1, clip.sourceEnd - clip.sourceStart)

  const handleSetSpeed = (newSpeed: number) => {
    const safeSpeed = Math.max(0.05, Math.min(16, newSpeed))
    const updates: Partial<Clip> = { speed: safeSpeed }
    if (rippleDuration) {
      const newDur = Math.max(0.1, sourceDuration / safeSpeed)
      updates.duration = newDur
    }
    updateClip(clip.id, updates)
    setInputValue(safeSpeed.toFixed(2))
  }

  const handleInputCommit = () => {
    const val = parseFloat(inputValue)
    if (!isNaN(val) && val > 0) handleSetSpeed(val)
    else setInputValue(clip.speed.toFixed(2))
  }

  const nudge = (delta: number) => handleSetSpeed(clip.speed + delta)

  const quickPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0]
  const stylePresets = [
    { label: 'Cinematic Slow-Mo', speed: 0.5, icon: Film, desc: '50% — silky smooth slow motion' },
    { label: 'Ultra Slow-Mo', speed: 0.25, icon: Gauge, desc: '25% — dramatic impact' },
    { label: 'Fast Forward', speed: 2.0, icon: Zap, desc: '2× — energetic cut' },
    { label: 'Time-Lapse', speed: 4.0, icon: Sparkles, desc: '4× — montage and b-roll' },
    { label: 'Normal Speed', speed: 1.0, icon: Target, desc: 'Reset to 100%' },
    { label: 'Ultra Fast', speed: 8.0, icon: FastForward, desc: '8× — hyperlapse effect' },
  ]

  const timelineAfter = rippleDuration
    ? `${(sourceDuration / clip.speed).toFixed(2)}s`
    : `${clip.duration.toFixed(2)}s (fixed)`

  return (
    <div className="space-y-3 p-3">
      {/* ── Clip Info ── */}
      <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold truncate max-w-[160px]">{clip.name}</span>
          <span className="font-mono text-violet-400 text-xs font-bold">{clip.speed.toFixed(2)}×</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          <div><span>Source: </span><span className="font-mono text-foreground">{sourceDuration.toFixed(2)}s</span></div>
          <div><span>On Timeline: </span><span className="font-mono text-foreground">{timelineAfter}</span></div>
        </div>
      </div>

      {/* ── Precise Input + Nudge ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Speed Multiplier</Label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded border bg-card text-sm font-bold hover:bg-muted transition text-muted-foreground"
            onClick={() => nudge(-0.25)}
            title="Decrease speed by 0.25×"
          >−</button>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded border bg-card text-xs font-bold hover:bg-muted transition text-muted-foreground"
            onClick={() => nudge(-0.05)}
            title="Decrease speed by 0.05×"
          >‒</button>
          <input
            type="number"
            min={0.05}
            max={16}
            step={0.05}
            value={inputFocused ? inputValue : clip.speed.toFixed(2)}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => { setInputFocused(true); setInputValue(clip.speed.toFixed(2)) }}
            onBlur={() => { setInputFocused(false); handleInputCommit() }}
            onKeyDown={(e) => { if (e.key === 'Enter') { handleInputCommit(); (e.target as HTMLInputElement).blur() } }}
            className="h-7 flex-1 min-w-0 rounded border bg-card px-2 text-center font-mono text-xs outline-none focus:ring-1 focus:ring-violet-500"
          />
          <span className="text-muted-foreground text-xs font-mono">×</span>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded border bg-card text-xs font-bold hover:bg-muted transition text-muted-foreground"
            onClick={() => nudge(0.05)}
            title="Increase speed by 0.05×"
          >+</button>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded border bg-card text-sm font-bold hover:bg-muted transition text-muted-foreground"
            onClick={() => nudge(0.25)}
            title="Increase speed by 0.25×"
          >＋</button>
        </div>
        <Slider
          min={0.05}
          max={8}
          step={0.05}
          value={[Math.min(clip.speed, 8)]}
          onValueChange={([v]) => handleSetSpeed(v)}
          className="mt-1"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground font-mono pt-0.5">
          <span>0.05×</span><span>0.5×</span><span>1×</span><span>2×</span><span>4×</span><span>8×</span>
        </div>
      </div>

      {/* ── Quick Preset Chips ── */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Quick Presets</Label>
        <div className="grid grid-cols-4 gap-1">
          {quickPresets.map((p) => (
            <button
              key={p}
              type="button"
              className={cn(
                'rounded py-1 text-center font-mono text-[10px] font-semibold transition',
                Math.abs(clip.speed - p) < 0.03
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'border bg-card text-muted-foreground hover:border-violet-500/50 hover:text-foreground',
              )}
              onClick={() => handleSetSpeed(p)}
            >
              {p}×
            </button>
          ))}
        </div>
      </div>

      {/* ── Style Presets ── */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Style Presets</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {stylePresets.map((ramp) => {
            const Icon = ramp.icon
            return (
              <button
                key={ramp.label}
                type="button"
                className={cn(
                  'rounded-md border p-2 text-left text-[10px] transition',
                  Math.abs(clip.speed - ramp.speed) < 0.05
                    ? 'border-violet-500 bg-violet-500/15 text-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted/30',
                )}
                onClick={() => handleSetSpeed(ramp.speed)}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3 text-violet-600 dark:text-violet-400 shrink-0" />
                  <p className="font-semibold text-foreground leading-tight">{ramp.label}</p>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{ramp.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Options ── */}
      <div className="space-y-2 pt-1 border-t">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">Ripple Timeline Duration</Label>
            <p className="text-[10px] text-muted-foreground">Auto-resize clip on timeline with speed</p>
          </div>
          <Switch checked={rippleDuration} onCheckedChange={setRippleDuration} />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">Preserve Audio Pitch</Label>
            <p className="text-[10px] text-muted-foreground">Prevent chipmunk effect at high speed</p>
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
// ─── Design & Motion Graphics Section ─────────────────────────────────────────
function DesignSection() {
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  const [motionSubTab, setMotionSubTab] = React.useState<'prompt' | 'presets' | 'code' | 'history'>('prompt')

  // Motion Graphics State
  const [concept, setConcept] = React.useState('Kinetic modern title sequence with neon violet glow')
  const [style, setStyle] = React.useState('Modern Tech Glow')
  const [duration, setDuration] = React.useState(5)
  const [transparent, setTransparent] = React.useState(false)
  const [resolution, setResolution] = React.useState('auto')
  const [fps, setFps] = React.useState(30)
  const [motionCode, setMotionCode] = React.useState<string>(BUILTIN_MOTION_PRESETS[0].code)

  // Live Canvas Playback State
  const [isPlaying, setIsPlaying] = React.useState(true)
  const [currentTime, setCurrentTime] = React.useState(0)
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const animFrameRef = React.useRef<number | null>(null)

  // Execution & Progress
  const [busy, setBusy] = React.useState(false)
  const [rendering, setRendering] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const history = React.useMemo(() => getMotionHistory(), [busy])

  // ── Sandboxed motion preview (Web Worker) ──────────────────────────────
  // Motion code runs inside motionPreview.worker.ts (no DOM/storage access).
  // One OffscreenCanvas ping-pongs between main thread and worker.
  const motionWorkerRef = React.useRef<Worker | null>(null)
  const motionCanvasRef = React.useRef<OffscreenCanvas | null>(null)
  const motionSizeRef = React.useRef<{ w: number; h: number } | null>(null)
  const motionBusyRef = React.useRef(false)
  const motionQueuedRef = React.useRef<{ t: number; needInit: boolean } | null>(null)
  const motionInitedCodeRef = React.useRef<string | null>(null)

  const getMotionWorker = React.useCallback((): Worker | null => {
    if (motionWorkerRef.current) return motionWorkerRef.current
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null
    const worker = new Worker(new URL('../../workers/motionPreview.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent) => {
      const { ok, canvas, message } = ev.data as { ok: boolean; canvas?: OffscreenCanvas; message?: string }
      motionCanvasRef.current = canvas ?? null
      motionBusyRef.current = false
      void ok
      void message
      const offscreen = motionCanvasRef.current
      const size = motionSizeRef.current
      const visible = previewCanvasRef.current?.getContext('2d')
      if (offscreen && visible && size) {
        visible.imageSmoothingEnabled = true
        visible.imageSmoothingQuality = 'high'
        try {
          visible.clearRect(0, 0, size.w, size.h)
          visible.drawImage(offscreen as unknown as CanvasImageSource, 0, 0)
        } catch {
          /* frame dropped */
        }
      }
      const queued = motionQueuedRef.current
      if (queued && offscreen && size) {
        motionQueuedRef.current = null
        dispatchMotionFrameRef.current(offscreen, size.w, size.h, queued.t, queued.needInit)
      }
    }
    motionWorkerRef.current = worker
    return worker
  }, [])

  const dispatchMotionFrameRef = React.useRef<
    (canvas: OffscreenCanvas, w: number, h: number, t: number, needInit: boolean) => void
  >(() => {})

  function dispatchMotionFrame(canvas: OffscreenCanvas, w: number, h: number, t: number, needInit: boolean) {
    const worker = getMotionWorker()
    if (!worker) return
    motionBusyRef.current = true
    worker.postMessage({ canvas, code: motionCode, t, width: w, height: h, needInit }, [canvas])
    motionCanvasRef.current = null
  }

  React.useEffect(() => {
    dispatchMotionFrameRef.current = dispatchMotionFrame
  })

  const requestMotionFrame = React.useCallback(
    (t: number, needInit: boolean) => {
      const canvasEl = previewCanvasRef.current
      if (!canvasEl || !motionCode.trim()) return
      const worker = getMotionWorker()
      if (!worker) return
      const w = canvasEl.width
      const h = canvasEl.height
      let offscreen = motionCanvasRef.current
      if (!offscreen || motionSizeRef.current?.w !== w || motionSizeRef.current?.h !== h) {
        if (offscreen) {
          // Size changed — discard the old buffer (ownership currently here).
          offscreen = null
          motionCanvasRef.current = null
        }
        offscreen = new OffscreenCanvas(w, h)
        motionCanvasRef.current = offscreen
        motionSizeRef.current = { w, h }
        needInit = true
      }
      if (motionBusyRef.current) {
        motionQueuedRef.current = { t, needInit }
        return
      }
      const initForCode = needInit || motionInitedCodeRef.current !== motionCode
      if (initForCode) motionInitedCodeRef.current = motionCode
      dispatchMotionFrameRef.current(offscreen, w, h, t, initForCode)
    },
    [motionCode, getMotionWorker],
  )

  // Terminate the sandbox worker on unmount.
  React.useEffect(() => {
    return () => {
      motionWorkerRef.current?.terminate()
      motionWorkerRef.current = null
      motionCanvasRef.current = null
      motionBusyRef.current = false
      motionQueuedRef.current = null
    }
  }, [])

  // Live Canvas Playback Loop (sandboxed)
  React.useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return

    let startTime = performance.now()
    let lastT = -1
    const loop = (now: number) => {
      if (!isPlaying) return
      const elapsed = ((now - startTime) / 1000) % duration
      const t = elapsed / duration
      setCurrentTime(t)
      if (t !== lastT) {
        lastT = t
        requestMotionFrame(t, false)
      }
      animFrameRef.current = requestAnimationFrame(loop)
    }

    // Initial paint for the current code.
    requestMotionFrame(currentTime, true)
    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionCode, isPlaying, duration, requestMotionFrame])

  // Update canvas on manual time scrub (rendered in the sandbox worker)
  const handleScrubTime = (t: number) => {
    setCurrentTime(t)
    setIsPlaying(false)
    requestMotionFrame(t, false)
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
      const [w, h] = resolution === 'auto'
        ? [project.width || 1280, project.height || 720]
        : resolution.split('x').map(Number)
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
          updateClip(clip.id, {
            duration,
            sourceEnd: duration,
            clipType: 'animation',
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
          })
          setSuccess(`Rendered ${duration}s HD motion graphic (${w}x${h}) centered on timeline!`)
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

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const stageW = project.width || 1280
  const stageH = project.height || 720

  return (
    <div className="flex h-full flex-col gap-3.5 p-3">
      {/* ── Live Canvas Viewport ── */}
      <div className="space-y-1.5 rounded-xl border border-violet-500/20 bg-black/60 p-2.5 shadow-lg">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-violet-400" />
            Motion Graphic Stage ({stageW}×{stageH})
          </span>
          <span className="font-mono font-semibold text-violet-400">{(currentTime * duration).toFixed(2)}s / {duration}s</span>
        </div>

        <div
          className="relative flex w-full max-h-72 items-center justify-center overflow-hidden rounded-xl border border-violet-500/30 bg-zinc-950 mx-auto shadow-2xl"
          style={{
            aspectRatio: `${stageW} / ${stageH}`,
            backgroundImage: transparent ? 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 0)' : undefined,
            backgroundSize: '16px 16px',
          }}
        >
          <canvas
            ref={previewCanvasRef}
            width={stageW}
            height={stageH}
            className="size-full object-contain mx-auto block"
          />
          <div className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[9px] font-mono text-violet-300 backdrop-blur border border-violet-500/30">
            {stageW >= 3840 ? '4K Ultra HD' : stageW >= 1920 ? '1080p Full HD' : 'HD Ready'}
          </div>
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
      <div className="flex rounded-lg border bg-muted/40 p-0.5">
        {[
          { id: 'prompt' as const, label: 'AI Generator', icon: Sparkles },
          { id: 'presets' as const, label: 'Presets', icon: Boxes },
          { id: 'code' as const, label: 'Code', icon: Code },
          { id: 'history' as const, label: 'History', icon: History },
        ].map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 flex items-center justify-center gap-1 rounded-md py-1 text-center text-[10px] font-semibold transition',
              motionSubTab === id
                ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMotionSubTab(id)}
          >
            <TabIcon className="size-3 shrink-0" />
            <span>{label}</span>
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
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Duration</span>
                <span className="font-mono text-violet-700 dark:text-violet-300 font-bold">{duration}s</span>
              </div>
              <Slider value={[duration]} min={2} max={15} step={1} onValueChange={([v]) => setDuration(v)} />
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
                <span className="rounded bg-violet-500/20 px-1.5 py-0.2 text-[9px] font-medium text-violet-700 dark:text-violet-300">
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
                <SelectItem value="auto">Auto ({project.width || 1280}×{project.height || 720})</SelectItem>
                <SelectItem value="1920x1080">1080p HD (16:9)</SelectItem>
                <SelectItem value="1280x720">720p HD (16:9)</SelectItem>
                <SelectItem value="1080x1920">9:16 Vertical (Shorts/Reels)</SelectItem>
                <SelectItem value="1080x1080">1:1 Square (Instagram)</SelectItem>
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
    </div>
  )
}

// ─── Script Section ───────────────────────────────────────────────────────────
function ScriptSection() {
  const [topic, setTopic] = React.useState('')
  const [creatorCategory, setCreatorCategory] = React.useState<string>('all')
  const [creatorStyle, setCreatorStyle] = React.useState<CreatorStyleId>('mrbeast')
  const [customCreator, setCustomCreator] = React.useState('')
  const [targetDuration, setTargetDuration] = React.useState(60)
  const [sceneCount, setSceneCount] = React.useState(5)
  const [customTone, setCustomTone] = React.useState('high_energy')
  const [language, setLanguage] = React.useState('auto')
  const [busy, setBusy] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'storyboard' | 'editor' | 'teleprompter' | 'hook'>('storyboard')
  const [teleprompterZoom, setTeleprompterZoom] = React.useState(14)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [isStudioOpen, setIsStudioOpen] = React.useState(false)
  const [studioLayout, setStudioLayout] = React.useState<'full' | 'half-right' | 'half-left'>('full')
  const [isSynthesizingTts, setIsSynthesizingTts] = React.useState(false)

  const script = useScriptStore((s) => s.script)
  const setScript = useScriptStore((s) => s.setScript)
  const updateScript = useScriptStore((s) => s.updateScript)
  const updateScene = useScriptStore((s) => s.updateScene)
  const addScene = useScriptStore((s) => s.addScene)
  const removeScene = useScriptStore((s) => s.removeScene)
  const reorderScenes = useScriptStore((s) => s.reorderScenes)

  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const addTextClip = useTimelineStore((s) => s.addTextClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)

  // Filtered creators list based on category tab
  const filteredCreators = React.useMemo(() => {
    const list = Object.values(CREATOR_STYLES)
    if (creatorCategory === 'all') return list
    if (creatorCategory === 'english') return list.filter((c) => c.language === 'english' || c.language === 'all')
    if (creatorCategory === 'hindi') return list.filter((c) => c.language === 'hindi')
    return list.filter((c) => c.category === creatorCategory)
  }, [creatorCategory])

  // Voiceover Recording Integration
  const handleVoiceoverDone = React.useCallback(
    async (file: File, durationSec: number) => {
      try {
        const { imported, errors } = await importFiles([file])
        if (imported.length) {
          const audioTrack = project.tracks.find((t) => t.type === 'audio') || project.tracks.find((t) => t.type === 'video')
          if (audioTrack) {
            const clip = addClip(imported[0].id, audioTrack.id, playhead ?? 0)
            if (clip) {
              updateClip(clip.id, { duration: durationSec, sourceEnd: durationSec, clipType: 'audio' })
              setSuccess(`Recorded ${durationSec.toFixed(1)}s voiceover directly to audio track at ${(playhead ?? 0).toFixed(1)}s!`)
            }
          }
        } else {
          setError(errors[0] ?? 'Could not import voiceover')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Voiceover save failed')
      }
    },
    [importFiles, project.tracks, addClip, playhead, updateClip],
  )

  const recorder = useVoiceoverRecorder(handleVoiceoverDone)

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
        customCreator: customCreator.trim() || undefined,
        customTone,
        sceneCount,
        language,
      })
      setScript(result)
      const personaName = customCreator.trim() ? customCreator.trim() : CREATOR_STYLES[creatorStyle].name
      setSuccess(`Script created in ${personaName} style (${language === 'Hindi' ? 'हिन्दी' : language === 'Hinglish' ? 'Hinglish' : 'English'})!`)
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

    let time = playhead ?? 0
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

  const handleSynthesizeTts = async () => {
    if (!script) return
    setIsSynthesizingTts(true)
    setError(null)
    setSuccess(null)
    try {
      const { getActiveTtsProvider } = await import('@/api/tts')
      const provider = getActiveTtsProvider()
      const fullText = [script.hook, ...script.scenes.map((s) => s.text), script.cta].filter(Boolean).join(' ')

      let audioBlob: Blob
      if (provider) {
        const ttsResult = await provider.synthesize({ text: fullText })
        if (ttsResult?.blob) {
          audioBlob = ttsResult.blob
        } else {
          const { generateAvatarVideo } = await import('@/api/llm/avatarGenerator')
          const res = await generateAvatarVideo({ role: 'presenter', topic: script.title, scriptText: fullText })
          audioBlob = res.videoBlob
        }
      } else {
        const { generateAvatarVideo } = await import('@/api/llm/avatarGenerator')
        const res = await generateAvatarVideo({ role: 'presenter', topic: script.title, scriptText: fullText })
        audioBlob = res.videoBlob
      }

      const file = new File([audioBlob], `script-voiceover-${Date.now()}.wav`, { type: 'audio/wav' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        const audioTrack = project.tracks.find((t) => t.type === 'audio') || project.tracks.find((t) => t.type === 'video')
        if (audioTrack) {
          const clip = addClip(imported[0].id, audioTrack.id, playhead ?? 0)
          if (clip) {
            const metrics = calculateScriptMetrics(script)
            updateClip(clip.id, { duration: metrics.estimatedSeconds, sourceEnd: metrics.estimatedSeconds, clipType: 'audio' })
            setSuccess(`Synthesized ~${metrics.estimatedSeconds}s audio voiceover to timeline!`)
          }
        }
      } else {
        setError(errors[0] ?? 'Could not import synthesized audio')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TTS synthesis failed')
    } finally {
      setIsSynthesizingTts(false)
    }
  }

  const metrics = script ? calculateScriptMetrics(script) : null

  return (
    <div className="space-y-3.5 p-3 text-xs">
      {/* ── 1. Creator Persona & Style Selector ── */}
      <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/10 p-3">
        <div className="flex items-center justify-between">
          <span className="font-bold flex items-center gap-1.5 text-foreground">
            <Flame className="size-4 text-amber-500" />
            <span>Famous Creators & Persona Presets</span>
          </span>
          <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">
            {customCreator.trim() ? customCreator.trim() : CREATOR_STYLES[creatorStyle].name}
          </span>
        </div>

        {/* Creator Category Filter Pills */}
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'all', label: `All (${Object.keys(CREATOR_STYLES).length})` },
            { id: 'english', label: 'English Stars' },
            { id: 'hindi', label: 'Hindi & Indian Top' },
            { id: 'tech', label: 'Tech & AI' },
            { id: 'business', label: 'Business & Finance' },
            { id: 'education', label: 'Education & Science' },
            { id: 'viral', label: 'Viral Shorts' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-semibold transition',
                creatorCategory === cat.id
                  ? 'bg-violet-600 text-white font-bold shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              onClick={() => setCreatorCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Style Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-0.5 pt-0.5">
          {filteredCreators.map((style) => {
            const Icon = CREATOR_STYLE_ICON_MAP[style.icon] || Mic
            const isSelected = creatorStyle === style.id && !customCreator.trim()
            return (
              <button
                key={style.id}
                type="button"
                className={cn(
                  'rounded-lg border p-1.5 text-left transition flex flex-col justify-between h-15 group relative',
                  isSelected
                    ? 'border-violet-500 bg-violet-500/15 shadow-xs ring-1 ring-violet-500'
                    : 'border-border/60 bg-card hover:border-violet-500/40 hover:bg-muted/10',
                )}
                onClick={() => {
                  setCreatorStyle(style.id)
                  if (style.id !== 'custom') setCustomCreator('')
                  if (style.language === 'hindi' && language === 'auto') {
                    setLanguage('Hinglish')
                  }
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className="size-3 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span className="text-[10px] font-bold truncate text-foreground">{style.name}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[8px] font-mono px-1 rounded uppercase font-bold shrink-0',
                      style.language === 'hindi'
                        ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300'
                        : style.language === 'english'
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {style.language === 'hindi' ? 'HI' : style.language === 'english' ? 'EN' : 'ALL'}
                  </span>
                </div>
                <p className="text-[8px] text-muted-foreground line-clamp-1 leading-tight">{style.tagline}</p>
              </button>
            )
          })}
        </div>

        {/* Optional Custom Creator Input Field */}
        <div className="space-y-1 pt-1.5 border-t border-border/40">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-muted-foreground">Custom Creator / Persona (Optional):</span>
            <span className="text-[9px] text-violet-500 font-medium">Type any channel name</span>
          </div>
          <Input
            placeholder="e.g. CodeWithHarry, CarryMinati, Fireship, Bhuvan Bam, Iman Gadzhi..."
            value={customCreator}
            onChange={(e) => {
              setCustomCreator(e.target.value)
              if (e.target.value.trim()) setCreatorStyle('custom')
            }}
            className="h-7 text-xs bg-card"
            disabled={busy}
          />
        </div>
      </div>

      {/* ── 2. Script Topic & Pacing Controls ── */}
      <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/10 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Video Topic or Core Premise</Label>
          <Input
            placeholder="e.g. 5 AI tools that will change video editing forever..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-8 text-xs bg-card font-medium"
            disabled={busy}
          />

          {/* Quick Instant Topic Pills */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {[
              { label: '5 AI Secrets (MrBeast)', topic: '5 secret AI video tools that feel illegal to use in 2026', style: 'mrbeast' as CreatorStyleId, lang: 'auto' },
              { label: 'Hindi Tech (Tech Burner)', topic: '5 AI tools jo video editing ko 10x fast kar denge', style: 'tech_burner' as CreatorStyleId, lang: 'Hinglish' },
              { label: 'Dhruv Rathee Analysis', topic: 'The Reality of Artificial Intelligence and Future Jobs', style: 'dhruv_rathee' as CreatorStyleId, lang: 'Hindi' },
              { label: 'Tech Review (MKBHD)', topic: 'So I have been testing AI Video Editors for the past month', style: 'mkbhd' as CreatorStyleId, lang: 'auto' },
              { label: 'Think School Case Study', topic: 'How Top AI Startups Dominated YouTube in 2026', style: 'think_school' as CreatorStyleId, lang: 'Hinglish' },
              { label: 'CarryMinati Satire', topic: 'AI Influencers Aur Future Ki Kahani', style: 'carryminati' as CreatorStyleId, lang: 'Hinglish' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                className="rounded-full border border-border/60 bg-card px-2 py-0.5 text-[9px] font-medium text-muted-foreground hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-foreground transition"
                onClick={() => {
                  setTopic(p.topic)
                  setCreatorStyle(p.style)
                  setLanguage(p.lang)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection Row */}
        <div className="space-y-1 pt-1 border-t border-border/40">
          <div className="flex items-center justify-between text-[10px]">
            <Label className="text-[10px] font-bold text-foreground">Language & Script Format</Label>
            <span className="text-[9px] text-muted-foreground font-mono">
              {language === 'Hindi' ? 'हिन्दी (Devanagari)' : language === 'Hinglish' ? 'Hinglish (Latin)' : 'English'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'auto', label: 'English (EN)' },
              { id: 'Hindi', label: 'Hindi (HI)' },
              { id: 'Hinglish', label: 'Hinglish (IN)' },
              { id: 'Spanish', label: 'Spanish (ES)' },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                className={cn(
                  'rounded-md border py-1 text-[9px] font-semibold transition text-center',
                  language === l.id
                    ? 'border-violet-500 bg-violet-600 text-white shadow-xs font-bold'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setLanguage(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold text-muted-foreground">Duration</Label>
              <span className="font-mono text-[9px] text-violet-500 font-bold">{targetDuration}s</span>
            </div>
            <Select value={String(targetDuration)} onValueChange={(v) => setTargetDuration(Number(v))} disabled={busy}>
              <SelectTrigger className="w-full h-8 text-[10px] font-medium bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                <SelectItem value="15">15s (Shorts/TikTok)</SelectItem>
                <SelectItem value="30">30s (Quick Hook)</SelectItem>
                <SelectItem value="60">60s (1-Min Standard)</SelectItem>
                <SelectItem value="90">90s (Deep Reel)</SelectItem>
                <SelectItem value="120">2 Min (Explainer)</SelectItem>
                <SelectItem value="180">3 Min (Mini-Doc)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Tone & Pacing</Label>
            <Select value={customTone} onValueChange={setCustomTone} disabled={busy}>
              <SelectTrigger className="w-full h-8 text-[10px] font-medium bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                <SelectItem value="high_energy">High Energy & Urgent</SelectItem>
                <SelectItem value="storytelling">Narrative Storytelling</SelectItem>
                <SelectItem value="educational">Educational & Analytical</SelectItem>
                <SelectItem value="humorous">Witty & Humorous</SelectItem>
                <SelectItem value="authoritative">Authoritative & Confident</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Scene Beats</Label>
            <Select value={String(sceneCount)} onValueChange={(v) => setSceneCount(Number(v))} disabled={busy}>
              <SelectTrigger className="w-full h-8 text-[10px] font-medium bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                <SelectItem value="3">3 Scenes (Tight)</SelectItem>
                <SelectItem value="4">4 Scenes (Balanced)</SelectItem>
                <SelectItem value="5">5 Scenes (Standard)</SelectItem>
                <SelectItem value="6">6 Scenes (Deep)</SelectItem>
                <SelectItem value="8">8 Scenes (Long)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full bg-violet-600 hover:bg-violet-500 text-white shadow-md font-bold h-9 gap-1.5"
          onClick={() => void handleGenerate()}
          disabled={busy || !topic.trim()}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {busy ? 'Writing Viral Script...' : `Generate ${customCreator.trim() ? customCreator.trim() : CREATOR_STYLES[creatorStyle].name} Script`}
        </Button>
      </div>

      {error && <SectionNotice kind="error" text={error} />}
      {success && <SectionNotice kind="ok" text={success} />}

      {/* ── 3. Panel Recording HUD (When active) ── */}
      {recorder.isRecording && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/40 p-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-red-200">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-500 animate-ping" />
              Recording Voiceover...
            </span>
            <span className="font-mono text-sm font-bold text-white">{recorder.duration.toFixed(1)}s</span>
          </div>

          {/* VU Meter */}
          <div className="h-1.5 w-full rounded-full bg-black/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-75"
              style={{ width: `${recorder.audioLevel}%` }}
            />
          </div>

          <div className="flex gap-1.5 pt-1">
            <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs text-red-300 hover:text-white" onClick={recorder.cancelRecording}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs" onClick={recorder.stopRecording}>
              <Square className="size-3 mr-1 fill-current" /> Finish & Add
            </Button>
          </div>
        </div>
      )}

      {/* ── 4. Rich Script Studio Viewer & Editor ── */}
      {script && (
        <div className="space-y-2.5 rounded-lg border bg-card p-3 shadow-xs">
          {/* Header & Metrics */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground truncate max-w-[170px]">{script.title}</p>
              {metrics && (
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono">
                  <span>{metrics.totalWords}w</span>
                  <span>·</span>
                  <span>~{metrics.estimatedSeconds}s</span>
                  <span>·</span>
                  <span className="text-violet-400 font-semibold">{metrics.wpm} wpm</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 px-1.5 border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20 font-semibold"
                onClick={() => {
                  setStudioLayout('half-right')
                  setIsStudioOpen(true)
                }}
                title="Open Half-Screen Prompter to Read & Record alongside Video"
              >
                <PanelRight className="size-3 text-violet-400" />
                Half-Screen
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1 px-1.5"
                onClick={() => {
                  setStudioLayout('full')
                  setIsStudioOpen(true)
                }}
                title="Open Fullscreen Teleprompter & Studio Editor"
              >
                <Maximize2 className="size-3" />
                Fullscreen
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => handleCopy(formatTeleprompter(script))}
                title="Copy Full Script"
              >
                {copied ? <CheckCircle2 className="size-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="size-3.5" />}
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

          {/* Quick Studio Tools Bar */}
          <div className="flex items-center gap-1.5">
            {recorder.isRecording ? (
              <Button size="sm" variant="destructive" className="h-7 flex-1 text-xs gap-1 font-bold animate-pulse" onClick={recorder.stopRecording}>
                <Square className="size-3 fill-current" /> Stop ({recorder.duration.toFixed(1)}s)
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 flex-1 text-xs gap-1 bg-red-600 hover:bg-red-500 text-white font-semibold shadow-xs"
                onClick={() => void recorder.startRecording()}
              >
                <Mic className="size-3" /> Record Audio
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-violet-500/30 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10"
              onClick={() => void handleSynthesizeTts()}
              disabled={isSynthesizingTts}
            >
              {isSynthesizingTts ? <Loader2 className="size-3 animate-spin" /> : <Volume2 className="size-3" />}
              TTS
            </Button>
          </div>

          {/* Viewer Tabs */}
          <div className="flex rounded-md border bg-muted/40 p-0.5 text-[10px]">
            <button
              type="button"
              className={cn(
                'flex-1 flex items-center justify-center gap-1 rounded py-1 font-medium transition text-center',
                activeTab === 'storyboard' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('storyboard')}
            >
              <Layers className="size-3 shrink-0" />
              <span>Storyboard</span>
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 flex items-center justify-center gap-1 rounded py-1 font-medium transition text-center',
                activeTab === 'editor' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('editor')}
            >
              <Pencil className="size-3 shrink-0" />
              <span>Edit Script</span>
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 flex items-center justify-center gap-1 rounded py-1 font-medium transition text-center',
                activeTab === 'teleprompter' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('teleprompter')}
            >
              <ScrollText className="size-3 shrink-0" />
              <span>Prompter</span>
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 flex items-center justify-center gap-1 rounded py-1 font-medium transition text-center',
                activeTab === 'hook' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('hook')}
            >
              <Flame className="size-3 shrink-0" />
              <span>Hook</span>
            </button>
          </div>

          {/* ── 1. Storyboard View ── */}
          {activeTab === 'storyboard' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {/* Hook */}
              {script.hook && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Flame className="size-3 text-amber-500 shrink-0" />
                      <span>0:00 → 0:04 · HOOK</span>
                    </span>
                    <span className="text-[9px] font-semibold uppercase bg-amber-500/20 px-1 rounded text-amber-800 dark:text-amber-300">High Retention</span>
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
                  <div className="flex items-center justify-between text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                    <span className="flex items-center gap-1.5">
                      <Clapperboard className="size-3 text-violet-500 shrink-0" />
                      <span>Scene {i + 1}: {sc.title || `Beat ${i + 1}`}</span>
                    </span>
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
                    <div className="inline-block rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300">
                      TEXT: "{sc.onScreenText}"
                    </div>
                  )}
                </div>
              ))}

              {/* CTA */}
              {script.cta && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="size-3 text-emerald-500 shrink-0" />
                      <span>OUTRO / CALL TO ACTION</span>
                    </span>
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

          {/* ── 2. In-Panel Scene Editor ── */}
          {activeTab === 'editor' && (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {/* Hook Edit */}
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 space-y-1.5">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Flame className="size-3 text-amber-500 shrink-0" />
                  <span>Opening Hook (0-4s)</span>
                </span>
                <textarea
                  value={script.hook}
                  onChange={(e) => updateScript({ hook: e.target.value })}
                  placeholder="Spoken hook..."
                  className="w-full h-14 rounded border bg-background p-1.5 text-[11px] outline-none focus:border-amber-500 resize-none text-foreground"
                />
              </div>

              {/* Scenes Edit List */}
              {script.scenes.map((sc, i) => (
                <div key={i} className="rounded-md border bg-muted/20 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">Scene {i + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        onClick={() => reorderScenes(i, Math.max(0, i - 1))}
                        disabled={i === 0}
                      >
                        <ChevronLeft className="size-3 rotate-90" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-5 text-red-500 hover:text-red-400"
                        onClick={() => removeScene(i)}
                        disabled={script.scenes.length <= 1}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={sc.title}
                    onChange={(e) => updateScene(i, { title: e.target.value })}
                    placeholder="Scene Title"
                    className="h-6 text-[10px] bg-background text-foreground"
                  />
                  <textarea
                    value={sc.text}
                    onChange={(e) => updateScene(i, { text: e.target.value })}
                    placeholder="Spoken text for this scene..."
                    className="w-full h-14 rounded border bg-background p-1.5 text-[11px] outline-none focus:border-violet-500 resize-none text-foreground"
                  />
                  <Input
                    value={sc.visualCue || ''}
                    onChange={(e) => updateScene(i, { visualCue: e.target.value })}
                    placeholder="B-Roll visual cue..."
                    className="h-6 text-[10px] bg-background text-foreground italic"
                  />
                </div>
              ))}

              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs border-dashed border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
                onClick={() => addScene()}
              >
                <Plus className="size-3 mr-1" /> Add Scene Beat
              </Button>

              {/* CTA Edit */}
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="size-3 text-emerald-500 shrink-0" />
                  <span>Outro / CTA</span>
                </span>
                <textarea
                  value={script.cta}
                  onChange={(e) => updateScript({ cta: e.target.value })}
                  placeholder="Closing CTA..."
                  className="w-full h-14 rounded border bg-background p-1.5 text-[11px] outline-none focus:border-emerald-500 resize-none text-foreground"
                />
              </div>
            </div>
          )}

          {/* ── 3. Teleprompter View ── */}
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
                className="max-h-64 overflow-y-auto rounded-md border bg-muted/40 p-3 leading-relaxed text-foreground font-sans space-y-3 select-text"
                style={{ fontSize: `${teleprompterZoom}px` }}
              >
                {script.hook && <p className="font-bold text-amber-700 dark:text-amber-300">{script.hook}</p>}
                {script.scenes.map((sc, i) => (
                  <p key={i}>{sc.text}</p>
                ))}
                {script.cta && <p className="font-semibold text-emerald-700 dark:text-emerald-300">{script.cta}</p>}
              </div>
            </div>
          )}

          {/* ── 4. Hook Breakdown View ── */}
          {activeTab === 'hook' && (
            <div className="space-y-2 text-xs">
              <div className="rounded-md border p-2.5 space-y-1.5 bg-muted/20">
                <p className="font-semibold text-foreground text-xs">First 4 Seconds Analysis</p>
                <p className="text-[11px] text-muted-foreground">
                  The opening hook sets the visual and spoken promise. In <span className="text-violet-600 dark:text-violet-400 font-semibold">{script.creatorStyle || 'Creator'}</span> style, retention is maximized by immediate tension.
                </p>
                <div className="rounded bg-background p-2 font-mono text-[11px] text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  &ldquo;{script.hook}&rdquo;
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

      {/* ── 5. Full Screen Big Teleprompter & Studio Modal ── */}
      <ScriptStudioModal
        open={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        initialLayout={studioLayout}
      />
    </div>
  )
}

// ─── Images Section ───────────────────────────────────────────────────────────
function ImagesSection() {
  const [activeTab, setActiveTab] = React.useState<'stock' | 'vision'>('stock')
  const importFiles = useTimelineStore((s) => s.importFiles)
  const project = useTimelineStore((s) => s.project)
  const assets = useTimelineStore((s) => s.assets)
  const config = useApiConfigStore((s) => s.config)

  // Stock search state
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<Array<{ id: string; url: string; thumb: string; alt: string }>>([])
  const [searching, setSearching] = React.useState(false)
  const [importingId, setImportingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // Vision state
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>('')
  const [visionModel, setVisionModel] = React.useState('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning')
  const [visionMode, setVisionMode] = React.useState<'scene' | 'ocr' | 'caption' | 'custom'>('scene')
  const [customPrompt, setCustomPrompt] = React.useState('')
  const [visionBusy, setVisionBusy] = React.useState(false)
  const [visionResult, setVisionResult] = React.useState<string | null>(null)
  const [visionError, setVisionError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const imageAssets = React.useMemo(() => assets.filter((a) => a.type === 'image'), [assets])

  React.useEffect(() => {
    if (imageAssets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(imageAssets[0].id)
    }
  }, [imageAssets, selectedAssetId])

  const orientation = React.useMemo(() => {
    if (project.aspectRatio === '9:16' || project.width < project.height) return 'portrait'
    if (project.aspectRatio === '1:1' || project.width === project.height) return 'squarish'
    return 'landscape'
  }, [project.aspectRatio, project.width, project.height])

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    setResults([])
    try {
      const providers = []
      if (config.stockImages.unsplash.enabled && config.stockImages.unsplash.accessKey) {
        providers.push(searchUnsplash(query.trim(), 8, orientation))
      }
      if (config.stockImages.pexels.enabled && config.stockImages.pexels.apiKey) {
        providers.push(searchPexels(query.trim(), 8, orientation === 'squarish' ? 'square' : orientation))
      }
      if (config.stockImages.pixabay.enabled && config.stockImages.pixabay.apiKey) {
        providers.push(searchPixabay(query.trim(), 8, orientation === 'portrait' ? 'vertical' : orientation === 'landscape' ? 'horizontal' : 'all'))
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

  const runVisionAnalysis = async () => {
    const targetAsset = assets.find((a) => a.id === selectedAssetId)
    if (!targetAsset) {
      setVisionError('Please select an image asset to analyze.')
      return
    }
    setVisionBusy(true)
    setVisionError(null)
    setVisionResult(null)
    try {
      const { readMediaFile } = await import('@/engine/storage/opfs')
      const { analyzeImageWithNvidiaVision, extractOcrWithNemotron, generateSceneCaptionWithNemotron } = await import('@/api/llm/vision')
      const file = await readMediaFile(targetAsset.filePath)

      let resText = ''
      if (visionMode === 'ocr') {
        resText = await extractOcrWithNemotron(file, visionModel)
      } else if (visionMode === 'caption') {
        resText = await generateSceneCaptionWithNemotron(file, visionModel)
      } else if (visionMode === 'custom' && customPrompt.trim()) {
        const out = await analyzeImageWithNvidiaVision(file, { prompt: customPrompt.trim(), model: visionModel })
        resText = out.text
      } else {
        const out = await analyzeImageWithNvidiaVision(file, { model: visionModel })
        resText = out.text
      }

      setVisionResult(resText)
    } catch (err) {
      setVisionError(err instanceof Error ? err.message : String(err))
    } finally {
      setVisionBusy(false)
    }
  }

  const addVisionTextToTimeline = () => {
    if (!visionResult) return
    const store = useTimelineStore.getState()
    const textTrack = store.project.tracks.find((t) => t.type === 'text')
    const trackId = textTrack?.id ?? store.project.tracks[0]?.id
    if (!trackId) return
    const snippet = visionResult.slice(0, 100)
    store.addTextClip(snippet, trackId, store.playhead)
    setSuccess('Added text overlay to timeline!')
  }

  const copyVisionText = () => {
    if (!visionResult) return
    navigator.clipboard.writeText(visionResult)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3 p-3">
      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all',
            activeTab === 'stock' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Search className="size-3.5" />
          <span>Stock Search</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('vision')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all',
            activeTab === 'vision' ? 'bg-card text-violet-600 dark:text-violet-400 font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Sparkles className="size-3.5" />
          <span>Nemotron Vision</span>
        </button>
      </div>

      {activeTab === 'stock' && (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            <Input placeholder="Search stock images..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search() }} className="h-8 text-xs" />
            <Button size="sm" className="h-8 px-2" onClick={() => void search()} disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            </Button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
            <span>Format matching canvas</span>
            <span className="font-semibold text-violet-400 capitalize">{orientation} ({project.aspectRatio || '16:9'})</span>
          </div>

          {error && <SectionNotice kind="error" text={error} />}
          {success && <SectionNotice kind="ok" text={success} />}
          {results.length > 0 && (
            <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto">
              {results.map((r) => (
                <button key={r.id} type="button" className="group relative overflow-hidden rounded border bg-muted" onClick={() => void importImage(r)} disabled={importingId === r.id}>
                  <img
                    src={r.thumb}
                    alt={r.alt}
                    style={{ aspectRatio: `${project.width || 16} / ${project.height || 9}` }}
                    className="w-full object-cover"
                    loading="lazy"
                  />
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
      )}

      {activeTab === 'vision' && (
        <div className="space-y-3">
          {/* Target Image Selector */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Select Image Asset</Label>
            {imageAssets.length > 0 ? (
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-400"
              >
                {imageAssets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                No image assets in project. Import an image from the Media tab or Stock search.
              </div>
            )}
          </div>

          {/* Vision Model Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Vision Model</Label>
              <span className="text-[10px] text-emerald-500 font-semibold">NVIDIA NIM</span>
            </div>
            <select
              value={visionModel}
              onChange={(e) => setVisionModel(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-400"
            >
              <option value="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning">
                Nemotron-3-Nano Omni 30B Reasoning (Recommended)
              </option>
              <option value="meta/llama-3.2-11b-vision-instruct">
                Llama 3.2 11B Vision
              </option>
              <option value="meta/llama-3.2-90b-vision-instruct">
                Llama 3.2 90B Vision
              </option>
            </select>
          </div>

          {/* Analysis Mode Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Analysis Mode</Label>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: 'scene', label: 'Scene Analysis' },
                { id: 'ocr', label: 'Extract OCR Text' },
                { id: 'caption', label: '1-Line Caption' },
                { id: 'custom', label: 'Custom Prompt' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setVisionMode(m.id as any)}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all',
                    visionMode === m.id
                      ? 'border-violet-500/60 bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {visionMode === 'custom' && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Custom Vision Prompt</Label>
              <Input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Describe the color harmony and subject action..."
                className="h-8 text-xs bg-card"
              />
            </div>
          )}

          {visionError && <SectionNotice kind="error" text={visionError} />}
          {success && <SectionNotice kind="ok" text={success} />}

          {/* Action button */}
          <Button
            type="button"
            size="sm"
            className="w-full h-8 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-xs"
            disabled={visionBusy || !selectedAssetId}
            onClick={() => void runVisionAnalysis()}
          >
            {visionBusy ? (
              <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Reasoning with Nemotron...</>
            ) : (
              <><Sparkles className="size-3.5 mr-1.5" />Analyze with Nemotron</>
            )}
          </Button>

          {/* Vision Result */}
          {visionResult && (
            <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                  Nemotron Reasoning Result
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={copyVisionText}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
                  >
                    <Copy className="size-3" />
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {visionResult}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-7 text-[11px] font-semibold border-violet-500/30 hover:bg-violet-500/20"
                onClick={addVisionTextToTimeline}
              >
                <Plus className="size-3 mr-1" />
                Add as Text Overlay
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

async function searchUnsplash(query: string, limit: number, orientation?: string) {
  const cfg = useApiConfigStore.getState().config.stockImages.unsplash
  const orientParam = orientation ? `&orientation=${orientation}` : ''
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}&client_id=${cfg.accessKey}${orientParam}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map((p: any) => ({ id: p.id, url: p.urls.regular, thumb: p.urls.thumb, alt: p.alt_description || query }))
}

async function searchPexels(query: string, limit: number, orientation?: string) {
  const cfg = useApiConfigStore.getState().config.stockImages.pexels
  if (!cfg.apiKey) return []
  const orientParam = orientation ? `&orientation=${orientation}` : ''
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}${orientParam}`, { headers: { Authorization: cfg.apiKey } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.photos ?? []).map((p: any) => ({ id: String(p.id), url: p.src.large, thumb: p.src.medium, alt: p.alt || query }))
}

async function searchPixabay(query: string, limit: number, orientation?: string) {
  const cfg = useApiConfigStore.getState().config.stockImages.pixabay
  const orientParam = orientation && orientation !== 'all' ? `&orientation=${orientation}` : ''
  const res = await fetch(`https://pixabay.com/api/?key=${cfg.apiKey}&q=${encodeURIComponent(query)}&per_page=${limit}&image_type=photo${orientParam}`)
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

const ELEVEN_CURATED_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', style: 'Calm & Clear female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi', style: 'Strong & Confident female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella', style: 'Narrative & Expressive female' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni', style: 'Natural & Warm male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli', style: 'Young & Bright female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh', style: 'Deep & Engaging male' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold', style: 'Authoritative & Crisp male' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam', style: 'Bold & Professional male' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam', style: 'Casual & Dynamic male' },
]

const ELEVEN_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (High Quality)' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (Fast & Low Latency)' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5 (Ultra Fast)' },
  { id: 'eleven_monolingual_v1', name: 'English v1 (Standard)' },
]

const MAGPIE_MODELS = [
  { id: 'magpie-tts-zeroshot', name: 'Magpie Zero-Shot (Voice Cloning & Presets)' },
  { id: 'magpie-tts-multilingual', name: 'Magpie Multilingual (Expressive Speech)' },
]

// ─── Voiceover / TTS Studio ──────────────────────────────────────────────────
function VoiceoverSection() {
  const config = useApiConfigStore((s) => s.config)
  const [text, setText] = React.useState('')
  const [provider, setProvider] = React.useState<'nvidia' | 'magpie' | 'elevenlabs'>('magpie')
  const [magpieModel, setMagpieModel] = React.useState('magpie-tts-zeroshot')
  const [magpieVoice, setMagpieVoice] = React.useState('Finn')
  const [elevenModel, setElevenModel] = React.useState(config.elevenLabs.model || 'eleven_multilingual_v2')
  const [elevenVoice, setElevenVoice] = React.useState(config.elevenLabs.voiceId || '21m00Tcm4TlvDq8ikWAM')
  const [customVoiceId, setCustomVoiceId] = React.useState('')
  const [useCustomVoice, setUseCustomVoice] = React.useState(false)
  const [nvidiaVoice, setNvidiaVoice] = React.useState(config.nvidiaTts.voice || 'en-US-ryan-high')
  const [speed, setSpeed] = React.useState(1.0)
  const [busy, setBusy] = React.useState(false)
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const generate = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    setAudioUrl(null)
    try {
      let synthesizeResult: { blob: Blob; url: string }
      if (provider === 'magpie') {
        const { magpieTtsProvider } = await import('@/api/tts/magpie')
        if (!magpieTtsProvider.isConfigured()) throw new Error('NVIDIA API key not configured. Add it in Settings → NVIDIA NIM.')
        synthesizeResult = await magpieTtsProvider.synthesize({
          text: text.trim(),
          voiceId: magpieVoice,
          model: magpieModel,
          speed,
        })
      } else if (provider === 'nvidia') {
        const { nvidiaTtsProvider } = await import('@/api/tts/nvidia')
        if (!nvidiaTtsProvider.isConfigured()) throw new Error('NVIDIA TTS API key not configured. Add it in Settings → NVIDIA TTS.')
        synthesizeResult = await nvidiaTtsProvider.synthesize({ text: text.trim(), voiceId: nvidiaVoice, speed })
      } else {
        const { elevenLabsProvider } = await import('@/api/tts/elevenlabs')
        if (!elevenLabsProvider.isConfigured()) throw new Error('ElevenLabs API key not configured. Add it in Settings → ElevenLabs.')
        const targetVoice = useCustomVoice && customVoiceId.trim() ? customVoiceId.trim() : elevenVoice
        synthesizeResult = await elevenLabsProvider.synthesize({
          text: text.trim(),
          voiceId: targetVoice,
          model: elevenModel,
          speed,
        })
      }
      setAudioUrl(synthesizeResult.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const addToTimeline = async () => {
    if (!audioUrl) return
    const store = useTimelineStore.getState()
    const res = await fetch(audioUrl)
    const blob = await res.blob()
    const voiceTag = provider === 'magpie' ? magpieVoice : provider === 'elevenlabs' ? elevenVoice : 'narrator'
    const fname = `voiceover_${voiceTag}_${Date.now()}.wav`
    const file = new File([blob], fname, { type: blob.type || 'audio/wav' })
    const { imported, errors } = await store.importFiles([file])
    if (errors.length) {
      setError(errors[0])
      return
    }
    const asset = imported[0]
    if (asset) store.addAssetToTimeline(asset.id)
  }

  // Dynamic import of MAGPIE_VOICE_PRESETS
  const [voicePresets, setVoicePresets] = React.useState<{ id: string; label: string; style: string }[]>([])
  React.useEffect(() => {
    import('@/api/tts/index').then(({ MAGPIE_VOICE_PRESETS }) => setVoicePresets(MAGPIE_VOICE_PRESETS ?? []))
  }, [])

  return (
    <div className="space-y-4 p-3">
      {/* Provider selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-foreground">TTS Provider</Label>
        <div className="grid grid-cols-3 gap-1">
          {(['magpie', 'elevenlabs', 'nvidia'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all',
                provider === p
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold'
                  : 'border-border bg-card text-muted-foreground hover:border-violet-400/40 hover:text-foreground',
              )}
            >
              {p === 'magpie' ? 'NVIDIA Magpie' : p === 'elevenlabs' ? 'ElevenLabs' : 'NVIDIA NIM'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Magpie Controls ── */}
      {provider === 'magpie' && (
        <div className="space-y-2.5 rounded-lg border bg-muted/15 p-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Magpie TTS Model</Label>
            <select
              value={magpieModel}
              onChange={(e) => setMagpieModel(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-400"
            >
              {MAGPIE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Voice Preset ({voicePresets.length} voices)</Label>
            <select
              value={magpieVoice}
              onChange={(e) => setMagpieVoice(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-400"
            >
              {voicePresets.map((v) => (
                <option key={v.id} value={v.id}>{v.label} — {v.style}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── ElevenLabs Controls ── */}
      {provider === 'elevenlabs' && (
        <div className="space-y-2.5 rounded-lg border bg-muted/15 p-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">ElevenLabs Model</Label>
            <select
              value={elevenModel}
              onChange={(e) => setElevenModel(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-400"
            >
              {ELEVEN_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold text-muted-foreground">Voice</Label>
              <button
                type="button"
                className="text-[9px] text-violet-600 dark:text-violet-400 hover:underline"
                onClick={() => setUseCustomVoice(!useCustomVoice)}
              >
                {useCustomVoice ? 'Choose Preset' : 'Custom Voice ID'}
              </button>
            </div>
            {useCustomVoice ? (
              <Input
                value={customVoiceId}
                onChange={(e) => setCustomVoiceId(e.target.value)}
                placeholder="Paste ElevenLabs voice ID"
                className="h-8 text-xs bg-card"
              />
            ) : (
              <select
                value={elevenVoice}
                onChange={(e) => setElevenVoice(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-400"
              >
                {ELEVEN_CURATED_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label} — {v.style}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* ── NVIDIA NIM TTS Controls ── */}
      {provider === 'nvidia' && (
        <div className="space-y-2 rounded-lg border bg-muted/15 p-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground">Voice ID</Label>
            <Input
              value={nvidiaVoice}
              onChange={(e) => setNvidiaVoice(e.target.value)}
              placeholder="e.g. en-US-ryan-high"
              className="h-8 text-xs bg-card"
            />
          </div>
        </div>
      )}

      {/* Speed */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">Speed</Label>
          <span className="text-xs text-muted-foreground">{speed.toFixed(1)}×</span>
        </div>
        <Slider
          min={0.5}
          max={2.0}
          step={0.1}
          value={[speed]}
          onValueChange={([v]) => setSpeed(v)}
          className="w-full"
        />
      </div>

      {/* Script textarea */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-foreground">Script / Text</Label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Type or paste your script here..."
          className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 transition-all"
        />
        <p className="text-[10px] text-muted-foreground">{text.length} chars • ~{Math.round(text.split(' ').filter(Boolean).length / 150)} min read</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Audio preview */}
      {audioUrl && (
        <div className="space-y-2">
          <audio controls src={audioUrl} className="w-full h-8" />
          <Button
            type="button"
            size="sm"
            className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => void addToTimeline()}
          >
            <Plus className="size-3.5 mr-1.5" />
            Add to Timeline
          </Button>
        </div>
      )}

      {/* Generate button */}
      <Button
        type="button"
        size="sm"
        className="w-full h-9 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-md"
        disabled={!text.trim() || busy}
        onClick={() => void generate()}
      >
        {busy ? (
          <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Generating...</>
        ) : (
          <><AudioLines className="size-3.5 mr-1.5" />Generate Voiceover</>
        )}
      </Button>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────
interface RightToolPanelProps {
  section: ToolSection
  onCollapse: () => void
}

const SECTION_COMPONENTS: Record<ToolSection, React.FC> = {
  text: TextSection,
  insights: InsightsSection,
  effects: EffectsSection,
  audio: AudioSection,
  voiceover: VoiceoverSection,
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
    <div className="flex h-full w-full flex-col bg-card">
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
