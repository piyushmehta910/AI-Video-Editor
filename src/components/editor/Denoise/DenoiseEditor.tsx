import * as React from 'react'
import { FileAudio, Loader2, Download, Wand2, AudioLines, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useDenoise, applyDenoiseToAudioBuffer } from '@/hooks/useDenoise'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { StatusBadge } from '../StatusBadge'
import { DropZone } from '../DropZone'

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

const MIX_PRESETS = [
  { label: 'Off', value: 0 },
  { label: 'Light', value: 0.35 },
  { label: 'Medium', value: 0.7 },
  { label: 'Full', value: 1 },
] as const

export function DenoiseEditor({ clip, onSave, onClose }: DenoiseEditorProps) {
  const [audioFile, setAudioFile] = React.useState<File | null>(null)
  const [audioPreview, setAudioPreview] = React.useState<string>(clip?.audioUrl || '')
  const [status, setStatus] = React.useState<DenoiseClipData['status']>(clip?.status || 'pending')
  const [progress, setProgress] = React.useState(clip?.progress || 0)
  const [mix, setMix] = React.useState(clip?.mix ?? 1)
  const [error, setError] = React.useState<string | null>(null)
  const [engineReady, setEngineReady] = React.useState(false)

  const [originalSamples, setOriginalSamples] = React.useState<Float32Array | null>(null)
  const [denoisedSamples, setDenoisedSamples] = React.useState<Float32Array | null>(null)
  const [sampleRate, setSampleRate] = React.useState(48000)
  const [mixedUrl, setMixedUrl] = React.useState<string | null>(clip?.denoisedUrl || null)

  const { processing, initialize, denoise, terminate } = useDenoise({
    config: { sampleRate: 48000, frameSize: 480 },
    onProgress: setProgress,
    onComplete: (result) => {
      setStatus('completed')
      setDenoisedSamples(result.denoisedAudio)
      setSampleRate(result.sampleRate)
      onSave({ ...clip!, status: 'completed', progress: 1, denoisedUrl: URL.createObjectURL(float32ToWav(result.denoisedAudio, result.sampleRate)), mix } as DenoiseClipData)
    },
    onError: (err) => {
      setStatus('error')
      setError(err)
    },
  })

  React.useEffect(() => {
    initialize()
      .then(() => setEngineReady(true))
      .catch((err) => {
        setEngineReady(false)
        setError(err instanceof Error ? err.message : String(err))
      })
    return () => terminate()
  }, [])

  React.useEffect(() => {
    if (!originalSamples || !denoisedSamples) return
    const mixed = applyDenoiseToAudioBuffer(originalSamples, denoisedSamples, mix)
    const url = URL.createObjectURL(float32ToWav(mixed, sampleRate))
    setMixedUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [mix, originalSamples, denoisedSamples, sampleRate])

  const handleAudioUpload = async (file: File) => {
    setAudioFile(file)
    setAudioPreview(URL.createObjectURL(file))
    setOriginalSamples(null)
    setDenoisedSamples(null)
    setMixedUrl(null)
    setStatus('pending')
    setProgress(0)
    setError(null)
  }

  const handleDenoise = async () => {
    if (!audioFile) {
      setError('Please select an audio file first')
      return
    }

    setStatus('processing')
    setProgress(0)
    setError(null)

    try {
      const samples = await decodeAudioTo48000(audioFile)
      setOriginalSamples(samples)
      await denoise(samples, 48000)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Denoising failed')
    }
  }

  const handleDownload = () => {
    if (!mixedUrl) return
    const a = document.createElement('a')
    a.href = mixedUrl
    a.download = `denoised-${clip?.name || 'audio'}.wav`
    a.click()
  }

  const canDenoise = audioFile && !processing

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
              <AudioLines className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">RNNoise Noise Cancellation</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">Remove background noise from audio — runs 100% in-browser</p>
            </div>
          </div>
          <StatusBadge status={status} progress={progress} />
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {!engineReady && !error && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading RNNoise engine (WASM)…
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              {sectionTitle('1', 'Source Audio', 'Upload a recording with background noise')}
              <DropZone
                accept="audio/*"
                file={audioFile}
                onFile={(f) => void handleAudioUpload(f)}
                onClear={() => {
                  setAudioFile(null)
                  setAudioPreview('')
                  setOriginalSamples(null)
                  setDenoisedSamples(null)
                  setMixedUrl(null)
                  setStatus('pending')
                  setError(null)
                }}
                label="Choose audio file"
                hint="MP3, WAV, M4A, OGG — drop or click to browse"
                icon={<FileAudio className="size-4" />}
              />
              {audioPreview && (
                <audio src={audioPreview} controls className="w-full rounded-md border" />
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              {sectionTitle('2', 'Noise Reduction', 'Blend original with denoised audio')}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Reduction strength</span>
                  <span className="text-muted-foreground">{Math.round(mix * 100)}%</span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[mix]}
                  onValueChange={([value]) => setMix(value)}
                />
                <div className="grid grid-cols-4 gap-2">
                  {MIX_PRESETS.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      variant={mix === p.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMix(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              {processing && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      Removing noise…
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

              <Button
                onClick={() => void handleDenoise()}
                disabled={!canDenoise || processing}
                className="w-full"
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" />
                    {originalSamples ? 'Re-run Noise Removal' : 'Remove Noise'}
                  </>
                )}
              </Button>
            </div>

            {originalSamples && denoisedSamples && (
              <>
                <Separator />

                <div className="space-y-4">
                  {sectionTitle('3', 'Result', 'Compare and download the cleaned audio')}
                  <Waveform samples={denoisedSamples} sampleRate={sampleRate} accent />
                </div>
              </>
            )}

            {mixedUrl && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Original</p>
                    <audio src={audioPreview} controls className="w-full" />
                  </div>
                  <div className="space-y-2 rounded-md border bg-emerald-500/5 p-3">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Denoised ({Math.round(mix * 100)}%)
                    </p>
                    <audio src={mixedUrl} controls className="w-full" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleDownload} className="flex-1">
                    <Download className="size-4" />
                    Download WAV
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMix(1)
                      setStatus('completed')
                    }}
                    className="flex-1"
                  >
                    <CheckCircle2 className="size-4" />
                    Done
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
}

function Waveform({ samples, sampleRate, accent = false }: { samples: Float32Array; sampleRate: number; accent?: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const mid = height / 2
    ctx.clearRect(0, 0, width, height)

    const buckets = Math.min(256, Math.max(80, Math.floor(width / 4)))
    const step = Math.max(1, Math.floor(samples.length / buckets))
    const barWidth = Math.max(1, width / buckets - 1)

    for (let i = 0; i < buckets; i++) {
      let min = 1
      let max = -1
      const start = i * step
      const end = Math.min(start + step, samples.length)
      for (let j = start; j < end; j++) {
        const s = samples[j]
        if (s < min) min = s
        if (s > max) max = s
      }
      const top = mid - Math.abs(max) * mid * 0.95
      const bottom = mid + Math.abs(min) * mid * 0.95
      ctx.fillStyle = accent ? 'rgb(16 185 129)' : 'rgb(100 116 139)'
      ctx.fillRect(i * (width / buckets), top, barWidth, Math.max(1, bottom - top))
    }
  }, [samples, accent])

  const duration = samples.length / sampleRate
  const durLabel = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium">
          <AudioLines className="size-3.5" />
          Cleared audio
        </span>
        <span>{durLabel} · {sampleRate / 1000}kHz</span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={72}
        className="h-18 w-full rounded-md border bg-background"
        style={{ height: '72px' }}
      />
    </div>
  )
}

async function decodeAudioTo48000(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 })
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  return audioBuffer.getChannelData(0)
}

function float32ToWav(buffer: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = buffer.length * bytesPerSample
  const totalSize = 44 + dataSize

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