import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface StockImageResult {
  id: string
  thumb: string
  full: string
  author: string
  source: string
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

async function searchUnsplash(query: string, limit: number): Promise<StockImageResult[]> {
  const cfg = useApiConfigStore.getState().config.stockImages.unsplash
  const key = cfg.accessKey || cfg.apiKey
  if (!key) return []
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const data = (await fetchJson(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}`,
      { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } },
      timeout,
    )) as { results?: Array<{ id?: string; urls?: Record<string, string>; user?: { name?: string }; width?: number; height?: number }> }
    return (data.results ?? []).map((p) => ({
      id: p.id ?? '',
      thumb: p.urls?.small ?? '',
      full: p.urls?.full ?? p.urls?.regular ?? '',
      author: p.user?.name ?? '',
      source: 'Unsplash',
      width: p.width,
      height: p.height,
    }))
  } catch {
    return []
  }
}

async function searchPexels(query: string, limit: number): Promise<StockImageResult[]> {
  const cfg = useApiConfigStore.getState().config.stockImages.pexels
  if (!cfg.apiKey) return []
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const data = (await fetchJson(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}`,
      { headers: { Authorization: cfg.apiKey } },
      timeout,
    )) as { photos?: Array<{ id?: number; src?: Record<string, string>; photographer?: string; width?: number; height?: number }> }
    return (data.photos ?? []).map((p) => ({
      id: String(p.id),
      thumb: p.src?.medium ?? '',
      full: p.src?.original ?? p.src?.large2x ?? '',
      author: p.photographer ?? '',
      source: 'Pexels',
      width: p.width,
      height: p.height,
    }))
  } catch {
    return []
  }
}

async function searchPixabay(query: string, limit: number): Promise<StockImageResult[]> {
  const cfg = useApiConfigStore.getState().config.stockImages.pixabay
  if (!cfg.apiKey) return []
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const params = new URLSearchParams({
      key: cfg.apiKey,
      q: query,
      per_page: String(limit),
      image_type: 'photo',
      safesearch: String(cfg.safeSearch ?? true),
    })
    const data = (await fetchJson(`https://pixabay.com/api/?${params}`, {}, timeout)) as {
      hits?: Array<{ id?: number; webformatURL?: string; largeImageURL?: string; user?: string; imageWidth?: number; imageHeight?: number }>
    }
    return (data.hits ?? []).map((p) => ({
      id: String(p.id),
      thumb: p.webformatURL ?? '',
      full: p.largeImageURL ?? '',
      author: p.user ?? '',
      source: 'Pixabay',
      width: p.imageWidth,
      height: p.imageHeight,
    }))
  } catch {
    return []
  }
}

export async function searchStockImages(query: string, options: { maxResults?: number } = {}): Promise<StockImageResult[]> {
  const config = useApiConfigStore.getState().config
  const limit = options.maxResults ?? 8
  const ordered = [...(config.stockImages.order ?? ['unsplash', 'pexels', 'pixabay'])]
  const preferred = config.preferences.preferredStock
  if (preferred && ordered.includes(preferred as 'unsplash' | 'pexels' | 'pixabay')) {
    ordered.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0))
  }
  const results: StockImageResult[] = []
  const per = Math.max(4, Math.floor(limit / ordered.length))
  for (const provider of ordered) {
    const batch =
      provider === 'unsplash'
        ? await searchUnsplash(query, per)
        : provider === 'pexels'
          ? await searchPexels(query, per)
          : await searchPixabay(query, per)
    results.push(...batch)
    if (results.length >= limit) break
  }
  return results.slice(0, limit)
}

export async function downloadStockImage(result: StockImageResult): Promise<File> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = needsProxy(result.full)
      ? await proxyFetch(result.full, {}, 30000)
      : await fetch(result.full, { signal: controller.signal })
    const blob = await res.blob()
    const ext = result.full.includes('.png') ? '.png' : '.jpg'
    return new File([blob], `stock-${result.source.toLowerCase()}-${result.id}${ext}`, { type: blob.type || 'image/jpeg' })
  } finally {
    clearTimeout(timer)
  }
}