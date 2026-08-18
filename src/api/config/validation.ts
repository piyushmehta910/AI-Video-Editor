import type { ProviderStatus } from './types'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface TestConnectionResult {
  ok: boolean
  status: ProviderStatus
  message: string
  latencyMs: number
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  if (needsProxy(url)) {
    return proxyFetch(url, init, timeoutMs)
  }
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
    return { ok: false, status: 'disconnected', message: `Request rejected (HTTP ${status})` }
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
  /** Prefix for the Authorization header value. Defaults to `Bearer `. Set to empty string for raw-key auth (e.g. Pexels). */
  authPrefix?: string
}): Promise<TestConnectionResult> {
  const { label, url, apiKey, timeoutMs } = params
  const prefix = params.authPrefix ?? 'Bearer '
  try {
    return await measure(async () => {
      const res = await fetchWithTimeout(
        url,
        {
          method: params.init?.method ?? 'GET',
          ...params.init,
          headers: {
            Authorization: `${prefix}${apiKey}`,
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

export function testUnsplash(accessKey: string, timeoutMs: number) {
  return testReachability({
    label: 'Unsplash',
    url: 'https://api.unsplash.com/search/photos?query=test&per_page=1',
    timeoutMs,
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  })
}

export function testPexels(apiKey: string, timeoutMs: number) {
  return testBearerEndpoint({
    label: 'Pexels',
    url: 'https://api.pexels.com/v1/search?query=nature&per_page=1',
    apiKey,
    timeoutMs,
    authPrefix: '',
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
    // Free endpoint per docs — returns credit usage without consuming credits.
    url: `${endpoint.replace(/\/$/, '')}/v2/team/credit-usage`,
    apiKey,
    timeoutMs,
  })
}

export function testElevenLabs(
  apiKey: string,
  timeoutMs: number,
  endpoint = 'https://api.elevenlabs.io',
  voiceId?: string,
) {
  if (!apiKey.trim()) {
    return Promise.resolve({ ok: false, status: 'disconnected' as const, message: 'ElevenLabs: Enter an API key to test', latencyMs: 0 })
  }
  const base = endpoint.replace(/\/$/, '')
  // Validate the key against the models endpoint first, then verify the
  // configured voice exists for the account (GET /v1/voices/{id}).
  return testReachability({
    label: 'ElevenLabs',
    url: `${base}/v1/models`,
    timeoutMs,
    headers: {
      'xi-api-key': apiKey,
      Accept: 'application/json',
    },
  }).then(async (modelsResult) => {
    if (!modelsResult.ok || !voiceId) return modelsResult
    const voice = await testReachability({
      label: 'ElevenLabs Voice',
      url: `${base}/v1/voices/${encodeURIComponent(voiceId)}`,
      timeoutMs,
      headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
    })
    if (!voice.ok) {
      return {
        ok: false,
        status: 'disconnected' as const,
        message: `ElevenLabs: Voice "${voiceId}" not found for this account`,
        latencyMs: modelsResult.latencyMs + voice.latencyMs,
      }
    }
    return {
      ok: true,
      status: 'connected' as const,
      message: `ElevenLabs: Connection successful (voice "${voiceId}" verified)`,
      latencyMs: modelsResult.latencyMs + voice.latencyMs,
    }
  })
}

/**
 * Fetch the live model roster from the configured ElevenLabs endpoint so the
 * dropdown always reflects what the account can actually use.
 */
export async function fetchElevenLabsModels(apiKey: string, endpoint = 'https://api.elevenlabs.io', timeoutMs = 20000): Promise<string[]> {
  const res = await fetchWithTimeout(
    `${endpoint.replace(/\/$/, '')}/v1/models`,
    { headers: { 'xi-api-key': apiKey, Accept: 'application/json' } },
    timeoutMs,
  )
  if (!res.ok) throw new Error(`ElevenLabs catalog error ${res.status}`)
  const data = (await res.json()) as Array<{ model_id?: string }>
  const models = (data ?? []).map((m) => m.model_id ?? '').filter(Boolean).sort()
  if (!models.length) throw new Error('No models returned by ElevenLabs')
  return models
}

export function testMusicBrainz(baseUrl = 'https://musicbrainz.org', userAgent = 'ClipForgeAI/1.0', timeoutMs: number) {
  return testReachability({
    label: 'MusicBrainz',
    url: `${baseUrl.replace(/\/$/, '')}/ws/2/artist?query=test&limit=1&fmt=json`,
    timeoutMs,
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
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
export async function fetchOpenRouterFreeModels(baseUrl = 'https://openrouter.ai/api/v1', timeoutMs = 20000): Promise<string[]> {
  const res = await fetchWithTimeout(
    `${baseUrl.replace(/\/$/, '')}/models`,
    { headers: { Accept: 'application/json' } },
    timeoutMs,
  )
  if (!res.ok) throw new Error(`OpenRouter catalog error ${res.status}`)
  const data = (await res.json()) as { data?: Array<{ id?: string }> }
  const free = (data.data ?? [])
    .map((m) => m.id ?? '')
    .filter((id) => id.endsWith(':free'))
    .sort()
  if (!free.length) throw new Error('No free models returned by OpenRouter')
  return free
}

const NON_CHAT_NIM = /(embed|reward|safety|content-safety|riva|nemo-retriever|nemoretriever|parse|clip|ocr|vil|vila|synthetic-video|cosmos-reason|neva)/i

/**
 * Validate an NVIDIA NIM API key by posting a minimal chat completion to the
 * OpenAI-compatible endpoint. `GET /v1/models` returns 200 even without a
 * valid key, so only `POST /v1/chat/completions` actually validates auth
 * (401/403 on bad/missing key, 404 on unknown model, 429 on rate limit).
 */
export async function testNvidiaNim(apiKey: string, baseUrl: string, model: string, timeoutMs: number): Promise<TestConnectionResult> {
  const label = 'NVIDIA NIM'
  if (!apiKey.trim()) {
    return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  }
  try {
    return await measure(async () => {
      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        },
        timeoutMs,
      )
      const body = await res.text().catch(() => '')
      if (res.ok) {
        return { ok: true, status: 'connected', message: `${label}: Connection successful` }
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: 'disconnected', message: `${label}: Invalid API key or unauthorized` }
      }
      if (res.status === 404) {
        return { ok: false, status: 'disconnected', message: `${label}: Model not found — "${model}". Pick a different model or refresh the list.` }
      }
      if (res.status === 429) {
        return { ok: false, status: 'disconnected', message: `${label}: Rate limit exceeded` }
      }
      return { ok: false, status: 'disconnected', message: `${label}: HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}` }
    }).then(({ result, latencyMs }) => ({ ...result, latencyMs }) as TestConnectionResult)
  } catch (err) {
    return handleError(err, label)
  }
}

/**
 * Fetch the hosted model catalog from the configured NVIDIA NIM endpoint
 * (OpenAI-compatible) and return text-chat-capable model ids. The catalog does
 * not expose which models are free-tier, so non-chat model families are
 * filtered out.
 */
export async function fetchNvidiaNimModels(apiKey: string, baseUrl = 'https://integrate.api.nvidia.com/v1', timeoutMs = 20000): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`
  const init: RequestInit = {
    headers: {
      Accept: 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  }
  const res = needsProxy(url) ? await proxyFetch(url, init, timeoutMs) : await fetch(url, init)
  if (!res.ok) throw new Error(`NVIDIA catalog error ${res.status}`)
  const data = (await res.json()) as { data?: Array<{ id?: string }> }
  const chat = (data.data ?? [])
    .map((m) => m.id ?? '')
    .filter((id) => !NON_CHAT_NIM.test(id))
    .sort()
  if (!chat.length) throw new Error('No models returned by NVIDIA')
  return chat
}