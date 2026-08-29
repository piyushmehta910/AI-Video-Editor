/**
 * Same-origin serverless proxy so the browser app can call providers that
 * block CORS (NVIDIA NIM, OpenCode Zen). Keys pass through from the
 * client; nothing is persisted server-side. CORS-friendly providers are
 * fetched directly from the browser and never hit this endpoint.
 */

import { isAllowedProxyUrl } from '../src/lib/proxyHosts'

interface ProxyPayload {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

async function doFetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
  try {
    return await fetch(url, { ...init, signal })
  } catch (err) {
    // Retry transient network failures exactly once. Timeouts are never
    // retried — that would double worst-case latency past Vercel's limits.
    if (err instanceof TypeError && !signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      return fetch(url, { ...init, signal })
    }
    throw err
  }
}

async function forwardProxyRequest(payload: ProxyPayload) {
  const url = payload.url
  if (!url || !isAllowedProxyUrl(url)) {
    return {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode(JSON.stringify({ error: 'Host not allowed by proxy' })),
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
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === 'content-type' || lower === 'content-length') headers[key] = value
    })
    // Stream the upstream body straight through so SSE/token streaming and
    // large downloads are not buffered in memory.
    return { status: res.status, statusText: res.statusText, headers, body: res.body ?? new Uint8Array(0) }
  } catch (err) {
    return {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode(JSON.stringify({ error: err instanceof Error ? err.message : String(err) })),
    }
  }
}

async function handler(req: Request): Promise<Response> {
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

// Vercel's Vite function runtime dispatches Web API handlers via `fetch`.
export default { fetch: handler }
