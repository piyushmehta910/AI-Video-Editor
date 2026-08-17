/**
 * Shared server-side proxy for providers that block browser CORS
 * (NVIDIA NIM, OpenCode Zen, Firecrawl, Deezer). The browser sends the
 * request as JSON to the same-origin proxy endpoint, which forwards it
 * server-side and returns the upstream response. API keys are never stored
 * server-side — they pass through from the user's browser.
 */

export interface ProxyPayload {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

export interface ProxyResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

/** Hosts that block browser CORS and are routed through this proxy. */
const ALLOWED_HOSTS = ['integrate.api.nvidia.com', 'opencode.ai', 'api.firecrawl.dev', 'api.deezer.com']

export function isAllowedProxyUrl(url: string): boolean {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
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
    const res = await fetch(url, {
      method: payload.method ?? 'GET',
      headers: payload.headers,
      body: payload.body,
    })
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