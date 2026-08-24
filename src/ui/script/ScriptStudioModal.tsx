import * as React from 'react'
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Mic,
  Square,
  Sparkles,
  Copy,
  CheckCircle2,
  Download,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Volume2,
  FileText,
  Loader2,
  ScrollText,
  Pencil,
  Flame,
  Crosshair,
  ArrowUpDown,
  SlidersHorizontal,
  Maximize2,
  PanelRight,
  PanelLeft,
} from 'lucide-react'
import { useScriptStore } from '@/stores/scriptStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { calculateScriptMetrics, formatTeleprompter } from '@/api/llm/scripts'
import { useVoiceoverRecorder } from '@/hooks/useVoiceoverRecorder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface ScriptStudioModalProps {
  open: boolean
  onClose: () => void
  initialLayout?: 'full' | 'half-right' | 'half-left'
}

export function ScriptStudioModal({ open, onClose, initialLayout }: ScriptStudioModalProps) {
  const [layoutMode, setLayoutMode] = React.useState<'full' | 'half-right' | 'half-left'>(
    initialLayout ?? 'full',
  )

  React.useEffect(() => {
    if (initialLayout && open) {
      setLayoutMode(initialLayout)
    }
  }, [initialLayout, open])
  const script = useScriptStore((s) => s.script)
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

  const [mode, setMode] = React.useState<'teleprompter' | 'editor' | 'hook'>('teleprompter')
  const [copied, setCopied] = React.useState(false)
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [isSynthesizingTts, setIsSynthesizingTts] = React.useState(false)

  // Teleprompter Controls
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [scrollSpeed, setScrollSpeed] = React.useState(45) // px per second
  const [fontSize, setFontSize] = React.useState(32) // px
  const lineHeight = 1.6
  const [mirrorX, setMirrorX] = React.useState(false)
  const [mirrorY, setMirrorY] = React.useState(false)
  const [guideLine, setGuideLine] = React.useState(true)
  const [maxWidthMode, setMaxWidthMode] = React.useState<'normal' | 'wide' | 'compact'>('normal')

  const prompterContainerRef = React.useRef<HTMLDivElement>(null)
  const scrollAnimRef = React.useRef<number | null>(null)
  const lastTimeRef = React.useRef<number>(0)

  // Voiceover Recorder Integration
  const handleRecordingDone = React.useCallback(
    async (file: File, durationSec: number) => {
      try {
        const { imported, errors } = await importFiles([file])
        if (imported.length) {
          const audioTrack = project.tracks.find((t) => t.type === 'audio') || project.tracks.find((t) => t.type === 'video')
          if (!audioTrack) throw new Error('No audio track available on timeline')
          const clip = addClip(imported[0].id, audioTrack.id, playhead ?? 0)
          if (clip) {
            updateClip(clip.id, { duration: durationSec, sourceEnd: durationSec, clipType: 'audio' })
            setNotice({ kind: 'ok', text: `Recorded ${durationSec.toFixed(1)}s voiceover and placed on audio track at ${(playhead ?? 0).toFixed(1)}s!` })
          }
        } else {
          setNotice({ kind: 'error', text: errors[0] ?? 'Could not import audio recording' })
        }
      } catch (err) {
        setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to add voiceover to timeline' })
      }
    },
    [importFiles, project.tracks, addClip, playhead, updateClip],
  )

  const recorder = useVoiceoverRecorder(handleRecordingDone)

  // Teleprompter autoscroll loop
  React.useEffect(() => {
    if (!isPlaying) {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current)
      scrollAnimRef.current = null
      return
    }

    lastTimeRef.current = performance.now()

    const step = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      if (prompterContainerRef.current) {
        prompterContainerRef.current.scrollTop += scrollSpeed * delta
      }

      scrollAnimRef.current = requestAnimationFrame(step)
    }

    scrollAnimRef.current = requestAnimationFrame(step)

    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current)
    }
  }, [isPlaying, scrollSpeed])

  // Spacebar toggle playback shortcut
  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open || !script) return null

  const metrics = calculateScriptMetrics(script)

  const handleCopy = () => {
    navigator.clipboard.writeText(formatTeleprompter(script))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const text = formatTeleprompter(script)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(script.title || 'script').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_teleprompter.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddScenesAsTextOverlays = () => {
    const textTrack = project.tracks.find((t) => t.type === 'text') || project.tracks.find((t) => t.type === 'video')
    if (!textTrack) {
      setNotice({ kind: 'error', text: 'No text or video track available on timeline' })
      return
    }

    let time = playhead ?? 0
    if (script.hook) {
      addTextClip(script.hook, textTrack.id, time)
      time += 4
    }
    for (const sc of script.scenes) {
      const textToUse = sc.onScreenText || sc.text
      if (textToUse) {
        addTextClip(textToUse, textTrack.id, time)
      }
      time += sc.durationSeconds
    }
    if (script.cta) {
      addTextClip(script.cta, textTrack.id, time)
    }

    setNotice({ kind: 'ok', text: 'Successfully placed script scenes as text overlays on timeline!' })
  }

  const handleSynthesizeTts = async () => {
    setIsSynthesizingTts(true)
    setNotice(null)
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

      const file = new File([audioBlob], `studio-voiceover-${Date.now()}.wav`, { type: 'audio/wav' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        const audioTrack = project.tracks.find((t) => t.type === 'audio') || project.tracks.find((t) => t.type === 'video')
        if (audioTrack) {
          const clip = addClip(imported[0].id, audioTrack.id, playhead ?? 0)
          if (clip) {
            updateClip(clip.id, { duration: metrics.estimatedSeconds, sourceEnd: metrics.estimatedSeconds, clipType: 'audio' })
            setNotice({ kind: 'ok', text: `Added ~${metrics.estimatedSeconds}s synthesized voiceover to timeline!` })
          }
        }
      } else {
        setNotice({ kind: 'error', text: errors[0] ?? 'Could not import TTS audio' })
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'TTS synthesis failed' })
    } finally {
      setIsSynthesizingTts(false)
    }
  }

  const containerMaxWidth =
    maxWidthMode === 'compact' ? 'max-w-xl' : maxWidthMode === 'wide' ? 'max-w-5xl' : 'max-w-3xl'

  return (
    <>
      {/* Background Dimmer when in Fullscreen Mode */}
      {layoutMode === 'full' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      )}

      <div
        className={cn(
          'z-50 flex flex-col bg-background/95 backdrop-blur-2xl text-foreground select-none shadow-2xl transition-all duration-200',
          layoutMode === 'full' && 'fixed inset-0',
          layoutMode === 'half-right' &&
            'fixed top-0 bottom-0 right-0 w-full md:w-1/2 border-l border-border animate-in slide-in-from-right duration-200',
          layoutMode === 'half-left' &&
            'fixed top-0 bottom-0 left-0 w-full md:w-1/2 border-r border-border animate-in slide-in-from-left duration-200',
        )}
      >
        {/* ─── TOP CONTROL BAR ─── */}
        <div className="flex h-14 items-center justify-between border-b border-border/80 px-4 bg-card/60 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 font-bold border border-violet-500/30">
                <ScrollText className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate max-w-[200px] sm:max-w-xs">{script.title || 'Studio Script'}</h2>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono truncate">
                  <span>{metrics.totalWords} words</span>
                  <span>·</span>
                  <span>~{metrics.estimatedSeconds}s read</span>
                  <span>·</span>
                  <span className="text-violet-600 dark:text-violet-400 font-medium capitalize">{script.creatorStyle || 'Creator'}</span>
                </div>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="hidden sm:flex rounded-lg border bg-muted/40 p-0.5 ml-2 shrink-0">
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition',
                  mode === 'teleprompter' ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode('teleprompter')}
              >
                <ScrollText className="size-3.5" />
                <span>Prompter</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition',
                  mode === 'editor' ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode('editor')}
              >
                <Pencil className="size-3.5" />
                <span>Editor</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition',
                  mode === 'hook' ? 'bg-card text-violet-700 dark:text-violet-300 shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode('hook')}
              >
                <Flame className="size-3.5" />
                <span>Hooks</span>
              </button>
            </div>
          </div>

          {/* Action Buttons & Layout Mode Switcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Audio Recorder Button */}
            {recorder.isRecording ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 gap-1.5 font-bold animate-pulse text-xs px-2.5"
                onClick={recorder.stopRecording}
              >
                <Square className="size-3.5 fill-current" />
                <span>Stop ({recorder.duration.toFixed(1)}s)</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold shadow-xs text-xs px-2.5"
                onClick={() => void recorder.startRecording()}
              >
                <Mic className="size-3.5" />
                <span className="hidden sm:inline">Record Voiceover</span>
                <span className="sm:hidden">Record</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="hidden lg:flex h-8 text-xs gap-1.5 border-violet-500/30 hover:bg-violet-500/10 text-violet-300 px-2.5"
              onClick={() => void handleSynthesizeTts()}
              disabled={isSynthesizingTts}
            >
              {isSynthesizingTts ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
              TTS
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="hidden xl:flex h-8 text-xs gap-1.5 px-2.5"
              onClick={handleAddScenesAsTextOverlays}
            >
              <FileText className="size-3.5 text-cyan-400" />
              Overlays
            </Button>

            <Button size="icon" variant="ghost" className="size-8" onClick={handleCopy} title="Copy full script">
              {copied ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
            </Button>

            <Button size="icon" variant="ghost" className="size-8" onClick={handleDownload} title="Download .txt">
              <Download className="size-4" />
            </Button>

            {/* Layout Mode Switcher */}
            <div className="flex items-center rounded-md border bg-muted/40 p-0.5 ml-1" title="Prompter Layout">
              <button
                type="button"
                className={cn(
                  'rounded p-1 text-muted-foreground transition hover:text-foreground',
                  layoutMode === 'full' && 'bg-card text-violet-300 font-bold shadow-xs',
                )}
                onClick={() => setLayoutMode('full')}
                title="Fullscreen Prompter Studio"
              >
                <Maximize2 className="size-3.5" />
              </button>
              <button
                type="button"
                className={cn(
                  'rounded p-1 text-muted-foreground transition hover:text-foreground',
                  layoutMode === 'half-right' && 'bg-card text-violet-300 font-bold shadow-xs',
                )}
                onClick={() => setLayoutMode('half-right')}
                title="Half-Right Split (Read & Record alongside Video)"
              >
                <PanelRight className="size-3.5" />
              </button>
              <button
                type="button"
                className={cn(
                  'rounded p-1 text-muted-foreground transition hover:text-foreground',
                  layoutMode === 'half-left' && 'bg-card text-violet-300 font-bold shadow-xs',
                )}
                onClick={() => setLayoutMode('half-left')}
                title="Half-Left Split (Read & Record alongside Video)"
              >
                <PanelLeft className="size-3.5" />
              </button>
            </div>

            <div className="h-5 w-px bg-border mx-0.5" />

            <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2 text-xs font-medium border-b',
            notice.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30',
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* ─── RECORDING LIVE HUD (When Recording is active) ─── */}
      {recorder.isRecording && (
        <div className="flex items-center justify-between bg-red-950/80 border-b border-red-500/40 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="size-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-bold text-red-200">LIVE AUDIO RECORDING IN PROGRESS</span>
            <span className="font-mono text-sm font-bold text-white">
              {Math.floor(recorder.duration / 60)}:{(Math.floor(recorder.duration) % 60).toString().padStart(2, '0')}.
              {Math.floor((recorder.duration % 1) * 10)}
            </span>
          </div>

          {/* Real-time Mic Level VU Meter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-red-300 font-mono">MIC LEVEL</span>
            <div className="w-36 h-2 rounded-full bg-black/60 overflow-hidden p-0.5 border border-red-500/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-75"
                style={{ width: `${recorder.audioLevel}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-300 hover:text-white" onClick={recorder.cancelRecording}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 bg-white text-black hover:bg-neutral-200 font-bold text-xs" onClick={recorder.stopRecording}>
              Done & Add to Track
            </Button>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT VIEWPORTS ─── */}
      <div className="flex-1 overflow-hidden relative">
        {/* ══════════ 1. TELEPROMPTER VIEW ══════════ */}
        {mode === 'teleprompter' && (
          <div className="flex h-full flex-col">
            {/* Prompter Toolbar Controls */}
            <div className="flex flex-wrap items-center justify-between border-b bg-card/40 px-6 py-2 gap-4">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  className={cn(
                    'h-8 px-4 font-bold text-xs gap-2',
                    isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white',
                  )}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  {isPlaying ? 'Pause (Space)' : 'Play Autoscroll (Space)'}
                </Button>

                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => {
                    if (prompterContainerRef.current) prompterContainerRef.current.scrollTop = 0
                    setIsPlaying(false)
                  }}
                  title="Reset to Start"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>

              {/* Sliders and Toggles */}
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Speed</span>
                  <div className="w-24">
                    <Slider min={10} max={180} step={5} value={[scrollSpeed]} onValueChange={([v]) => setScrollSpeed(v)} />
                  </div>
                  <span className="font-mono text-[10px] w-6">{scrollSpeed}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span>Font</span>
                  <div className="w-24">
                    <Slider min={18} max={56} step={2} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} />
                  </div>
                  <span className="font-mono text-[10px] w-6">{fontSize}px</span>
                </div>

                <div className="flex items-center gap-1.5 border-l pl-4">
                  <button
                    type="button"
                    className={cn(
                      'rounded px-2 py-1 text-[11px] font-medium border transition',
                      mirrorX ? 'border-violet-500 bg-violet-500/20 text-violet-300' : 'border-border/60 text-muted-foreground',
                    )}
                    onClick={() => setMirrorX(!mirrorX)}
                    title="Flip Horizontal for Glass Teleprompter"
                  >
                    ⇄ Flip Horiz
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border transition',
                      mirrorY ? 'border-violet-500 bg-violet-500/20 text-violet-300' : 'border-border/60 text-muted-foreground',
                    )}
                    onClick={() => setMirrorY(!mirrorY)}
                    title="Flip Vertical"
                  >
                    <ArrowUpDown className="size-3" />
                    <span>Flip Vert</span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border transition',
                      guideLine ? 'border-violet-500 bg-violet-500/20 text-violet-300' : 'border-border/60 text-muted-foreground',
                    )}
                    onClick={() => setGuideLine(!guideLine)}
                    title="Toggle Reading Focus Line"
                  >
                    <Crosshair className="size-3" />
                    <span>Focus Line</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border border-border/60 text-muted-foreground hover:text-foreground transition capitalize"
                    onClick={() => setMaxWidthMode((m) => (m === 'normal' ? 'wide' : m === 'wide' ? 'compact' : 'normal'))}
                    title="Toggle Teleprompter Stage Width"
                  >
                    <SlidersHorizontal className="size-3" />
                    <span>{maxWidthMode}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Scrolling Teleprompter Stage */}
            <div className="relative flex-1 bg-black overflow-hidden flex justify-center">
              {/* Reading Marker Line */}
              {guideLine && (
                <div className="absolute top-1/3 left-0 right-0 h-16 pointer-events-none border-y border-amber-500/30 bg-amber-500/5 z-10 flex items-center justify-between px-6">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">▸ Reading Focus</span>
                  <span className="text-[10px] font-mono text-amber-400/60 font-bold">◄</span>
                </div>
              )}

              <div
                ref={prompterContainerRef}
                className={cn(
                  'w-full h-full overflow-y-auto px-12 py-40 select-text transition-transform',
                  containerMaxWidth,
                )}
                style={{
                  transform: `${mirrorX ? 'scaleX(-1)' : ''} ${mirrorY ? 'scaleY(-1)' : ''}`,
                }}
              >
                <div
                  className="space-y-12 font-sans font-medium text-zinc-100 transition-all leading-relaxed"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight,
                  }}
                >
                  {/* Hook */}
                  {script.hook && (
                    <div className="space-y-2 border-l-4 border-amber-500 pl-4">
                      <span className="block text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                        Hook (First 4s)
                      </span>
                      <p className="font-bold text-amber-200">{script.hook}</p>
                    </div>
                  )}

                  {/* Scenes */}
                  {script.scenes.map((scene, i) => (
                    <div key={i} className="space-y-2 border-l-4 border-violet-500/60 pl-4">
                      <div className="flex items-center justify-between text-xs font-mono text-violet-400 font-bold uppercase tracking-wider">
                        <span>Beat {i + 1}: {scene.title}</span>
                        <span className="text-zinc-500 font-normal">~{scene.durationSeconds}s</span>
                      </div>
                      <p className="text-zinc-100">{scene.text}</p>
                      {scene.visualCue && (
                        <p className="text-[0.6em] font-normal text-zinc-400 italic">
                          [B-Roll Visual: {scene.visualCue}]
                        </p>
                      )}
                    </div>
                  ))}

                  {/* CTA */}
                  {script.cta && (
                    <div className="space-y-2 border-l-4 border-emerald-500 pl-4">
                      <span className="block text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                        Call to Action / Outro
                      </span>
                      <p className="font-bold text-emerald-200">{script.cta}</p>
                    </div>
                  )}

                  <div className="h-64" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ 2. STUDIO SCENE EDITOR VIEW ══════════ */}
        {mode === 'editor' && (
          <div className="h-full overflow-y-auto p-6 flex justify-center bg-muted/30">
            <div className={cn('w-full space-y-6 pb-20', containerMaxWidth)}>
              {/* Script Header Details */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Script Metadata</span>
                  <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold" onClick={() => addScene()}>
                    <Plus className="size-3.5 mr-1" /> Add New Beat / Scene
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Script Title</Label>
                    <Input
                      value={script.title}
                      onChange={(e) => updateScript({ title: e.target.value })}
                      className="h-8 text-xs bg-background font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Topic Thesis</Label>
                    <Input
                      value={script.topic}
                      onChange={(e) => updateScript({ topic: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Hook Section */}
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Flame className="size-3.5 text-amber-500" />
                    <span>Opening Hook (First 0-4 Seconds)</span>
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono font-semibold">Max Retention Zone</span>
                </div>
                <textarea
                  value={script.hook}
                  onChange={(e) => updateScript({ hook: e.target.value })}
                  placeholder="The opening spoken sentence that hooks the viewer immediately..."
                  className="w-full h-20 rounded-md border bg-background p-2.5 text-xs text-foreground outline-none focus:border-amber-500 resize-none font-medium leading-relaxed"
                />
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Hook Visual Cue / Opening Action</Label>
                  <Input
                    value={script.hookVisual || ''}
                    onChange={(e) => updateScript({ hookVisual: e.target.value })}
                    placeholder="e.g. Extreme close-up of phone screen exploding with notifications..."
                    className="h-7 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Scenes Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-foreground">Scenes & Narrative Beats ({script.scenes.length})</span>
                </div>

                {script.scenes.map((scene, idx) => (
                  <div key={idx} className="rounded-xl border bg-card p-4 space-y-3 shadow-sm hover:border-violet-500/50 transition">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded bg-violet-600/20 text-violet-600 dark:text-violet-400 text-xs font-bold">
                          {idx + 1}
                        </span>
                        <Input
                          value={scene.title}
                          onChange={(e) => updateScene(idx, { title: e.target.value })}
                          className="h-7 text-xs font-bold w-48 bg-background"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground font-mono">Duration:</Label>
                          <Input
                            type="number"
                            min={2}
                            max={120}
                            value={scene.durationSeconds}
                            onChange={(e) => updateScene(idx, { durationSeconds: Number(e.target.value) || 5 })}
                            className="h-7 w-16 text-xs font-mono bg-background"
                          />
                          <span className="text-[10px] text-muted-foreground">s</span>
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => reorderScenes(idx, Math.max(0, idx - 1))}
                          disabled={idx === 0}
                          title="Move Up"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => reorderScenes(idx, Math.min(script.scenes.length - 1, idx + 1))}
                          disabled={idx === script.scenes.length - 1}
                          title="Move Down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-red-400 hover:text-red-300"
                          onClick={() => removeScene(idx)}
                          disabled={script.scenes.length <= 1}
                          title="Delete Scene"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Spoken Script</Label>
                      <textarea
                        value={scene.text}
                        onChange={(e) => updateScene(idx, { text: e.target.value })}
                        placeholder="What the presenter/voiceover says during this scene..."
                        className="w-full h-24 rounded-md border bg-background p-2.5 text-xs text-foreground outline-none focus:border-violet-500 resize-none leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">B-Roll / Visual Direction</Label>
                        <Input
                          value={scene.visualCue || ''}
                          onChange={(e) => updateScene(idx, { visualCue: e.target.value })}
                          placeholder="e.g. Fast screen recording of AI generating 3D model..."
                          className="h-7 text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">On-Screen Text Overlay</Label>
                        <Input
                          value={scene.onScreenText || ''}
                          onChange={(e) => updateScene(idx, { onScreenText: e.target.value })}
                          placeholder="e.g. STEP 1: PROMPT TO 3D"
                          className="h-7 text-xs bg-background font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Outro CTA Section */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-emerald-500" />
                    <span>Outro &amp; Call to Action (CTA)</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-semibold">Closing Conversion</span>
                </div>
                <textarea
                  value={script.cta}
                  onChange={(e) => updateScript({ cta: e.target.value })}
                  placeholder="Clear, memorable closing takeaway and specific action step..."
                  className="w-full h-20 rounded-md border bg-background p-2.5 text-xs text-foreground outline-none focus:border-emerald-500 resize-none font-medium leading-relaxed"
                />
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">CTA Visual Cue</Label>
                  <Input
                    value={script.ctaVisual || ''}
                    onChange={(e) => updateScript({ ctaVisual: e.target.value })}
                    placeholder="e.g. Subscribe button pop animation with channel banner..."
                    className="h-7 text-xs bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ 3. HOOK RETENTION ANALYZER ══════════ */}
        {mode === 'hook' && (
          <div className="h-full overflow-y-auto p-6 flex justify-center bg-muted/30">
            <div className={cn('w-full space-y-4', containerMaxWidth)}>
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  Hook Pacing & Retention Architecture
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  According to viral short-form retention curves, 70% of viewers decide whether to watch within the first 3.5 seconds.
                  Your current script uses the <span className="text-violet-600 dark:text-violet-400 font-semibold">{script.creatorStyle}</span> pacing model.
                </p>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
                    <span>Opening Hook Spoken Text:</span>
                    <span>~{Math.max(2, Math.round(script.hook.split(/\s+/).length * 0.38))}s read</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground font-mono bg-background/80 p-3 rounded border border-amber-500/30">
                    &ldquo;{script.hook}&rdquo;
                  </p>
                  {script.hookVisual && (
                    <p className="text-xs text-amber-700/90 dark:text-amber-200/80 italic">
                      Visual: {script.hookVisual}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg border bg-muted/20 p-3 text-center space-y-1">
                    <span className="text-[10px] text-muted-foreground font-mono">TOTAL SCRIPT DURATION</span>
                    <p className="text-base font-bold text-foreground font-mono">~{metrics.estimatedSeconds}s</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3 text-center space-y-1">
                    <span className="text-[10px] text-muted-foreground font-mono">WORDS PER MINUTE</span>
                    <p className="text-base font-bold text-emerald-400 font-mono">{metrics.wpm} WPM</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3 text-center space-y-1">
                    <span className="text-[10px] text-muted-foreground font-mono">SCENES & BEATS</span>
                    <p className="text-base font-bold text-violet-400 font-mono">{script.scenes.length} Scenes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </>
)
}
