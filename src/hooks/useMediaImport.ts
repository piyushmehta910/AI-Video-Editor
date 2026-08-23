import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import { validateFile, type MediaType } from '@/engine/storage/mediaType'
import { writeMediaFile } from '@/engine/storage/opfs'
import { generateThumbnail, probeMedia, type MediaProbe } from '@/engine/storage/thumbnails'
import { generateProxy } from '@/engine/media/proxy'
import { generateFilmstrip } from '@/engine/media/filmstrip'
import { generateWaveform } from '@/engine/media/waveform'
import { putRecord } from '@/engine/storage/db'
import type { Asset } from '@/engine/types'

/**
 * Media import orchestration with real per-stage progress ("Processing
 * video.mp4... 45%"), clipboard paste support and screen/webcam recording.
 * Mirrors timelineStore.importFiles' pipeline (OPFS + IndexedDB) but reports
 * progress per stage; images are probed/thumbnails in a worker.
 */

export interface ImportJob {
  id: string
  name: string
  /** 0–100 */
  progress: number
  stage: string
}

export type RecordingKind = 'screen' | 'webcam'

interface UseMediaImport {
  jobs: ImportJob[]
  importing: boolean
  recording: RecordingKind | null
  recordingStream: MediaStream | null
  importFiles: (files: FileList | File[]) => Promise<void>
  startRecording: (kind: RecordingKind) => Promise<void>
  stopRecording: () => void
}

const worker = () =>
  new Worker(new URL('../workers/mediaProcessor.ts', import.meta.url), { type: 'module' })

/** Image thumbnail + dimensions via OffscreenCanvas in the worker. */
function processImageInWorker(
  file: File,
): Promise<{ thumbUrl: string; probe: MediaProbe }> {
  return new Promise((resolve, reject) => {
    let w: Worker | null = null
    try {
      w = worker()
    } catch {
      reject(new Error('worker unavailable'))
      return
    }
    const timeout = window.setTimeout(() => {
      w?.terminate()
      reject(new Error('Image processing timed out'))
    }, 10_000)
    w.onmessage = (event: MessageEvent) => {
      const msg = event.data
      if (msg.id !== 'img') return
      window.clearTimeout(timeout)
      w?.terminate()
      if (!msg.ok) {
        reject(new Error(msg.error))
        return
      }
      const blob = new Blob([msg.buffer], { type: msg.mime })
      resolve({
        thumbUrl: URL.createObjectURL(blob),
        probe: { width: msg.width, height: msg.height },
      })
    }
    w.onerror = () => {
      window.clearTimeout(timeout)
      w?.terminate()
      reject(new Error('Image worker crashed'))
    }
    w.postMessage({ id: 'img', type: 'thumbnail-image', file, maxW: 320, maxH: 320 })
  })
}

