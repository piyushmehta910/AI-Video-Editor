import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface MusicTrackResult {
  id: string
  title: string
  artist: string
  duration: number
  previewUrl?: string
  source: 'deezer' | 'internetarchive'
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

async function searchInternetArchive(query: string, limit: number): Promise<MusicTrackResult[]> {
  const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`${query} AND mediatype:audio AND collection:opensource_audio`)}&fl[]=identifier&fl[]=title&fl[]=creator&rows=${limit * 4}&page=1&output=json`
  let data: { response?: { docs?: Array<{ identifier?: string; title?: string; creator?: string | string[] }> } }
  try {
    data = (await fetchJson(searchUrl, {}, 30000)) as typeof data
  } catch {
    return []
  }
  const docs = data.response?.docs ?? []
  if (!docs.length) return []

  const rows = await Promise.all(
    docs.map(async (doc): Promise<MusicTrackResult | null> => {
      const id = doc.identifier ?? ''
      if (!id) return null
      const title = doc.title ?? 'Untitled'
      const artist = Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator ?? 'Internet Archive')
      try {
        const meta = (await fetchJson(`https://archive.org/metadata/${encodeURIComponent(id)}`, {}, 30000)) as {
          files?: Array<{ name?: string; format?: string; length?: string | number }>
          metadata?: { 'access-restricted-item'?: string }
        }
        if (meta.metadata?.['access-restricted-item'] === 'true') return null
        const files = meta.files ?? []
        const file =
          files.find((f) => f.name && /(mp3|ogg|vorbis)/i.test(f.format ?? f.name)) ??
          files.find((f) => f.name && /(wav|flac|m4a)/i.test(f.format ?? f.name))
        if (!file?.name) return null
        const duration = Number(file.length ?? 0) || 0
        return {
          id: `${id}:${file.name}`,
          title,
          artist,
          duration,
          previewUrl: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(file.name)}`,
          source: 'internetarchive',
        }
      } catch {
        return null
      }
    }),
  )
  return rows.filter((r): r is MusicTrackResult => r !== null).slice(0, limit)
}

export async function searchMusic(query: string, options: MusicSearchOptions = {}): Promise<MusicTrackResult[]> {
  const limit = options.maxResults ?? 6
  const deezer = await searchDeezer(query, limit)
  if (deezer.length) return deezer
  return searchInternetArchive(query, limit)
}