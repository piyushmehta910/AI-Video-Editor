/**
 * Browser-side helper for providers that block CORS. Requests are POSTed as
 * JSON to the same-origin proxy (api/proxy.ts on Vercel, middleware in dev),
 * which forwards them server-side. Mirrors the allowlist in server/proxy.ts.
 *
 * Only CORS-blocked providers are proxied (NVIDIA NIM, OpenCode Zen, Deezer).
 * ElevenLabs, Firecrawl, OpenRouter, Unsplash, Pexels, Pixabay, MusicBrainz
 * and Freesound all allow browser CORS and are fetched directly.
 */

const PROXIED_HOSTS = ['integrate.api.nvidia.com', 'opencode.ai', 'api.deezer.com']

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
        timeoutMs,
      }),
      signal: controller.signal,
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}