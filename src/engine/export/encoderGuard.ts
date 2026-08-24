/**
 * Shared helpers for WebCodecs-based export pipelines.
 *
 * - Backpressure: without draining, `encoder.encode()` queues frames faster
 *   than hardware encoders consume them. Each queued 4K VideoFrame holds
 *   ~33 MB of memory; an unbounded queue balloons RAM until the tab crashes.
 * - Failure guard: throwing inside a WebCodecs `error` callback does not
 *   reject the surrounding async function — it becomes an uncaught exception
 *   that can take down the page. The guard converts callback errors into a
 *   promise rejection that races the export loop instead.
 */

interface DrainableEncoder {
  readonly encodeQueueSize: number
  addEventListener(type: 'dequeue', listener: () => void): void
  removeEventListener(type: 'dequeue', listener: () => void): void
}

/** Resolves once the encoder queue has drained below `maxQueued`. */
export function waitForDrain(encoder: DrainableEncoder, maxQueued: number): Promise<void> {
  if (encoder.encodeQueueSize < maxQueued) return Promise.resolve()
  return new Promise((resolve) => {
    const onDequeue = () => {
      if (encoder.encodeQueueSize < maxQueued) {
        encoder.removeEventListener('dequeue', onDequeue)
        resolve()
      }
    }
    encoder.addEventListener('dequeue', onDequeue)
  })
}

/**
 * Yield to the browser event loop so UI events, GC and encoder callbacks can
 * run between frames. Prefers `scheduler.yield` (post-task priority) and
 * falls back to a macrotask.
 */
export function yieldToBrowser(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (typeof sched?.yield === 'function') return sched.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export interface EncoderGuard {
  /** Called from encoder error callbacks. Records the first failure. */
  fail: (reason: unknown) => void
  /** Rejects when `fail` has been called; race this against the export loop. */
  failure: Promise<never>
  /** True once `fail` has been called. */
  readonly failed: boolean
  /** The recorded error, if any. */
  readonly error: Error | null
}

export function createEncoderGuard(): EncoderGuard {
  let rejectFn!: (reason: Error) => void
  const failure = new Promise<never>((_, reject) => {
    rejectFn = reject
  })
  // Avoid noisy unhandled rejections when the export loop finishes first.
  failure.catch(() => {})

  const state: { failed: boolean; error: Error | null } = { failed: false, error: null }

  return {
    fail: (reason) => {
      if (state.failed) return
      state.failed = true
      const err = reason instanceof Error ? reason : new Error(String(reason ?? 'Encoder failed'))
      state.error = err
      rejectFn(err)
    },
    get failed() {
      return state.failed
    },
    get error() {
      return state.error
    },
    failure,
  }
}
