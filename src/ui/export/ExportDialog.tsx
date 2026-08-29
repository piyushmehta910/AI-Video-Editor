import * as React from 'react'
import { createPortal } from 'react-dom'
import { bitrateFor, type QualityId } from '@/lib/exportFormats'
import {
  X,
  Loader2,
  Download,
  FileVideo,
  AlertTriangle,
  Film,
  Sparkles,
  CheckCircle2,
  Tv,
  Smartphone,
  Gauge,
  Sliders,
} from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { exportProject } from '@/engine/export/exportVideo'
import { exportMp4 } from '@/engine/export/exportMp4'
import { beginExportSession } from '@/engine/export/exportSession'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

type Codec = 'h264' | 'vp8' | 'vp9' | 'av1' | 'wav'
type Format = 'webm' | 'mp4' | 'wav'

interface QualityPreset {
  label: string
  description: string
}

const QUALITY_PRESETS: Record<string, QualityPreset> = {
  low: { label: 'Low (Fastest)', description: 'Smaller file size, quick export' },
  medium: { label: 'Medium (Balanced)', description: 'Recommended for YouTube & Web' },
  high: { label: 'High (Crisp 1080p)', description: 'High fidelity for production' },
  very_high: { label: 'Ultra (4K / Master)', description: 'Maximum bitrate for 4K archiving' },
}

