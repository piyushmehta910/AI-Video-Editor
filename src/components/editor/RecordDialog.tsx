import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Camera,
  Check,
  Film,
  Loader2,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Square,
  Video,
  Volume2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTimelineStore } from '@/stores/timelineStore'
import { cn } from '@/lib/utils'

export interface RecordDialogProps {
  open: boolean
  onClose: () => void
  initialMode?: 'webcam' | 'screen' | 'voice'
}

type RecordMode = 'webcam' | 'screen' | 'voice'

function pickMime(type: 'video' | 'audio'): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const videoCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ]
  const audioCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  const candidates = type === 'video' ? videoCandidates : audioCandidates
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function RecordDialog({ open, onClose, initialMode = 'webcam' }: RecordDialogProps) {
  const [mode, setMode] = React.useState<RecordMode>(initialMode)
  const [recordingState, setRecordingState] = React.useState<'idle' | 'countdown' | 'recording' | 'paused' | 'review'>('idle')
  const [countdown, setCountdown] = React.useState(3)
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [micMuted, setMicMuted] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Device enumeration
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([])
  const [selectedVideoDevice, setSelectedVideoDevice] = React.useState<string>('')
  const [selectedAudioDevice, setSelectedAudioDevice] = React.useState<string>('')

  // Media references
  const liveVideoRef = React.useRef<HTMLVideoElement | null>(null)
  const reviewVideoRef = React.useRef<HTMLVideoElement | null>(null)
  const reviewAudioRef = React.useRef<HTMLAudioElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const streamRef = React.useRef<MediaStream | null>(null)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const recordedChunksRef = React.useRef<Blob[]>([])
  const [recordedFile, setRecordedFile] = React.useState<File | null>(null)
  const [recordedUrl, setRecordedUrl] = React.useState<string | null>(null)

  // Audio visualizer
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const animFrameRef = React.useRef<number | null>(null)

  // Stop all active tracks
  const stopStream = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  // Enumerate camera / mic devices
  React.useEffect(() => {
    if (!open) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return

    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const v = devices.filter((d) => d.kind === 'videoinput')
        const a = devices.filter((d) => d.kind === 'audioinput')
        setVideoDevices(v)
        setAudioDevices(a)
        if (v.length && !selectedVideoDevice) setSelectedVideoDevice(v[0].deviceId)
        if (a.length && !selectedAudioDevice) setSelectedAudioDevice(a[0].deviceId)
      })
      .catch(() => {
        // Device enumeration restricted or unsupported
      })
  }, [open, selectedVideoDevice, selectedAudioDevice])

  // Start live stream based on mode
  const initStream = React.useCallback(async () => {
    if (!open || recordingState === 'review') return
    stopStream()
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('Media devices are not supported in this browser environment.')
      return
    }

    try {
      let stream: MediaStream | null = null

      if (mode === 'webcam') {
        const constraints: MediaStreamConstraints = {
          video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
          audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } else if (mode === 'screen') {
        if (!navigator.mediaDevices.getDisplayMedia) {
          setError('Screen recording is not supported in this browser.')
          return
        }
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        })
      } else if (mode === 'voice') {
        const constraints: MediaStreamConstraints = {
          audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
          video: false,
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      }

      if (!stream) return
      streamRef.current = stream

      // Bind to video element for webcam or screen
      if (liveVideoRef.current && (mode === 'webcam' || mode === 'screen')) {
        liveVideoRef.current.srcObject = stream
        void liveVideoRef.current.play().catch(() => {})
      }

      // Audio waveform visualizer for voice mode (or all audio)
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length > 0) {
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          if (AudioContextClass) {
            const ctx = new AudioContextClass()
            audioContextRef.current = ctx
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 64
            analyserRef.current = analyser
            const source = ctx.createMediaStreamSource(stream)
            source.connect(analyser)

            const renderMeter = () => {
              if (!canvasRef.current || !analyserRef.current) return
              const canvas = canvasRef.current
              const canvasCtx = canvas.getContext('2d')
              if (!canvasCtx) return

              const bufferLength = analyserRef.current.frequencyBinCount
              const dataArray = new Uint8Array(bufferLength)
              analyserRef.current.getByteFrequencyData(dataArray)

              canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
              const barWidth = (canvas.width / bufferLength) * 1.5
              let x = 0

              for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height
                canvasCtx.fillStyle = '#f43f5e'
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight)
                x += barWidth + 1
              }

              animFrameRef.current = requestAnimationFrame(renderMeter)
            }
            renderMeter()
          }
        } catch {
          // AudioContext unsupported or restricted
        }
      }

      // Handle screen share user cancellation
      if (mode === 'screen') {
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.addEventListener('ended', () => {
            if (recordingState === 'recording' || recordingState === 'paused') {
              stopRecording()
            } else {
              stopStream()
            }
          })
        }
      }
    } catch (err) {
      console.warn('Stream initialization failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError('Permission to access camera or microphone was denied. Please allow permissions in your browser.')
      } else {
        setError(`Could not access device: ${msg}`)
      }
    }
  }, [open, mode, selectedVideoDevice, selectedAudioDevice, recordingState, stopStream])

  // Re-initialize stream on mode or device change
  React.useEffect(() => {
    if (open && recordingState === 'idle') {
      void initStream()
    }
    return () => {
      stopStream()
    }
  }, [open, mode, selectedVideoDevice, selectedAudioDevice, recordingState, initStream, stopStream])

  // Mic mute toggle
  React.useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !micMuted
      })
    }
  }, [micMuted])

  // Actual recording start
  const startActualRecording = React.useCallback(() => {
    if (!streamRef.current) return
    const isVideo = mode === 'webcam' || mode === 'screen'
    const mimeType = pickMime(isVideo ? 'video' : 'audio')
    const options = mimeType ? { mimeType } : undefined

    try {
      const recorder = new MediaRecorder(streamRef.current, options)
      mediaRecorderRef.current = recorder
      recordedChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const typeStr = isVideo ? (recorder.mimeType || 'video/webm') : (recorder.mimeType || 'audio/webm')
        const filename = `recording-${mode}-${stamp}.${ext}`
        const file = new File(recordedChunksRef.current, filename, { type: typeStr })
        const url = URL.createObjectURL(file)

        setRecordedFile(file)
        setRecordedUrl(url)
        setRecordingState('review')
        stopStream()
      }

      recorder.start(500)
    } catch (err) {
      console.error('MediaRecorder start failed:', err)
      setError(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`)
      setRecordingState('idle')
    }
  }, [mode, stopStream])

  // Countdown timer
  React.useEffect(() => {
    if (recordingState !== 'countdown') return
    if (countdown > 1) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => {
      setRecordingState('recording')
      startActualRecording()
    }, 1000)
    return () => clearTimeout(timer)
  }, [recordingState, countdown, startActualRecording])

  // Elapsed recording time counter
  React.useEffect(() => {
    if (recordingState !== 'recording') return
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [recordingState])

  // Trigger recording flow
  const handleStartRecording = () => {
    setElapsedSeconds(0)
    setCountdown(3)
    setRecordingState('countdown')
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setRecordingState('paused')
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setRecordingState('recording')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const discardRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl)
      setRecordedUrl(null)
    }
    setRecordedFile(null)
    setRecordingState('idle')
    setElapsedSeconds(0)
    void initStream()
  }

  // Save to project
  const handleSaveToProject = async (addToTimeline: boolean) => {
    if (!recordedFile) return
    setSaving(true)
    try {
      const store = useTimelineStore.getState()
      const { imported, errors } = await store.importFiles([recordedFile])
      if (errors.length > 0 && !imported.length) {
        throw new Error(errors[0])
      }
      if (addToTimeline && imported[0]) {
        store.addAssetToTimeline(imported[0].id)
      }
      handleClose()
    } catch (err) {
      console.error('Failed to import recording:', err)
      setError(`Failed to save recording: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    stopStream()
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl)
      setRecordedUrl(null)
    }
    setRecordedFile(null)
    setRecordingState('idle')
    setElapsedSeconds(0)
    setError(null)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && recordingState !== 'recording' && recordingState !== 'countdown') {
          handleClose()
        }
      }}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-dialog-title"
      >
        {/* ── Dialog Header ── */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-rose-500" />
            </span>
            <div>
              <h2 id="record-dialog-title" className="text-sm font-bold text-foreground tracking-tight">
                Record Media
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Capture webcam, screen, or microphone directly into your project
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={recordingState === 'recording'}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-30"
            aria-label="Close record modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Mode Selection Tabs (Only visible when idle) ── */}
        {recordingState === 'idle' && (
          <div className="grid grid-cols-3 gap-1.5 border-b border-border/60 bg-muted/30 p-2">
            <button
              type="button"
              onClick={() => setMode('webcam')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all',
                mode === 'webcam'
                  ? 'bg-card text-rose-500 shadow-xs border border-rose-500/30'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Camera className="size-3.5" />
              <span>Camera (Webcam)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('screen')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all',
                mode === 'screen'
                  ? 'bg-card text-rose-500 shadow-xs border border-rose-500/30'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Monitor className="size-3.5" />
              <span>Screen Capture</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('voice')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-all',
                mode === 'voice'
                  ? 'bg-card text-rose-500 shadow-xs border border-rose-500/30'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Mic className="size-3.5" />
              <span>Voiceover (Audio)</span>
            </button>
          </div>
        )}

        {/* ── Main Preview / Recording Area ── */}
        <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden bg-black/95">
          {/* Error display */}
          {error && (
            <div className="absolute inset-4 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-center">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-xs font-medium text-destructive max-w-sm">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void initStream()} className="gap-1.5 text-xs">
                <RotateCcw className="size-3.5" /> Retry Connection
              </Button>
            </div>
          )}

          {/* Countdown Overlay */}
          {recordingState === 'countdown' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs">
              <span className="text-7xl font-black text-rose-500 animate-pulse scale-125 transition-transform">
                {countdown}
              </span>
              <p className="mt-2 text-xs font-semibold text-white/80">Get Ready…</p>
            </div>
          )}

          {/* Live Video (Webcam / Screen) */}
          {(mode === 'webcam' || mode === 'screen') && recordingState !== 'review' && (
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'size-full object-cover',
                mode === 'webcam' && 'scale-x-[-1]', // Mirror webcam for intuitive viewing
              )}
            />
          )}

          {/* Voiceover Waveform Visualizer */}
          {mode === 'voice' && recordingState !== 'review' && (
            <div className="flex flex-col items-center justify-center gap-4 p-6">
              <div className="flex size-20 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-500 shadow-lg shadow-rose-500/20">
                <Mic className="size-9 animate-pulse" />
              </div>
              <div className="h-16 w-64 overflow-hidden rounded-xl border border-rose-500/30 bg-black/40 p-1">
                <canvas ref={canvasRef} width={256} height={64} className="size-full" />
              </div>
              <p className="text-xs font-semibold text-rose-300">
                {recordingState === 'recording' ? 'Recording your voice…' : 'Microphone is live. Speak to test.'}
              </p>
            </div>
          )}

          {/* Review Video playback */}
          {recordingState === 'review' && recordedUrl && (mode === 'webcam' || mode === 'screen') && (
            <video
              ref={reviewVideoRef}
              src={recordedUrl}
              controls
              autoPlay
              playsInline
              className="size-full object-contain"
            />
          )}

          {/* Review Audio playback */}
          {recordingState === 'review' && recordedUrl && mode === 'voice' && (
            <div className="flex flex-col items-center justify-center gap-4 p-6">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Volume2 className="size-8" />
              </div>
              <audio ref={reviewAudioRef} src={recordedUrl} controls className="w-72" />
              <p className="text-xs font-semibold text-emerald-300">Recording preview ready</p>
            </div>
          )}

          {/* Active Recording HUD Overlay */}
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/70 px-3 py-1.5 backdrop-blur-md border border-white/10 z-10">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
                </span>
                <span className="text-xs font-bold text-white tracking-wider">
                  {recordingState === 'paused' ? 'PAUSED' : 'REC'}
                </span>
                <span className="rounded bg-black/80 px-2 py-0.5 font-mono text-xs font-bold text-rose-400 border border-rose-500/30">
                  {formatDuration(elapsedSeconds)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {recordingState === 'recording' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={pauseRecording}
                    className="h-7 gap-1 px-2 text-[11px] text-white/90 hover:bg-white/15"
                  >
                    <Pause className="size-3" /> Pause
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={resumeRecording}
                    className="h-7 gap-1 px-2 text-[11px] text-emerald-400 hover:bg-white/15"
                  >
                    <Play className="size-3" /> Resume
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={stopRecording}
                  className="h-7 gap-1 px-3 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                >
                  <Square className="size-3 fill-white" /> Stop & Finish
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom Controls Footer ── */}
        <div className="flex items-center justify-between border-t border-border/80 bg-card/90 px-4 py-3 gap-3">
          {/* Idle Controls */}
          {recordingState === 'idle' && (
            <>
              <div className="flex items-center gap-2 text-xs">
                {mode === 'webcam' && videoDevices.length > 1 && (
                  <select
                    value={selectedVideoDevice}
                    onChange={(e) => setSelectedVideoDevice(e.target.value)}
                    className="h-8 max-w-[160px] truncate rounded-lg border border-border bg-background px-2 text-[11px] text-foreground outline-none"
                  >
                    {videoDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 4)}`}
                      </option>
                    ))}
                  </select>
                )}

                {audioDevices.length > 1 && (
                  <select
                    value={selectedAudioDevice}
                    onChange={(e) => setSelectedAudioDevice(e.target.value)}
                    className="h-8 max-w-[140px] truncate rounded-lg border border-border bg-background px-2 text-[11px] text-foreground outline-none"
                    title="Select microphone"
                  >
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mic ${d.deviceId.slice(0, 4)}`}
                      </option>
                    ))}
                  </select>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMicMuted(!micMuted)}
                  className={cn(
                    'h-8 gap-1.5 px-2 text-xs',
                    micMuted ? 'text-amber-500 hover:bg-amber-500/10' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={micMuted ? 'Microphone is muted' : 'Microphone is active'}
                >
                  {micMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5 text-emerald-500" />}
                  <span>{micMuted ? 'Unmute' : 'Mute Mic'}</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleStartRecording}
                  className="h-8 gap-1.5 px-4 font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 transition-all active:scale-95"
                >
                  <Video className="size-3.5" />
                  <span>Start Recording</span>
                </Button>
              </div>
            </>
          )}

          {/* Recording in progress controls footer hint */}
          {(recordingState === 'recording' || recordingState === 'paused' || recordingState === 'countdown') && (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {recordingState === 'countdown' ? 'Starting recording…' : 'Recording in progress. Click Stop when finished.'}
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={stopRecording}
                disabled={recordingState === 'countdown'}
                className="gap-1.5 font-bold"
              >
                <Square className="size-3.5 fill-white" /> Stop Recording
              </Button>
            </div>
          )}

          {/* Review State Controls */}
          {recordingState === 'review' && (
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={discardRecording}
                disabled={saving}
                className="gap-1.5 text-xs text-muted-foreground hover:text-rose-500"
              >
                <RotateCcw className="size-3.5" /> Record Again
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSaveToProject(false)}
                  disabled={saving}
                  className="gap-1.5 text-xs"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Film className="size-3.5" />}
                  <span>Add to Media Bin</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSaveToProject(true)}
                  disabled={saving}
                  className="gap-1.5 text-xs font-bold bg-gradient-to-r from-rose-600 to-violet-600 hover:from-rose-500 hover:to-violet-500 text-white shadow-md shadow-rose-600/20"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>Add to Timeline</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
