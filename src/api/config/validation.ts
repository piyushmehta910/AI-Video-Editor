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
  return doRequest(label, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, temperature: 0 }),
  }, timeoutMs)
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
  const url = `${baseUrl.replace(/\/$/, '')}/models`
  return doRequest(label, url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }, timeoutMs)
}

export async function fetchOpenRouterFreeModels(baseUrl = 'https://openrouter.ai/api/v1', timeoutMs = 20000): Promise<string[]> {
  const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/models`, { headers: { Accept: 'application/json' } }, timeoutMs)
  if (!res.ok) throw new Error(`OpenRouter catalog error ${res.status}`)
  const data = (await res.json()) as { data?: Array<{ id?: string }> }
  const free = (data.data ?? []).map((m) => m.id ?? '').filter((id) => id.endsWith(':free')).sort()
  if (!free.length) throw new Error('No free models returned by OpenRouter')
  return free
}

export async function testElevenLabs(apiKey: string, endpoint: string, timeoutMs: number, voiceId?: string): Promise<TestResult> {
  const label = 'ElevenLabs'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  const base = endpoint.replace(/\/$/, '')
  const modelsRes = await doRequest(label, `${base}/v1/models`, { headers: { 'xi-api-key': apiKey, Accept: 'application/json' } }, timeoutMs)
  if (!modelsRes.ok) return modelsRes
  let latency = modelsRes.latencyMs
  const userRes = await doRequest(label, `${base}/v1/user`, { headers: { 'xi-api-key': apiKey, Accept: 'application/json' } }, timeoutMs)
  latency += userRes.latencyMs
  let message = `${label}: Connected`
  if (voiceId) {
    const voiceRes = await doRequest(label, `${base}/v1/voices/${encodeURIComponent(voiceId)}`, { headers: { 'xi-api-key': apiKey, Accept: 'application/json' } }, timeoutMs)
    latency += voiceRes.latencyMs
    if (!voiceRes.ok) return { ok: false, status: 'disconnected', message: `ElevenLabs: Voice "${voiceId}" not found`, latencyMs: latency }
    message += ` (voice "${voiceId}" verified)`
  }
  return { ok: true, status: 'connected', message, latencyMs: latency }
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

export async function testFreesound(apiKey: string, endpoint: string, timeoutMs: number): Promise<TestResult> {
  const label = 'Freesound'
  if (!apiKey.trim()) return { ok: false, status: 'disconnected', message: `${label}: Enter an API key to test`, latencyMs: 0 }
  return doRequest(label, `${endpoint.replace(/\/$/, '')}/search/?token=${encodeURIComponent(apiKey)}`, {}, timeoutMs)
}