const CODEC_INFO: Record<Codec, string> = {
  h264: 'Universal MP4 compatibility (H.264 + AAC). Plays on all devices & browsers.',
  vp9: 'High compression & quality (VP9 + Opus). Native in Chrome, Edge, and YouTube.',
  vp8: 'Legacy WebM codec for maximum backward compatibility with older devices.',
  av1: 'Next-gen open video codec with ultra-efficient compression.',
  wav: 'Lossless uncompressed 48kHz stereo master audio track.',
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const project = useTimelineStore((s) => s.project)
  const assets = useTimelineStore((s) => s.assets)
  const duration = useTimelineStore((s) => s.duration())

  const resolutions = React.useMemo(() => {
    const currentW = project.width || 1920
    const currentH = project.height || 1080

    const list = [
      { label: 'Match Project', w: currentW, h: currentH, desc: `${currentW}×${currentH} (${project.aspectRatio})` },
      { label: '1080p Full HD', w: 1920, h: 1080, desc: '1920×1080 (16:9 Landscape)' },
      { label: '9:16 Vertical Reel', w: 1080, h: 1920, desc: '1080×1920 (TikTok / Shorts)' },
      { label: '720p HD', w: 1280, h: 720, desc: '1280×720 (Fast Preview)' },
      { label: '1440p 2K QHD', w: 2560, h: 1440, desc: '2560×1440 (2K Master)' },
      { label: '4K UHD', w: 3840, h: 2160, desc: '3840×2160 (Ultra HD)' },
      { label: '1:1 Square', w: 1080, h: 1080, desc: '1080×1080 (Instagram Feed)' },
    ]

    return list
  }, [project.width, project.height, project.aspectRatio])

  const [resolution, setResolution] = React.useState('Match Project')
  const [fps, setFps] = React.useState(project.fps || 30)
  const [format, setFormat] = React.useState<Format>('mp4')
  const [codec, setCodec] = React.useState<Codec>('h264')
  const [quality, setQuality] = React.useState('medium')
  const [customName, setCustomName] = React.useState(
    project.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'clipforge-export',
  )

  const [progress, setProgress] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [error, setError] = React.useState('')
  const [resultUrl, setResultUrl] = React.useState('')
  const abortRef = React.useRef<AbortController | null>(null)
  // Throttle progress re-renders — updating state on every frame caused a
  // React render storm (60+ renders/sec) on top of the encoder load.
  const lastProgressAtRef = React.useRef(0)

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setStatus('idle')
      setProgress(0)
      setTotal(0)
      setError('')
      setResultUrl('')
    }
  }, [open, resultUrl])

  // Escape closes this dialog while open; capture phase prevents the global
  // cancelOperation shortcut from also firing.
  React.useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc, { capture: true })
    return () => window.removeEventListener('keydown', handleEsc, { capture: true })
  }, [open, onClose])

  if (!open) return null

  const selectedRes = resolutions.find((r) => r.label === resolution) ?? resolutions[0]
  const width = Math.round(selectedRes?.w ?? project.width ?? 1920)
  const height = Math.round(selectedRes?.h ?? project.height ?? 1080)
  // Resolution-aware bitrate — replaces the old fixed-quality presets that
  // ignored whether the user picked 360p or 4K.
  const effectiveBitrate = bitrateFor(quality as QualityId, width, height)

  // Estimated file size: (bitrate bits/sec × duration secs) / 8 / 1024 / 1024
  const estimatedSizeMb = Math.max(0.5, ((effectiveBitrate * Math.max(1, duration)) / 8 / 1024 / 1024)).toFixed(1)

  const applyPresetProfile = (type: 'youtube' | 'reel' | 'webm_hq' | '4k' | 'audio_only') => {
    if (type === 'youtube') {
      setFormat('mp4')
      setCodec('h264')
      setResolution('1080p Full HD')
      setFps(30)
      setQuality('high')
    } else if (type === 'reel') {
      setFormat('mp4')
      setCodec('h264')
      setResolution('9:16 Vertical Reel')
      setFps(30)
      setQuality('high')
    } else if (type === 'webm_hq') {
      setFormat('webm')
      setCodec('vp9')
      setResolution('1080p Full HD')
      setFps(60)
      setQuality('high')
    } else if (type === '4k') {
      setFormat('mp4')
      setCodec('h264')
      setResolution('4K UHD')
      setFps(60)
      setQuality('very_high')
    } else if (type === 'audio_only') {
      setFormat('webm')
      setCodec('vp9')
      setResolution('Match Project')
      setQuality('low')
    }
  }

  const handleExport = async () => {
    setStatus('running')
    setProgress(0)
    setError('')
    const controller = new AbortController()
    abortRef.current = controller
    // Pause the live preview so playback compositing does not compete with
    // the export loop for CPU/GPU (see exportSession.ts / usePlayback).
    const releaseExport = beginExportSession()
    lastProgressAtRef.current = 0
    try {
      const shared = {
        width,
        height,
        fps,
        bitrate: effectiveBitrate,
        onProgress: (done: number, totalFrames: number) => {
          const now = performance.now()
          if (now - lastProgressAtRef.current >= 120 || done >= totalFrames) {
            lastProgressAtRef.current = now
            setProgress(done)
            setTotal(totalFrames)
          }
        },
        signal: controller.signal,
      }
      const { blob, frames } =
        format === 'mp4'
          ? await exportMp4(project, assets, shared)
          : await exportProject(project, assets, { ...shared, codec: (codec === 'h264' ? 'vp9' : codec) as 'vp8' | 'vp9' | 'av1' })
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      setStatus('done')
      setTotal(frames ?? 0)
      setProgress(frames ?? 0)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setStatus('idle')
        setProgress(0)
        return
      }
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      releaseExport()
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setStatus('idle')
    setProgress(0)
  }

  const percent = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0
  const finalFilename = `${customName.trim() || 'clipforge-export'}.${format}`

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog Container */}
      <div className="relative w-full max-w-xl max-h-[94svh] flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-3.5 sm:px-5 py-3 sm:py-3.5 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs shrink-0">
              <FileVideo className="size-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">Export Project Video</h2>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">High-performance GPU browser render</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body Content (Scrollable if screen is small) */}
        <div className="flex-1 overflow-y-auto space-y-3.5 sm:space-y-4 px-3.5 sm:px-5 py-3 sm:py-4 text-xs">
          {/* Quick Platform Presets */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Sparkles className="size-3 text-violet-500" />
              Quick Export Profiles
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetProfile('youtube')}
                className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-violet-500/60 hover:bg-violet-500/10 transition"
              >
                <Tv className="size-3 text-red-500" />
                1080p MP4 (YouTube)
              </button>
              <button
                type="button"
                onClick={() => applyPresetProfile('reel')}
                className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-violet-500/60 hover:bg-violet-500/10 transition"
              >
                <Smartphone className="size-3 text-pink-500" />
                9:16 Reel (TikTok)
              </button>
              <button
                type="button"
                onClick={() => applyPresetProfile('webm_hq')}
                className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-violet-500/60 hover:bg-violet-500/10 transition"
              >
                <Film className="size-3 text-cyan-500" />
                WebM (VP9 60fps)
              </button>
              <button
                type="button"
                onClick={() => applyPresetProfile('4k')}
                className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-violet-500/60 hover:bg-violet-500/10 transition"
              >
                <Gauge className="size-3 text-amber-500" />
                4K Cinema Master
              </button>
            </div>
          </div>

          {/* Filename Input */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-foreground">File Name</Label>
            <div className="flex items-center rounded-lg border border-input bg-background/50 px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500/50">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="project-export-name"
                className="flex-1 bg-transparent text-xs text-foreground outline-none font-medium"
              />
              <span className="font-mono text-[11px] font-bold text-muted-foreground uppercase">
                .{format}
              </span>
            </div>
          </div>

          {/* Main Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Resolution */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-foreground">Resolution</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="w-full h-9 justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050]">
                  {resolutions.map((r) => (
                    <SelectItem key={r.label} value={r.label}>
                      <div className="flex flex-col text-left">
                        <span className="font-semibold">{r.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{r.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frame rate */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-foreground">Frame Rate</Label>
              <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))}>
                <SelectTrigger className="w-full h-9 justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050]">
                  <SelectItem value="24">24 fps (Cinematic Film)</SelectItem>
                  <SelectItem value="25">25 fps (PAL Standard)</SelectItem>
                  <SelectItem value="30">30 fps (Standard Web/Vlog)</SelectItem>
                  <SelectItem value="60">60 fps (High Motion & Smooth)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format Container */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-foreground">Format Container</Label>
              <Select
                value={format}
                onValueChange={(v) => {
                  const next = v as Format
                  setFormat(next)
                  if (next === 'mp4') setCodec('h264')
                  if (next === 'webm' && codec === 'h264') setCodec('vp9')
                }}
              >
                <SelectTrigger className="w-full h-9 justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050]">
                  <SelectItem value="mp4">MP4 Video (.mp4)</SelectItem>
                  <SelectItem value="webm">WebM Video (.webm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Codec */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-foreground">Video Codec</Label>
              <Select
                value={codec}
                onValueChange={(v) => {
                  const next = v as Codec
                  setCodec(next)
                  if (next === 'h264') setFormat('mp4')
                  if (next === 'vp9' || next === 'vp8' || next === 'av1') setFormat('webm')
                }}
              >
                <SelectTrigger className="w-full h-9 justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050]">
                  {format === 'mp4' ? (
                    <SelectItem value="h264">H.264 / AVC (Recommended)</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="vp9">VP9 (High Quality)</SelectItem>
                      <SelectItem value="vp8">VP8 (Legacy Compatibility)</SelectItem>
                      <SelectItem value="av1">AV1 (Ultra Compressed)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Quality Preset */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span>Quality & Bitrate</span>
                <span className="font-mono text-[10px] text-violet-500 font-bold">
                  {(effectiveBitrate / 1_000_000).toFixed(0)} Mbps
                </span>
              </Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger className="w-full h-9 justify-between">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10050]">
                  {Object.entries(QUALITY_PRESETS).map(([key, q]) => {
                    const optBitrate = bitrateFor(key as QualityId, width, height)
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="font-semibold">{q.label}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {(optBitrate / 1_000_000).toFixed(0)} Mbps · {q.description}
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info Card */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5 text-foreground font-bold">
                <Sliders className="size-3.5 text-violet-500" />
                {width}×{height} @ {fps}fps
              </span>
              <span>{formatSeconds(duration)} length</span>
              <span className="font-mono text-violet-600 dark:text-violet-400 font-bold">
                ~{estimatedSizeMb} MB
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {CODEC_INFO[codec]}
            </p>
          </div>

          {(resolution === '4K UHD' || resolution === '1440p 2K QHD') && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
              <span>
                4K UHD render utilizes high hardware GPU decoding and frame synthesis. Please keep this tab active during encoding.
              </span>
            </div>
          )}

          {/* Progress State */}
          {status === 'running' && (
            <div className="space-y-2 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
                  <Loader2 className="size-4 animate-spin text-violet-500" />
                  Rendering frame {progress} / {total || '…'}
                </span>
                <span className="font-mono text-violet-600 dark:text-violet-400 font-bold">{percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-150"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleCancel}>
                Cancel Render
              </Button>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Completed State */}
          {status === 'done' && (
            <div className="space-y-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  Video Encoded Successfully!
                </span>
                <span>{percent}%</span>
              </div>
              <Button
                className="w-full gap-2 bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-md"
                asChild
              >
                <a href={resultUrl} download={finalFilename}>
                  <Download className="size-4" />
                  Download {finalFilename}
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {status === 'idle' && (
          <div className="border-t border-border/80 px-5 py-3 bg-muted/20 flex items-center justify-end gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleExport()}
              className="gap-1.5 bg-violet-600 font-bold text-white hover:bg-violet-500 shadow-xs px-5"
            >
              <Download className="size-3.5" />
              Export Video
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}