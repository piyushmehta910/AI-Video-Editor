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
 * - Abort: every awaitable accepts an `AbortSignal` so user cancellation
 *   propagates instantly instead of waiting for a frame loop or drain poll.
 */

interface DrainableEncoder {
  readonly encodeQueueSize: number
  addEventListener(type: 'dequeue', listener: () => void): void
  removeEventListener(type: 'dequeue', listener: () => void): void
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
}

/** Resolves once the encoder queue has drained below `maxQueued`. */
export function waitForDrain(
  encoder: DrainableEncoder,
  maxQueued: number,
  timeoutMs = 8000,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal)
  if (encoder.encodeQueueSize < maxQueued) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let timer: number | null = null
    let pollInterval: number | null = null
    let settled = false

    const cleanup = () => {
      if (settled) return
      settled = true
      encoder.removeEventListener('dequeue', onDequeue)
      if (timer !== null) window.clearTimeout(timer)
      if (pollInterval !== null) window.clearInterval(pollInterval)
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    const settle = (error?: Error) => {
      cleanup()
      if (error) reject(error)
      else resolve()
    }

    const onAbort = () => settle(new DOMException('Export aborted', 'AbortError'))

    const onDequeue = () => {
      if (encoder.encodeQueueSize < maxQueued) settle()
    }

    encoder.addEventListener('dequeue', onDequeue)
    if (signal) {
      if (signal.aborted) {
        settle(new DOMException('Export aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', onAbort)
    }

    // Polling fallback in case dequeue event was dropped or delayed by the browser engine
    pollInterval = window.setInterval(() => {
      if (encoder.encodeQueueSize < maxQueued) settle()
    }, 12)

    // Safety timeout prevents indefinite hang
    timer = window.setTimeout(() => settle(), timeoutMs)
  })
}

/**
 * Yield to the browser event loop so UI events, GC and encoder callbacks can
 * run between frames. When `needBreather` is true, yields a brief macrotask delay (4ms)
 * to prevent thermal throttling, GC pressure, and 100% CPU lockup.
 */
export function yieldToBrowser(needBreather = false, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  if (needBreather) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, 4)
      const onAbort = () => {
        clearTimeout(t)
        reject(new DOMException('Export aborted', 'AbortError'))
      }
      if (signal) signal.addEventListener('abort', onAbort)
    })
  }
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, 0)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Export aborted', 'AbortError'))
    }
    if (signal) signal.addEventListener('abort', onAbort)
  })
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

/** Helper used throughout the export pipeline to bail out instantly. */
export function checkAborted(signal?: AbortSignal): void {
  throwIfAborted(signal)
}
