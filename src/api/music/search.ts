import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface MusicTrackResult {
  id: string
  title: string
  artist: string
  duration: number
  previewUrl?: string
  source: 'deezer'
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

export async function searchMusic(query: string, options: MusicSearchOptions = {}): Promise<MusicTrackResult[]> {
  const limit = options.maxResults ?? 6
  return searchDeezer(query, limit)
}