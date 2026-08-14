import type { ProviderStatus } from './types'

export interface TestConnectionResult {
  ok: boolean
  status: ProviderStatus
  message: string
  latencyMs: number
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export function classifyResponse(
  status: number,
  ok: boolean,
): { ok: boolean; status: ProviderStatus; message: string } {
  if (ok) {
    return { ok: true, status: 'connected', message: 'Connection successful' }
  }
  if (status === 401 || status === 403) {
    return { ok: false, status: 'disconnected', message: 'Invalid API key or unauthorized' }
  }
  if (status >= 400 && status < 500) {
    return { ok: true, status: 'connected', message: 'Endpoint reachable' }
  }
  return { ok: false, status: 'disconnected', message: `HTTP ${status}` }
}

function measure<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now()
  return fn().then((result) => ({ result, latencyMs: Math.round(performance.now() - start) }))
}

function handleError(err: unknown, label: string): TestConnectionResult {
  const message =
    err instanceof Error
      ? err.name === 'AbortError'
        ? `${label}: request timed out`
        : `${label}: ${err.message}`
      : `${label}: ${String(err)}`
  return { ok: false, status: 'disconnected', message, latencyMs: 0 }
}

export async function testBearerEndpoint(params: {
  label: string
  url: string
  apiKey: string
  timeoutMs: number
  headers?: Record<string, string>
  init?: Omit<RequestInit, 'headers'>
}): Promise<TestConnectionResult> {
  const { label, url, apiKey, timeoutMs } = params
  try {
    return await measure(async () => {
      const res = await fetchWithTimeout(
        url,
        {
          method: params.init?.method ?? 'GET',
          ...params.init,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...params.headers,
          },
        },
        timeoutMs,
      )
      const classified = classifyResponse(res.status, res.ok)
      return { ...classified, message: `${label}: ${classified.message}` }
    }).then(({ result, latencyMs }) => ({ ...result, latencyMs }))
  } catch (err) {
    return handleError(err, label)
  }
}

export async function testApiKeyEndpoint(params: {
  label: string
  url: string
  apiKey: string
  keyName?: string
  timeoutMs: number
}): Promise<TestConnectionResult> {
  const { label, url, apiKey, keyName = 'api_key', timeoutMs } = params
  try {
    return await measure(async () => {
      const separator = url.includes('?') ? '&' : '?'
      const res = await fetchWithTimeout(`${url}${separator}${keyName}=${encodeURIComponent(apiKey)}`, {}, timeoutMs)
      const classified = classifyResponse(res.status, res.ok)
      return { ...classified, message: `${label}: ${classified.message}` }
    }).then(({ result, latencyMs }) => ({ ...result, latencyMs }))
  } catch (err) {
    return handleError(err, label)
  }
}

export async function testReachability(params: {
  label: string
  url: string
  timeoutMs: number
  headers?: Record<string, string>
}): Promise<TestConnectionResult> {
  const { label, url, timeoutMs } = params
  try {
    return await measure(async () => {
      const res = await fetchWithTimeout(url, { headers: params.headers }, timeoutMs)
      const classified = classifyResponse(res.status, res.ok)
      return { ...classified, message: `${label}: ${classified.message}` }
    }).then(({ result, latencyMs }) => ({ ...result, latencyMs }))
  } catch (err) {
    return handleError(err, label)
  }
}

export function testUnsplash(apiKey: string, timeoutMs: number) {
  return testApiKeyEndpoint({
    label: 'Unsplash',
    url: 'https://api.unsplash.com/search/photos',
    apiKey,
    keyName: 'client_id',
    timeoutMs,
  })
}

export function testPexels(apiKey: string, timeoutMs: number) {
  return testBearerEndpoint({
    label: 'Pexels',
    url: 'https://api.pexels.com/v1/search',
    apiKey,
    timeoutMs,
  })
}

export function testPixabay(apiKey: string, timeoutMs: number) {
  return testApiKeyEndpoint({
    label: 'Pixabay',
    url: 'https://pixabay.com/api/',
    apiKey,
    timeoutMs,
  })
}

export function testFirecrawl(apiKey: string, timeoutMs: number) {
  return testBearerEndpoint({
    label: 'Firecrawl',
    url: 'https://api.firecrawl.dev/v1/search',
    apiKey,
    timeoutMs,
    init: {
      method: 'POST',
      body: JSON.stringify({ query: 'test', limit: 1 }),
    },
  })
}

export function testElevenLabs(apiKey: string, timeoutMs: number) {
  return testBearerEndpoint({
    label: 'ElevenLabs',
    url: 'https://api.elevenlabs.io/v1/user',
    apiKey,
    timeoutMs,
    headers: { 'xi-api-key': apiKey },
  })
}

export function testMusicBrainz(timeoutMs: number) {
  return testReachability({
    label: 'MusicBrainz',
    url: 'https://musicbrainz.org/ws/2/artist?query=test&limit=1',
    timeoutMs,
    headers: { 'User-Agent': 'ClipForgeAI/1.0 (clipforge@example.com)' },
  })
}

export function testDeezer(timeoutMs: number) {
  return testReachability({
    label: 'Deezer',
    url: 'https://api.deezer.com/search?q=test&limit=1',
    timeoutMs,
  })
}

export function testFreesound(apiKey: string, timeoutMs: number) {
  return testApiKeyEndpoint({
    label: 'Freesound',
    url: 'https://freesound.org/apiv2/search/text/',
    apiKey,
    keyName: 'token',
    timeoutMs,
  })
}