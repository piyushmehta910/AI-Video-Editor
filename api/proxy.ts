/**
 * Same-origin serverless proxy so the browser app can call providers that
 * block CORS (NVIDIA NIM, OpenCode Zen). Keys pass through from the
 * client; nothing is persisted server-side. CORS-friendly providers are
 * fetched directly from the browser and never hit this endpoint.
 */

interface ProxyPayload {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

/** Hosts allowed to be proxied through this endpoint. Mirrors server/proxy.ts. */
const ALLOWED_HOSTS = ['integrate.api.nvidia.com', 'opencode.ai']

function isAllowedProxyUrl(url: string): boolean {
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

async function forwardProxyRequest(payload: ProxyPayload) {
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
      if (key.toLowerCase() === 'content-type') headers[key] = value
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  let payload: ProxyPayload
  try {
    payload = (await req.json()) as ProxyPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const result = await forwardProxyRequest(payload)
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
  })
}