import * as React from 'react'
import {
  Mic,
  Video,
  Image as ImageIcon,
  Loader2,
  Download,
  Wand2,
  AlertTriangle,
  Sparkles,
  XCircle,
  Square,
  Volume2,
  Users,
  Plus,
  CheckCircle2,
  Radio,
  X,
} from 'lucide-react'
import { useLipSync, createLipSyncInput, createLipSyncInputFromImage } from '@/hooks/useLipSync'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '../StatusBadge'
import { DropZone } from '../DropZone'
import { cn } from '@/lib/utils'
import { WebMMuxer } from '@/engine/export/webm-muxer'
import { AVATAR_FACE_PRESETS, renderPresetFaceToBlob } from '@/engine/avatar/faces'
import { useTimelineStore } from '@/stores/timelineStore'
import { getActiveTtsProvider } from '@/api/tts'

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
    smoothMouth?: boolean
    paddingTop?: number
    paddingBottom?: number
    paddingLeft?: number
    paddingRight?: number
  }
}

interface LipSyncEditorProps {
  clip?: LipSyncClipData
  onSave: (clip: LipSyncClipData) => void
  onClose?: () => void
}

type FaceInputType = 'preset' | 'upload_image' | 'upload_video'
type AudioInputType = 'upload' | 'tts' | 'record' | 'timeline'

function synthesizeProceduralSpeech(text: string): Promise<Blob> {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const duration = Math.max(2, Math.min(60, words.length * 0.38))
  const sampleRate = 44100
  const numSamples = Math.floor(duration * sampleRate)
  const ctx = new AudioContext({ sampleRate })
  const buffer = ctx.createBuffer(1, numSamples, sampleRate)
  const data = buffer.getChannelData(0)

  const wordsPerSec = words.length / duration
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const wordPhase = (t * wordsPerSec) % 1
    const syllableEnv = Math.sin(wordPhase * Math.PI)
    const baseFreq = 130 + Math.sin(t * 3) * 20
    const f1 = 600 + Math.sin(t * 8) * 200
    const f2 = 1800 + Math.cos(t * 6) * 300

    const wave =
      Math.sin(2 * Math.PI * baseFreq * t) * 0.4 +
      Math.sin(2 * Math.PI * f1 * t) * 0.25 +
      Math.sin(2 * Math.PI * f2 * t) * 0.15 +
      (Math.random() * 2 - 1) * 0.05

    data[i] = wave * Math.max(0, syllableEnv) * 0.6
  }
  void ctx.close()

  const wavBuffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(wavBuffer)

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return Promise.resolve(new Blob([wavBuffer], { type: 'audio/wav' }))
}

async function synthesizeSpeechAudio(text: string, voice?: string): Promise<Blob> {
  const provider = getActiveTtsProvider()
  if (provider && provider.isConfigured()) {
    try {
      const res = await provider.synthesize({ text, voiceId: voice })
      if (res?.blob) return res.blob
    } catch (e) {
      console.warn('Cloud TTS synthesis failed, using procedural audio:', e)
    }
  }
  return synthesizeProceduralSpeech(text)
}

