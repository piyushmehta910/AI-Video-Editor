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

export async function searchGiphy(query: string, options: { limit?: number; rating?: string } = {}): Promise<StickerResult[]> {
  const cfg = useApiConfigStore.getState().config.giphy
  const key = cfg.apiKey
  if (!key) return []
  const limit = options.limit ?? cfg.limit ?? 24
  const rating = options.rating ?? cfg.rating ?? 'g'
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
    return (data.data ?? []).map((g) => {
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
  } catch {
    return []
  }
}

export async function searchGiphyTrending(options: { limit?: number; rating?: string } = {}): Promise<StickerResult[]> {
  const cfg = useApiConfigStore.getState().config.giphy
  const key = cfg.apiKey
  if (!key) return []
  const limit = options.limit ?? cfg.limit ?? 24
  const rating = options.rating ?? cfg.rating ?? 'g'
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
    return (data.data ?? []).map((g) => {
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
  } catch {
    return []
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
    return new File([blob], `sticker-${result.id}.gif`, { type: blob.type || 'image/gif' })
  } finally {
    clearTimeout(timer)
  }
}