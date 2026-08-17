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
    keyName: 'key',
    timeoutMs,
  })
}

export function testFirecrawl(apiKey: string, endpoint = 'https://api.firecrawl.dev', timeoutMs: number) {
  return testBearerEndpoint({
    label: 'Firecrawl',
    url: `${endpoint.replace(/\/$/, '')}/v2/search`,
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

export function testMusicBrainz(baseUrl = 'https://musicbrainz.org', userAgent = 'ClipForgeAI/1.0', timeoutMs: number) {
  return testReachability({
    label: 'MusicBrainz',
    url: `${baseUrl.replace(/\/$/, '')}/ws/2/artist?query=test&limit=1`,
    timeoutMs,
    headers: { 'User-Agent': userAgent },
  })
}

export function testDeezer(endpoint = 'https://api.deezer.com', timeoutMs: number) {
  return testReachability({
    label: 'Deezer',
    url: `${endpoint.replace(/\/$/, '')}/search?q=test&limit=1`,
    timeoutMs,
  })
}

export function testFreesound(apiKey: string, endpoint = 'https://freesound.org/apiv2', timeoutMs: number) {
  return testApiKeyEndpoint({
    label: 'Freesound',
    url: `${endpoint.replace(/\/$/, '')}/search/`,
    apiKey,
    keyName: 'token',
    timeoutMs,
  })
}

/**
 * Fetch the current list of free models from OpenRouter's official API.
 * Models are free when their id ends with the `:free` variant.
 */
export async function fetchOpenRouterFreeModels(timeoutMs = 20000): Promise<string[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`OpenRouter catalog error ${res.status}`)
    const data = (await res.json()) as { data?: Array<{ id?: string }> }
    const free = (data.data ?? [])
      .map((m) => m.id ?? '')
      .filter((id) => id.endsWith(':free'))
      .sort()
    if (!free.length) throw new Error('No free models returned by OpenRouter')
    return free
  } finally {
    clearTimeout(timer)
  }
}

const NON_CHAT_NIM = /(embed|reward|safety|content-safety|riva|nemo-retriever|nemoretriever|parse|clip|ocr|vil|vila|synthetic-video|cosmos-reason|neva)/i

/**
 * Fetch the hosted model catalog from the configured NVIDIA NIM endpoint
 * (OpenAI-compatible) and return text-chat-capable model ids. The catalog does
 * not expose which models are free-tier, so non-chat model families are
 * filtered out.
 */
export async function fetchNvidiaNimModels(apiKey: string, baseUrl = 'https://integrate.api.nvidia.com/v1', timeoutMs = 20000): Promise<string[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    })
    if (!res.ok) throw new Error(`NVIDIA catalog error ${res.status}`)
    const data = (await res.json()) as { data?: Array<{ id?: string }> }
    const chat = (data.data ?? [])
      .map((m) => m.id ?? '')
      .filter((id) => !NON_CHAT_NIM.test(id))
      .sort()
    if (!chat.length) throw new Error('No models returned by NVIDIA')
    return chat
  } finally {
    clearTimeout(timer)
  }
}