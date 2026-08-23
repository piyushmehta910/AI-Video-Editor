import { create } from 'zustand'
import type { Asset, Project } from '@/engine/types'
import type { CanvasExportSettings } from '@/hooks/useCanvasRecorder'
import {
  exportFramesZip,
  recordCanvasVideo,
  type ExportProgress,
} from '@/hooks/useCanvasRecorder'
import { FORMATS, resolveMimeType } from '@/lib/exportFormats'

/**
 * Export job queue: multiple exports run sequentially, cancel works for
 * in-progress jobs and retry for failures. AbortControllers live in a module
 * map so cancellation reaches the render loop without entering zustand state,
 * and runners are re-invocable by `retry`.
 */

export type ExportJobStatus = 'queued' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled'

export interface ExportJob extends CanvasExportSettings {
  id: string
  name: string
  status: ExportJobStatus
  done: number
  total: number
  error?: string
  size?: number
  /** Object URL of the finished blob for re-download / "Open file". */
  resultUrl?: string
}

interface ExportQueueState {
  jobs: ExportJob[]
  enqueue: (job: Omit<ExportJob, 'id' | 'status' | 'done' | 'total'>) => string
  patch: (id: string, changes: Partial<ExportJob>) => void
  progress: (id: string, p: ExportProgress) => void
  cancel: (id: string) => void
  retry: (id: string) => void
  dismiss: (id: string) => void
  clearFinished: () => void
}

/** Module-level registries outside the store — non-serialisable runtime handles. */
const aborts = new Map<string, AbortController>()
const runners = new Map<string, () => Promise<void>>()

export const useExportQueueStore = create<ExportQueueState>((set, get) => ({
  jobs: [],

  enqueue: (input) => {
    const id = crypto.randomUUID()
    set((s) => ({ jobs: [...s.jobs, { ...input, id, status: 'queued', done: 0, total: 0 }] }))
    return id
  },

  patch: (id, changes) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...changes } : j)) })),

  progress: (id, p) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              done: p.done,
              total: p.total,
              status: p.stage === 'encode' ? ('encoding' as const) : j.status === 'encoding' || j.status === 'rendering' ? j.status : ('rendering' as const),
            }
          : j,
      ),
    })),

  cancel: (id) => {
    aborts.get(id)?.abort()
    aborts.delete(id)
    runners.delete(id)
    get().patch(id, { status: 'cancelled' })
  },

  retry: (id) => {
    if (!runners.has(id)) return
    aborts.get(id)?.abort()
    aborts.delete(id)
    aborts.set(id, new AbortController())
    get().patch(id, { status: 'queued', done: 0, total: 0, error: undefined, size: undefined })
    void runners.get(id)?.()
  },

  dismiss: (id) => {
    aborts.get(id)?.abort()
    aborts.delete(id)
    runners.delete(id)
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
  },

  clearFinished: () =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status === 'queued' || j.status === 'rendering' || j.status === 'encoding'),
    })),
}))

export function getAbortSignal(id: string): AbortSignal | undefined {
  return aborts.get(id)?.signal
}

/**
 * Wire a queued job to the recorder engine and start it immediately. The
 * runner is kept in a module map so `retry` can re-invoke it; the abort
 * signal is re-resolved on every invocation to pick up fresh controllers.
 */
export function runExportJob(jobId: string, projectSnapshot: Project, assets: Asset[]): void {
  const job = useExportQueueStore.getState().jobs.find((j) => j.id === jobId)
  if (!job) return

  if (!aborts.has(jobId)) aborts.set(jobId, new AbortController())

  const runner = async (): Promise<void> => {
    // Resolve fresh each run — retry installs a new controller before calling.
    const signal = aborts.get(jobId)!.signal
    useExportQueueStore.getState().patch(jobId, { status: 'rendering', done: 0, total: 0 })
    try {
      let result: Awaited<ReturnType<typeof recordCanvasVideo>>
      if (job.format === 'frames') {
        result = await exportFramesZip(
          projectSnapshot,
          assets,
          job,
          (p) => useExportQueueStore.getState().progress(jobId, p),
          signal,
        )
      } else {
        const format = FORMATS.find((f) => f.id === job.format)
        const mimeType = format ? resolveMimeType(format) : null
        if (!mimeType) {
          throw new Error('Your browser does not support this format. Use the Frame export option.')
        }
        result = await recordCanvasVideo(
          projectSnapshot,
          assets,
          { ...job, mimeType },
          (p) => useExportQueueStore.getState().progress(jobId, p),
          signal,
        )
      }
      const url = URL.createObjectURL(result.blob)
      useExportQueueStore.getState().patch(jobId, {
        status: 'done',
        size: result.blob.size,
        resultUrl: url,
      })
      triggerDownload(url, `${job.name}.${result.extension}`)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        useExportQueueStore.getState().patch(jobId, { status: 'cancelled' })
      } else {
        useExportQueueStore.getState().patch(jobId, {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } finally {
      aborts.delete(jobId)
      runners.delete(jobId)
    }
  }

  runners.set(jobId, runner)
  void runner()
}

export function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
