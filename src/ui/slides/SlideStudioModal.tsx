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
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface SlideStudioModalProps {
  isOpen: boolean
  onClose: () => void
  initialDeck?: SlideDeck | null
  onDeckChange?: (deck: SlideDeck) => void
}

const QUICK_TOPICS = [
  'Startup Pitch Deck & Investment Highlights',
  'Next-Gen WebGPU & AI Video Architecture',
  'Product Launch & Feature Roadmap',
  'Quarterly Growth & Business Performance',
  'Educational Explainer: How Neural Networks Work',
  'Creative Storytelling & Cinematic Production',
]

const LAYOUT_OPTIONS: Array<{ id: SlideLayout; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'hero', label: 'Hero Headline', icon: Star },
  { id: 'cards', label: 'Feature Cards', icon: LayoutGrid },
  { id: 'big_stat', label: 'Key Stat / Metric', icon: Zap },
  { id: 'split', label: 'Split 2-Col', icon: Columns2 },
  { id: 'quote', label: 'Quote / Takeaway', icon: Quote },
  { id: 'checklist', label: 'Bullet Points', icon: ListChecks },
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
  const playhead = useTimelineStore((s) => s.playhead)

  // Active Deck State
  const [deck, setDeck] = React.useState<SlideDeck | null>(() => initialDeck ?? null)
  const [currentSlideIdx, setCurrentSlideIdx] = React.useState(0)
  const [slideDuration] = React.useState(5)
  const [activeInspectorTab, setActiveInspectorTab] = React.useState<'content' | 'layout' | 'design' | 'ai' | 'notes'>('content')

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

  const currentSlide = deck && deck.slides.length > 0 ? deck.slides[currentSlideIdx] || deck.slides[0] : null

  // Live HTML for preview
  const currentSlideHtml = currentSlide && deck
    ? renderSlideHtml(
        currentSlide,
        currentSlideIdx + 1,
        deck.slides.length,
        currentSlide.theme || deck.theme,
        currentSlide.font || deck.font,
        currentSlide.animation || deck.animation,
      )
    : ''

  // ── Generation Handler ──
  const handleGenerateDeck = async (overrideTopic?: string, overrideCount?: number) => {
    const finalTopic = (overrideTopic || topicPrompt).trim()
    if (!finalTopic || isGenerating) return

    setIsGenerating(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    setProgressMsg('AI is structuring presentation narrative and layouts...')

    try {
      const generated = await generateSlides({
        topic: finalTopic,
        count: overrideCount || slideCount,
        theme: selectedTheme,
        font: selectedFont,
        animation: selectedAnimation,
        layoutArchetype: selectedArchetype,
      })

      setDeck(generated)
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
      // Automatically generate
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

  // ── Add to Timeline ──
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
        const videoTrack = project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const startBase = playhead ?? 0
          imported.forEach((asset, idx) => {
            const newClip = addClip(asset.id, videoTrack.id, startBase + idx * slideDuration)
            if (newClip) updateClip(newClip.id, { duration: slideDuration, sourceEnd: slideDuration, clipType: 'image' })
          })
        }
        setSuccessMsg(`Successfully added ${imported.length} presentation slides (${slideW}×${slideH}) to the timeline!`)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setIsAddingTimeline(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[94vh] w-[98vw] max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        
        {/* ── Header Bar ── */}
        <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-600/20 p-2 text-violet-400">
              <Presentation className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide">
                  Slide Presentation Studio
                </h2>
                {deck && (
                  <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                    {deck.title} ({deck.slides.length} slides)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                AI presentation deck generation, kinetic typography, live visual editing, and 1-click timeline staging
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deck && (
              <>
                <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1 text-xs">
                  <span className="text-[10px] text-muted-foreground">Slide Duration:</span>
                  <span className="font-mono text-violet-400 font-bold">{slideDuration}s</span>
                </div>

                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-xs"
                  onClick={() => void handleAddAllToTimeline()}
                  disabled={isAddingTimeline}
                >
                  {isAddingTimeline ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  {isAddingTimeline ? 'Staging Slides...' : `Add All ${deck.slides.length} Slides to Timeline`}
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              title="Close Presentation Studio"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* ── Main Workspace ── */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* ── Left/Center: Live 16:9 Canvas + Filmstrip Carousel ── */}
          <div className="flex flex-1 flex-col border-r bg-zinc-950/60 overflow-hidden">
            
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
                  className="h-7 text-xs gap-1"
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
            <div className="flex-1 flex items-center justify-center p-6 bg-black/50 overflow-hidden">
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
                  <div className="rounded-2xl bg-violet-600/20 p-4 text-violet-400">
                    <Presentation className="size-10" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">No Presentation Loaded</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Type a topic on the right or pick a quick preset to generate a cinematic presentation deck with AI.
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                    {QUICK_TOPICS.slice(0, 3).map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] text-violet-300 hover:bg-violet-500/20 transition"
                        onClick={() => {
                          setTopicPrompt(topic)
                          void handleGenerateDeck(topic)
                        }}
                      >
                        {topic.split(' ')[0]} {topic.split(' ')[1]}
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
                    <span className="text-[11px] font-bold text-foreground">Deck Slides ({deck.slides.length})</span>
                    <span className="text-[10px] text-muted-foreground">Click to edit · Reorder or customize</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={handleAddSlide}>
                      <Plus className="size-3" />
                      <span>Add Blank Slide</span>
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
                          <span className="rounded bg-black/60 px-1 font-mono text-[9px] font-bold text-white">
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
          <div className="flex w-[460px] flex-col overflow-hidden bg-card">
            
            {/* Inspector Tab Switcher */}
            <div className="flex border-b bg-muted/30 p-1 gap-1">
              {[
                { id: 'content' as const, label: 'Content', icon: FileText },
                { id: 'layout' as const, label: 'Layouts', icon: LayoutGrid },
                { id: 'design' as const, label: 'Themes & Fonts', icon: Palette },
                { id: 'ai' as const, label: 'AI Generator', icon: Sparkles },
                { id: 'notes' as const, label: 'Notes', icon: Brain },
              ].map(({ id, label, icon: TabIcon }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-center text-[10px] font-bold transition',
                    activeInspectorTab === id
                      ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs border border-border/80'
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
                        <span className="text-xs font-bold text-foreground">Slide #{currentSlideIdx + 1} Content</span>
                        <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300 uppercase">
                          {currentSlide.layout || 'Hero'}
                        </span>
                      </div>

                      {/* Headline */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Slide Headline</Label>
                        <Input
                          value={currentSlide.title}
                          onChange={(e) => updateCurrentSlide({ title: e.target.value })}
                          className="h-8 text-xs bg-muted/20 font-bold"
                          placeholder="e.g. Revolutionizing Video with AI"
                        />
                      </div>

                      {/* Subtitle / Category */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Category / Subtitle</Label>
                        <Input
                          value={currentSlide.subtitle || ''}
                          onChange={(e) => updateCurrentSlide({ subtitle: e.target.value })}
                          className="h-8 text-xs bg-muted/20"
                          placeholder="e.g. EXECUTIVE SUMMARY"
                        />
                      </div>

                      {/* Layout-Specific Customization */}
                      {currentSlide.layout === 'big_stat' && (
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/5 p-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-cyan-300">Big Number / Metric</Label>
                            <Input
                              value={currentSlide.statNumber || '+140%'}
                              onChange={(e) => updateCurrentSlide({ statNumber: e.target.value })}
                              className="h-8 text-xs font-bold text-cyan-400 bg-black/40"
                              placeholder="+140%"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-cyan-300">Metric Description</Label>
                            <Input
                              value={currentSlide.statLabel || 'Performance Increase'}
                              onChange={(e) => updateCurrentSlide({ statLabel: e.target.value })}
                              className="h-8 text-xs bg-black/40"
                              placeholder="Year-over-Year Growth"
                            />
                          </div>
                        </div>
                      )}

                      {currentSlide.layout === 'quote' && (
                        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                          <Label className="text-xs font-bold text-amber-300">Quote Attribution / Speaker</Label>
                          <Input
                            value={currentSlide.quoteAuthor || 'Steve Jobs'}
                            onChange={(e) => updateCurrentSlide({ quoteAuthor: e.target.value })}
                            className="h-8 text-xs bg-black/40"
                            placeholder="Speaker Name, Title"
                          />
                        </div>
                      )}

                      {currentSlide.layout === 'cards' && (
                        <div className="space-y-2.5 rounded-lg border border-violet-500/40 bg-violet-500/5 p-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-violet-300">
                              Feature Cards ({(currentSlide.cards || []).length}/3)
                            </Label>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] text-violet-300 font-semibold"
                              onClick={() => {
                                const cards = [
                                  ...(currentSlide.cards || []),
                                  { title: 'New Concept', description: 'Describe feature benefit', tag: 'NEW' },
                                ]
                                updateCurrentSlide({ cards, layout: 'cards' })
                              }}
                            >
                              + Add Card
                            </Button>
                          </div>

                          {(currentSlide.cards || []).map((card, cIdx) => (
                            <div key={cIdx} className="space-y-1.5 rounded-md border bg-black/40 p-2">
                              <div className="flex gap-1.5">
                                <Input
                                  value={card.tag || ''}
                                  placeholder="TAG"
                                  onChange={(e) => {
                                    const cards = [...(currentSlide.cards || [])]
                                    cards[cIdx] = { ...cards[cIdx], tag: e.target.value }
                                    updateCurrentSlide({ cards })
                                  }}
                                  className="h-7 text-[10px] w-20 uppercase font-bold text-violet-400"
                                />
                                <Input
                                  value={card.title}
                                  placeholder="Card Title"
                                  onChange={(e) => {
                                    const cards = [...(currentSlide.cards || [])]
                                    cards[cIdx] = { ...cards[cIdx], title: e.target.value }
                                    updateCurrentSlide({ cards })
                                  }}
                                  className="h-7 text-xs font-bold flex-1"
                                />
                              </div>
                              <Input
                                value={card.description}
                                placeholder="Description text"
                                onChange={(e) => {
                                  const cards = [...(currentSlide.cards || [])]
                                  cards[cIdx] = { ...cards[cIdx], description: e.target.value }
                                  updateCurrentSlide({ cards })
                                }}
                                className="h-7 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bullets List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Bullet Points</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-violet-400 font-semibold"
                            onClick={() => {
                              const bullets = [...currentSlide.bullets, 'New supporting insight']
                              updateCurrentSlide({ bullets })
                            }}
                          >
                            + Add Bullet
                          </Button>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {currentSlide.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-1.5">
                              <Input
                                value={bullet}
                                onChange={(e) => {
                                  const bullets = [...currentSlide.bullets]
                                  bullets[bIdx] = e.target.value
                                  updateCurrentSlide({ bullets })
                                }}
                                className="h-8 text-xs flex-1 bg-muted/20"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => {
                                  const bullets = currentSlide.bullets.filter((_, i) => i !== bIdx)
                                  updateCurrentSlide({ bullets })
                                }}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 space-y-2">
                      <Presentation className="size-8 text-muted-foreground mx-auto opacity-50" />
                      <p className="text-xs text-muted-foreground">No slide selected. Generate a deck to start editing.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════ TAB 2: SLIDE LAYOUT ARCHETYPES ═══════════ */}
              {activeInspectorTab === 'layout' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Change Slide Layout</Label>
                    <p className="text-[10px] text-muted-foreground">Select an archetype for the current slide.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {LAYOUT_OPTIONS.map(({ id, label, icon: Icon }) => {
                      const isSelected = (currentSlide?.layout || 'hero') === id
                      return (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            'flex flex-col items-start rounded-lg border p-3 text-left transition',
                            isSelected
                              ? 'border-violet-500 bg-violet-500/20 text-violet-300 ring-1 ring-violet-500'
                              : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                          )}
                          onClick={() => updateCurrentSlide({ layout: id })}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="size-4 text-violet-400" />
                            <span className="text-xs font-bold">{label}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-1 line-clamp-1">
                            {id === 'hero' && 'Bold headline with subtitle emphasis'}
                            {id === 'cards' && '3 modular glass feature cards'}
                            {id === 'big_stat' && 'Giant metric callout with label'}
                            {id === 'split' && 'Two-column balanced layout'}
                            {id === 'quote' && 'Large quotation with attribution'}
                            {id === 'checklist' && 'Structured bullet checklist'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 3: VISUAL THEMES & FONTS ═══════════ */}
              {activeInspectorTab === 'design' && (
                <div className="space-y-4">
                  {/* Theme Palette Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Visual Themes</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(SLIDE_THEMES_META).map(([key, t]) => {
                        const isSelected = (deck?.theme || selectedTheme) === key
                        return (
                          <button
                            key={key}
                            type="button"
                            className={cn(
                              'flex flex-col rounded-lg border p-2.5 text-left transition',
                              isSelected
                                ? 'border-violet-500 bg-violet-500/20 text-violet-300 ring-1 ring-violet-500'
                                : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-violet-500/40 hover:text-foreground',
                            )}
                            onClick={() => {
                              setSelectedTheme(key as SlideTheme)
                              if (deck) setDeck({ ...deck, theme: key as SlideTheme })
                              setPreviewKey((k) => k + 1)
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-bold">{t.name}</span>
                              <div
                                className="size-3 rounded-full border shadow-xs"
                                style={{ backgroundColor: t.accent }}
                              />
                            </div>
                            <span className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">
                              {t.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Typography & Animations */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Typography</Label>
                      <Select
                        value={deck?.font || selectedFont}
                        onValueChange={(v) => {
                          setSelectedFont(v as SlideFont)
                          if (deck) setDeck({ ...deck, font: v as SlideFont })
                          setPreviewKey((k) => k + 1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SLIDE_FONTS_META).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Entrance Animation</Label>
                      <Select
                        value={deck?.animation || selectedAnimation}
                        onValueChange={(v) => {
                          setSelectedAnimation(v as SlideAnimation)
                          if (deck) setDeck({ ...deck, animation: v as SlideAnimation })
                          setPreviewKey((k) => k + 1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SLIDE_ANIMATIONS_META).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 4: AI GENERATOR & INDUCTIVE COPILOT ═══════════ */}
              {activeInspectorTab === 'ai' && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Generate New Presentation Deck</Label>
                    <Input
                      placeholder="e.g. Next-Gen AI Video Editor Architecture & Capabilities"
                      value={topicPrompt}
                      onChange={(e) => setTopicPrompt(e.target.value)}
                      className="h-8 text-xs bg-muted/20"
                      disabled={isGenerating || isInducing}
                    />
                  </div>

                  {/* Quick Preset Topics */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground font-semibold">Quick Topic Ideas:</span>
                    <div className="flex flex-wrap gap-1">
                      {QUICK_TOPICS.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground hover:border-violet-500/40 hover:text-foreground transition"
                          onClick={() => setTopicPrompt(topic)}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
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
                      <Label className="text-[10px] text-muted-foreground">Presentation Archetype</Label>
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

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold h-8"
                      onClick={() => void handleGenerateDeck()}
                      disabled={isGenerating || isInducing || !topicPrompt.trim()}
                    >
                      {isGenerating ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Sparkles className="mr-1.5 size-3.5" />}
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
                      {isInducing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Brain className="mr-1.5 size-3.5" />}
                      <span>Induce from Timeline</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* ═══════════ TAB 5: SPEAKER NOTES & TELEPROMPTER ═══════════ */}
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
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateCurrentSlide({ notes: e.target.value })}
                    rows={6}
                    className="text-xs leading-relaxed bg-muted/20"
                    placeholder="Enter spoken script notes for this slide (voiceover, presenter timing, key talking points)..."
                  />
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
