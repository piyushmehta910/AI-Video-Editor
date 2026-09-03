/**
 * Token bucket rate limiter for AI provider calls.
 *
 * Default budget: 30 requests/minute with burst of 10.
 * Per-provider overrides:
 *   - nvidiaNim: 20/min  (strict, expensive GPUs)
 *   - openRouter: 50/min (aggregator, generous)
 *   - opencodeZen: 30/min
 *
 * The store is in-memory only — it resets on page reload, which matches user
 * intent ("don't burn credits in a single session"). For hard billing
 * protection, combine with server-side limits at the proxy.
 */

interface Bucket {
  tokens: number
  lastRefillMs: number
}

interface Limit {
  perMinute: number
  burst: number
}

const DEFAULTS: Limit = { perMinute: 30, burst: 10 }

const PROVIDER_LIMITS: Record<string, Limit> = {
  nvidiaNim: { perMinute: 20, burst: 5 },
  openRouter: { perMinute: 50, burst: 10 },
  opencodeZen: { perMinute: 30, burst: 8 },
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
  remaining: number
}

function getLimit(provider: string): Limit {
  return PROVIDER_LIMITS[provider] ?? DEFAULTS
}

function refill(bucket: Bucket, limit: Limit, nowMs: number): void {
  const elapsedMs = nowMs - bucket.lastRefillMs
  if (elapsedMs <= 0) return
  // Refill rate = perMinute / 60_000 tokens per ms
  const refillPerMs = limit.perMinute / 60_000
  const added = elapsedMs * refillPerMs
  bucket.tokens = Math.min(limit.burst, bucket.tokens + added)
  bucket.lastRefillMs = nowMs
}

/**
 * Check (and atomically consume) one token. Returns retry-after hint in ms
 * if denied. The call is a no-op if allowed.
 */
export function checkRateLimit(provider: string): RateLimitResult {
  const limit = getLimit(provider)
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
  let bucket = buckets.get(provider)
  if (!bucket) {
    bucket = { tokens: limit.burst, lastRefillMs: nowMs }
    buckets.set(provider, bucket)
  }
  refill(bucket, limit, nowMs)
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true, retryAfterMs: 0, remaining: Math.floor(bucket.tokens) }
  }
  // Tokens short by how long until 1 token regenerates
  const deficit = 1 - bucket.tokens
  const refillPerMs = limit.perMinute / 60_000
  const retryAfterMs = Math.ceil(deficit / refillPerMs)
  return { allowed: false, retryAfterMs, remaining: 0 }
}

/** Reset the bucket — useful for tests and the "Reset" button. */
export function resetRateLimit(provider?: string): void {
  if (provider) buckets.delete(provider)
  else buckets.clear()
}

/** Snapshot for debugging / UI display. */
export function getRateLimitStatus(provider: string): { tokens: number; limit: Limit } {
  const limit = getLimit(provider)
  const bucket = buckets.get(provider)
  return {
    tokens: bucket ? Math.floor(bucket.tokens) : limit.burst,
    limit,
  }
}
