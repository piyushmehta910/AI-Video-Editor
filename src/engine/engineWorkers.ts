import DecodeWorker from '@/workers/decode.worker?worker'
import RenderWorker from '@/workers/render.worker?worker'
import EncodeWorker from '@/workers/encode.worker?worker'
import AiWorker from '@/workers/ai.worker?worker'
import { WORKER_NAMES } from '@/workers/workerProtocol'
import type { WorkerName } from '@/workers/workerProtocol'
import type { HealthResponse } from '@/workers/workerProtocol'

const WORKER_CTORS: Record<WorkerName, new () => Worker> = {
  decode: DecodeWorker,
  render: RenderWorker,
  encode: EncodeWorker,
  ai: AiWorker,
}

const HEALTH_TIMEOUT_MS = 3000

let instances: Partial<Record<WorkerName, Worker>> = {}
let health: Record<WorkerName, boolean | null> = {
  decode: null,
  render: null,
  encode: null,
  ai: null,
}

/** Create a worker instance if one isn't already running. */
export function startWorker(name: WorkerName): void {
  if (typeof Worker === 'undefined' || instances[name]) return
  instances[name] = new WORKER_CTORS[name]()
}

function terminate(name: WorkerName): void {
  instances[name]?.terminate()
  delete instances[name]
  health[name] = null
}

function requestHealth(name: WorkerName): Promise<boolean> {
  const worker = instances[name]
  if (!worker) return Promise.resolve(false)
  return new Promise((resolve) => {
    const requestId = globalThis.crypto?.randomUUID?.() ?? String(Math.random())
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      worker.removeEventListener('message', onMessage)
      clearTimeout(timer)
      health[name] = ok
      resolve(ok)
    }
    const onMessage = (e: MessageEvent<HealthResponse>) => {
      if (e.data?.type === 'health' && e.data.requestId === requestId) finish(e.data.ok === true)
    }
    const timer = setTimeout(() => finish(false), HEALTH_TIMEOUT_MS)
    worker.addEventListener('message', onMessage)
    worker.postMessage({ type: 'health', requestId })
  })
}

/** Spawn all workers (no-op if already running) and health-check each one. */
export async function checkAllWorkers(): Promise<Record<WorkerName, boolean>> {
  for (const name of WORKER_NAMES) startWorker(name)
  const results: Record<WorkerName, boolean> = {
    decode: false,
    render: false,
    encode: false,
    ai: false,
  }
  await Promise.all(
    WORKER_NAMES.map(async (name) => {
      results[name] = await requestHealth(name)
    }),
  )
  return results
}

/** Terminate and respawn a single worker, returning its fresh health. */
export async function restartWorker(name: WorkerName): Promise<boolean> {
  terminate(name)
  startWorker(name)
  return requestHealth(name)
}

/** Terminate all workers (used on dispose). */
export function stopAllWorkers(): void {
  for (const name of WORKER_NAMES) terminate(name)
}

/** Last known health per worker (null = never checked). */
export function getWorkerHealth(): Record<WorkerName, boolean | null> {
  return { ...health }
}

export function isWorkerRunning(name: WorkerName): boolean {
  return instances[name] !== undefined
}