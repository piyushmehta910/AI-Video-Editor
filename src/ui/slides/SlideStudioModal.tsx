import * as React from 'react'
import {
  Presentation,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Play,
  RotateCcw,
  X,
  Star,
  LayoutGrid,
  Zap,
  Columns2,
  Quote,
  ListChecks,
  Palette,
  FileText,
  Loader2,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowDownToLine,
  Wand2,
  Globe,
  Search,
  ExternalLink,
  Link2,
  Cpu,
  FileSearch,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import {
  type SlideDeck,
  type Slide,
  type SlideTheme,
  type SlideFont,
  type SlideAnimation,
  type SlideLayout,
  SLIDE_THEMES_META,
  SLIDE_FONTS_META,
  SLIDE_ANIMATIONS_META,
  generateSlides,
  renderSlideHtml,
  renderSlidePng,
} from '@/api/llm/slides'
import { generateInductiveSlideContext } from '@/api/llm/slideContext'
import {
  isFirecrawlConfigured,
  firecrawlSearch,
  firecrawlScrape,
  type WebSearchResult,
} from '@/api/research/firecrawl'
import { ALL_LLM_MODELS } from '@/api/llm/models'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface SlideStudioModalProps {
  isOpen: boolean
  onClose: () => void
  initialDeck?: SlideDeck | null
  onDeckChange?: (deck: SlideDeck) => void
}

const TEMPLATE_ARCHETYPES = [
  {
    id: 'Startup Pitch Deck',
    title: 'Startup Pitch Deck',
    desc: 'Hook, Problem, Solution, Traction & Team',
    topic: 'Next-Gen AI Video Platform - Seed Pitch & Investment Deck',
    count: 4,
    theme: 'pitch_dark' as SlideTheme,
    font: 'sans' as SlideFont,
    badge: 'INVESTOR',
  },
  {
    id: 'Product Launch',
    title: 'Product Launch Keynote',
    desc: 'Cinematic reveal, flagship features & roadmap',
    topic: 'ClipForge 2.0 Launch: Browser-Native AI Video Revolution',
    count: 5,
    theme: 'apple_minimal' as SlideTheme,
    font: 'sans' as SlideFont,
    badge: 'KEYNOTE',
  },
  {
    id: 'Technical Deep Dive',
    title: 'Technical Architecture',
    desc: 'WebGPU shaders, ONNX pipelines & latency benchmarks',
    topic: 'High-Performance WebGPU Neural Video Rendering Engine',
    count: 4,
    theme: 'cyber_neon' as SlideTheme,
    font: 'mono' as SlideFont,
    badge: 'ENG DEEP DIVE',
  },
  {
    id: 'Executive Report',
    title: 'Quarterly Executive Review',
    desc: 'Key growth metrics, financial KPIs & takeaways',
    topic: 'Q3 Business Performance: Growth Metrics & Strategic Expansion',
    count: 4,
    theme: 'clean_studio' as SlideTheme,
    font: 'serif' as SlideFont,
    badge: 'EXECUTIVE',
  },
  {
    id: 'Educational Masterclass',
    title: 'Educational Explainer',
    desc: 'Clear concept breakdowns, step guides & case study',
    topic: 'Mastering AI Video Editing: From Prompt to 4K Export',
    count: 4,
    theme: 'sunset_warm' as SlideTheme,
    font: 'display' as SlideFont,
    badge: 'COURSE',
  },
]

const LAYOUT_OPTIONS: Array<{
  id: SlideLayout
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
}> = [
  { id: 'hero', label: 'Hero Headline', icon: Star, desc: 'Bold single-message title with category chip' },
  { id: 'cards', label: 'Feature Cards', icon: LayoutGrid, desc: '2 to 3 modular glass cards with tags' },
  { id: 'big_stat', label: 'Big Stat Callout', icon: Zap, desc: 'Giant numeric metric with descriptive label' },
  { id: 'split', label: 'Split 2-Column', icon: Columns2, desc: 'Balanced side-by-side comparative layout' },
  { id: 'quote', label: 'Quote / Takeaway', icon: Quote, desc: 'Inspiring pull quote with speaker credit' },
  { id: 'checklist', label: 'Action Checklist', icon: ListChecks, desc: 'Lead-bulleted key takeaways or steps' },
]

export function SlideStudioModal({
  isOpen,
  onClose,
  initialDeck,
  onDeckChange,
}: SlideStudioModalProps) {
  const project = useTimelineStore((s) => s.project)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const select = useTimelineStore((s) => s.select)
  const playhead = useTimelineStore((s) => s.playhead)

  // Active Deck State
  const [deck, setDeck] = React.useState<SlideDeck | null>(() => initialDeck ?? null)
  const [currentSlideIdx, setCurrentSlideIdx] = React.useState(0)
  const [slideDuration, setSlideDuration] = React.useState(5)
  const [activeInspectorTab, setActiveInspectorTab] = React.useState<
    'content' | 'layout' | 'design' | 'research' | 'templates' | 'notes'
  >('content')

  // Real-Time Web Research State
  const apiConfig = useApiConfigStore((s) => s.config)
  const firecrawlAvailable = isFirecrawlConfigured()
  const [useWebResearch, setUseWebResearch] = React.useState(firecrawlAvailable)
  const [researchQuery, setResearchQuery] = React.useState('')
  const [scrapeUrl, setScrapeUrl] = React.useState('')
  const [isSearchingWeb, setIsSearchingWeb] = React.useState(false)
  const [researchResults, setResearchResults] = React.useState<WebSearchResult[]>([])
  const [selectedResearchIndices, setSelectedResearchIndices] = React.useState<number[]>([])

  // AI Model Selection
  const [selectedModel, setSelectedModel] = React.useState<string>(() => {
    const pref = apiConfig.preferences.preferredAiProvider || 'nvidia-nim'
    if (pref === 'nvidia-nim' || pref === 'nvidiaNim') return apiConfig.nvidiaNim.model || 'meta/llama-3.3-70b-instruct'
    if (pref === 'opencode-zen' || pref === 'opencodeZen') return apiConfig.opencodeZen.model || 'deepseek-v4-flash-free'
    return apiConfig.openRouter.model || 'nvidia/nemotron-3.5-lightning:free'
  })

  // Generator & Inductive State
  const [topicPrompt, setTopicPrompt] = React.useState('')
  const [slideCount, setSlideCount] = React.useState(4)
  const [selectedTheme, setSelectedTheme] = React.useState<SlideTheme>('pitch_dark')
  const [selectedFont, setSelectedFont] = React.useState<SlideFont>('sans')
  const [selectedAnimation, setSelectedAnimation] = React.useState<SlideAnimation>('slide_up')
  const [selectedArchetype, setSelectedArchetype] = React.useState('Startup Pitch Deck')

  // Execution & Progress State
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isAddingTimeline, setIsAddingTimeline] = React.useState(false)
  const [isAddingCurrent, setIsAddingCurrent] = React.useState(false)
  const [separateSlideTrack, setSeparateSlideTrack] = React.useState(true)
  const [isInducing, setIsInducing] = React.useState(false)
  const [progressMsg, setProgressMsg] = React.useState('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)
  const [isPlayingShow, setIsPlayingShow] = React.useState(false)
  const [previewKey, setPreviewKey] = React.useState(0)

  // Sync initial deck
  React.useEffect(() => {
    if (initialDeck) {
      setDeck(initialDeck)
      setSelectedTheme(initialDeck.theme)
      setSelectedFont(initialDeck.font)
      setSelectedAnimation(initialDeck.animation)
      if (initialDeck.sources?.length) {
        setResearchResults(initialDeck.sources)
        setSelectedResearchIndices(initialDeck.sources.map((_, i) => i))
      }
    }
  }, [initialDeck])

  // Sync deck updates to parent
  React.useEffect(() => {
    if (deck && onDeckChange) {
      onDeckChange(deck)
    }
  }, [deck, onDeckChange])

  // Auto slideshow preview player
  React.useEffect(() => {
    if (!isPlayingShow || !deck || deck.slides.length === 0) return
    const interval = setInterval(() => {
      setCurrentSlideIdx((prev) => (prev + 1) % deck.slides.length)
      setPreviewKey((k) => k + 1)
    }, slideDuration * 1000)
    return () => clearInterval(interval)
  }, [isPlayingShow, deck, slideDuration])

  if (!isOpen) return null

  const currentSlide =
    deck && deck.slides.length > 0 ? deck.slides[currentSlideIdx] || deck.slides[0] : null

  // Live HTML for preview
  const currentSlideHtml =
    currentSlide && deck
      ? renderSlideHtml(
          currentSlide,
          currentSlideIdx + 1,
          deck.slides.length,
          currentSlide.theme || deck.theme,
          currentSlide.font || deck.font,
          currentSlide.animation || deck.animation,
        )
      : ''

  // ── Real-Time Web Search Handlers ──
  const handlePerformWebSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch || researchQuery || topicPrompt).trim()
    if (!q) {
      setErrorMsg('Please enter a research topic or query')
      return
    }
    if (!firecrawlAvailable) {
      setErrorMsg('Firecrawl API key is not configured. Go to Settings → Web Research.')
      return
    }

    setIsSearchingWeb(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    setProgressMsg(`Searching real-time web facts for "${q}" via Firecrawl...`)
    try {
      const hits = await firecrawlSearch(q, 5)
      setResearchResults(hits)
      setSelectedResearchIndices(hits.map((_, i) => i))
      setSuccessMsg(`Found ${hits.length} live web sources via Firecrawl!`)
      if (!topicPrompt) setTopicPrompt(q)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearchingWeb(false)
      setProgressMsg('')
    }
  }

  const handlePerformScrapeUrl = async () => {
    const url = scrapeUrl.trim()
    if (!url) {
      setErrorMsg('Please enter a valid website URL to scrape')
      return
    }
    if (!firecrawlAvailable) {
      setErrorMsg('Firecrawl API key is not configured. Go to Settings → Web Research.')
      return
    }

    setIsSearchingWeb(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    setProgressMsg(`Extracting markdown content from ${url} via Firecrawl...`)
    try {
      const hit = await firecrawlScrape(url)
      setResearchResults((prev) => [hit, ...prev])
      setSelectedResearchIndices((prev) => [0, ...prev.map((i) => i + 1)])
      setSuccessMsg(`Extracted page: "${hit.title}" via Firecrawl!`)
      if (!topicPrompt) setTopicPrompt(hit.title)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearchingWeb(false)
      setProgressMsg('')
    }
  }

  // ── Generation Handler ──
  const handleGenerateDeck = async (
    overrideTopic?: string,
    overrideCount?: number,
    overrideTheme?: SlideTheme,
    overrideFont?: SlideFont,
  ) => {
    const finalTopic = (overrideTopic || topicPrompt).trim()
    if (!finalTopic || isGenerating) return

    setIsGenerating(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    setProgressMsg(
      useWebResearch && firecrawlAvailable
        ? 'Firecrawl is researching live facts & AI is architecting slides...'
        : 'AI is architecting deck narrative, structure & typography...',
    )

    try {
      const activeSources = researchResults.filter((_, idx) =>
        selectedResearchIndices.includes(idx),
      )

      const generated = await generateSlides({
        topic: finalTopic,
        count: overrideCount || slideCount,
        theme: overrideTheme || selectedTheme,
        font: overrideFont || selectedFont,
        animation: selectedAnimation,
        layoutArchetype: selectedArchetype,
        model: selectedModel,
        useWebResearch: useWebResearch,
        researchData: activeSources.length > 0 ? activeSources : undefined,
        sourceUrl: scrapeUrl.trim() || undefined,
        onResearchProgress: (msg) => setProgressMsg(msg),
      })

      setDeck(generated)
      if (generated.sources?.length) {
        setResearchResults(generated.sources)
        setSelectedResearchIndices(generated.sources.map((_, i) => i))
      }
      setCurrentSlideIdx(0)
      setSuccessMsg(`Generated ${generated.slides.length}-slide deck for "${generated.title}"!`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsGenerating(false)
      setProgressMsg('')
    }
  }

  // ── Inductive Timeline Reasoning ──
  const handleInductiveContext = async () => {
    setIsInducing(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const ctx = await generateInductiveSlideContext(topicPrompt.trim() || undefined)
      setTopicPrompt(ctx.topicThesis)
      setSlideCount(ctx.recommendedSlideCount)
      setSuccessMsg(`Inferred thesis: "${ctx.topicThesis}" (${ctx.recommendedSlideCount} slides)`)
      await handleGenerateDeck(ctx.topicThesis, ctx.recommendedSlideCount)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsInducing(false)
    }
  }

  // ── Update Current Slide ──
  const updateCurrentSlide = (patch: Partial<Slide>) => {
    if (!deck || !currentSlide) return
    const updatedSlides = [...deck.slides]
    updatedSlides[currentSlideIdx] = {
      ...updatedSlides[currentSlideIdx],
      ...patch,
    }
    setDeck({ ...deck, slides: updatedSlides })
    setPreviewKey((k) => k + 1)
  }

  // ── Slide Operations ──
  const handleAddSlide = () => {
    if (!deck) return
    const newSlide: Slide = {
      title: 'New Slide Title',
      subtitle: 'KEY HIGHLIGHT',
      layout: 'hero',
      bullets: ['First key insight or take-away point', 'Second supporting piece of evidence'],
      notes: 'Presenter explanation note for this slide.',
    }
    const updatedSlides = [...deck.slides, newSlide]
    setDeck({ ...deck, slides: updatedSlides })
    setCurrentSlideIdx(updatedSlides.length - 1)
  }

  const handleDuplicateSlide = () => {
    if (!deck || !currentSlide) return
    const duplicated: Slide = {
      ...JSON.parse(JSON.stringify(currentSlide)),
      title: `${currentSlide.title} (Copy)`,
    }
    const updatedSlides = [
      ...deck.slides.slice(0, currentSlideIdx + 1),
      duplicated,
      ...deck.slides.slice(currentSlideIdx + 1),
    ]
    setDeck({ ...deck, slides: updatedSlides })
    setCurrentSlideIdx(currentSlideIdx + 1)
  }

  const handleDeleteSlide = (idx: number) => {
    if (!deck || deck.slides.length <= 1) return
    const updatedSlides = deck.slides.filter((_, i) => i !== idx)
    setDeck({ ...deck, slides: updatedSlides })
    setCurrentSlideIdx((prev) => Math.min(prev, updatedSlides.length - 1))
  }

  const moveSlide = (direction: 'left' | 'right') => {
    if (!deck) return
    const targetIdx = direction === 'left' ? currentSlideIdx - 1 : currentSlideIdx + 1
    if (targetIdx < 0 || targetIdx >= deck.slides.length) return
    const updatedSlides = [...deck.slides]
    const temp = updatedSlides[currentSlideIdx]
    updatedSlides[currentSlideIdx] = updatedSlides[targetIdx]
    updatedSlides[targetIdx] = temp
    setDeck({ ...deck, slides: updatedSlides })
    setCurrentSlideIdx(targetIdx)
  }

  // ── Add Current Slide at Playhead ──
  const handleAddCurrentSlideToTimeline = async () => {
    if (!deck || !currentSlide || isAddingCurrent) return
    setIsAddingCurrent(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const slideW = project.width || 1280
    const slideH = project.height || 720

    try {
      const blob = await renderSlidePng(
        currentSlide,
        currentSlideIdx + 1,
        deck.slides.length,
        currentSlide.theme || deck.theme,
        slideW,
        slideH,
        currentSlide.font || deck.font,
        currentSlide.animation || deck.animation,
      )
      const file = new File([blob], `slide-${currentSlideIdx + 1}-${Date.now()}.png`, {
        type: 'image/png',
      })
      const { imported } = await importFiles([file])
      if (imported.length) {
        const startBase = playhead ?? 0
        const targetTrack = separateSlideTrack
          ? (project.tracks.find((t) => t.type === 'video' && (t.name.toLowerCase().includes('slide') || t.name.toLowerCase().includes('presentation'))) ||
             project.tracks.find((t) => t.type === 'video' && t.clips.every((c) => c.clipType === 'slide')) ||
             project.tracks.find((t) => t.type === 'video'))
          : project.tracks.find((t) => t.type === 'video')

        if (targetTrack) {
          const newClip = addClip(imported[0].id, targetTrack.id, startBase)
          if (newClip) {
            updateClip(newClip.id, {
              duration: slideDuration,
              sourceEnd: slideDuration,
              clipType: 'slide',
              name: `Slide ${currentSlideIdx + 1}: ${currentSlide.title}`,
            })
            select([newClip.id])
          }
        }
        setSuccessMsg(
          `Inserted Slide #${currentSlideIdx + 1} ("${currentSlide.title}") onto ${separateSlideTrack ? 'dedicated slide' : 'main video'} track at ${startBase.toFixed(1)}s!`,
        )
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsAddingCurrent(false)
    }
  }

  // ── Add All Slides to Timeline ──
  const handleAddAllToTimeline = async () => {
    if (!deck || isAddingTimeline) return
    setIsAddingTimeline(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const slideW = project.width || 1280
    const slideH = project.height || 720

    try {
      const files: File[] = []
      for (let i = 0; i < deck.slides.length; i++) {
        const slide = deck.slides[i]
        const blob = await renderSlidePng(
          slide,
          i + 1,
          deck.slides.length,
          slide.theme || deck.theme,
          slideW,
          slideH,
          slide.font || deck.font,
          slide.animation || deck.animation,
        )
        files.push(new File([blob], `slide-${i + 1}-${Date.now()}.png`, { type: 'image/png' }))
      }

      const { imported } = await importFiles(files)
      if (imported.length) {
        const targetTrack = separateSlideTrack
          ? (project.tracks.find((t) => t.type === 'video' && (t.name.toLowerCase().includes('slide') || t.name.toLowerCase().includes('presentation'))) ||
             project.tracks.find((t) => t.type === 'video' && t.clips.every((c) => c.clipType === 'slide')) ||
             project.tracks.find((t) => t.type === 'video'))
          : project.tracks.find((t) => t.type === 'video')

        if (targetTrack) {
          const startBase = playhead ?? 0
          imported.forEach((asset, idx) => {
            const newClip = addClip(asset.id, targetTrack.id, startBase + idx * slideDuration)
            if (newClip) {
              updateClip(newClip.id, {
                duration: slideDuration,
                sourceEnd: slideDuration,
                clipType: 'slide',
                name: `Slide ${idx + 1}: ${deck.slides[idx]?.title || 'Presentation'}`,
              })
            }
          })
        }
        setSuccessMsg(
          `Successfully staged ${imported.length} presentation slides (${slideW}×${slideH}) onto ${separateSlideTrack ? 'dedicated slide' : 'main video'} track!`,
        )
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsAddingTimeline(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[94vh] w-[98vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* ── Top Header Toolbar ── */}
        <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/25 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25">
              <Presentation className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-foreground">
                  Slide Presentation Studio
                </h2>
                {deck && (
                  <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-violet-300">
                    {deck.title} ({deck.slides.length} slides)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                AI presentation deck generation, kinetic typography, live visual editing & 1-click timeline staging
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deck && (
              <>
                <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs">
                  <Clock className="size-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Slide Duration:</span>
                  <Select
                    value={String(slideDuration)}
                    onValueChange={(v) => setSlideDuration(Number(v))}
                  >
                    <SelectTrigger className="h-6 w-16 border-0 bg-transparent p-0 text-xs font-mono font-bold text-violet-400 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 sec</SelectItem>
                      <SelectItem value="3">3 sec</SelectItem>
                      <SelectItem value="5">5 sec</SelectItem>
                      <SelectItem value="8">8 sec</SelectItem>
                      <SelectItem value="10">10 sec</SelectItem>
                      <SelectItem value="15">15 sec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Track Target Toggle */}
                <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSeparateSlideTrack(true)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-semibold transition',
                      separateSlideTrack
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    title="Place slides on a separate dedicated Presentation track"
                  >
                    📊 Separate Slide Track
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeparateSlideTrack(false)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-semibold transition',
                      !separateSlideTrack
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    title="Place slides directly onto main video track"
                  >
                    🎬 Main Video
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-violet-500/40 text-violet-300 hover:bg-violet-500/10 text-xs font-semibold"
                  onClick={() => void handleAddCurrentSlideToTimeline()}
                  disabled={isAddingCurrent}
                  title="Insert only the currently selected slide at the playhead"
                >
                  {isAddingCurrent ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="size-3.5" />
                  )}
                  <span>Drop Slide #{currentSlideIdx + 1}</span>
                </Button>

                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-600/30"
                  onClick={() => void handleAddAllToTimeline()}
                  disabled={isAddingTimeline}
                >
                  {isAddingTimeline ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  <span>
                    {isAddingTimeline ? 'Staging...' : `Add All ${deck.slides.length} Slides to Timeline`}
                  </span>
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              title="Close Presentation Studio"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* ── Main Studio Workspace ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left/Center: Live 16:9 Canvas + Filmstrip Carousel ── */}
          <div className="flex flex-1 flex-col border-r bg-zinc-950/70 overflow-hidden">
            {/* Viewport Control Strip */}
            <div className="flex items-center justify-between border-b bg-card/40 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Live Presentation Viewport</span>
                <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                  {project.width || 1280} × {project.height || 720}
                </span>
                {deck && (
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Slide {currentSlideIdx + 1} of {deck.slides.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  title="Replay slide entry animation"
                >
                  <RotateCcw className="size-3" />
                  <span>Replay Animation</span>
                </Button>

                <Button
                  size="sm"
                  variant={isPlayingShow ? 'default' : 'outline'}
                  className={cn('h-7 text-xs gap-1', isPlayingShow && 'bg-violet-600 text-white')}
                  onClick={() => setIsPlayingShow(!isPlayingShow)}
                  title="Toggle continuous slideshow preview"
                >
                  <Play className="size-3" />
                  <span>{isPlayingShow ? 'Pause Show' : 'Play Slideshow'}</span>
                </Button>
              </div>
            </div>

            {/* ── High-Resolution Interactive Presentation Stage ── */}
            <div className="flex-1 flex items-center justify-center p-6 bg-black/60 overflow-hidden relative">
              {deck && currentSlide ? (
                <div
                  className="relative w-full max-w-4xl max-h-full rounded-xl border border-border/80 overflow-hidden shadow-2xl bg-black transition-all"
                  style={{ aspectRatio: `${project.width || 1280} / ${project.height || 720}` }}
                >
                  <iframe
                    key={previewKey}
                    title="Slide Live Stage"
                    srcDoc={currentSlideHtml}
                    className="size-full border-0 pointer-events-none select-none"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-md">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
                    <Presentation className="size-8" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">No Presentation Loaded</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pick a template from the right panel or type any prompt to generate a cinematic presentation deck with AI.
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                    {TEMPLATE_ARCHETYPES.slice(0, 3).map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold text-violet-300 hover:bg-violet-500/25 transition"
                        onClick={() => {
                          setTopicPrompt(tmpl.topic)
                          setSelectedTheme(tmpl.theme)
                          setSelectedFont(tmpl.font)
                          void handleGenerateDeck(tmpl.topic, tmpl.count, tmpl.theme, tmpl.font)
                        }}
                      >
                        {tmpl.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Bottom Filmstrip Thumbnail Carousel ── */}
            {deck && (
              <div className="border-t bg-card/60 p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground">Deck Filmstrip ({deck.slides.length} slides)</span>
                    <span className="text-[10px] text-muted-foreground">Click to edit · Reorder or stage</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1"
                      onClick={() => moveSlide('left')}
                      disabled={currentSlideIdx === 0}
                      title="Move slide earlier"
                    >
                      <ChevronLeft className="size-3" />
                      <span>Move Left</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1"
                      onClick={() => moveSlide('right')}
                      disabled={currentSlideIdx === deck.slides.length - 1}
                      title="Move slide later"
                    >
                      <span>Move Right</span>
                      <ChevronRight className="size-3" />
                    </Button>
                    <div className="h-4 w-px bg-border/80 mx-1" />
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={handleAddSlide}>
                      <Plus className="size-3" />
                      <span>Add Slide</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={handleDuplicateSlide}>
                      <Copy className="size-3" />
                      <span>Duplicate</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteSlide(currentSlideIdx)}
                      disabled={deck.slides.length <= 1}
                    >
                      <Trash2 className="size-3" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                {/* Slides Thumbnail Strip */}
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {deck.slides.map((slide, idx) => {
                    const isSelected = idx === currentSlideIdx
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setCurrentSlideIdx(idx)
                          setPreviewKey((k) => k + 1)
                        }}
                        className={cn(
                          'group relative flex flex-col justify-between w-36 h-20 rounded-lg border p-2 cursor-pointer transition-all shrink-0',
                          isSelected
                            ? 'border-violet-500 bg-violet-500/20 ring-2 ring-violet-500/60 shadow-md'
                            : 'border-border/60 bg-muted/40 hover:border-violet-500/50 hover:bg-muted/60',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-black/70 px-1 font-mono text-[9px] font-bold text-white">
                            #{idx + 1}
                          </span>
                          <span className="rounded bg-violet-500/30 px-1 text-[8px] font-bold text-violet-200 uppercase">
                            {slide.layout || 'Hero'}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold text-foreground line-clamp-1 mt-1">
                          {slide.title}
                        </span>

                        <span className="text-[8px] text-muted-foreground line-clamp-1">
                          {slide.subtitle || `${slide.bullets.length} bullet points`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Tabbed Inspector & AI Generator Studio ── */}
          <div className="flex w-[480px] flex-col overflow-hidden bg-card">
            {/* Inspector Tab Switcher */}
            <div className="flex border-b bg-muted/30 p-1 gap-1 overflow-x-auto">
              {[
                { id: 'content' as const, label: 'Content', icon: FileText },
                { id: 'layout' as const, label: 'Layouts', icon: LayoutGrid },
                { id: 'design' as const, label: 'Themes', icon: Palette },
                { id: 'research' as const, label: 'Web Research', icon: Globe },
                { id: 'templates' as const, label: 'Templates & AI', icon: Sparkles },
                { id: 'notes' as const, label: 'Notes', icon: Brain },
              ].map(({ id, label, icon: TabIcon }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'flex-1 min-w-[70px] flex items-center justify-center gap-1 rounded-md py-1.5 text-center text-[10px] font-bold transition',
                    activeInspectorTab === id
                      ? 'bg-card text-violet-600 dark:text-violet-300 shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setActiveInspectorTab(id)}
                >
                  <TabIcon className="size-3 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Inspector Tab Content Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ═══════════ TAB 1: EDIT SLIDE CONTENT ═══════════ */}
              {activeInspectorTab === 'content' && (
                <div className="space-y-3.5">
                  {currentSlide ? (
                    <>
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground">
                            Slide #{currentSlideIdx + 1} Content
                          </span>
                          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-violet-300">
                            {currentSlide.layout || 'Hero'}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-violet-400"
                          onClick={() => setPreviewKey((k) => k + 1)}
                        >
                          <RotateCcw className="size-2.5 mr-1" /> Replay
                        </Button>
                      </div>

                      {/* Title & Subtitle */}
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Headline / Title</Label>
                          <Input
                            value={currentSlide.title}
                            onChange={(e) => updateCurrentSlide({ title: e.target.value })}
                            className="text-xs bg-muted/20 font-semibold"
                            placeholder="Enter slide headline..."
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Subtitle / Category Tag</Label>
                          <Input
                            value={currentSlide.subtitle || ''}
                            onChange={(e) => updateCurrentSlide({ subtitle: e.target.value })}
                            className="text-xs bg-muted/20"
                            placeholder="e.g. KEY METRIC or MARKET ANALYSIS"
                          />
                        </div>
                      </div>

                      {/* Bullets */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bullet Points (Bold Keywords: **word**)</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[10px] px-1 text-violet-400"
                            onClick={() =>
                              updateCurrentSlide({
                                bullets: [...currentSlide.bullets, 'New bullet point insight'],
                              })
                            }
                          >
                            <Plus className="size-2.5 mr-0.5" /> Add Bullet
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          {currentSlide.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-1.5">
                              <span className="font-mono text-[9px] text-muted-foreground w-3 text-right shrink-0">
                                {bIdx + 1}.
                              </span>
                              <Input
                                value={bullet}
                                onChange={(e) => {
                                  const updated = [...currentSlide.bullets]
                                  updated[bIdx] = e.target.value
                                  updateCurrentSlide({ bullets: updated })
                                }}
                                className="text-xs bg-muted/20 flex-1"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => {
                                  const updated = currentSlide.bullets.filter((_, i) => i !== bIdx)
                                  updateCurrentSlide({ bullets: updated })
                                }}
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Big Stat Layout Inputs */}
                      {currentSlide.layout === 'big_stat' && (
                        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-muted/20 p-2.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Stat Number / Metric</Label>
                            <Input
                              value={currentSlide.statNumber || ''}
                              onChange={(e) => updateCurrentSlide({ statNumber: e.target.value })}
                              placeholder="e.g. +140% or 10x"
                              className="text-xs font-mono font-bold text-violet-400 bg-background"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Stat Description</Label>
                            <Input
                              value={currentSlide.statLabel || ''}
                              onChange={(e) => updateCurrentSlide({ statLabel: e.target.value })}
                              placeholder="e.g. YoY Growth & Throughput"
                              className="text-xs bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {/* Quote Layout Inputs */}
                      {currentSlide.layout === 'quote' && (
                        <div className="space-y-1 rounded-xl border border-border/80 bg-muted/20 p-2.5">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Quote Author / Citation</Label>
                          <Input
                            value={currentSlide.quoteAuthor || ''}
                            onChange={(e) => updateCurrentSlide({ quoteAuthor: e.target.value })}
                            placeholder="e.g. Satya Nadella — CEO, Microsoft"
                            className="text-xs bg-background"
                          />
                        </div>
                      )}

                      {/* Feature Cards Layout Inputs */}
                      {currentSlide.layout === 'cards' && (
                        <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-2.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground uppercase font-bold">Modular Cards</Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 text-[10px] text-violet-400"
                              onClick={() => {
                                const currentCards = currentSlide.cards || []
                                updateCurrentSlide({
                                  cards: [
                                    ...currentCards,
                                    {
                                      tag: `STEP ${currentCards.length + 1}`,
                                      title: 'New Feature Card',
                                      description: 'Explain capability breakdown here.',
                                    },
                                  ],
                                })
                              }}
                            >
                              <Plus className="size-2.5 mr-0.5" /> Add Card
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {(currentSlide.cards || []).map((card, cIdx) => (
                              <div key={cIdx} className="space-y-1.5 rounded-lg border bg-background/80 p-2 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    value={card.tag || ''}
                                    onChange={(e) => {
                                      const cards = [...(currentSlide.cards || [])]
                                      cards[cIdx] = { ...cards[cIdx], tag: e.target.value }
                                      updateCurrentSlide({ cards })
                                    }}
                                    placeholder="TAG"
                                    className="h-6 w-20 text-[10px] font-mono uppercase bg-muted/30"
                                  />
                                  <Input
                                    value={card.title}
                                    onChange={(e) => {
                                      const cards = [...(currentSlide.cards || [])]
                                      cards[cIdx] = { ...cards[cIdx], title: e.target.value }
                                      updateCurrentSlide({ cards })
                                    }}
                                    placeholder="Card Title"
                                    className="h-6 flex-1 text-xs font-bold bg-muted/30"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="size-6 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      const cards = (currentSlide.cards || []).filter((_, i) => i !== cIdx)
                                      updateCurrentSlide({ cards })
                                    }}
                                  >
                                    <X className="size-3" />
                                  </Button>
                                </div>
                                <Textarea
                                  value={card.description}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                    const cards = [...(currentSlide.cards || [])]
                                    cards[cIdx] = { ...cards[cIdx], description: e.target.value }
                                    updateCurrentSlide({ cards })
                                  }}
                                  placeholder="Card description..."
                                  rows={2}
                                  className="text-xs bg-muted/30"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No presentation loaded. Select a template in Templates tab.
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════ TAB 2: SLIDE LAYOUT ARCHETYPES ═══════════ */}
              {activeInspectorTab === 'layout' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Slide Layout Archetype</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Change the structural template of Slide #{currentSlideIdx + 1}.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {LAYOUT_OPTIONS.map((layout) => {
                      const LayoutIcon = layout.icon
                      const isCurrent = currentSlide?.layout === layout.id
                      return (
                        <button
                          key={layout.id}
                          type="button"
                          onClick={() => updateCurrentSlide({ layout: layout.id })}
                          className={cn(
                            'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                            isCurrent
                              ? 'border-violet-500 bg-violet-500/15 ring-2 ring-violet-500/50 shadow-xs'
                              : 'border-border/70 bg-muted/20 hover:border-violet-500/40 hover:bg-muted/40',
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <LayoutIcon className={cn('size-4', isCurrent ? 'text-violet-400' : 'text-muted-foreground')} />
                            <span className="text-xs font-bold text-foreground">{layout.label}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-tight">{layout.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 3: THEMES & TYPOGRAPHY ═══════════ */}
              {activeInspectorTab === 'design' && (
                <div className="space-y-4">
                  {/* Theme Presets */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Deck Color Theme</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(SLIDE_THEMES_META) as SlideTheme[]).map((thm) => {
                        const meta = SLIDE_THEMES_META[thm]
                        const isSelected = (currentSlide?.theme || deck?.theme) === thm
                        return (
                          <button
                            key={thm}
                            type="button"
                            onClick={() => {
                              setSelectedTheme(thm)
                              if (deck) {
                                setDeck({ ...deck, theme: thm })
                                const updated = deck.slides.map((s) => ({ ...s, theme: thm }))
                                setDeck({ ...deck, theme: thm, slides: updated })
                              }
                            }}
                            className={cn(
                              'flex flex-col items-start p-2.5 rounded-xl border text-left transition-all',
                              isSelected
                                ? 'border-violet-500 bg-violet-500/15 ring-2 ring-violet-500/50 shadow-xs'
                                : 'border-border/70 bg-muted/20 hover:border-violet-500/40',
                            )}
                          >
                            <div className="flex items-center gap-2 w-full mb-1">
                              <span
                                className="size-3.5 rounded-full border shrink-0"
                                style={{ backgroundColor: meta.accent }}
                              />
                              <span className="text-xs font-bold text-foreground truncate">{meta.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                              {meta.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Typography Font */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-bold">Typography System</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(SLIDE_FONTS_META) as SlideFont[]).map((fnt) => {
                        const meta = SLIDE_FONTS_META[fnt]
                        const isSelected = (currentSlide?.font || deck?.font) === fnt
                        return (
                          <button
                            key={fnt}
                            type="button"
                            onClick={() => {
                              setSelectedFont(fnt)
                              if (deck) {
                                setDeck({ ...deck, font: fnt })
                                const updated = deck.slides.map((s) => ({ ...s, font: fnt }))
                                setDeck({ ...deck, font: fnt, slides: updated })
                              }
                            }}
                            className={cn(
                              'flex flex-col items-start p-2.5 rounded-xl border text-left transition-all',
                              isSelected
                                ? 'border-violet-500 bg-violet-500/15 ring-2 ring-violet-500/50 shadow-xs'
                                : 'border-border/70 bg-muted/20 hover:border-violet-500/40',
                            )}
                          >
                            <span className="text-xs font-bold text-foreground">{meta.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{meta.sample}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Motion Animation Preset */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-bold">Entrance Motion</Label>
                    <Select
                      value={selectedAnimation}
                      onValueChange={(v) => {
                        setSelectedAnimation(v as SlideAnimation)
                        if (deck) {
                          const updated = deck.slides.map((s) => ({ ...s, animation: v as SlideAnimation }))
                          setDeck({ ...deck, animation: v as SlideAnimation, slides: updated })
                          setPreviewKey((k) => k + 1)
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-muted/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SLIDE_ANIMATIONS_META).map(([key, val]) => (
                          <SelectItem key={key} value={key}>
                            {val.name} — {val.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 4: REAL-TIME WEB RESEARCH & FIRECRAWL ═══════════ */}
              {activeInspectorTab === 'research' && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-2.5">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-violet-400" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">Firecrawl Live Web Grounding</span>
                          {firecrawlAvailable ? (
                            <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[8px] font-mono font-bold text-emerald-400">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[8px] font-mono font-bold text-amber-400">
                              API KEY NEEDED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Searches live web facts, statistics & company docs to ground presentation slides in verified data.
                        </p>
                      </div>
                    </div>

                    {!firecrawlAvailable && (
                      <Link to="/settings" className="shrink-0 text-[10px] font-bold text-violet-400 hover:underline">
                        Setup
                      </Link>
                    )}
                  </div>

                  {/* 1. Real-Time Query Search */}
                  <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3">
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <Search className="size-3.5 text-violet-400" />
                      Search Live Web via Firecrawl
                    </Label>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="e.g. DeepSeek V3 architecture benchmarks 2026..."
                        value={researchQuery}
                        onChange={(e) => setResearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handlePerformWebSearch()
                        }}
                        className="h-8 text-xs bg-muted/20"
                        disabled={isSearchingWeb}
                      />
                      <Button
                        size="sm"
                        className="h-8 bg-violet-600 hover:bg-violet-500 text-white text-xs shrink-0"
                        onClick={() => void handlePerformWebSearch()}
                        disabled={isSearchingWeb || !researchQuery.trim()}
                      >
                        {isSearchingWeb ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                        <span className="ml-1">Search</span>
                      </Button>
                    </div>
                  </div>

                  {/* 2. Web URL Scraper */}
                  <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3">
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <Link2 className="size-3.5 text-violet-400" />
                      Extract & Build from Webpage URL
                    </Label>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="https://company.com/announcement or blog post..."
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        className="h-8 text-xs bg-muted/20"
                        disabled={isSearchingWeb}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-violet-500/40 text-violet-300 hover:bg-violet-500/10 text-xs shrink-0"
                        onClick={() => void handlePerformScrapeUrl()}
                        disabled={isSearchingWeb || !scrapeUrl.trim()}
                      >
                        {isSearchingWeb ? <Loader2 className="size-3.5 animate-spin" /> : <FileSearch className="size-3.5" />}
                        <span className="ml-1">Scrape URL</span>
                      </Button>
                    </div>
                  </div>

                  {/* Research Findings List */}
                  {researchResults.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-400" />
                          Grounded Sources ({researchResults.length})
                        </span>
                        <span className="text-[10px] text-muted-foreground">Select sources to ground deck</span>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                        {researchResults.map((src, i) => {
                          const isSelected = selectedResearchIndices.includes(i)
                          return (
                            <div
                              key={i}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedResearchIndices(selectedResearchIndices.filter((idx) => idx !== i))
                                } else {
                                  setSelectedResearchIndices([...selectedResearchIndices, i])
                                }
                              }}
                              className={cn(
                                'cursor-pointer rounded-xl border p-2.5 text-xs transition space-y-1',
                                isSelected
                                  ? 'border-violet-500/70 bg-violet-500/15'
                                  : 'border-border/60 bg-muted/20 hover:bg-muted/40',
                              )}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="font-bold text-foreground text-[11px] line-clamp-1 flex-1">
                                  {src.title}
                                </span>
                                {src.url && (
                                  <a
                                    href={src.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-violet-400 shrink-0"
                                    title="Open source link"
                                  >
                                    <ExternalLink className="size-3" />
                                  </a>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-2">
                                {src.description || (src.markdown ? src.markdown.slice(0, 150) : 'Extracted web content')}
                              </p>
                            </div>
                          )
                        })}
                      </div>

                      <Button
                        size="sm"
                        className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold h-8 mt-2"
                        onClick={() => void handleGenerateDeck()}
                        disabled={isGenerating || isSearchingWeb || (!topicPrompt.trim() && !scrapeUrl.trim())}
                      >
                        <Wand2 className="size-3.5 mr-1.5" />
                        Generate Presentation Deck with these Sources
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════ TAB 5: TEMPLATES & AI GENERATOR ═══════════ */}
              {activeInspectorTab === 'templates' && (
                <div className="space-y-4">
                  {/* Model & Research Engine Controls */}
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Cpu className="size-3 text-violet-400" />
                        AI Model Engine
                      </Label>
                      <Link to="/settings" className="text-[9px] text-violet-400 hover:underline">
                        API Settings
                      </Link>
                    </div>

                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full rounded-lg border border-border bg-[#0f0f1a] px-2 py-1.5 text-xs text-foreground outline-none focus:border-violet-500"
                    >
                      {ALL_LLM_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.provider}) {m.isFree ? '— [FREE]' : ''}
                        </option>
                      ))}
                    </select>

                    {/* Firecrawl Real-Time Web Research Toggle */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Globe className="size-3.5 text-violet-400" />
                        <span className="text-xs font-semibold">Real-Time Web Research (Firecrawl)</span>
                      </div>
                      <Switch
                        checked={useWebResearch}
                        onCheckedChange={setUseWebResearch}
                        className="scale-75"
                        disabled={!firecrawlAvailable}
                        title={firecrawlAvailable ? 'Ground slides in live web facts' : 'Add Firecrawl API Key in Settings'}
                      />
                    </div>
                  </div>

                  {/* Template Archetype Cards */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Presentation Archetypes</Label>
                    <div className="space-y-1.5">
                      {TEMPLATE_ARCHETYPES.map((tmpl) => (
                        <div
                          key={tmpl.id}
                          className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 hover:border-violet-500/50 hover:bg-muted/30 transition"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-foreground">{tmpl.title}</span>
                              <span className="rounded bg-violet-500/20 px-1.5 py-0.2 text-[8px] font-mono font-bold text-violet-300">
                                {tmpl.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{tmpl.desc}</p>
                          </div>

                          <Button
                            size="sm"
                            className="h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white shrink-0"
                            onClick={() => {
                              setTopicPrompt(tmpl.topic)
                              setSelectedTheme(tmpl.theme)
                              setSelectedFont(tmpl.font)
                              void handleGenerateDeck(tmpl.topic, tmpl.count, tmpl.theme, tmpl.font)
                            }}
                            disabled={isGenerating || isInducing}
                          >
                            <Wand2 className="size-3 mr-1" />
                            Build
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Topic Generator */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Custom Topic Prompt</Label>
                      <Input
                        placeholder="e.g. Next-Gen WebGPU & AI Video Architecture"
                        value={topicPrompt}
                        onChange={(e) => setTopicPrompt(e.target.value)}
                        className="h-8 text-xs bg-muted/20"
                        disabled={isGenerating || isInducing}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Slide Count</Label>
                        <Select value={String(slideCount)} onValueChange={(v) => setSlideCount(Number(v))}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
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
                        <Label className="text-[10px] text-muted-foreground">Deck Archetype</Label>
                        <Select value={selectedArchetype} onValueChange={setSelectedArchetype}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
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

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold h-8"
                        onClick={() => void handleGenerateDeck()}
                        disabled={isGenerating || isInducing || !topicPrompt.trim()}
                      >
                        {isGenerating ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 size-3.5" />
                        )}
                        {isGenerating ? progressMsg || 'Generating...' : `Generate ${slideCount} Slides`}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 text-xs font-semibold h-8"
                        onClick={() => void handleInductiveContext()}
                        disabled={isGenerating || isInducing}
                        title="Auto-detect thesis and structure from current timeline clips"
                      >
                        {isInducing ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <Brain className="mr-1.5 size-3.5" />
                        )}
                        <span>Timeline Copilot</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 6: SPEAKER NOTES & TELEPROMPTER ═══════════ */}
              {activeInspectorTab === 'notes' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Presenter Voiceover / Teleprompter Script</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Notes for Slide #{currentSlideIdx + 1}: "{currentSlide?.title || ''}"
                    </p>
                  </div>

                  <Textarea
                    value={currentSlide?.notes || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      updateCurrentSlide({ notes: e.target.value })
                    }
                    rows={6}
                    className="text-xs leading-relaxed bg-muted/20"
                    placeholder="Enter spoken script notes for this slide (voiceover, presenter timing, key talking points)..."
                  />

                  {deck?.sources && deck.sources.length > 0 && (
                    <div className="rounded-xl border border-border/80 bg-muted/20 p-2.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <Globe className="size-3 text-violet-400" />
                        Verified Grounded Sources
                      </span>
                      <div className="space-y-1">
                        {deck.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-violet-400 hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="size-2.5 shrink-0" />
                            <span className="truncate">{src.title || src.url}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status Notices */}
              {errorMsg && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
