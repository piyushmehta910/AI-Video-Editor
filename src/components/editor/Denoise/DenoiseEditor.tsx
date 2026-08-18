import * as React from 'react'
import { FileAudio, Loader2, Play, Download, Volume2 } from 'lucide-react'
import { useDenoise } from '@/hooks/useDenoise'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export interface DenoiseClipData {
  id: string
  type: 'denoise'
  name: string
  startTime: number
  duration: number
  audioUrl?: string
  denoisedUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  mix: number
}

interface DenoiseEditorProps {
  clip?: DenoiseClipData
  onSave: (clip: DenoiseClipData) => void
  onClose: () => void
}

export function DenoiseEditor({ clip, onSave, onClose }: DenoiseEditorProps) {
  const [audioFile, setAudioFile] = React.useState<File | null>(clip ? null : null)
  const [audioPreview, setAudioPreview] = React.useState<string>(clip?.audioUrl || '')
  const [denoisedPreview, setDenoisedPreview] = React.useState<string>(clip?.denoisedUrl || '')
  const [status, setStatus] = React.useState<DenoiseClipData['status']>(clip?.status || 'pending')
  const [progress, setProgress] = React.useState(clip?.progress || 0)
  const [mix, setMix] = React.useState(clip?.mix ?? 1.0)
  const [error, setError] = React.useState<string | null>(null)

  const { processing, initialize, denoiseFromFile, terminate } = useDenoise({
    config: { sampleRate: 48000, frameSize: 480 },
    onProgress: setProgress,
    onComplete: (result) => {
      setStatus('completed')
      const wavBlob = float32ToWav(result.denoisedAudio, result.sampleRate)
      const url = URL.createObjectURL(wavBlob)
      setDenoisedPreview(url)
      onSave({ ...clip!, status: 'completed', progress: 1, denoisedUrl: url, mix } as DenoiseClipData)
    },
    onError: (err) => {
      setStatus('error')
      setError(err)
    },
  })

  React.useEffect(() => {
    initialize().then(() => console.log('RNNoise engine ready')).catch(setError)
    return () => terminate()
  }, [])

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setAudioPreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleDenoise = async () => {
    if (!audioFile) {
      setError('Please select an audio file')
      return
    }

    setStatus('processing')
    setProgress(0)
    setError(null)

    try {
      await denoiseFromFile(audioFile)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Denoising failed')
    }
  }

  const canDenoise = audioFile && !processing

  const handleDownloadDenoised = () => {
    if (!denoisedPreview) return
    const a = document.createElement('a')
    a.href = denoisedPreview
    a.download = `denoised-${clip?.name || 'audio'}.wav`
    a.click()
  }

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Volume2 className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">RNNoise Noise Cancellation</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">Remove background noise from audio using RNNoise (RNNoise WASM)</p>
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
          <div className="space-y-4">
            <Label>Audio Input</Label>
            <div className="relative aspect-square rounded-md border border-dashed min-h-[120px]">
              {audioPreview ? (
                <div className="flex flex-col items-center justify-center h-full p-4">
                  <audio src={audioPreview} controls className="w-full" />
                  <p className="text-xs text-muted-foreground mt-2">Original audio</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileAudio className="size-8 mb-2" />
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

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs">
                {error}
              </div>
            )}

            <Separator className="my-4" />

            <div className="space-y-4">
              <Label>Noise Reduction Mix</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Reduction: {Math.round(mix * 100)}%</span>
                  <span>{mix === 1 ? 'Full' : mix === 0 ? 'None' : 'Partial'}</span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  value={[mix]}
                  onValueChange={([value]) => setMix(value)}
                />
              </div>

              {processing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Removing noise...</span>
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
                  onClick={handleDenoise}
                  disabled={!canDenoise || processing}
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
                      Remove Noise
                    </>
                  )}
                </Button>
              </div>
            </div>

            {denoisedPreview && (
              <div className="mt-4 space-y-2">
                <Label>Denoised Output</Label>
                <div className="flex flex-col items-center justify-center p-4">
                  <audio src={denoisedPreview} controls className="w-full" />
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" onClick={handleDownloadDenoised}>
                      <Download className="mr-2 size-4" />
                      Download WAV
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {audioPreview && denoisedPreview && (
              <div className="mt-4 space-y-2">
                <Label>A/B Comparison</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Original</p>
                    <audio src={audioPreview} controls className="w-full" />
                  </div>
                  <div className="p-2 rounded border bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Denoised (mix: {Math.round(mix * 100)}%)</p>
                    <audio src={denoisedPreview} controls className="w-full" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 mt-4 px-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

function float32ToWav(buffer: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = buffer.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}