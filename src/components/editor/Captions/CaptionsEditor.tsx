import * as React from 'react'
import { Mic, FileText, Download, Loader2, Play, Globe } from 'lucide-react'
import { useCaptions, generateSRT, generateVTT, downloadSubtitle } from '@/hooks/useCaptions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface CaptionsClipData {
  id: string
  type: 'captions'
  name: string
  startTime: number
  duration: number
  videoUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  segments: Array<{ start: number; end: number; text: string }>
  language: string
  config: {
    modelId: 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small' | 'Xenova/whisper-medium' | 'Xenova/whisper-large-v3'
    language: string
    task: 'transcribe' | 'translate'
  }
}

interface CaptionsEditorProps {
  clip?: CaptionsClipData
  onSave: (clip: CaptionsClipData) => void
  onClose: () => void
}

export function CaptionsEditor({ clip, onSave, onClose }: CaptionsEditorProps) {
  const [videoFile, setVideoFile] = React.useState<File | null>(clip ? null : null)
  const [videoPreview, setVideoPreview] = React.useState<string>(clip?.videoUrl || '')
  const [status, setStatus] = React.useState<CaptionsClipData['status']>(clip?.status || 'pending')
  const [progress, setProgress] = React.useState(clip?.progress || 0)
  const [config, setConfig] = React.useState({
    modelId: 'Xenova/whisper-base' as const,
    language: 'en',
    task: 'transcribe' as const,
    ...clip?.config,
  })
  const [segments, setSegments] = React.useState<CaptionsClipData['segments']>(clip?.segments || [])
  const [error, setError] = React.useState<string | null>(null)

  const { processing, initialize, transcribeFromVideo, terminate } = useCaptions({
    config: { modelId: config.modelId, language: config.language, task: config.task, chunkLengthSeconds: 30, strideLengthSeconds: 5 },
    onProgress: setProgress,
    onComplete: (result) => {
      setStatus('completed')
      setSegments(result.segments)
      onSave({ ...clip!, status: 'completed', progress: 1, segments: result.segments } as CaptionsClipData)
    },
    onError: (err) => {
      setStatus('error')
      setError(err)
    },
  })

  React.useEffect(() => {
    initialize({ modelId: config.modelId, language: config.language, task: config.task, chunkLengthSeconds: 30, strideLengthSeconds: 5 })
      .catch(setError)
    return () => terminate()
  }, [initialize, terminate, config.modelId, config.language, config.task])

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVideoFile(file)
      setVideoPreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  // Revoke the previous blob URL whenever it changes or on unmount.
  React.useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
    }
  }, [videoPreview])

  const handleGenerate = async () => {
    if (!videoFile) {
      setError('Please select a video file')
      return
    }

    setStatus('processing')
    setProgress(0)
    setError(null)

    try {
      await transcribeFromVideo(videoFile)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Transcription failed')
    }
  }

  const canGenerate = videoFile && !processing

  const handleDownloadSRT = () => {
    if (segments.length === 0) return
    const srt = generateSRT(segments)
    downloadSubtitle(srt, clip?.name || 'captions', 'srt')
  }

  const handleDownloadVTT = () => {
    if (segments.length === 0) return
    const vtt = generateVTT(segments)
    downloadSubtitle(vtt, clip?.name || 'captions', 'vtt')
  }

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Mic className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Auto Captions (Whisper)</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">Generate subtitles from video audio using OpenAI Whisper</p>
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
            <Label>Video Source</Label>
            <div className="relative aspect-video rounded-md border border-dashed">
              {videoPreview ? (
                <video
                  src={videoPreview}
                  className="w-full h-full object-cover rounded-md"
                  muted
                  loop
                  autoPlay
                  playsInline
                  controls
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Mic className="size-8 mb-2" />
                  <span className="text-xs">Drop video file or click to upload</span>
                </div>
              )}
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs">
                {error}
              </div>
            )}

            <Separator className="my-4" />

            <Tabs defaultValue="settings" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="segments">Segments ({segments.length})</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <Select value={config.modelId} onValueChange={(v) => setConfig(prev => ({ ...prev, modelId: v as any }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Model" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Xenova/whisper-tiny">Tiny (39MB, fastest)</SelectItem>
                        <SelectItem value="Xenova/whisper-base">Base (74MB, balanced)</SelectItem>
                        <SelectItem value="Xenova/whisper-small">Small (244MB, better)</SelectItem>
                        <SelectItem value="Xenova/whisper-medium">Medium (769MB, best)</SelectItem>
                        <SelectItem value="Xenova/whisper-large-v3">Large v3 (1.5GB, best)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Language</Label>
                    <Select value={config.language} onValueChange={(v) => setConfig(prev => ({ ...prev, language: v }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Language" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                        <SelectItem value="ko">Korean</SelectItem>
                        <SelectItem value="auto">Auto-detect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Task</Label>
                    <Select value={config.task} onValueChange={(v) => setConfig(prev => ({ ...prev, task: v as any }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Task" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transcribe">Transcribe</SelectItem>
                        <SelectItem value="translate">Translate to English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {processing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Transcribing audio...</span>
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
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 size-4" />
                        Generate Captions
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="segments" className="space-y-4 mt-4">
                {segments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No segments generated yet</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {segments.map((seg, i) => (
                        <div key={i} className="p-3 rounded-md border bg-muted/50">
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-muted-foreground w-20 shrink-0">
                              {formatTime(seg.start)} - {formatTime(seg.end)}
                            </span>
                            <textarea
                              value={seg.text}
                              onChange={(e) => setSegments(prev => prev.map((s, idx) => idx === i ? { ...s, text: e.target.value } : s))}
                              className="flex-1 text-sm p-2 rounded bg-background border"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="export" className="space-y-4 mt-4">
                <div className="p-3 rounded-md border bg-muted/50">
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <FileText className="size-4 text-primary" />
                    <span className="font-medium">Export Subtitles</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Download the generated captions in standard subtitle formats.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleDownloadSRT} disabled={segments.length === 0}>
                      <Download className="mr-2 size-4" />
                      Download SRT
                    </Button>
                    <Button variant="outline" onClick={handleDownloadVTT} disabled={segments.length === 0}>
                      <Download className="mr-2 size-4" />
                      Download VTT
                    </Button>
                  </div>
                </div>

                {segments.length > 0 && (
                  <div className="p-3 rounded-md border bg-muted/50">
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <Globe className="size-4 text-primary" />
                      <span className="font-medium">Preview (SRT)</span>
                    </div>
                    <pre className="text-xs bg-background p-3 rounded max-h-64 overflow-auto whitespace-pre-wrap">
                      {generateSRT(segments)}
                    </pre>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {segments.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label>Live Preview</Label>
              <video
                src={videoPreview}
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