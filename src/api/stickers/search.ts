import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface StickerResult {
  id: string
  title: string
  preview: string
  url: string
  width?: number
  height?: number
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

export async function searchWikimediaGifs(query: string, limit: number): Promise<StickerResult[]> {
  const timeout = 20000
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: `${query} animation filetype:bitmap`,
      gsrlimit: String(limit * 2),
      prop: 'imageinfo',
      iiprop: 'url|size',
      iiurlwidth: '300',
      format: 'json',
      origin: '*',
    })
    const data = (await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`, {}, timeout)) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string
            imageinfo?: Array<{
              thumburl?: string
              url?: string
              width?: number
              height?: number
            }>
          }
        >
      }
    }
    const pages = Object.values(data.query?.pages ?? {})
    return pages
      .map((p) => {
        const info = p.imageinfo?.[0]
        if (!info?.url || !info.url.toLowerCase().includes('.gif')) return null
        const title = (p.title || '').replace(/^File:/i, '').replace(/\.gif$/i, '')
        return {
          id: encodeURIComponent(p.title || crypto.randomUUID()),
          title,
          preview: info.thumburl || info.url,
          url: info.url,
          width: info.width,
          height: info.height,
        }
      })
      .filter((g): g is StickerResult => g !== null)
      .slice(0, limit)
  } catch (err) {
    console.warn('[stickers] Wikimedia GIF search failed:', err)
    return []
  }
}

export async function searchGiphy(query: string, options: { limit?: number; rating?: string } = {}): Promise<StickerResult[]> {
  const cfg = useApiConfigStore.getState().config.giphy
  const limit = options.limit ?? cfg.limit ?? 24
  const rating = options.rating ?? cfg.rating ?? 'g'
  const key = cfg.apiKey
  if (!key) {
    return searchWikimediaGifs(query, limit)
  }
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const params = new URLSearchParams({
      api_key: key,
      q: query,
      limit: String(Math.min(50, Math.max(1, limit))),
      rating,
    })
    const data = (await fetchJson(`https://api.giphy.com/v1/gifs/search?${params}`, {}, timeout)) as {
      data?: Array<{
        id?: string
        title?: string
        images?: Record<string, { url?: string; width?: string; height?: string }>
      }>
    }
    const results = (data.data ?? []).map((g) => {
      const preview = g.images?.fixed_width?.url ?? g.images?.preview_gif?.url ?? ''
      const url = g.images?.original?.url ?? preview
      return {
        id: g.id ?? '',
        title: g.title ?? '',
        preview,
        url,
        width: Number(g.images?.original?.width) || undefined,
        height: Number(g.images?.original?.height) || undefined,
      }
    })
    if (results.length === 0) {
      return searchWikimediaGifs(query, limit)
    }
    return results
  } catch {
    return searchWikimediaGifs(query, limit)
  }
}

export async function searchGiphyTrending(options: { limit?: number; rating?: string } = {}): Promise<StickerResult[]> {
  const cfg = useApiConfigStore.getState().config.giphy
  const limit = options.limit ?? cfg.limit ?? 24
  const rating = options.rating ?? cfg.rating ?? 'g'
  const key = cfg.apiKey
  if (!key) {
    return searchWikimediaGifs('animated sticker', limit)
  }
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const params = new URLSearchParams({
      api_key: key,
      limit: String(Math.min(50, Math.max(1, limit))),
      rating,
    })
    const data = (await fetchJson(`https://api.giphy.com/v1/gifs/trending?${params}`, {}, timeout)) as {
      data?: Array<{
        id?: string
        title?: string
        images?: Record<string, { url?: string; width?: string; height?: string }>
      }>
    }
    const results = (data.data ?? []).map((g) => {
      const preview = g.images?.fixed_width?.url ?? g.images?.preview_gif?.url ?? ''
      const url = g.images?.original?.url ?? preview
      return {
        id: g.id ?? '',
        title: g.title ?? '',
        preview,
        url,
        width: Number(g.images?.original?.width) || undefined,
        height: Number(g.images?.original?.height) || undefined,
      }
    })
    if (results.length === 0) {
      return searchWikimediaGifs('animated sticker', limit)
    }
    return results
  } catch {
    return searchWikimediaGifs('animated sticker', limit)
  }
}

export async function downloadGiphy(result: StickerResult): Promise<File> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = needsProxy(result.url)
      ? await proxyFetch(result.url, {}, 30000)
      : await fetch(result.url, { signal: controller.signal })
    const blob = await res.blob()
    const safeId = result.id.replace(/[^\w-]/g, '').slice(0, 32) || 'sticker'
    return new File([blob], `sticker-${safeId}.gif`, { type: blob.type || 'image/gif' })
  } finally {
    clearTimeout(timer)
  }
}