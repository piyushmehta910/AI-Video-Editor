import * as React from 'react'
import { Mic, Video, Image as ImageIcon, Loader2, Download, Wand2, AlertTriangle, Sparkles, XCircle } from 'lucide-react'
import { useLipSync, createLipSyncInput, createLipSyncInputFromImage } from '@/hooks/useLipSync'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '../StatusBadge'
import { DropZone } from '../DropZone'
import { cn } from '@/lib/utils'

export interface LipSyncClipData {
  id: string
  type: 'lipsync'
  name: string
  startTime: number
  duration: number
  avatarVideoUrl?: string
  audioUrl?: string
  outputVideoUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  config: {
    modelUrl: string
    fps: number
    batchSize: number
  }
}

interface LipSyncEditorProps {
  clip?: LipSyncClipData
  onSave: (clip: LipSyncClipData) => void
  onClose: () => void
}

type InputMode = 'video' | 'image'

const MODES: Array<{ value: InputMode; label: string; icon: React.ReactNode }> = [
  { value: 'video', label: 'Video', icon: <Video className="size-3.5" /> },
  { value: 'image', label: 'Image', icon: <ImageIcon className="size-3.5" /> },
]

export function LipSyncEditor({ clip, onSave, onClose }: LipSyncEditorProps) {
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [audioFile, setAudioFile] = React.useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = React.useState<string>(clip?.avatarVideoUrl || '')
  const [audioPreview, setAudioPreview] = React.useState<string>(clip?.audioUrl || '')
  const [outputPreview, setOutputPreview] = React.useState<string>(clip?.outputVideoUrl || '')
  const [status, setStatus] = React.useState<LipSyncClipData['status']>(clip?.status || 'pending')
  const [progress, setProgress] = React.useState(clip?.progress || 0)
  const [config, setConfig] = React.useState({
    modelUrl: '/models/wav2lip.onnx',
    fps: 25,
    batchSize: 8,
    ...clip?.config,
  })
  const [error, setError] = React.useState<string | null>(null)
  const [inputMode, setInputMode] = React.useState<InputMode>('video')
  const [engineReady, setEngineReady] = React.useState(false)
  const [engineError, setEngineError] = React.useState<string | null>(null)

  const { processing, initialize, process, terminate } = useLipSync({
    config: { modelUrl: config.modelUrl, inputSize: [96, 96], fps: config.fps, batchSize: config.batchSize },
    onProgress: setProgress,
    onComplete: (result) => {
      setStatus('completed')
      const blob = new Blob([result.frames as unknown as BlobPart], { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      setOutputPreview(url)
      onSave({ ...clip!, status: 'completed', progress: 1, outputVideoUrl: url } as LipSyncClipData)
    },
    onError: (err) => {
      setStatus('error')
      setError(err)
    },
  })

  const initEngine = React.useCallback(async () => {
    setEngineError(null)
    setEngineReady(false)
    try {
      await initialize({ modelUrl: config.modelUrl, inputSize: [96, 96], fps: config.fps, batchSize: config.batchSize })
      setEngineReady(true)
    } catch (err) {
      setEngineReady(false)
      setEngineError(err instanceof Error ? err.message : String(err))
    }
  }, [config.modelUrl, config.fps, config.batchSize, initialize])

  React.useEffect(() => {
    void initEngine()
    return () => terminate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAvatarUpload = (file: File) => {
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError(null)
  }

  const handleAudioUpload = (file: File) => {
    setAudioFile(file)
    setAudioPreview(URL.createObjectURL(file))
    setError(null)
  }

  const handleGenerate = async () => {
    if (!avatarFile || !audioFile) {
      setError(inputMode === 'video' ? 'Please select both avatar video and audio' : 'Please select both avatar image and audio')
      return
    }

    if (!engineReady) {
      await initEngine()
      if (!engineReady) return
    }

    setStatus('processing')
    setProgress(0)
    setError(null)

    try {
      const input = inputMode === 'video'
        ? await createLipSyncInput(avatarFile, audioFile)
        : await createLipSyncInputFromImage(avatarFile, audioFile)
      await process(input)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const handleCancel = () => {
    terminate()
    setEngineReady(false)
    setStatus('pending')
    setProgress(0)
  }

  const handleDownload = () => {
    if (!outputPreview) return
    const a = document.createElement('a')
    a.href = outputPreview
    a.download = `lipsync-${clip?.name || 'avatar'}.webm`
    a.click()
  }

  const canGenerate = avatarFile && audioFile && engineReady && !processing

  const sectionTitle = (num: string, title: string, sub?: string) => (
    <div className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {num}
      </span>
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Mic className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Wav2Lip Neural Lip Sync</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">Generate realistic lip-sync from avatar + audio — in-browser</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex',
                engineReady ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
              )}
            >
              {engineReady ? (
                <>
                  <Sparkles className="size-3" />
                  Engine ready
                </>
              ) : (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Loading model…
                </>
              )}
            </span>
            <StatusBadge status={status} progress={progress} />
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {engineError && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  <p className="font-medium">Model failed to load: {engineError}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Place a converted <code className="rounded bg-muted px-1">wav2lip.onnx</code> model in{' '}
                    <code className="rounded bg-muted px-1">public/models/</code> or update the model URL below.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {sectionTitle('1', 'Avatar Input', 'Use a video or a single image')}
              <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setInputMode(m.value)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      inputMode === m.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
              <DropZone
                accept={inputMode === 'video' ? 'video/*' : 'image/*'}
                file={avatarFile}
                onFile={handleAvatarUpload}
                onClear={() => {
                  setAvatarFile(null)
                  setAvatarPreview('')
                  setError(null)
                }}
                label={inputMode === 'video' ? 'Choose avatar video' : 'Choose avatar image'}
                hint={inputMode === 'video' ? 'MP4, WebM, MOV — drop or click to browse' : 'PNG, JPG, WebP — drop or click to browse'}
                icon={inputMode === 'video' ? <Video className="size-4" /> : <ImageIcon className="size-4" />}
              />
              {avatarPreview && (
                <div className="relative aspect-video overflow-hidden rounded-md border">
                  {inputMode === 'video' ? (
                    <video
                      src={avatarPreview}
                      className="size-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <img src={avatarPreview} alt="Avatar" className="size-full object-cover" />
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              {sectionTitle('2', 'Speech Audio', 'The audio your avatar will speak')}
              <DropZone
                accept="audio/*"
                file={audioFile}
                onFile={handleAudioUpload}
                onClear={() => {
                  setAudioFile(null)
                  setAudioPreview('')
                  setError(null)
                }}
                label="Choose audio file"
                hint="MP3, WAV, M4A, OGG — drop or click to browse"
                icon={<Mic className="size-4" />}
              />
              {audioPreview && (
                <audio src={audioPreview} controls className="w-full rounded-md border" />
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              {sectionTitle('3', 'Settings', 'Tune generation parameters')}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Model URL</Label>
                  <Input
                    value={config.modelUrl}
                    onChange={(e) => handleConfigChange('modelUrl', e.target.value)}
                    placeholder="/models/wav2lip.onnx"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">FPS</Label>
                  <Select value={String(config.fps)} onValueChange={(v) => handleConfigChange('fps', Number(v))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="FPS" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 fps</SelectItem>
                      <SelectItem value="25">25 fps</SelectItem>
                      <SelectItem value="30">30 fps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Batch Size</Label>
                  <Select value={String(config.batchSize)} onValueChange={(v) => handleConfigChange('batchSize', Number(v))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Batch" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                      <SelectItem value="16">16</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              {processing && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      Generating lip-sync…
                    </span>
                    <span className="font-medium">{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-all duration-150"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {processing ? (
                  <Button variant="destructive" onClick={handleCancel} className="flex-1" size="lg">
                    <XCircle className="size-4" />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    onClick={() => void handleGenerate()}
                    disabled={!canGenerate}
                    className="flex-1"
                    size="lg"
                  >
                    {engineReady ? (
                      <>
                        <Wand2 className="size-4" />
                        Generate Lip Sync
                      </>
                    ) : (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Loading model…
                      </>
                    )}
                  </Button>
                )}
              </div>
              {!engineReady && !engineError && (
                <p className="text-muted-foreground text-center text-xs">
                  Downloading Wav2Lip model ({'~'}50 MB) — first run may take a moment
                </p>
              )}
            </div>

            {outputPreview && (
              <div className="space-y-3">
                <Separator />
                {sectionTitle('4', 'Result', 'Your lip-synced video')}
                <video
                  src={outputPreview}
                  className="w-full rounded-md border"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleDownload} className="flex-1">
                    <Download className="size-4" />
                    Download WebM
                  </Button>
                  <Button variant="ghost" onClick={() => window.open(outputPreview, '_blank')} className="flex-1">
                    <Video className="size-4" />
                    Open in new tab
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end gap-2 px-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </div>
  )

  function handleConfigChange(key: string, value: string | number) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }
}