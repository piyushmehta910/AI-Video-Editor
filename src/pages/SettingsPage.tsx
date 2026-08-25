import * as React from 'react'
import {
  ArrowLeft,
  Activity,
  Cpu,
  Mic,
  Image as ImageIcon,
  Compass,
  Sliders,
  Keyboard,
  ShieldCheck,
  Search,
  Key,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useApiConfigStore } from '@/api/config/store'
import { ConnectionOverview } from '@/components/settings/ConnectionOverview'
import { NvidiaNimCard } from '@/components/settings/cards/NvidiaNimCard'
import { OpenCodeZenCard } from '@/components/settings/cards/OpenCodeZenCard'
import { OpenRouterCard } from '@/components/settings/cards/OpenRouterCard'
import { ElevenLabsCard } from '@/components/settings/cards/ElevenLabsCard'
import { AvatarCard } from '@/components/settings/cards/AvatarCard'
import { VoiceProviderPicker } from '@/components/settings/cards/VoiceProviderPicker'
import { StockImagesCard } from '@/components/settings/cards/StockImagesCard'
import { GiphyCard } from '@/components/settings/cards/GiphyCard'
import { FirecrawlCard } from '@/components/settings/cards/FirecrawlCard'
import { MusicCard } from '@/components/settings/cards/MusicCard'
import { EngineCard } from '@/components/settings/cards/EngineCard'
import { PreferencesCard } from '@/components/settings/cards/PreferencesCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type SettingsTab = 'all' | 'ai' | 'voice' | 'web' | 'media' | 'engine' | 'shortcuts'

