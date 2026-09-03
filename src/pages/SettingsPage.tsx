import * as React from 'react'
import {
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
  Lock,
  Unlock,
  RotateCcw,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useIsFromEditor } from '@/hooks/useIsFromEditor'
import { useApiConfigStore } from '@/api/config/store'
import { getMasterKeyState, verifyMasterPassphrase } from '@/api/config/crypto'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type SettingsTab = 'all' | 'ai' | 'voice' | 'web' | 'media' | 'engine' | 'shortcuts' | 'security'

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
  const isFromEditor = useIsFromEditor()

  const navigate = useNavigate()

  const handleBack = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      void navigate({ to: isFromEditor ? '/editor' : '/' })
    }
  }, [navigate, isFromEditor])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          handleBack()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleBack])

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
            { id: 'security', label: 'Security', icon: ShieldCheck },
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
              {(match('openrouter') || match('ai') || match('free')) && <OpenRouterCard />}
              {(match('opencode') || match('zen') || match('deepseek')) && <OpenCodeZenCard />}
              {(match('nvidia') || match('nim') || match('legacy')) && <NvidiaNimCard />}
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

        {/* 8. Security & Encryption */}
        {(activeTab === 'all' || activeTab === 'security') && (match('security') || match('encryption') || match('passphrase') || match('master')) && (
          <section className="flex flex-col gap-3">
            <SectionLabel icon={ShieldCheck} description="Manage local encryption passphrase for API key storage">
              Security & Encryption
            </SectionLabel>
            <SecuritySection />
          </section>
        )}
      </div>
    </div>
  )
}

