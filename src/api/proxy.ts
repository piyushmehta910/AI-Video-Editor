/**
 * Browser-side helper for providers that block CORS. Requests are POSTed as
 * JSON to the same-origin proxy (api/proxy.ts on Vercel, middleware in dev),
 * which forwards them server-side. Mirrors the allowlist in server/proxy.ts.
 */

const PROXIED_HOSTS = ['integrate.api.nvidia.com', 'opencode.ai', 'api.firecrawl.dev', 'api.deezer.com', 'api.elevenlabs.io']

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
    source.forEach((value, key) => {
      headers[key] = value
    })
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: init.method ?? 'GET',
        headers,
        body: typeof init.body === 'string' ? init.body : undefined,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Proxy error ${res.status}: ${text.slice(0, 200) || res.statusText}`)
    }
    const data = (await res.json()) as {
      status: number
      statusText: string
      headers: Record<string, string>
      body: string
    }
    return new Response(data.body, {
      status: data.status,
      statusText: data.statusText,
      headers: data.headers,
    })
  } finally {
    clearTimeout(timer)
  }
}