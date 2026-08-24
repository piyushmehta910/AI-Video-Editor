import * as React from 'react'
import { X, Loader2, Download, FileVideo } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { exportProject } from '@/engine/export/exportVideo'
import { exportMp4 } from '@/engine/export/exportMp4'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

type Codec = 'h264' | 'vp8' | 'vp9' | 'av1'
type Format = 'webm' | 'mp4'

const QUALITY_PRESETS: Record<string, { label: string; bitrate: number }> = {
  low: { label: 'Low (faster)', bitrate: 2_000_000 },
  medium: { label: 'Medium', bitrate: 5_000_000 },
  high: { label: 'High (slower)', bitrate: 10_000_000 },
  very_high: { label: 'Very High (4K)', bitrate: 35_000_000 },
}

const CODEC_INFO: Record<Codec, string> = {
  h264: 'Universal compatibility. MP4 · H.264 + AAC.',
  vp9: 'Best balance of quality & size. WebM.',
  vp8: 'Max compatibility with old devices. WebM.',
  av1: 'Smallest file, slowest to encode. WebM.',
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const project = useTimelineStore((s) => s.project)
  const assets = useTimelineStore((s) => s.assets)
  const duration = useTimelineStore((s) => s.duration())

  const resolutions: Array<{ label: string; w: number; h: number }> = React.useMemo(() => {
    const ratio = project.width / project.height
    const currentW = project.width
    const currentH = project.height

    const scales: Array<{ label: string; w?: number; h?: number; base?: number }> = [
      { label: 'Match Project', w: currentW, h: currentH },
      { label: '720p', base: 720 },
      { label: '1080p', base: 1080 },
      { label: '1440p', base: 1440 },
      { label: '4K UHD', base: 2160 },
    ]

    return scales.map((s) => {
      if (s.w != null && s.h != null) {
        return { label: s.label, w: s.w, h: s.h }
      }
      const base = s.base ?? 1080
      if (ratio >= 1) {
        const h = base
        const w = Math.round(h * ratio)
        return { label: s.label, w: (w % 2 === 0 ? w : w + 1), h: (h % 2 === 0 ? h : h + 1) }
      } else {
        const w = base
        const h = Math.round(w / ratio)
        return { label: s.label, w: (w % 2 === 0 ? w : w + 1), h: (h % 2 === 0 ? h : h + 1) }
      }
    })
  }, [project.width, project.height])

  const [resolution, setResolution] = React.useState('Match Project')
  const [fps, setFps] = React.useState(project.fps)
  const [format, setFormat] = React.useState<Format>('mp4')
  const [codec, setCodec] = React.useState<Codec>('h264')
  const [quality, setQuality] = React.useState('medium')

  const [progress, setProgress] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [error, setError] = React.useState('')
  const [resultUrl, setResultUrl] = React.useState('')
  const abortRef = React.useRef<AbortController | null>(null)

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

  if (!open) return null

  const preset = QUALITY_PRESETS[quality]
  const res = resolutions.find((r) => r.label === resolution) ?? resolutions[0]
  const width = Math.round(res?.w ?? project.width ?? 1920)
  const height = Math.round(res?.h ?? project.height ?? 1080)

  const handleExport = async () => {
    setStatus('running')
    setProgress(0)
    setError('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const shared = {
        width,
        height,
        fps,
        bitrate: preset.bitrate,
        onProgress: (done: number, totalFrames: number) => {
          setProgress(done)
          setTotal(totalFrames)
        },
        signal: controller.signal,
      }
      const { blob, frames } =
        format === 'mp4'
          ? await exportMp4(project, assets, shared)
          : await exportProject(project, assets, { ...shared, codec: codec as 'vp8' | 'vp9' | 'av1' })
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
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setStatus('idle')
    setProgress(0)
  }

  const percent = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0
  const filename = `${project.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'clipforge'}.${format}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <FileVideo className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Export Video</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Resolution</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger size="sm" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutions.map((r) => (
                    <SelectItem key={r.label} value={r.label}>
                      {r.label} · {r.w}×{r.h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frame rate</Label>
              <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))}>
                <SelectTrigger size="sm" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[24, 25, 30, 48, 60].map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      {f} fps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select
                value={format}
                onValueChange={(v) => {
                  const next = v as Format
                  setFormat(next)
                  if (next === 'mp4') setCodec('h264')
                  if (next === 'webm' && codec === 'h264') setCodec('vp9')
                }}
              >
                <SelectTrigger size="sm" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4</SelectItem>
                  <SelectItem value="webm">WebM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Codec</Label>
              <Select
                value={codec}
                onValueChange={(v) => {
                  const next = v as Codec
                  setCodec(next)
                  if (next === 'h264') setFormat('mp4')
                  if (next === 'vp9' || next === 'vp8' || next === 'av1') setFormat('webm')
                }}
              >
                <SelectTrigger size="sm" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {format === 'mp4' ? (
                    <SelectItem value="h264">H.264 (AVC)</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="vp9">VP9</SelectItem>
                      <SelectItem value="vp8">VP8</SelectItem>
                      <SelectItem value="av1">AV1</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger size="sm" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUALITY_PRESETS).map(([key, q]) => (
                    <SelectItem key={key} value={key}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">{CODEC_INFO[codec]}</p>

          {(resolution === '4K UHD' || resolution === '1440p') && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
              ⚠️ High-resolution export requires significant time and memory. For 4K, choose VP9 or H.264 with Very High quality.
            </div>
          )}

          <div className="text-muted-foreground flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span>
              {width}×{height} · {formatSeconds(duration)}
            </span>
            <span>{(preset.bitrate / 1_000_000).toFixed(0)} Mbps</span>
          </div>

          {status === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Encoding frame {progress} / {total || '…'}
                </span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          {status === 'done' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                <span>Export complete</span>
                <span>{percent}%</span>
              </div>
              <Button className="w-full" asChild>
                <a href={resultUrl} download={filename}>
                  <Download />
                  Download {filename}
                </a>
              </Button>
            </div>
          )}

          {status === 'idle' && (
            <Button className="w-full" onClick={() => void handleExport()}>
              Export
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}