function SecuritySection() {
  const { clearMasterKey } = useApiConfigStore()
  const [masterKeyState, setMasterKeyState] = React.useState<Awaited<ReturnType<typeof getMasterKeyState>> | null>(null)
  const [showChangePassphrase, setShowChangePassphrase] = React.useState(false)
  const [currentPassphrase, setCurrentPassphrase] = React.useState('')
  const [newPassphrase, setNewPassphrase] = React.useState('')
  const [confirmPassphrase, setConfirmPassphrase] = React.useState('')
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [isChanging, setIsChanging] = React.useState(false)
  const [isRemoving, setIsRemoving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  React.useEffect(() => {
    getMasterKeyState().then(setMasterKeyState)
  }, [])

  const handleChangePassphrase = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassphrase.length < 8) {
      setError('New passphrase must be at least 8 characters')
      return
    }
    if (newPassphrase !== confirmPassphrase) {
      setError('Passphrases do not match')
      return
    }

    setIsChanging(true)
    try {
      // Verify current passphrase
      const verified = await verifyMasterPassphrase(currentPassphrase)
      if (!verified) {
        setError('Current passphrase is incorrect')
        return
      }

      // Remove old and set new
      await clearMasterKey()
      const { setMasterPassphrase } = await import('@/api/config/crypto')
      await setMasterPassphrase(newPassphrase)

      // Re-encrypt config with new passphrase
      const { useApiConfigStore: store } = await import('@/api/config/store')
      const config = store.getState().config
      const { encryptConfig } = await import('@/api/config/crypto')
      const STORAGE_KEY = 'clipforge-api-config'
      const encrypted = await encryptConfig(config as unknown as Record<string, unknown>, newPassphrase)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted))

      setSuccess('Passphrase changed successfully')
      setShowChangePassphrase(false)
      setCurrentPassphrase('')
      setNewPassphrase('')
      setConfirmPassphrase('')
      getMasterKeyState().then(setMasterKeyState)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change passphrase')
    } finally {
      setIsChanging(false)
    }
  }

  const handleRemovePassphrase = async () => {
    setError(null)
    setSuccess(null)

    if (!confirm('This will remove encryption from your API keys. They will be stored in plaintext. Continue?')) {
      return
    }

    setIsRemoving(true)
    try {
      await clearMasterKey()
      // Save config unencrypted
      const { useApiConfigStore: store } = await import('@/api/config/store')
      const config = store.getState().config
      localStorage.setItem('clipforge-api-config', JSON.stringify(config))
      setSuccess('Encryption removed. API keys are now stored in plaintext.')
      getMasterKeyState().then(setMasterKeyState)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove encryption')
    } finally {
      setIsRemoving(false)
    }
  }

  if (!masterKeyState) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isEncryptedV2 = masterKeyState.version === 2 && masterKeyState.hasPassphrase
  const isEncryptedV1 = masterKeyState.version === 1 && masterKeyState.hasPassphrase

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex size-10 items-center justify-center rounded-full',
              isEncryptedV2 ? 'bg-emerald-500/10 text-emerald-600'
                : isEncryptedV1 ? 'bg-amber-500/10 text-amber-600'
                : 'bg-muted text-muted-foreground'
            )}>
              {isEncryptedV2 ? (
                <Lock className="size-5" />
              ) : isEncryptedV1 ? (
                <AlertCircle className="size-5" />
              ) : (
                <Unlock className="size-5" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-foreground">
                {isEncryptedV2 ? 'AES-256 Encryption Active' : isEncryptedV1 ? 'Legacy Encryption (Auto-Generated Key)' : 'No Encryption'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isEncryptedV2
                  ? 'Your API keys are encrypted with a passphrase you created. The passphrase is never stored.'
                  : isEncryptedV1
                    ? 'Your API keys are encrypted with an auto-generated key stored in localStorage. Consider upgrading to a personal passphrase.'
                    : 'API keys are stored in plaintext. Set a passphrase to enable encryption.'}
              </p>
            </div>
          </div>
          {isEncryptedV1 && !showChangePassphrase && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowChangePassphrase(true)}
              className="shrink-0"
            >
              <Lock className="mr-1.5 size-3.5" />
              Upgrade to Personal Passphrase
            </Button>
          )}
        </div>
      </div>

      {/* Change Passphrase Form */}
      {showChangePassphrase && (
        <div className="rounded-xl border bg-card p-4 shadow-xs animate-in slide-in-from-top-2 duration-200">
          <h4 className="mb-3 font-medium text-foreground">Change Master Passphrase</h4>
          <form onSubmit={handleChangePassphrase} className="space-y-3">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            {success && (
              <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600">{success}</div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="current-passphrase" className="text-sm font-medium">Current Passphrase</Label>
              <div className="relative">
                <Input
                  id="current-passphrase"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassphrase}
                  onChange={(e) => setCurrentPassphrase(e.target.value)}
                  placeholder="Enter current passphrase"
                  autoComplete="off"
                  disabled={isChanging}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-passphrase" className="text-sm font-medium">New Passphrase (min 8 chars)</Label>
              <div className="relative">
                <Input
                  id="new-passphrase"
                  type={showNew ? 'text' : 'password'}
                  value={newPassphrase}
                  onChange={(e) => setNewPassphrase(e.target.value)}
                  placeholder="Enter new passphrase"
                  autoComplete="off"
                  disabled={isChanging}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-passphrase" className="text-sm font-medium">Confirm New Passphrase</Label>
              <div className="relative">
                <Input
                  id="confirm-passphrase"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Confirm new passphrase"
                  autoComplete="off"
                  disabled={isChanging}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isChanging || newPassphrase.length < 8}>
                {isChanging ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Change Passphrase'
                )}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowChangePassphrase(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {masterKeyState.version === 2 && masterKeyState.hasPassphrase && !showChangePassphrase && (
          <Button variant="outline" size="sm" onClick={() => setShowChangePassphrase(true)}>
            <RotateCcw className="mr-1.5 size-3.5" />
            Change Passphrase
          </Button>
        )}
        {(isEncryptedV2 || isEncryptedV1) ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemovePassphrase}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Removing…
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 size-3.5" />
                Remove Encryption
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowChangePassphrase(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Lock className="mr-1.5 size-3.5" />
            Set Passphrase & Enable Encryption
          </Button>
        )}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Your passphrase is used with PBKDF2 (100,000 iterations) to derive an AES-256-GCM encryption key.</li>
          <li>The passphrase is <strong>never stored</strong> — it's only used in memory during your session.</li>
          <li>Only the salt (random per session) and version are stored in localStorage.</li>
          <li>If you forget your passphrase, <strong>your encrypted API keys cannot be recovered</strong>.</li>
          <li>Legacy auto-generated keys are vulnerable to XSS — upgrading to a personal passphrase is recommended.</li>
        </ul>
      </div>
    </div>
  )
}