export function useMediaImport(): UseMediaImport {
  const [jobs, setJobs] = React.useState<ImportJob[]>([])
  const [recording, setRecording] = React.useState<RecordingKind | null>(null)
  const [recordingStream, setRecordingStream] = React.useState<MediaStream | null>(null)

  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)

  const updateJob = React.useCallback((id: string, progress: number, stage: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, progress, stage } : j)))
  }, [])

  /**
   * Import one file through the same pipeline as the store's importFiles,
   * reporting granular progress. Images take the worker fast-path.
   */
  const importOne = async (file: File, jobId: string): Promise<void> => {
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Unsupported file')
    }
    const type = validation.type as MediaType

    updateJob(jobId, 5, 'Validating')

    // OPFS write — the bulk of large files' time.
    const id = crypto.randomUUID()
    const filePathPromise = writeMediaFile(id, file).then((path) => {
      updateJob(jobId, Math.min(45, 5 + (file.size / (50 * 1024 * 1024)) * 40), 'Storing in OPFS')
      return path
    })

    // Probe + thumbnail run concurrently with the OPFS write.
    let probePromise: Promise<MediaProbe>
    let thumbPromise: Promise<{ url: string }>
    if (type === 'image') {
      updateJob(jobId, 20, 'Decoding image')
      const viaWorker = processImageInWorker(file)
      probePromise = viaWorker.then((r) => r.probe)
      thumbPromise = viaWorker.then((r) => ({ url: r.thumbUrl }))
    } else {
      updateJob(jobId, 20, 'Reading metadata')
      probePromise = probeMedia(file, type === 'audio' ? 'audio' : 'video').catch(() => ({}) as MediaProbe)
      updateJob(jobId, 45, 'Generating thumbnail')
      thumbPromise = generateThumbnail(file, type).then((t) => ({ url: t.url }))
    }

    const [filePath, probe, thumb] = await Promise.all([filePathPromise, probePromise, thumbPromise])
    updateJob(jobId, 70, 'Generating previews')

    let proxyPath: string | undefined
    let filmstrip: import('@/engine/types').FilmstripData | undefined
    let waveform: import('@/engine/types').FilmstripData | undefined
    if (type === 'video') {
      updateJob(jobId, 75, 'Building proxy & filmstrip')
      const [proxy, strip] = await Promise.all([
        generateProxy(id, file),
        generateFilmstrip(file, type),
      ])
      proxyPath = proxy ?? undefined
      filmstrip = strip ?? undefined
    } else if (type === 'audio') {
      updateJob(jobId, 80, 'Analyzing waveform')
      waveform = (await generateWaveform(file, type)) ?? undefined
    }
    updateJob(jobId, 92, 'Saving')

    const asset: Asset = {
      id,
      name: file.name.replace(/\.[^.]+$/, ''),
      type,
      filePath,
      mime: file.type,
      size: file.size,
      width: probe.width,
      height: probe.height,
      duration: probe.duration,
      thumbnailUrl: thumb.url,
      proxyPath,
      filmstrip,
      waveform,
      importedAt: Date.now(),
    }
    await putRecord('assets', asset)
    useTimelineStore.setState((state) => ({ assets: [asset, ...state.assets] }))
    updateJob(jobId, 100, 'Done')
  }

  const importFiles = React.useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      if (!files.length) return
      const entries = files.map((file) => ({
        file,
        id: crypto.randomUUID(),
      }))
      setJobs((prev) => [
        ...prev,
        ...entries.map(({ file, id }) => ({ id, name: file.name, progress: 0, stage: 'Queued' })),
      ])

      await Promise.all(
        entries.map(async ({ file, id }) => {
          try {
            await importOne(file, id)
          } catch (err) {
            console.error(`Import failed for ${file.name}:`, err)
            updateJob(id, -1, err instanceof Error ? err.message : String(err))
            window.setTimeout(() => {
              setJobs((prev) => prev.filter((j) => j.id !== id))
            }, 4000)
          }
        }),
      )
      // Successful jobs fade out shortly after completing.
      window.setTimeout(() => {
        setJobs((prev) => prev.filter((j) => j.progress < 100))
      }, 1500)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateJob],
  )

  const stopRecording = React.useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const startRecording = React.useCallback(
    async (kind: RecordingKind) => {
      if (recording) return
      try {
        const stream =
          kind === 'screen'
            ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
            : await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        streamRef.current = stream
        setRecordingStream(stream)
        setRecording(kind)

        // Auto-stop when the user ends browser-level sharing.
        stream.getVideoTracks()[0]?.addEventListener('ended', stopRecording)

        const chunks: Blob[] = []
        chunksRef.current = chunks
        const recorder = new MediaRecorder(stream, { mimeType: pickRecorderMime() })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          setRecordingStream(null)
          setRecording(null)
          recorderRef.current = null
          if (!chunks.length) return
          const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'
          const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          const file = new File(chunks, `recording-${kind}-${stamp}.${ext}`, {
            type: recorder.mimeType || 'video/webm',
          })
          void importFiles([file])
        }
        recorderRef.current = recorder
        recorder.start(500)
      } catch (err) {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setRecordingStream(null)
        setRecording(null)
        console.error('Recording failed:', err)
      }
    },
    [recording, stopRecording, importFiles],
  )

  // Clipboard paste: images on the clipboard import as assets. Skipped while
  // typing in inputs so text paste still works normally.
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = document.activeElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      const images: File[] = []
      for (const item of e.clipboardData?.items ?? []) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            images.push(
              new File([file], file.name || `pasted-${Date.now()}.png`, { type: file.type || 'image/png' }),
            )
          }
        }
      }
      if (images.length) {
        e.preventDefault()
        void importFiles(images)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [importFiles])

  // Cleanup on unmount.
  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    }
  }, [])

  return {
    // Failed jobs (progress < 0, stage = error message) stay visible briefly.
    jobs,
    importing: jobs.some((j) => j.progress > 0 && j.progress < 100),
    recording,
    recordingStream,
    importFiles,
    startRecording,
    stopRecording,
  }
}

function pickRecorderMime(): string | undefined {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      // keep probing
    }
  }
  return undefined
}
