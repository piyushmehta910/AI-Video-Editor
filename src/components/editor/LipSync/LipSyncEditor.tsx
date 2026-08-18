import * as React from 'react'
import { Mic, Video, Play, Loader2, Upload } from 'lucide-react'
import { useLipSync, createLipSyncInput } from '@/hooks/useLipSync'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export function LipSyncEditor({ clip, onSave, onClose }: LipSyncEditorProps) {
  const [avatarFile, setAvatarFile] = React.useState<File | null>(clip ? null : null)
  const [audioFile, setAudioFile] = React.useState<File | null>(clip ? null : null)
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

  React.useEffect(() => {
    initialize({ modelUrl: config.modelUrl, inputSize: [96, 96], fps: config.fps, batchSize: config.batchSize })
      .then(() => console.log('LipSync engine ready'))
      .catch(setError)
    return () => terminate()
  }, [])

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setAudioPreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleGenerate = async () => {
    if (!avatarFile || !audioFile) {
      setError('Please select both avatar video and audio file')
      return
    }

    setStatus('processing')
    setProgress(0)
    setError(null)

    try {
      const input = await createLipSyncInput(avatarFile, audioFile)
      await process(input)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const handleConfigChange = (key: string, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const canGenerate = avatarFile && audioFile && !processing

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Mic className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Wav2Lip Lip Sync</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">Generate realistic lip-sync from avatar video + audio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              status === 'completed' && 'bg-emerald-500/10 text-emerald-600',
              status === 'processing' && 'bg-blue-500/10 text-blue-600',
              status === 'error' && 'bg-destructive/10 text-destructive',
              status === 'pending' && 'bg-muted text-muted-foreground',
            )}>
              {status === 'processing' ? `Processing ${Math.round(progress * 100)}%` : status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label>Avatar Video</Label>
              <div className="relative aspect-video rounded-md border border-dashed">
                {avatarPreview ? (
                  <video
                    src={avatarPreview}
                    className="w-full h-full object-cover rounded-md"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Upload className="size-8 mb-2" />
                    <span className="text-xs">Drop avatar video or click to upload</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleAvatarUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Audio</Label>
              <div className="relative aspect-square rounded-md border border-dashed min-h-[120px]">
                {audioPreview ? (
                  <div className="flex flex-col items-center justify-center h-full p-4">
                    <audio src={audioPreview} controls className="w-full" />
                    <p className="text-xs text-muted-foreground mt-2">Audio loaded</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Mic className="size-8 mb-2" />
                    <span className="text-xs">Drop audio file or click to upload</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
              {error}
            </div>
          )}

          <Separator className="my-4" />

          <div className="space-y-4">
            <Label>Settings</Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs text-muted-foreground">Model URL</Label>
                <Input
                  value={config.modelUrl}
                  onChange={(e) => handleConfigChange('modelUrl', e.target.value)}
                  placeholder="/models/wav2lip.onnx"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">FPS</Label>
                <Select value={String(config.fps)} onValueChange={(v) => handleConfigChange('fps', Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="FPS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
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

            {processing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing lip-sync...</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || processing}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="animate-spin mr-2 size-4" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 size-4" />
                    Generate Lip Sync
                  </>
                )}
              </Button>
              {outputPreview && (
                <Button variant="outline" onClick={() => window.open(outputPreview, '_blank')}>
                  <Video className="mr-2 size-4" />
                  Preview Output
                </Button>
              )}
            </div>
          </div>

          {outputPreview && (
            <div className="mt-4 space-y-2">
              <Label>Output Preview</Label>
              <video
                src={outputPreview}
                className="w-full rounded-md border"
                controls
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 mt-4 px-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}