export const WORKER_NAMES = ['decode', 'render', 'encode', 'ai'] as const
export type WorkerName = (typeof WORKER_NAMES)[number]

export interface HealthRequest {
  type: 'health'
  requestId: string
}

export interface HealthResponse {
  type: 'health'
  requestId: string
  worker: WorkerName
  ok: true
  ts: number
}

/** Validate and normalize an incoming worker message. Returns null for garbage. */
export function parseWorkerMessage(raw: unknown): { type: string; requestId: string } | null {
  if (raw === null || typeof raw !== 'object') return null
  const msg = raw as { type?: unknown; requestId?: unknown }
  if (typeof msg.type !== 'string' || typeof msg.requestId !== 'string') return null
  return { type: msg.type, requestId: msg.requestId }
}

/**
 * Pure message handler shared by every worker stub. Health checks are answered
 * with a round-trip response; anything else is ignored (returns null).
 */
export function handleWorkerMessage(raw: unknown, worker: WorkerName): HealthResponse | null {
  const msg = parseWorkerMessage(raw)
  if (!msg || msg.type !== 'health') return null
  return { type: 'health', requestId: msg.requestId, worker, ok: true, ts: Date.now() }
}