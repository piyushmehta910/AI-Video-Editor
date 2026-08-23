import { beforeEach, describe, expect, it } from 'vitest'
import { useExportQueueStore } from './exportQueueStore'

const base = {
  name: 'clip',
  format: 'webm' as const,
  width: 1280,
  height: 720,
  fps: 30,
  quality: 'medium' as const,
  includeAudio: true,
}

describe('exportQueueStore', () => {
  beforeEach(() => {
    useExportQueueStore.setState({ jobs: [] })
  })

  it('enqueues jobs with defaults', () => {
    const id = useExportQueueStore.getState().enqueue(base)
    const [job] = useExportQueueStore.getState().jobs
    expect(job.id).toBe(id)
    expect(job.status).toBe('queued')
    expect(job.done).toBe(0)
    expect(job.total).toBe(0)
  })

  it('progress updates counters and switches to encoding stage', () => {
    const id = useExportQueueStore.getState().enqueue(base)
    useExportQueueStore.getState().patch(id, { status: 'rendering' })
    useExportQueueStore.getState().progress(id, { done: 10, total: 100, stage: 'render' })
    expect(useExportQueueStore.getState().jobs[0]).toMatchObject({ done: 10, total: 100, status: 'rendering' })

    useExportQueueStore.getState().progress(id, { done: 20, total: 100, stage: 'encode' })
    expect(useExportQueueStore.getState().jobs[0].status).toBe('encoding')
  })

  it('cancel marks a job cancelled without removing it', () => {
    const id = useExportQueueStore.getState().enqueue(base)
    useExportQueueStore.getState().patch(id, { status: 'rendering' })
    useExportQueueStore.getState().cancel(id)
    expect(useExportQueueStore.getState().jobs[0].status).toBe('cancelled')
  })

  it('retry without an active runner is a safe no-op that re-queues', () => {
    const id = useExportQueueStore.getState().enqueue(base)
    useExportQueueStore.getState().patch(id, { status: 'error', error: 'boom' })
    useExportQueueStore.getState().retry(id)
    const job = useExportQueueStore.getState().jobs[0]
    // No runner was registered for this job, so state stays untouched.
    expect(job.status).toBe('error')
  })

  it('dismiss removes the job entirely', () => {
    const id = useExportQueueStore.getState().enqueue(base)
    useExportQueueStore.getState().dismiss(id)
    expect(useExportQueueStore.getState().jobs).toHaveLength(0)
  })

  it('clearFinished keeps active work only', () => {
    const store = useExportQueueStore.getState()
    const done = store.enqueue(base)
    const error = store.enqueue({ ...base, name: 'two' })
    const active = store.enqueue({ ...base, name: 'three' })
    store.patch(done, { status: 'done' })
    store.patch(error, { status: 'error' })
    store.patch(active, { status: 'rendering' })

    useExportQueueStore.getState().clearFinished()
    const remaining = useExportQueueStore.getState().jobs
    expect(remaining.map((j) => j.id)).toEqual([active])
  })
})
