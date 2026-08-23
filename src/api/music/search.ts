import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface MusicTrackResult {
  id: string
  title: string
  artist: string
  duration: number
  previewUrl?: string
  source: 'deezer' | 'internetarchive' | 'musicbrainz'
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

async function searchMusicBrainz(query: string, limit: number): Promise<MusicTrackResult[]> {
  const cfg = useApiConfigStore.getState().config.music.musicbrainz
  if (!cfg.enabled) return []
  const base = (cfg.baseUrl ?? 'https://musicbrainz.org').replace(/\/$/, '')
  try {
    const data = (await fetchJson(
      `${base}/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
      { headers: { Accept: 'application/json' } },
      30000,
    )) as {
      recordings?: Array<{
        id?: string
        title?: string
        length?: number
        'artist-credit'?: Array<{ name?: string; artist?: { name?: string } }>
      }>
    }
    const recordings = data.recordings ?? []
    return Promise.all(
      recordings.map(async (r): Promise<MusicTrackResult> => {
        const title = r.title ?? 'Unknown'
        const artist =
          r['artist-credit']
            ?.map((c) => c.name ?? c.artist?.name ?? '')
            .filter(Boolean)
            .join(', ') || 'Unknown'
        const duration = Math.round((r.length ?? 0) / 1000)
        let previewUrl: string | undefined
        try {
          // MusicBrainz has no audio; enrich with a free 30s iTunes preview when available.
          const it = (await fetchJson(
            `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`,
            {},
            15000,
          )) as { results?: Array<{ previewUrl?: string }> }
          previewUrl = it.results?.[0]?.previewUrl
        } catch {
          // preview optional
        }
        return { id: r.id ?? `${title}:${artist}`, title, artist, duration, previewUrl, source: 'musicbrainz' }
      }),
    )
  } catch {
    return []
  }
}

export async function searchMusic(query: string, options: MusicSearchOptions = {}): Promise<MusicTrackResult[]> {
  const limit = options.maxResults ?? 6
  const [deezer, musicbrainz, archive] = await Promise.all([
    searchDeezer(query, limit),
    searchMusicBrainz(query, limit),
    searchInternetArchive(query, limit),
  ])
  const seen = new Set<string>()
  const merged: MusicTrackResult[] = []
  for (const track of [...deezer, ...musicbrainz, ...archive]) {
    const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(track)
    if (merged.length >= limit * 2) break
  }
  return merged
}

export interface SoundEffectResult {
  id: string
  name: string
  duration: number
  previewUrl?: string
  license?: string
  source: 'freesound'
}

export async function searchSoundEffects(query: string, options: { maxResults?: number } = {}): Promise<SoundEffectResult[]> {
  const limit = options.maxResults ?? 8
  const cfg = useApiConfigStore.getState().config.music.freesound
  const apiKey = cfg?.apiKey?.trim()
  const timeout = cfg?.timeoutMs ?? 30000
  if (!apiKey) return []
  try {
    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&token=${encodeURIComponent(apiKey)}&page_size=${limit}&fields=id,name,duration,previews,license`
    const data = (await fetchJson(url, {}, timeout)) as {
      results?: Array<{
        id: number
        name: string
        duration: number
        previews?: { 'preview-hq-mp3'?: string; 'preview-lq-mp3'?: string }
        license?: string
      }>
    }
    return (data.results ?? []).map((r) => ({
      id: String(r.id),
      name: r.name,
      duration: Math.round(r.duration),
      previewUrl: r.previews?.['preview-hq-mp3'] ?? r.previews?.['preview-lq-mp3'],
      license: r.license,
      source: 'freesound' as const,
    }))
  } catch {
    return []
  }
}