import type { ProviderStatus } from './types'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface TestResult {
  ok: boolean
  status: ProviderStatus
  message: string
  latencyMs: number
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
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

function measure<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now()
  return fn().then((result) => ({ result, latencyMs: Math.round(performance.now() - start) }))
}

function handleError(err: unknown, label: string): TestResult {
  const message = err instanceof Error
    ? err.name === 'AbortError'
      ? `${label}: request timed out`
      : `${label}: ${err.message}`
    : `${label}: ${String(err)}`
  return { ok: false, status: 'disconnected', message, latencyMs: 0 }
}

function classifyResponse(status: number, ok: boolean, label: string, body?: string): TestResult {
  if (ok) return { ok: true, status: 'connected', message: `${label}: Connected`, latencyMs: 0 }
  if (status === 401 || status === 403) return { ok: false, status: 'disconnected', message: `${label}: Invalid API key or unauthorized${body ? ` (${body.slice(0, 120)})` : ''}`, latencyMs: 0 }
  if (status >= 400 && status < 500) return { ok: false, status: 'disconnected', message: `${label}: Request rejected (HTTP ${status})${body ? ` (${body.slice(0, 120)})` : ''}`, latencyMs: 0 }
  return { ok: false, status: 'disconnected', message: `${label}: HTTP ${status}${body ? ` (${body.slice(0, 120)})` : ''}`, latencyMs: 0 }
}

async function doRequest(label: string, url: string, init: RequestInit, timeoutMs: number): Promise<TestResult> {
  try {
    return await measure(async () => {
      const res = await fetchWithTimeout(url, init, timeoutMs)
      const body = await res.text().catch(() => '')
      return classifyResponse(res.status, res.ok, label, body)
    }).then(({ result, latencyMs }) => ({ ...result, latencyMs }))
  } catch (err) {
    return handleError(err, label)
  }
}

export async function testNvidiaNim(apiKey: string, baseUrl: string, model: string, timeoutMs: number): Promise<TestResult> {
  const label = 'NVIDIA NIM'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const start = performance.now()
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, temperature: 0 }),
    }, timeoutMs)
    const latencyMs = Math.round(performance.now() - start)
    const isDeprecating = res.headers.get('deprecation') || res.headers.get('x-nim-deprecation') || baseUrl.includes('integrate.api.nvidia.com')
    if (res.ok || res.status === 400) {
      return {
        ok: true,
        status: 'connected',
        message: isDeprecating
          ? `${label}: Connected (Hosted endpoint retires Aug 26, 2026 — switch to OpenRouter or self-hosted NIM)`
          : `${label}: Connected`,
        latencyMs,
      }
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 'disconnected', message: `${label}: Invalid NVIDIA API key`, latencyMs }
    }
    return { ok: false, status: 'disconnected', message: `${label}: HTTP ${res.status}`, latencyMs }
  } catch (err) {
    return handleError(err, label)
  }
}

const NON_CHAT_NIM = /(embed|reward|safety|content-safety|riva|nemo-retriever|nemoretriever|parse|clip|ocr|vil|vila|synthetic-video|cosmos-reason|neva)/i

export async function fetchNvidiaNimModels(apiKey: string, baseUrl = 'https://integrate.api.nvidia.com/v1', timeoutMs = 20000): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`
  const init: RequestInit = { headers: { Accept: 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) } }
  const res = needsProxy(url) ? await proxyFetch(url, init, timeoutMs) : await fetch(url, init)
  if (!res.ok) throw new Error(`NVIDIA catalog error ${res.status}`)
  const data = (await res.json()) as { data?: Array<{ id?: string }> }
  const chat = (data.data ?? []).map((m) => m.id ?? '').filter((id) => !NON_CHAT_NIM.test(id)).sort()
  if (!chat.length) throw new Error('No models returned by NVIDIA')
  return chat
}

export async function testNvidiaTts(apiKey: string, baseUrl: string, timeoutMs: number): Promise<TestResult> {
  const label = 'NVIDIA Voice'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  const url = `${baseUrl.replace(/\/$/, '')}/models`
  return doRequest(label, url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }, timeoutMs)
}

export async function testNvidiaVoice(apiKey: string, baseUrl: string, model = 'nvidia/magpie-tts-zeroshot', timeoutMs = 20000): Promise<TestResult> {
  const label = 'NVIDIA NIM Voice'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  const url = `${baseUrl.replace(/\/$/, '')}/audio/speech`
  const start = performance.now()
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: 'NVIDIA voice synthesis online.', voice: 'Aaliyah', response_format: 'wav', speed: 1.0 }),
    }, timeoutMs)
    const latencyMs = Math.round(performance.now() - start)
    if (res.ok || res.status === 200) {
      return { ok: true, status: 'connected', message: `${label}: Voice synthesis ready (${model})`, latencyMs }
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 'disconnected', message: `${label}: Invalid API key`, latencyMs }
    }
    return { ok: false, status: 'disconnected', message: `${label}: HTTP ${res.status}`, latencyMs }
  } catch (err) {
    return handleError(err, label)
  }
}

export async function testOpenCodeZen(apiKey: string, baseUrl: string, model: string, timeoutMs: number): Promise<TestResult> {
  const label = 'OpenCode Zen'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  return doRequest(label, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, temperature: 0 }),
  }, timeoutMs)
}

export async function testOpenRouter(apiKey: string, baseUrl: string, timeoutMs: number): Promise<TestResult> {
  const label = 'OpenRouter'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  const start = performance.now()
  try {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    }, timeoutMs)
    const latencyMs = Math.round(performance.now() - start)
    if (res.ok) {
      const data = await res.json().catch(() => null)
      const keyLabel = data?.data?.label ? ` (${data.data.label})` : ''
      return { ok: true, status: 'connected', message: `${label}: Connected${keyLabel}`, latencyMs }
    }
    if (res.status === 401) {
      return { ok: false, status: 'disconnected', message: `${label}: Invalid OpenRouter key`, latencyMs }
    }
    return doRequest(label, `${baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    }, timeoutMs)
  } catch (err) {
    return handleError(err, label)
  }
}