function SectionLabel({
  children,
  icon: Icon,
  description,
  className,
}: {
  children: React.ReactNode
  icon?: React.FC<{ className?: string }>
  description?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 border-b border-border/40 pb-2 mb-1', className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-violet-500 shrink-0" />}
        <h2 className="text-sm font-bold text-foreground tracking-tight">{children}</h2>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

export function SettingsPage() {
  const { config, hydrated, error } = useApiConfigStore()
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('all')
  const [searchQuery, setSearchQuery] = React.useState('')

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // Count configured services
  const configuredServices = [
    Boolean(config.nvidiaNim.apiKey?.trim()),
    Boolean(config.openRouter.apiKey?.trim()),
    Boolean(config.opencodeZen.apiKey?.trim()),
    Boolean(config.elevenLabs.apiKey?.trim()),
    Boolean(config.firecrawl.apiKey?.trim()),
    Boolean(config.stockImages.pexels.apiKey?.trim() || config.stockImages.unsplash.accessKey?.trim() || config.stockImages.pixabay.apiKey?.trim()),
    Boolean(config.giphy.apiKey?.trim()),
  ].filter(Boolean).length

  const search = searchQuery.toLowerCase().trim()
  const match = (text: string) => !search || text.toLowerCase().includes(search)

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">API Credentials & Settings Hub</h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3" />
              AES-256 Local Encrypted
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Organized management for AI reasoning models, voice synthesis, live web research, and stock media.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-semibold shadow-xs">
            <Link to="/">
              <ArrowLeft className="size-3.5" />
              Back to Editor
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive font-medium">
          Storage error: {error}
        </p>
      )}

      {/* ── API Credentials Summary Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Key className="size-3.5 text-violet-500" />
            Configured APIs
          </div>
          <div className="text-lg font-bold text-foreground mt-0.5">
            {configuredServices} <span className="text-xs font-normal text-muted-foreground">/ 8 integrations</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Cpu className="size-3.5 text-cyan-500" />
            Active LLM Engine
          </div>
          <div className="text-xs font-bold text-foreground mt-1 truncate">
            {config.preferences.preferredAiProvider || 'NVIDIA NIM (Unified)'}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Mic className="size-3.5 text-pink-500" />
            Voice Synthesis
          </div>
          <div className="text-xs font-bold text-foreground mt-1 truncate">
            {config.nvidiaNim.apiKey ? 'NVIDIA Magpie / FastPitch' : config.elevenLabs.apiKey ? 'ElevenLabs' : 'Web Speech API'}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Compass className="size-3.5 text-amber-500" />
            Live Web Research
          </div>
          <div className="text-xs font-bold text-foreground mt-1 truncate">
            {config.firecrawl.apiKey ? 'Firecrawl Connected' : 'Free Built-in Search'}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Tabs ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-1">
          {[
            { id: 'all', label: 'All Settings', icon: Activity },
            { id: 'ai', label: 'AI & LLMs', icon: Cpu },
            { id: 'voice', label: 'Voice & Speech', icon: Mic },
            { id: 'web', label: 'Web Research', icon: Compass },
            { id: 'media', label: 'Stock & 3D', icon: ImageIcon },
            { id: 'engine', label: 'Preferences', icon: Sliders },
            { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API or model..."
            className="pl-8 h-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* ── Content Sections ── */}
      <div className="flex flex-col gap-8 pt-2">
        {/* 1. Connection Matrix (Shown in All tab) */}
        {(activeTab === 'all' && !search) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={Activity} description="Live connectivity status for configured services">
              Service Connectivity Matrix
            </SectionLabel>
            <ConnectionOverview />
          </section>
        )}

        {/* 2. AI Reasoning Providers */}
        {(activeTab === 'all' || activeTab === 'ai') && (match('nvidia') || match('openrouter') || match('opencode') || match('ai') || match('llm')) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={Cpu} description="Language and reasoning models for AI Director, script generation, and timeline orchestration">
              AI & LLM Reasoning Engines
            </SectionLabel>
            <div className="flex flex-col gap-3">
              {(match('nvidia') || match('nim') || match('ai')) && <NvidiaNimCard />}
              {(match('openrouter') || match('ai') || match('free')) && <OpenRouterCard />}
              {(match('opencode') || match('zen') || match('deepseek')) && <OpenCodeZenCard />}
            </div>
          </section>
        )}

        {/* 3. Voice & Audio Generation */}
        {(activeTab === 'all' || activeTab === 'voice') && (match('voice') || match('speech') || match('elevenlabs') || match('avatar') || match('tts')) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={Mic} description="Text-to-speech synthesis, zero-shot voice cloning, and AI avatar presenter">
              Voice Over & Audio Synthesis
            </SectionLabel>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <VoiceProviderPicker />
            </div>
            <div className="flex flex-col gap-3">
              {(match('elevenlabs') || match('voice')) && <ElevenLabsCard />}
              {(match('avatar') || match('presenter') || match('mouth') || match('lipsync')) && <AvatarCard />}
            </div>
          </section>
        )}

        {/* 4. Web Research & Intelligence */}
        {(activeTab === 'all' || activeTab === 'web') && (match('firecrawl') || match('web') || match('research') || match('scrape')) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={Compass} description="Scrape web articles, search facts, and ground AI presentations with live citations">
              Web Intelligence & Research (Firecrawl)
            </SectionLabel>
            <FirecrawlCard />
          </section>
        )}

        {/* 5. Stock Media & Creative Assets */}
        {(activeTab === 'all' || activeTab === 'media') && (match('stock') || match('pexels') || match('unsplash') || match('pixabay') || match('giphy') || match('music')) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={ImageIcon} description="Integrations for free stock imagery, animated stickers, and background music">
              Stock Media & Creative Assets
            </SectionLabel>
            <div className="flex flex-col gap-3">
              {(match('stock') || match('pexels') || match('unsplash') || match('pixabay')) && <StockImagesCard />}
              {(match('giphy') || match('gif') || match('sticker')) && <GiphyCard />}
              {(match('music') || match('deezer') || match('audio')) && <MusicCard />}
            </div>
          </section>
        )}

        {/* 6. AI Preferences & Engine */}
        {(activeTab === 'all' || activeTab === 'engine') && (match('engine') || match('preferences') || match('render') || match('resolution')) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={Sliders} description="Global editor defaults, aspect ratios, auto-captions, and in-browser render engine">
              Preferences & Render Engine
            </SectionLabel>
            <div className="flex flex-col gap-3">
              <PreferencesCard />
              <EngineCard />
            </div>
          </section>
        )}

        {/* 7. Keyboard Shortcuts */}
        {(activeTab === 'all' || activeTab === 'shortcuts') && (match('shortcut') || match('keyboard') || match('keys')) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={Keyboard} description="Complete reference for timeline navigation, clip editing, and zoom shortcuts">
              Keyboard Shortcuts Reference
            </SectionLabel>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-muted-foreground mb-4 text-xs">
                Shortcuts work when the editor canvas or timeline has focus.
              </p>
              <div className="flex flex-col gap-4">
                {[
                  {
                    title: 'Playback & navigation',
                    items: [
                      { keys: 'Space', label: 'Play / Pause' },
                      { keys: '← / →', label: 'Step one frame' },
                      { keys: 'Shift+← / Shift+→', label: 'Seek ± 1 second' },
                      { keys: '↑ / ↓', label: 'Seek ± 5 seconds' },
                      { keys: 'Home / End', label: 'Go to start / end' },
                      { keys: 'J / K / L', label: 'Shuttle reverse / stop / forward' },
                    ],
                  },
                  {
                    title: 'Editing',
                    items: [
                      { keys: 'Ctrl+Z', label: 'Undo' },
                      { keys: 'Ctrl+Shift+Z / Ctrl+Y', label: 'Redo' },
                      { keys: 'Ctrl+S', label: 'Save project' },
                      { keys: 'Ctrl+C / Ctrl+X / Ctrl+V', label: 'Copy / Cut / Paste' },
                      { keys: 'Ctrl+D', label: 'Duplicate selected' },
                      { keys: 'Delete / Backspace', label: 'Delete selected' },
                      { keys: 'Shift+Delete', label: 'Ripple-delete selected' },
                      { keys: 'Ctrl+K (or I)', label: 'Split at playhead' },
                      { keys: 'Ctrl+A', label: 'Select all clips' },
                      { keys: 'Shift+← / Shift+→', label: 'Nudge selected clip 1 frame' },
                      { keys: '[ / ]', label: 'Trim selected clip start / end' },
                    ],
                  },
                  {
                    title: 'Timeline & view',
                    items: [
                      { keys: 'Ctrl+= / Ctrl+-', label: 'Zoom in / out' },
                      { keys: 'Ctrl+0', label: 'Reset zoom' },
                      { keys: 'Ctrl+wheel', label: 'Zoom on the timeline' },
                      { keys: 'Click ruler / track', label: 'Move playhead' },
                      { keys: 'Shift+drag clip', label: 'Disable snapping' },
                    ],
                  },
                ].map((group) => (
                  <div key={group.title}>
                    <h3 className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
                      {group.title}
                    </h3>
                    <div className="flex flex-col divide-y divide-border/60 rounded-lg border bg-muted/30">
                      {group.items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <span className="text-xs">{item.label}</span>
                          <span className="flex flex-wrap justify-end gap-1">
                            {item.keys.split(' / ').map((k, i) => (
                              <kbd
                                key={i}
                                className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                              >
                                {k}
                              </kbd>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}