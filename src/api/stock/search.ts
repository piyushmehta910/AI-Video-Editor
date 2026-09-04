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
  } catch (err) {
    // Surface the failure instead of silently reporting "no results".
    console.warn('[stock] Unsplash search failed:', err instanceof Error ? err.message : err)
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
  } catch (err) {
    console.warn('[stock] Pexels search failed:', err instanceof Error ? err.message : err)
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
  } catch (err) {
    console.warn('[stock] Pixabay search failed:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function searchWikimediaImages(query: string, limit: number): Promise<StockImageResult[]> {
  const timeout = 20000
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: `${query} filetype:bitmap`,
      gsrlimit: String(limit),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '500',
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
              extmetadata?: {
                Artist?: { value?: string }
                Credit?: { value?: string }
              }
            }>
          }
        >
      }
    }
    const pages = Object.values(data.query?.pages ?? {})
    return pages
      .map((p) => {
        const info = p.imageinfo?.[0]
        if (!info?.url) return null
        const artist =
          info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '') ||
          info.extmetadata?.Credit?.value?.replace(/<[^>]*>/g, '') ||
          'Wikimedia Commons'
        return {
          id: encodeURIComponent(p.title || crypto.randomUUID()),
          thumb: info.thumburl || info.url,
          full: info.url,
          author: artist.slice(0, 50),
          source: 'Wikimedia Commons',
          width: info.width,
          height: info.height,
        }
      })
      .filter((img): img is StockImageResult => img !== null)
  } catch (err) {
    console.warn('[stock] Wikimedia image search failed:', err)
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
  if (results.length === 0) {
    const wiki = await searchWikimediaImages(query, limit)
    results.push(...wiki)
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
    const isPng = result.full.toLowerCase().includes('.png') || blob.type.includes('png')
    const isWebp = result.full.toLowerCase().includes('.webp') || blob.type.includes('webp')
    const ext = isPng ? '.png' : isWebp ? '.webp' : '.jpg'
    const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg'
    const safeId = result.id.replace(/[^\w-]/g, '').slice(0, 32) || 'img'
    return new File([blob], `stock-${result.source.toLowerCase().replace(/\s+/g, '-')}-${safeId}${ext}`, { type: blob.type || mime })
  } finally {
    clearTimeout(timer)
  }
}

export interface StockVideoResult {
  id: string
  thumb: string
  url: string
  duration: number
  author: string
  source: string
  width?: number
  height?: number
}

