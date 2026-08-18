import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface MusicTrackResult {
  id: string
  title: string
  artist: string
  duration: number
  previewUrl?: string
  source: 'deezer' | 'freesound'
}

export interface MusicSearchOptions {
  maxResults?: number
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  if (needsProxy(url)) return proxyFetch(url, init, timeoutMs).then((r) => r.json())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function searchDeezer(query: string, limit: number): Promise<MusicTrackResult[]> {
  const cfg = useApiConfigStore.getState().config.music.deezer
  if (!cfg.enabled) return []
  const endpoint = cfg.endpoint ?? 'https://api.deezer.com'
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const data = (await fetchJson(`${endpoint.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&limit=${limit}`, {}, timeout)) as {
      data?: Array<{ id: number | string; title?: string; artist?: { name?: string }; duration?: number; preview?: string }>
    }
    return (data.data ?? []).map((t) => ({
      id: String(t.id),
      title: t.title ?? 'Unknown',
      artist: t.artist?.name ?? 'Unknown',
      duration: t.duration ?? 0,
      previewUrl: t.preview,
      source: 'deezer' as const,
    }))
  } catch {
    return []
  }
}

async function searchFreesound(query: string, limit: number): Promise<MusicTrackResult[]> {
  const cfg = useApiConfigStore.getState().config.music.freesound
  if (!cfg.enabled || !cfg.apiKey) return []
  const endpoint = cfg.endpoint ?? 'https://freesound.org/apiv2'
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const data = (await fetchJson(
      `${endpoint.replace(/\/$/, '')}/search/text/?query=${encodeURIComponent(query)}&filter=duration:[0 TO 120]&fields=id,name,username,duration,previews&page_size=${limit}&token=${encodeURIComponent(cfg.apiKey)}`,
      {},
      timeout,
    )) as {
      results?: Array<{
        id: number | string
        name?: string
        username?: string
        duration?: number
        previews?: Record<string, string>
      }>
    }
    return (data.results ?? []).map((t) => ({
      id: String(t.id),
      title: t.name ?? 'Unknown',
      artist: t.username ?? 'Unknown',
      duration: t.duration ?? 0,
      previewUrl: t.previews?.['preview-hq-mp3'] ?? t.previews?.['preview-lq-mp3'],
      source: 'freesound' as const,
    }))
  } catch {
    return []
  }
}

export async function searchMusic(query: string, options: MusicSearchOptions = {}): Promise<MusicTrackResult[]> {
  const limit = options.maxResults ?? 6
  const [deezer, freesound] = await Promise.all([searchDeezer(query, limit), searchFreesound(query, limit)])
  return [...deezer, ...freesound].slice(0, limit * 2)
}