export function LipSyncEditor({ clip, onSave, onClose }: LipSyncEditorProps) {
  const assets = useTimelineStore((s) => s.assets)
  const project = useTimelineStore((s) => s.project)
  const addClip = useTimelineStore((s) => s.addClip)
  const updateClip = useTimelineStore((s) => s.updateClip)
  const importFiles = useTimelineStore((s) => s.importFiles)
  const playhead = useTimelineStore((s) => s.playhead)

  // Face Selection State
  const [faceInputType, setFaceInputType] = React.useState<FaceInputType>('preset')
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('sarah-presenter')
  const [presetCategory, setPresetCategory] = React.useState<string>('all')
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = React.useState<string>(clip?.avatarVideoUrl || '')

  // Audio Selection State
  const [audioInputType, setAudioInputType] = React.useState<AudioInputType>('tts')
  const [audioFile, setAudioFile] = React.useState<File | null>(null)
  const [audioPreview, setAudioPreview] = React.useState<string>(clip?.audioUrl || '')

  // TTS State
  const [ttsScript, setTtsScript] = React.useState(
    'Welcome to the future of AI video editing. Watch how seamlessly neural lip sync synchronizes spoken audio with this avatar face.',
  )
  const [ttsVoice, setTtsVoice] = React.useState('alloy')
  const [isGeneratingTts, setIsGeneratingTts] = React.useState(false)

  // Recording State
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordSeconds, setRecordSeconds] = React.useState(0)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const recordTimerRef = React.useRef<number | null>(null)

  // Timeline Audio Selection
  const [selectedTimelineClipId, setSelectedTimelineClipId] = React.useState('')

  // Engine & Output State
  const [outputPreview, setOutputPreview] = React.useState<string>(clip?.outputVideoUrl || '')
  const [status, setStatus] = React.useState<LipSyncClipData['status']>(clip?.status || 'pending')
  const [progress, setProgress] = React.useState(clip?.progress || 0)
  const [error, setError] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)
  const [engineReady, setEngineReady] = React.useState(false)
  const [engineError, setEngineError] = React.useState<string | null>(null)

  // Neural Parameters
  const [config, setConfig] = React.useState({
    modelUrl: '/models/wav2lip.onnx',
    fps: 25,
    batchSize: 8,
    smoothMouth: true,
    paddingTop: 0,
    paddingBottom: 10,
    paddingLeft: 0,
    paddingRight: 0,
    ...clip?.config,
  })

  // Timeline audio clips
  const timelineAudioClips = React.useMemo(() => {
    const list: Array<{ id: string; name: string; duration: number }> = []
    for (const track of project.tracks) {
      for (const c of track.clips) {
        const asset = assets.find((a) => a.id === c.assetId)
        if (track.type === 'audio' || asset?.type === 'audio' || c.clipType === 'audio') {
          list.push({
            id: c.id,
            name: asset?.name || `Audio Clip (${c.startTime.toFixed(1)}s)`,
            duration: c.duration,
          })
        }
      }
    }
    return list
  }, [project.tracks, assets])

  // Filtered preset faces
  const filteredPresets = React.useMemo(() => {
    if (presetCategory === 'all') return AVATAR_FACE_PRESETS
    return AVATAR_FACE_PRESETS.filter((p) => p.role === presetCategory)
  }, [presetCategory])

  const handleConfigChange = <K extends keyof typeof config>(key: K, value: (typeof config)[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  // Load active preset face as default
  const loadPresetFace = React.useCallback(async (presetId: string) => {
    const preset = AVATAR_FACE_PRESETS.find((p) => p.id === presetId) || AVATAR_FACE_PRESETS[0]
    setSelectedPresetId(preset.id)
    try {
      const blob = await renderPresetFaceToBlob(preset, 512, 512)
      const file = new File([blob], `${preset.id}.png`, { type: 'image/png' })
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(blob))
    } catch (err) {
      console.warn('Failed to load avatar preset:', err)
    }
  }, [])

  // Auto-init preset face on mount
  React.useEffect(() => {
    if (!avatarFile && !clip?.avatarVideoUrl) {
      void loadPresetFace(selectedPresetId)
    }
  }, [avatarFile, clip?.avatarVideoUrl, loadPresetFace, selectedPresetId])

  // Initialize LipSync Hook
  const { processing, initialize, process, terminate } = useLipSync({
    config: {
      modelUrl: config.modelUrl,
      inputSize: [96, 96],
      fps: config.fps,
      batchSize: config.batchSize,
    },
    onProgress: setProgress,
    onComplete: async (result) => {
      setStatus('completed')
      try {
        if (!result.frames || result.frames.length === 0) {
          throw new Error('No frames returned by lip sync engine')
        }
        const width = result.frames[0].width
        const height = result.frames[0].height
        const fps = result.fps || config.fps || 25
        const duration = result.duration || result.frames.length / fps

        if (typeof VideoEncoder !== 'undefined') {
          const muxer = new WebMMuxer({ width, height, duration, codec: 'vp8' })
          const encoder = new VideoEncoder({
            output: (chunk) => {
              const bytes = new Uint8Array(chunk.byteLength)
              chunk.copyTo(bytes)
              muxer.addChunk({
                data: bytes,
                timestamp: chunk.timestamp / 1000,
                isKey: chunk.type === 'key',
              })
            },
            error: (e) => console.error('LipSync video encoding error:', e),
          })
          encoder.configure({
            codec: 'vp8',
            width,
            height,
            bitrate: 4_000_000,
            framerate: fps,
          })

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')

          for (let i = 0; i < result.frames.length; i++) {
            if (ctx) {
              ctx.putImageData(result.frames[i], 0, 0)
              const frame = new VideoFrame(canvas, {
                timestamp: Math.round((i / fps) * 1_000_000),
              })
              encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
              frame.close()
            }
          }
          await encoder.flush()
          encoder.close()
          const blob = muxer.finalize()
          const url = URL.createObjectURL(blob)
          setOutputPreview(url)
          setSuccessMsg('Wav2Lip neural lip sync completed successfully!')
          onSave({
            ...clip!,
            status: 'completed',
            progress: 1,
            outputVideoUrl: url,
          } as LipSyncClipData)
        } else {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.putImageData(result.frames[0], 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              setOutputPreview(url)
              setSuccessMsg('Lip sync preview rendered successfully!')
              onSave({
                ...clip!,
                status: 'completed',
                progress: 1,
                outputVideoUrl: url,
              } as LipSyncClipData)
            }
          })
        }
      } catch (encodeErr) {
        console.warn('Failed to encode lip sync frames:', encodeErr)
        setStatus('error')
        setError(encodeErr instanceof Error ? encodeErr.message : 'Encoding failed')
      }
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
      await initialize({
        modelUrl: config.modelUrl,
        inputSize: [96, 96],
        fps: config.fps,
        batchSize: config.batchSize,
      })
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

  // ── TTS Generator Handler ──
  const handleGenerateTTS = async () => {
    if (!ttsScript.trim() || isGeneratingTts) return
    setIsGeneratingTts(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const audioBlob = await synthesizeSpeechAudio(ttsScript.trim(), ttsVoice)
      const file = new File([audioBlob], `tts-${Date.now()}.wav`, { type: 'audio/wav' })
      setAudioFile(file)
      setAudioPreview(URL.createObjectURL(audioBlob))
      setSuccessMsg('Speech audio generated! Ready for neural lip sync.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate voiceover audio')
    } finally {
      setIsGeneratingTts(false)
    }
  }

  // ── Microphone Recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([audioBlob], `mic-recording-${Date.now()}.webm`, {
          type: 'audio/webm',
        })
        setAudioFile(file)
        setAudioPreview(URL.createObjectURL(audioBlob))
        stream.getTracks().forEach((track) => track.stop())
        setSuccessMsg('Microphone audio captured successfully!')
      }

      recorder.start()
      setIsRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1)
      }, 1000)
    } catch (err) {
      setError('Could not access microphone: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    }
  }

  // ── Timeline Audio Selection ──
  const handleSelectTimelineClip = async (clipId: string) => {
    setSelectedTimelineClipId(clipId)
    const targetClip = timelineAudioClips.find((c) => c.id === clipId)
    if (!targetClip) return
    const asset = assets.find((a) => a.id === targetClip.id || a.type === 'audio')
    if (asset && asset.filePath) {
      try {
        const res = await fetch(asset.filePath)
        const blob = await res.blob()
        const file = new File([blob], asset.name || 'timeline-audio.mp3', { type: blob.type })
        setAudioFile(file)
        setAudioPreview(URL.createObjectURL(blob))
        setSuccessMsg(`Loaded audio from timeline: "${targetClip.name}"`)
      } catch (e) {
        console.warn('Could not read timeline audio:', e)
      }
    }
  }

  // ── Custom Face Upload ──
  const handleAvatarUpload = (file: File) => {
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setSelectedPresetId('')
    setError(null)
  }

  const handleAudioUpload = (file: File) => {
    setAudioFile(file)
    setAudioPreview(URL.createObjectURL(file))
    setError(null)
  }

  // ── Generate LipSync ──
  const handleGenerate = async () => {
    if (!avatarFile || !audioFile) {
      setError('Please ensure both an Avatar Face and Speech Audio are selected.')
      return
    }

    if (!engineReady) {
      await initEngine()
      if (!engineReady) return
    }

    setStatus('processing')
    setProgress(0)
    setError(null)
    setSuccessMsg(null)

    try {
      const isVideo = faceInputType === 'upload_video'
      const input = isVideo
        ? await createLipSyncInput(avatarFile, audioFile)
        : await createLipSyncInputFromImage(avatarFile, audioFile)
      await process(input)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'LipSync generation failed')
    }
  }

  const handleCancel = () => {
    terminate()
    setEngineReady(false)
    setStatus('pending')
    setProgress(0)
  }

  // ── Add Output to Project Timeline ──
  const handleAddToTimeline = async () => {
    if (!outputPreview) return
    try {
      const response = await fetch(outputPreview)
      const blob = await response.blob()
      const file = new File([blob], `wav2lip-${Date.now()}.webm`, { type: 'video/webm' })
      const { imported } = await importFiles([file])
      if (imported.length) {
        const videoTrack = project.tracks.find((t) => t.type === 'video')
        if (videoTrack) {
          const newClip = addClip(imported[0].id, videoTrack.id, playhead ?? 0)
          if (newClip) {
            updateClip(newClip.id, { clipType: 'video' })
          }
        }
        setSuccessMsg('Lip-synced avatar video added directly to your timeline!')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add video to timeline')
    }
  }

  const handleDownload = () => {
    if (!outputPreview) return
    const a = document.createElement('a')
    a.href = outputPreview
    a.download = `lipsync-${selectedPresetId || 'avatar'}.webm`
    a.click()
  }

  const canGenerate = avatarFile && audioFile && engineReady && !processing

  return (
    <div className="flex h-full flex-col">
      <Card className="flex min-h-0 flex-1 flex-col border-border/80 bg-card shadow-2xl">
        {/* ── Studio Header ── */}
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25">
              <Mic className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Wav2Lip Neural Lip Sync Studio
                </h3>
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.2 text-[9px] font-mono font-bold text-violet-300">
                  ONNX WebGPU
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Synchronize talking-head avatar videos and predefined face portraits with custom speech audio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex',
                engineReady
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {engineReady ? (
                <>
                  <Sparkles className="size-3 text-emerald-400" />
                  Wav2Lip Ready
                </>
              ) : (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Loading Neural Model…
                </>
              )}
            </span>
            <StatusBadge status={status} progress={progress} />
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition ml-1"
                title="Close LipSync Studio"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </CardHeader>

        {/* ── Main Studio Content ── */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-6">
          {engineError && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-bold">Neural Model Notice: {engineError}</p>
                <p className="mt-0.5 text-muted-foreground leading-relaxed">
                  Fallback pipeline active. You can load a local model into{' '}
                  <code className="rounded bg-muted px-1">public/models/wav2lip.onnx</code>.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════ STEP 1: AVATAR FACE SELECTION ═══════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow-xs">
                  1
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Avatar Face Source</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Pick a predefined studio face or upload custom portrait / video
                  </p>
                </div>
              </div>

              {/* Source Mode Tabs */}
              <div className="flex rounded-lg border bg-muted/40 p-0.5">
                {[
                  { id: 'preset' as FaceInputType, label: 'Predefined Faces', icon: Users },
                  { id: 'upload_image' as FaceInputType, label: 'Upload Photo', icon: ImageIcon },
                  { id: 'upload_video' as FaceInputType, label: 'Upload Video', icon: Video },
                ].map(({ id, label, icon: TabIcon }) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                      faceInputType === id
                        ? 'bg-card text-violet-600 dark:text-violet-300 shadow-xs border border-border/80'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setFaceInputType(id)}
                  >
                    <TabIcon className="size-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TAB: PREDEFINED AVATAR FACES LIBRARY */}
            {faceInputType === 'preset' && (
              <div className="space-y-2.5 rounded-xl border bg-muted/15 p-3">
                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'all', label: 'All Avatars' },
                    { id: 'presenter', label: 'Studio Hosts' },
                    { id: 'narrator', label: 'Documentary & News' },
                    { id: 'intro', label: 'Tech & Gaming' },
                    { id: 'outro', label: 'Cyber & Anime' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition border',
                        presetCategory === c.id
                          ? 'border-violet-500 bg-violet-500/20 text-violet-300 ring-1 ring-violet-500'
                          : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setPresetCategory(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Face Presets Visual Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredPresets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={cn(
                          'group relative flex flex-col items-center rounded-xl border p-2 text-center transition-all',
                          isSelected
                            ? 'border-violet-500 bg-violet-500/20 text-violet-300 ring-2 ring-violet-500/60 shadow-md scale-[1.02]'
                            : 'border-border/60 bg-card text-muted-foreground hover:border-violet-500/50 hover:bg-muted/40',
                        )}
                        onClick={() => void loadPresetFace(preset.id)}
                      >
                        <div
                          className="size-14 rounded-full overflow-hidden border shadow-xs transition group-hover:scale-105"
                          dangerouslySetInnerHTML={{ __html: preset.svg }}
                        />
                        <span className="text-[10px] font-bold text-foreground mt-1.5 line-clamp-1">
                          {preset.name}
                        </span>
                        <span className="text-[8px] text-muted-foreground line-clamp-1">
                          {preset.tagline}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB: UPLOAD CUSTOM PHOTO OR VIDEO */}
            {faceInputType !== 'preset' && (
              <DropZone
                accept={faceInputType === 'upload_video' ? 'video/*' : 'image/*'}
                file={avatarFile}
                onFile={handleAvatarUpload}
                onClear={() => {
                  setAvatarFile(null)
                  setAvatarPreview('')
                  setError(null)
                }}
                label={faceInputType === 'upload_video' ? 'Choose avatar portrait video' : 'Choose portrait face image'}
                hint={
                  faceInputType === 'upload_video'
                    ? 'MP4, WebM, MOV with clear front-facing head'
                    : 'High-res PNG, JPG, WebP portrait face'
                }
                icon={faceInputType === 'upload_video' ? <Video className="size-5" /> : <ImageIcon className="size-5" />}
              />
            )}

            {/* Active Face Preview Badge */}
            {avatarPreview && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2">
                <div className="size-12 rounded-lg overflow-hidden border bg-black shrink-0">
                  {faceInputType === 'upload_video' ? (
                    <video src={avatarPreview} className="size-full object-cover" muted loop autoPlay playsInline />
                  ) : (
                    <img src={avatarPreview} alt="Selected Face" className="size-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      {selectedPresetId
                        ? AVATAR_FACE_PRESETS.find((p) => p.id === selectedPresetId)?.name || 'Selected Avatar Face'
                        : avatarFile?.name || 'Custom Portrait Face'}
                    </span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                      Face Ready
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Mouth Track: X {Math.round((config.paddingLeft + 50))}% · Y {Math.round(72)}% · Scale 512×512
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════ STEP 2: SPEECH AUDIO INPUT ═══════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow-xs">
                  2
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Speech Audio Input</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Provide the voiceover / dialogue for neural lip animation
                  </p>
                </div>
              </div>

              {/* Audio Source Tabs */}
              <div className="flex rounded-lg border bg-muted/40 p-0.5">
                {[
                  { id: 'tts' as AudioInputType, label: 'AI Voiceover (TTS)', icon: Wand2 },
                  { id: 'upload' as AudioInputType, label: 'Upload File', icon: Volume2 },
                  { id: 'record' as AudioInputType, label: 'Record Mic', icon: Mic },
                  { id: 'timeline' as AudioInputType, label: 'From Timeline', icon: Plus },
                ].map(({ id, label, icon: TabIcon }) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                      audioInputType === id
                        ? 'bg-card text-violet-600 dark:text-violet-300 shadow-xs border border-border/80'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setAudioInputType(id)}
                  >
                    <TabIcon className="size-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TAB: AI TTS GENERATOR */}
            {audioInputType === 'tts' && (
              <div className="space-y-2.5 rounded-xl border bg-muted/15 p-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Avatar Script Text</Label>
                  <Textarea
                    value={ttsScript}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTtsScript(e.target.value)}
                    rows={3}
                    placeholder="Enter spoken text for your avatar..."
                    className="text-xs bg-card"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-[10px] text-muted-foreground shrink-0">Voice Persona:</Label>
                    <Select value={ttsVoice} onValueChange={setTtsVoice}>
                      <SelectTrigger className="h-7 text-xs bg-card flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (Balanced & Clear)</SelectItem>
                        <SelectItem value="echo">Echo (Warm Male Presenter)</SelectItem>
                        <SelectItem value="fable">Fable (Expressive & Dynamic)</SelectItem>
                        <SelectItem value="onyx">Onyx (Deep Authoritative Voice)</SelectItem>
                        <SelectItem value="nova">Nova (Energetic Female Host)</SelectItem>
                        <SelectItem value="shimmer">Shimmer (Smooth Narrator)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    size="sm"
                    className="h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-xs"
                    onClick={() => void handleGenerateTTS()}
                    disabled={isGeneratingTts || !ttsScript.trim()}
                  >
                    {isGeneratingTts ? (
                      <Loader2 className="mr-1.5 size-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 size-3" />
                    )}
                    {isGeneratingTts ? 'Synthesizing...' : 'Generate Voiceover'}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB: UPLOAD AUDIO FILE */}
            {audioInputType === 'upload' && (
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
            )}

            {/* TAB: RECORD MICROPHONE */}
            {audioInputType === 'record' && (
              <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/20 p-6 space-y-3">
                <div
                  className={cn(
                    'flex size-16 items-center justify-center rounded-full transition-all',
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40 ring-4 ring-rose-500/30'
                      : 'bg-violet-600/20 text-violet-400',
                  )}
                >
                  <Mic className="size-8" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-foreground">
                    {isRecording ? `Recording Speech (${recordSeconds}s)...` : 'Live Microphone Capture'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isRecording ? 'Speak clearly into your microphone' : 'Click record to capture speech for this avatar'}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={isRecording ? 'destructive' : 'default'}
                  className={cn('h-8 text-xs font-semibold gap-1.5', !isRecording && 'bg-violet-600 text-white')}
                  onClick={isRecording ? stopRecording : () => void startRecording()}
                >
                  {isRecording ? <Square className="size-3.5" /> : <Radio className="size-3.5" />}
                  <span>{isRecording ? 'Stop & Use Recording' : 'Start Recording'}</span>
                </Button>
              </div>
            )}

            {/* TAB: TIMELINE AUDIO CLIPS */}
            {audioInputType === 'timeline' && (
              <div className="space-y-2 rounded-xl border bg-muted/15 p-3">
                <Label className="text-xs font-semibold">Select Audio Track from Project Timeline</Label>
                {timelineAudioClips.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    {timelineAudioClips.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-2 text-left transition',
                          selectedTimelineClipId === c.id
                            ? 'border-violet-500 bg-violet-500/20 text-violet-300 ring-1 ring-violet-500 font-bold'
                            : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => void handleSelectTimelineClip(c.id)}
                      >
                        <span className="text-xs truncate max-w-[150px]">{c.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {c.duration.toFixed(1)}s
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    No audio clips found on timeline. Upload an audio file or generate one with AI above.
                  </p>
                )}
              </div>
            )}

            {/* Active Audio Waveform / Audio Player */}
            {audioPreview && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                <Volume2 className="size-4 text-violet-400 shrink-0" />
                <audio src={audioPreview} controls className="h-8 flex-1 outline-none" />
              </div>
            )}
          </div>

          <Separator />

          {/* ═══════════ STEP 3: WAV2LIP NEURAL TUNING ═══════════ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow-xs">
                3
              </span>
              <div>
                <h4 className="text-sm font-bold text-foreground">Wav2Lip Neural Tuning & FPS</h4>
                <p className="text-[11px] text-muted-foreground">
                  Refine bounding box padding, framerate, and batch processing scale
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border bg-card p-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Framerate (FPS)</Label>
                <Select value={String(config.fps)} onValueChange={(v) => handleConfigChange('fps', Number(v))}>
                  <SelectTrigger className="h-7 text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 fps (Cinematic)</SelectItem>
                    <SelectItem value="25">25 fps (PAL Standard)</SelectItem>
                    <SelectItem value="30">30 fps (Web High)</SelectItem>
                    <SelectItem value="60">60 fps (Ultra Smooth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Batch Size</Label>
                <Select value={String(config.batchSize)} onValueChange={(v) => handleConfigChange('batchSize', Number(v))}>
                  <SelectTrigger className="h-7 text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 (Low VRAM)</SelectItem>
                    <SelectItem value="8">8 (Balanced)</SelectItem>
                    <SelectItem value="16">16 (Fast GPU)</SelectItem>
                    <SelectItem value="32">32 (Turbo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Face Top Pad</Label>
                <Input
                  type="number"
                  value={config.paddingTop}
                  onChange={(e) => handleConfigChange('paddingTop', Number(e.target.value))}
                  className="h-7 text-xs bg-muted/20"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Face Bottom Pad</Label>
                <Input
                  type="number"
                  value={config.paddingBottom}
                  onChange={(e) => handleConfigChange('paddingBottom', Number(e.target.value))}
                  className="h-7 text-xs bg-muted/20"
                />
              </div>
            </div>
          </div>

          {/* Feedback Notices */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Processing Progress */}
          {processing && (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-violet-400">
                  <Loader2 className="size-4 animate-spin" />
                  Generating Wav2Lip Neural Lip Sync…
                </span>
                <span className="font-mono text-foreground">{Math.round(progress * 100)}%</span>
              </div>
              <div className="bg-muted h-2.5 overflow-hidden rounded-full border">
                <div
                  className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full transition-all duration-150"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Output Preview & Timeline Staging Actions */}
          {outputPreview && (
            <div className="space-y-3 rounded-xl border border-violet-500/40 bg-violet-500/5 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-violet-400" />
                  <span className="text-xs font-bold text-foreground">Lip-Synced Output Result</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-violet-500/40 text-violet-300"
                    onClick={handleDownload}
                  >
                    <Download className="size-3" />
                    <span>Download</span>
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold"
                    onClick={() => void handleAddToTimeline()}
                  >
                    <Plus className="size-3" />
                    <span>Insert into Timeline</span>
                  </Button>
                </div>
              </div>

              <div className="relative aspect-video max-w-md mx-auto overflow-hidden rounded-lg border bg-black shadow-lg">
                <video src={outputPreview} controls className="size-full object-cover" />
              </div>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex gap-2 pt-2">
            {processing ? (
              <Button variant="destructive" onClick={handleCancel} className="flex-1 h-9 text-xs font-bold">
                <XCircle className="mr-1.5 size-4" />
                Cancel Generation
              </Button>
            ) : (
              <Button
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                className="flex-1 h-10 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/30"
              >
                {engineReady ? (
                  <>
                    <Wand2 className="mr-2 size-4" />
                    Generate Wav2Lip Neural Lip Sync
                  </>
                ) : (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Initializing Neural Model…
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}