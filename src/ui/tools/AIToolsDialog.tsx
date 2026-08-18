import { Brain, Cpu, FileText, Sparkles, Volume2, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip, Track } from '@/engine/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LipSyncEditor, type LipSyncClipData } from '@/components/editor/LipSync/LipSyncEditor'
import { CaptionsEditor, type CaptionsClipData } from '@/components/editor/Captions/CaptionsEditor'
import { DenoiseEditor, type DenoiseClipData } from '@/components/editor/Denoise/DenoiseEditor'

interface Props {
  open: boolean
  onClose: () => void
}

export function AIToolsDialog({ open, onClose }: Props) {
  const project = useTimelineStore((s) => s.project)
  const addClipToTrack = useTimelineStore((s) => s.addClipToTrack)

  if (!open) return null

  const nextStartTime = (trackType: Track['type']) => {
    const track = project.tracks.find((t: Track) => t.type === trackType)
    return track && track.clips.length
      ? Math.max(...track.clips.map((c) => c.startTime + c.duration))
      : 0
  }

  const addBaseClip = (trackType: Track['type'], duration: number, name: string, text?: Clip['text']): Clip => {
    const track = project.tracks.find((t: Track) => t.type === trackType)
    if (!track) throw new Error('No matching track in the timeline')
    return {
      id: crypto.randomUUID(),
      assetId: '',
      trackId: track.id,
      startTime: nextStartTime(trackType),
      duration,
      sourceStart: 0,
      sourceEnd: duration,
      speed: 1,
      name,
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      opacity: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      effects: [],
      transitions: {},
      text,
    }
  }

  const handleLipSyncSave = (clip: LipSyncClipData) => {
    try {
      addClipToTrack(addBaseClip('video', clip.duration, clip.name))
    } catch {
      /* ignore track errors */
    }
    onClose()
  }

  const handleCaptionsSave = (clip: CaptionsClipData) => {
    try {
      addClipToTrack(
        addBaseClip('video', clip.duration, clip.name, {
          text: clip.segments.map((s) => s.text).join(' '),
          fontSize: 24,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.6)',
          textAlign: 'center',
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 16,
          paddingRight: 16,
          borderRadius: 8,
          shadow: true,
          animation: 'fade-in',
          animationDuration: 0.3,
        }),
      )
    } catch {
      /* ignore track errors */
    }
    onClose()
  }

  const handleDenoiseSave = (clip: DenoiseClipData) => {
    try {
      addClipToTrack(addBaseClip('audio', clip.duration, clip.name))
    } catch {
      /* ignore track errors */
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">AI Tools</h3>
            <p className="text-muted-foreground text-[11px]">Neural lip-sync, auto captions & noise cancellation — on-device</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <Tabs defaultValue="lipsync" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-4 pt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="lipsync" className="flex items-center gap-2">
                <Brain className="size-3.5" />
                Wav2Lip
              </TabsTrigger>
              <TabsTrigger value="captions" className="flex items-center gap-2">
                <FileText className="size-3.5" />
                Captions
              </TabsTrigger>
              <TabsTrigger value="denoise" className="flex items-center gap-2">
                <Volume2 className="size-3.5" />
                Denoise
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="lipsync" className="min-h-0 flex-1">
            <LipSyncEditor onSave={handleLipSyncSave} onClose={onClose} />
          </TabsContent>
          <TabsContent value="captions" className="min-h-0 flex-1">
            <CaptionsEditor onSave={handleCaptionsSave} onClose={onClose} />
          </TabsContent>
          <TabsContent value="denoise" className="min-h-0 flex-1">
            <DenoiseEditor onSave={handleDenoiseSave} onClose={onClose} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Brain className="size-3.5" />
            Wav2Lip: ONNX Runtime (WebGL/WebGPU) + mel spectrogram
          </span>
          <span className="flex items-center gap-1.5">
            <Volume2 className="size-3.5" />
            RNNoise: C WASM via @shiguredo/rnnoise-wasm
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu className="size-3.5" />
            100% in-browser, no API key needed
          </span>
        </div>
      </div>
    </div>
  )
}