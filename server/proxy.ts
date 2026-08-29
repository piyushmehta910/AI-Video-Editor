/**
 * Shared server-side proxy for providers that block browser CORS
 * (NVIDIA NIM, OpenCode Zen). The browser sends the request as JSON
 * to the same-origin proxy endpoint, which forwards it server-side and
 * returns the upstream response. API keys are never stored server-side —
 * they pass through from the user's browser. Providers that support browser
 * CORS (ElevenLabs, Firecrawl, OpenRouter, stock/music providers) bypass this
 * proxy and are called directly.
 */

import { isAllowedProxyUrl } from '../src/lib/proxyHosts.ts'

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
  /** Upstream payload. A stream when the provider streams (e.g. SSE), bytes otherwise. */
  body: ReadableStream<Uint8Array> | Uint8Array
}

async function doFetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
  try {
    return await fetch(url, { ...init, signal })
  } catch (err) {
    // Retry transient network failures exactly once. Timeouts are never
    // retried — that would double worst-case latency past platform limits.
    if (err instanceof TypeError && !signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      return fetch(url, { ...init, signal })
    }
    throw err
  }
}

export async function forwardProxyRequest(payload: ProxyPayload): Promise<ProxyResult> {
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
      if (lower === 'content-type' || lower === 'content-length') {
        headers[key] = value
      }
    })
    // Pass the upstream stream straight through instead of buffering the whole
    // response — required for SSE/token streaming and large downloads.
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
