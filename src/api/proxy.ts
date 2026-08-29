// Provider APIs are proxied so valid keys do not fail because of browser CORS
// policies. The allowlist lives in shared/proxyHosts.ts — the single source of
// truth shared with the server-side proxies.
import { isAllowedProxyUrl } from '@/lib/proxyHosts'

export function needsProxy(url: string): boolean {
  return isAllowedProxyUrl(url)
}

export async function proxyFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // Propagate caller cancellation (e.g. the Director's stop button) into this
  // request instead of letting it run to the full timeout.
  const onOuterAbort = () => controller.abort()
  init.signal?.addEventListener('abort', onOuterAbort)
  try {
    const headers: Record<string, string> = {}
    const source = init.headers instanceof Headers ? init.headers : new Headers(init.headers)
    source.forEach((value, key) => { headers[key] = value })
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: init.method ?? 'GET',
        headers,
        body: typeof init.body === 'string' ? init.body : undefined,
        timeoutMs,
      }),
      signal: controller.signal,
    })
    return res
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', onOuterAbort)
  }
}