export async function fetchOpenRouterFreeModels(baseUrl = 'https://openrouter.ai/api/v1', timeoutMs = 20000): Promise<string[]> {
  const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/models`, { headers: { Accept: 'application/json' } }, timeoutMs)
  if (!res.ok) throw new Error(`OpenRouter catalog error ${res.status}`)
  const data = (await res.json()) as { data?: Array<{ id?: string; pricing?: { prompt?: string; completion?: string } }> }
  const free = (data.data ?? [])
    .filter((m) => {
      const id = m.id ?? ''
      if (!id) return false
      const isFreeSuffix = id.endsWith(':free')
      const isZeroPrice = m.pricing?.prompt === '0' && m.pricing?.completion === '0'
      const isFreeRouter = id === 'openrouter/free'
      return isFreeSuffix || isZeroPrice || isFreeRouter
    })
    .map((m) => m.id ?? '')
    .filter(Boolean)
    .sort()
  if (!free.length) throw new Error('No free models returned by OpenRouter')
  return free
}

export async function testElevenLabs(apiKey: string, endpoint: string, timeoutMs: number, voiceId?: string): Promise<TestResult> {
  const label = 'ElevenLabs'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  const base = endpoint.replace(/\/$/, '')
  const start = performance.now()
  try {
    const userRes = await fetchWithTimeout(`${base}/v1/user`, {
      headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
    }, timeoutMs)
    let latencyMs = Math.round(performance.now() - start)
    if (userRes.ok) {
      const data = await userRes.json().catch(() => null)
      const sub = data?.subscription
      let tierInfo = sub ? ` (${sub.tier ?? 'valid'}, ${sub.character_count ?? 0}/${sub.character_limit ?? 'unlimited'} chars)` : ''
      if (voiceId) {
        const voiceRes = await fetchWithTimeout(`${base}/v1/voices/${encodeURIComponent(voiceId)}`, {
          headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
        }, timeoutMs)
        latencyMs = Math.round(performance.now() - start)
        if (!voiceRes.ok) {
          return { ok: false, status: 'disconnected', message: `ElevenLabs: Voice "${voiceId}" not found`, latencyMs }
        }
        tierInfo += ` [voice "${voiceId}" ok]`
      }
      return { ok: true, status: 'connected', message: `${label}: Connected${tierInfo}`, latencyMs }
    }
    if (userRes.status === 401) {
      return { ok: false, status: 'disconnected', message: `${label}: Invalid ElevenLabs key`, latencyMs }
    }
    if (userRes.status === 429) {
      return { ok: true, status: 'connected', message: `${label}: Valid key (Rate-limited)`, latencyMs }
    }
    return { ok: false, status: 'disconnected', message: `${label}: HTTP ${userRes.status}`, latencyMs }
  } catch (err) {
    return handleError(err, label)
  }
}

export async function fetchElevenLabsModels(apiKey: string, endpoint = 'https://api.elevenlabs.io', timeoutMs = 20000): Promise<string[]> {
  const res = await fetchWithTimeout(`${endpoint.replace(/\/$/, '')}/v1/models`, { headers: { 'xi-api-key': apiKey, Accept: 'application/json' } }, timeoutMs)
  if (!res.ok) throw new Error(`ElevenLabs catalog error ${res.status}`)
  const data = (await res.json()) as Array<{ model_id?: string }>
  const models = (data ?? []).map((m) => m.model_id ?? '').filter(Boolean).sort()
  if (!models.length) throw new Error('No models returned by ElevenLabs')
  return models
}

export async function testUnsplash(accessKey: string, timeoutMs: number): Promise<TestResult> {
  const label = 'Unsplash'
  if (!accessKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an Access Key to test`, latencyMs: 0 }
  return doRequest(label, 'https://api.unsplash.com/search/photos?query=test&per_page=1', {
    headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
  }, timeoutMs)
}

export async function testPexels(apiKey: string, timeoutMs: number): Promise<TestResult> {
  const label = 'Pexels'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  return doRequest(label, 'https://api.pexels.com/v1/search?query=nature&per_page=1', {
    headers: { Authorization: apiKey, Accept: 'application/json' },
  }, timeoutMs)
}

export async function testPixabay(apiKey: string, timeoutMs: number): Promise<TestResult> {
  const label = 'Pixabay'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  return doRequest(label, `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}`, {}, timeoutMs)
}

export async function testFirecrawl(apiKey: string, endpoint: string, timeoutMs: number): Promise<TestResult> {
  const label = 'Firecrawl'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  return doRequest(label, `${endpoint.replace(/\/$/, '')}/v2/team/credit-usage`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  }, timeoutMs)
}

export async function testMusicBrainz(baseUrl: string, userAgent: string, timeoutMs: number): Promise<TestResult> {
  return doRequest('MusicBrainz', `${baseUrl.replace(/\/$/, '')}/ws/2/artist?query=test&limit=1&fmt=json`, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
  }, timeoutMs)
}

export async function testDeezer(endpoint: string, timeoutMs: number): Promise<TestResult> {
  return doRequest('Deezer', `${endpoint.replace(/\/$/, '')}/search?q=test&limit=1`, {}, timeoutMs)
}

export async function testGiphy(apiKey: string, timeoutMs: number, rating = 'g'): Promise<TestResult> {
  const label = 'Giphy'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  return doRequest(label, `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=test&limit=1&rating=${encodeURIComponent(rating)}`, {}, timeoutMs)
}