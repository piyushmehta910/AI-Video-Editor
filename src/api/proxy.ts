// Provider APIs are proxied so valid keys do not fail because of browser CORS
// policies. Keep this list in sync with the server-side allowlist.
const PROXIED_HOSTS = [
  'integrate.api.nvidia.com',
  'opencode.ai',
  'api.deezer.com',
  'api.elevenlabs.io',
  'freesound.org',
]

export function needsProxy(url: string): boolean {
  try {
    return PROXIED_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

export async function proxyFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
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
  }
}
