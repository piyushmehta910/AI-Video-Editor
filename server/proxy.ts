/**
 * Shared server-side proxy for providers that block browser CORS
 * (NVIDIA NIM, OpenCode Zen). The browser sends the request as JSON
 * to the same-origin proxy endpoint, which forwards it server-side and
 * returns the upstream response. API keys are never stored server-side —
 * they pass through from the user's browser. Providers that support browser
 * CORS (ElevenLabs, Firecrawl, OpenRouter, stock/music providers) bypass this
 * proxy and are called directly.
 */

export interface ProxyPayload {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface ProxyResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

/**
 * Provider hosts the client may call through this proxy. This keeps API keys
 * out of CORS preflight failures without turning the endpoint into an open
 * proxy. Keep this list in sync with src/api/proxy.ts.
 */
const ALLOWED_HOSTS = [
  'integrate.api.nvidia.com',
  'opencode.ai',
  'api.deezer.com',
  'api.elevenlabs.io',
  'pixabay.com',
  'api.unsplash.com',
  'api.pexels.com',
]

export function isAllowedProxyUrl(url: string): boolean {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

async function doFetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined })
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return fetch(url, { ...init, signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined })
  }
}

export async function forwardProxyRequest(payload: ProxyPayload): Promise<ProxyResult> {
  const url = payload.url
  if (!url || !isAllowedProxyUrl(url)) {
    return {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Host not allowed by proxy' }),
    }
  }
  try {
    const res = await doFetch(
      url,
      {
        method: payload.method ?? 'GET',
        headers: payload.headers,
        body: payload.body,
      },
      payload.timeoutMs,
    )
    const body = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === 'content-type') {
        headers[key] = value
      }
    })
    return { status: res.status, statusText: res.statusText, headers, body }
  } catch (err) {
    return {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
    }
  }
}
