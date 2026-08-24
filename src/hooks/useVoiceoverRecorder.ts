import * as React from 'react'

export interface VoiceoverRecorderState {
  isRecording: boolean
  duration: number
  audioLevel: number
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  cancelRecording: () => void
}

export function useVoiceoverRecorder(
  onComplete?: (file: File, durationSec: number) => void | Promise<void>,
): VoiceoverRecorderState {
  const [isRecording, setIsRecording] = React.useState(false)
  const [duration, setDuration] = React.useState(0)
  const [audioLevel, setAudioLevel] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const animFrameRef = React.useRef<number | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const startTimeRef = React.useRef<number>(0)
  const timerIntervalRef = React.useRef<number | null>(null)

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        void audioCtxRef.current.close()
      } catch {
        // ignore
      }
      audioCtxRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    setAudioLevel(0)
  }

  const cancelRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    stopTracks()
    setIsRecording(false)
    setDuration(0)
  }, [])

  const stopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const startRecording = React.useCallback(async () => {
    setError(null)
    chunksRef.current = []
    setDuration(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      streamRef.current = stream

      // Audio level analyser
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioContextClass()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const monitorLevel = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const avg = sum / dataArray.length
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))
        animFrameRef.current = requestAnimationFrame(monitorLevel)
      }
      animFrameRef.current = requestAnimationFrame(monitorLevel)

      // MediaRecorder MIME detection
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const recordedBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const ext = recorder.mimeType.includes('mp4') ? 'm4a' : recorder.mimeType.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([recordedBlob], `voiceover-${Date.now()}.${ext}`, {
          type: recorder.mimeType || 'audio/webm',
        })

        stopTracks()
        setIsRecording(false)
        if (onComplete && chunksRef.current.length > 0) {
          void onComplete(file, Math.max(0.5, elapsed))
        }
      }

      startTimeRef.current = Date.now()
      recorder.start(250)
      setIsRecording(true)

      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setDuration(elapsed)
      }, 100)
    } catch (err) {
      stopTracks()
      setIsRecording(false)
      setError(err instanceof Error ? err.message : 'Could not access microphone')
    }
  }, [onComplete])

  React.useEffect(() => {
    return () => {
      stopTracks()
    }
  }, [])

  return {
    isRecording,
    duration,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
