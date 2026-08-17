import * as React from 'react'
import { Clapperboard, Loader2, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import { readMediaFile } from '@/engine/storage/opfs'
import { generateLipsyncVideo, type AvatarMouth } from '@/engine/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RESOLUTIONS = ['512x512', '768x768', '1024x1024']
const BACKGROUNDS = ['transparent', 'solid', 'blurred'] as const
type Background = (typeof BACKGROUNDS)[number]

interface Props {
  open: boolean
  onClose: () => void
}

export function AvatarGeneratorDialog({ open, onClose }: Props) {
  const assets = useTimelineStore((s) => s.assets)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const avatar = useApiConfigStore((s) => s.config.avatar)

  const [imageAssetId, setImageAssetId] = React.useState('')
  const [audioAssetId, setAudioAssetId] = React.useState('')
  const [resolution, setResolution] = React.useState(avatar.resolution)
  const [fps, setFps] = React.useState(avatar.fps)
  const [background, setBackground] = React.useState<Background>(avatar.background as Background)
  const [mouth, setMouth] = React.useState<AvatarMouth>({
    x: avatar.mouthX,
    y: avatar.mouthY,
    width: avatar.mouthWidth,
    maxOpen: avatar.mouthMaxOpen,
  })
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const previewRef = React.useRef<HTMLCanvasElement>(null)

  const images = React.useMemo(() => assets.filter((a) => a.type === 'image'), [assets])
  const audios = React.useMemo(() => assets.filter((a) => a.type === 'audio'), [assets])

  // Seed the form from settings every time the dialog opens.
  React.useEffect(() => {
    if (!open) return
    setResolution(avatar.resolution)
    setFps(avatar.fps)
    setBackground((avatar.background as Background) ?? 'solid')
    setMouth({ x: avatar.mouthX, y: avatar.mouthY, width: avatar.mouthWidth, maxOpen: avatar.mouthMaxOpen })
    setError(null)
    setSuccess(null)
    setProgress(null)
    if (images.length && !assets.find((a) => a.id === imageAssetId && a.type === 'image')) {
      setImageAssetId(images[0].id)
    }
    if (audios.length && !assets.find((a) => a.id === audioAssetId && a.type === 'audio')) {
      setAudioAssetId(audios[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, avatar, images.length, audios.length])

  const imageAsset = assets.find((a) => a.id === imageAssetId) ?? null
  const audioAsset = assets.find((a) => a.id === audioAssetId) ?? null

  // Live preview of the avatar with the configured mouth position.
  React.useEffect(() => {
    let cancelled = false
    const canvas = previewRef.current
    if (!canvas || !open || !imageAsset) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    void (async () => {
      try {
        const file = await readMediaFile(imageAsset.filePath)
        const url = URL.createObjectURL(file)
        const img = new Image()
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
          img.src = url
        })
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        const w = canvas.width
        const h = canvas.height
        const iw = img.naturalWidth || w
        const ih = img.naturalHeight || h
        const scale = Math.max(w / iw, h / ih)
        ctx.drawImage(img, (w - iw * scale) / 2, (h - ih * scale) / 2, iw * scale, ih * scale)
        URL.revokeObjectURL(url)

        // Draw the mouth at mid-open so the anchor is visible while adjusting.
        const x = mouth.x * w
        const y = mouth.y * h
        const mw = Math.max(4, mouth.width * w)
        const maxOpenPx = Math.max(1, mouth.maxOpen * h)
        const openPx = maxOpenPx * 0.5
        const lip = Math.max(2, mw * 0.16)
        ctx.fillStyle = '#4a161b'
        ctx.beginPath()
        ctx.ellipse(x, y, mw * 0.55, Math.min(openPx * 0.85, maxOpenPx * 0.9), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#b56a6e'
        ctx.beginPath()
        ctx.ellipse(x, y - openPx * 0.22, mw * 0.5, Math.max(lip * 0.45, lip - openPx * 0.4), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(x, y + openPx * 0.3, mw * 0.5, Math.max(lip * 0.4, lip * 0.7 + openPx * 0.5), 0, 0, Math.PI * 2)
        ctx.fill()
      } catch {
        // preview is best-effort
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, imageAsset, mouth, resolution])

  React.useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const cancel = () => {
    abortRef.current?.abort()
  }

  const handleClose = () => {
    cancel()
    onClose()
  }

  const generate = async () => {
    if (!imageAsset || !audioAsset || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    setProgress(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const [imageFile, audioFile] = await Promise.all([
        readMediaFile(imageAsset.filePath),
        readMediaFile(audioAsset.filePath),
      ])
      const [width, height] = resolution.split('x').map((n) => Number(n))
      const result = await generateLipsyncVideo({
        imageFile,
        audioFile,
        width,
        height,
        fps,
        bitrate: 3_000_000,
        codec: 'vp8',
        mouth,
        background,
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      const file = new File([result.blob], `${imageAsset.name}-lipsync.webm`, { type: 'video/webm' })
      const { imported, errors } = await importFiles([file])
      if (imported.length) {
        setSuccess(`Generated ${imported[0].name} (${result.duration.toFixed(1)}s) and added it to the timeline.`)
      } else {
        setError(errors[0] ?? 'Could not add the generated clip to the timeline.')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Generation cancelled.')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setBusy(false)
      setProgress(null)
      abortRef.current = null
    }
  }

  if (!open) return null

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
            <Clapperboard className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Avatar Lip-Sync</h3>
            <p className="text-muted-foreground text-[11px]">Rendered on-device in your browser — no API</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex gap-4">
            <canvas ref={previewRef} width={200} height={200} className="size-[200px] shrink-0 rounded-lg border bg-muted" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="avatar-img">Avatar image</Label>
                <Select value={imageAssetId} onValueChange={setImageAssetId}>
                  <SelectTrigger id="avatar-img" className="w-full">
                    <SelectValue placeholder="Pick an image" />
                  </SelectTrigger>
                  <SelectContent>
                    {images.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="avatar-audio">Speech audio</Label>
                <Select value={audioAssetId} onValueChange={setAudioAssetId}>
                  <SelectTrigger id="avatar-audio" className="w-full">
                    <SelectValue placeholder="Pick audio" />
                  </SelectTrigger>
                  <SelectContent>
                    {audios.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Resolution</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="avatar-fps">FPS</Label>
              <Input
                id="avatar-fps"
                type="number"
                min={15}
                max={60}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Background</Label>
              <Select value={background} onValueChange={(v) => setBackground(v as Background)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BACKGROUNDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Mouth position X</Label>
              <Slider min={0.2} max={0.8} step={0.01} value={[mouth.x]} onValueChange={([v]) => setMouth((m) => ({ ...m, x: v }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mouth position Y</Label>
              <Slider min={0.5} max={0.95} step={0.01} value={[mouth.y]} onValueChange={([v]) => setMouth((m) => ({ ...m, y: v }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mouth width</Label>
              <Slider min={0.05} max={0.35} step={0.01} value={[mouth.width]} onValueChange={([v]) => setMouth((m) => ({ ...m, width: v }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Max mouth open</Label>
              <Slider min={0.02} max={0.2} step={0.01} value={[mouth.maxOpen]} onValueChange={([v]) => setMouth((m) => ({ ...m, maxOpen: v }))} />
            </div>
          </div>

          {progress && (
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-muted-foreground">
                  Rendering {progress.done}/{progress.total} frames
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          {success && <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{success}</p>}

          {!imageAsset && (
            <p className="text-muted-foreground text-xs">
              Import an avatar image first (Portrait, media browser → Import). Double-click it to add it to the timeline.
            </p>
          )}
          {!audioAsset && (
            <p className="text-muted-foreground text-xs">
              Import a speech/narration audio clip first (MP3, WAV, M4A…) so the mouth can be synchronized to it.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          {busy && (
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={busy || !imageAsset || !audioAsset}
            onClick={() => void generate()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Clapperboard />}
            {busy ? 'Generating…' : 'Generate lip-sync video'}
          </Button>
        </div>
      </div>
    </div>
  )
}