export async function searchPexelsVideos(query: string, limit: number): Promise<StockVideoResult[]> {
  const cfg = useApiConfigStore.getState().config.stockImages.pexels
  if (!cfg.apiKey) return []
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const data = (await fetchJson(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${limit}`,
      { headers: { Authorization: cfg.apiKey } },
      timeout,
    )) as {
      videos?: Array<{
        id?: number
        image?: string
        duration?: number
        user?: { name?: string }
        width?: number
        height?: number
        video_files?: Array<{ quality?: string; link?: string; width?: number; height?: number; file_type?: string }>
      }>
    }
    const list: StockVideoResult[] = []
    for (const v of data.videos ?? []) {
      const files = v.video_files ?? []
      const file =
        files.find((f) => f.quality === 'hd' && f.file_type?.includes('mp4')) ||
        files.find((f) => f.file_type?.includes('mp4') && (f.width ?? 0) >= 1280) ||
        files[0]
      if (file?.link) {
        list.push({
          id: String(v.id ?? crypto.randomUUID()),
          thumb: v.image ?? '',
          url: file.link,
          duration: v.duration ?? 5,
          author: v.user?.name ?? 'Pexels Creator',
          source: 'Pexels',
          width: file.width ?? v.width,
          height: file.height ?? v.height,
        })
      }
    }
    return list
  } catch (err) {
    console.warn('[stock] Pexels video search failed:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function searchPixabayVideos(query: string, limit: number): Promise<StockVideoResult[]> {
  const cfg = useApiConfigStore.getState().config.stockImages.pixabay
  if (!cfg.apiKey) return []
  const timeout = cfg.timeoutMs ?? 30000
  try {
    const params = new URLSearchParams({
      key: cfg.apiKey,
      q: query,
      per_page: String(limit),
      safesearch: String(cfg.safeSearch ?? true),
    })
    const data = (await fetchJson(`https://pixabay.com/api/videos/?${params}`, {}, timeout)) as {
      hits?: Array<{
        id?: number
        duration?: number
        user?: string
        videos?: {
          large?: { url?: string; width?: number; height?: number }
          medium?: { url?: string; width?: number; height?: number }
          tiny?: { url?: string; width?: number; height?: number }
        }
      }>
    }
    const list: StockVideoResult[] = []
    for (const hit of data.hits ?? []) {
      const file = hit.videos?.large || hit.videos?.medium || hit.videos?.tiny
      if (file?.url) {
        list.push({
          id: String(hit.id ?? crypto.randomUUID()),
          thumb: '',
          url: file.url,
          duration: hit.duration ?? 5,
          author: hit.user ?? 'Pixabay Creator',
          source: 'Pixabay',
          width: file.width,
          height: file.height,
        })
      }
    }
    return list
  } catch (err) {
    console.warn('[stock] Pixabay video search failed:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function searchWikimediaVideos(query: string, limit: number): Promise<StockVideoResult[]> {
  const timeout = 20000
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: `${query} filetype:video`,
      gsrlimit: String(limit),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '500',
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
              extmetadata?: {
                Artist?: { value?: string }
                Credit?: { value?: string }
              }
            }>
          }
        >
      }
    }
    const pages = Object.values(data.query?.pages ?? {})
    return pages
      .map((p) => {
        const info = p.imageinfo?.[0]
        if (!info?.url) return null
        const artist =
          info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '') ||
          info.extmetadata?.Credit?.value?.replace(/<[^>]*>/g, '') ||
          'Wikimedia Commons'
        return {
          id: encodeURIComponent(p.title || crypto.randomUUID()),
          thumb: info.thumburl || '',
          url: info.url,
          duration: 8,
          author: artist.slice(0, 50),
          source: 'Wikimedia Commons',
          width: info.width,
          height: info.height,
        }
      })
      .filter((v): v is StockVideoResult => v !== null)
  } catch (err) {
    console.warn('[stock] Wikimedia video search failed:', err)
    return []
  }
}

export async function searchStockVideos(query: string, options: { maxResults?: number } = {}): Promise<StockVideoResult[]> {
  const limit = options.maxResults ?? 4
  const pexelsResults = await searchPexelsVideos(query, limit)
  if (pexelsResults.length >= limit) return pexelsResults.slice(0, limit)
  const pixabayResults = await searchPixabayVideos(query, limit - pexelsResults.length)
  const combined = [...pexelsResults, ...pixabayResults]
  if (combined.length === 0) {
    const wiki = await searchWikimediaVideos(query, limit)
    combined.push(...wiki)
  }
  return combined.slice(0, limit)
}

export async function downloadStockVideo(result: StockVideoResult): Promise<File> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const res = needsProxy(result.url)
      ? await proxyFetch(result.url, {}, 60000)
      : await fetch(result.url, { signal: controller.signal })
    const blob = await res.blob()
    const isWebm = result.url.toLowerCase().includes('.webm') || blob.type.includes('webm')
    const ext = isWebm ? '.webm' : '.mp4'
    const mime = isWebm ? 'video/webm' : 'video/mp4'
    const safeId = result.id.replace(/[^\w-]/g, '').slice(0, 32) || 'vid'
    return new File([blob], `stock-video-${result.source.toLowerCase().replace(/\s+/g, '-')}-${safeId}${ext}`, { type: blob.type || mime })
  } finally {
    clearTimeout(timer)
  }
}