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
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useApiConfigStore } from '@/api/config/store'
import { ConnectionOverview } from '@/components/settings/ConnectionOverview'
import { NvidiaNimCard } from '@/components/settings/cards/NvidiaNimCard'
import { OpenCodeZenCard } from '@/components/settings/cards/OpenCodeZenCard'
import { OpenRouterCard } from '@/components/settings/cards/OpenRouterCard'
import { ElevenLabsCard } from '@/components/settings/cards/ElevenLabsCard'
import { NvidiaTtsCard } from '@/components/settings/cards/NvidiaTtsCard'
import { AvatarCard } from '@/components/settings/cards/AvatarCard'
import { VoiceProviderPicker } from '@/components/settings/cards/VoiceProviderPicker'
import { StockImagesCard } from '@/components/settings/cards/StockImagesCard'
import { GiphyCard } from '@/components/settings/cards/GiphyCard'
import { SketchfabCard } from '@/components/settings/cards/SketchfabCard'
import { FirecrawlCard } from '@/components/settings/cards/FirecrawlCard'
import { MusicCard } from '@/components/settings/cards/MusicCard'
import { EngineCard } from '@/components/settings/cards/EngineCard'
import { PreferencesCard } from '@/components/settings/cards/PreferencesCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  const hydrated = useApiConfigStore((s) => s.hydrated)
  const error = useApiConfigStore((s) => s.error)

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

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Settings & Integrations</h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3" />
              Local Storage Encrypted
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Configure external AI providers, voice synthesis, and stock media APIs. All keys are stored strictly on your local device.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5 font-semibold shrink-0 shadow-xs">
          <Link to="/">
            <ArrowLeft className="size-3.5" />
            Back to Editor
          </Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive font-medium">
          Storage error: {error}
        </p>
      )}

      <div className="flex flex-col gap-10">
        {/* 1. Connections Overview */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={Activity} description="Live connectivity status for configured services">
            Service Connections & Status
          </SectionLabel>
          <ConnectionOverview />
        </section>

        {/* 2. AI Reasoning Providers */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={Cpu} description="Language and reasoning models for AI Director, script generation, and timeline orchestration">
            AI & LLM Providers
          </SectionLabel>
          <div className="flex flex-col gap-3">
            <NvidiaNimCard />
            <OpenCodeZenCard />
            <OpenRouterCard />
          </div>
        </section>

        {/* 3. Voice & Audio Generation */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={Mic} description="Text-to-speech synthesis, zero-shot voice cloning, and AI avatar presenter">
            Voice & Speech Synthesis
          </SectionLabel>
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <VoiceProviderPicker />
          </div>
          <div className="flex flex-col gap-3">
            <NvidiaTtsCard />
            <ElevenLabsCard />
            <AvatarCard />
          </div>
        </section>

        {/* 4. Stock Media & Creative Assets */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={ImageIcon} description="Integrations for free stock imagery, animated stickers, 3D models, and background music">
            Stock Media & Creative Assets
          </SectionLabel>
          <div className="flex flex-col gap-3">
            <StockImagesCard />
            <GiphyCard />
            <SketchfabCard />
            <MusicCard />
          </div>
        </section>

        {/* 5. Web Research & Intelligence */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={Compass} description="Scrape web articles and search facts for automated video scripting">
            Web Research & Scraping
          </SectionLabel>
          <FirecrawlCard />
        </section>

        {/* 6. AI Preferences & Engine */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={Sliders} description="Global editor defaults, aspect ratios, auto-captions, and in-browser render engine">
            Preferences & Engine
          </SectionLabel>
          <div className="flex flex-col gap-3">
            <PreferencesCard />
            <EngineCard />
          </div>
        </section>

        {/* 7. Keyboard Shortcuts */}
        <section className="flex flex-col gap-3">
          <SectionLabel icon={Keyboard} description="Complete reference for timeline navigation, clip editing, and zoom shortcuts">
            Keyboard Shortcuts Reference
          </SectionLabel>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-muted-foreground mb-4 text-xs">
              Shortcuts work when the editor has focus.
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
      </div>
    </div>
  )
}