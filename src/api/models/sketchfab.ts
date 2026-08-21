import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface SketchfabModel {
  id: string
  name: string
  description: string
  categories: string[]
  tags: string[]
  polycount: number
  thumbnailUrl?: string
}

interface SketchfabSearchResponse {
  results?: Array<{
    uid?: string
    name?: string
    description?: string
    tags?: Array<{ name?: string }>
    categories?: Array<{ name?: string }>
    thumbnails?: { images?: Array<{ url?: string; width?: number }> }
  }>
}

interface SketchfabDownloadResponse {
  glb?: { url?: string }
  gltf?: { url?: string }
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

/** Search Sketchfab for downloadable models (requires an API token in Settings → 3D Models). */
export async function searchSketchfabModels(
  query: string,
  options: { maxResults?: number } = {},
): Promise<SketchfabModel[]> {
  const cfg = useApiConfigStore.getState().config.sketchfab
  if (!cfg.enabled || !cfg.apiKey) {
    throw new Error('Sketchfab is not enabled or missing an API key (Settings → 3D Models).')
  }
  const limit = options.maxResults ?? 12
  const url =
    `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(query)}` +
    `&downloadable=true&sort_by=-likeCount&count=${limit}`
  const data = (await fetchJson(url, {}, 30000)) as SketchfabSearchResponse
  return (data.results ?? [])
    .filter((r) => r.uid)
    .map((r) => ({
      id: r.uid!,
      name: r.name ?? 'Untitled',
      description: (r.description ?? '').replace(/<[^>]*>/g, '').slice(0, 200),
      categories: (r.categories ?? []).map((c) => c.name ?? '').filter(Boolean),
      tags: (r.tags ?? []).map((t) => t.name ?? '').filter(Boolean),
      polycount: 0,
      thumbnailUrl: r.thumbnails?.images?.toSorted((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url,
    }))
}

/**
 * Download a Sketchfab model as a single binary GLB. Uses the v3 download
 * endpoint which exposes a direct .glb URL when the model is downloadable.
 * Requires an API token with download scope.
 */
export async function downloadSketchfabGlb(uid: string): Promise<File> {
  const cfg = useApiConfigStore.getState().config.sketchfab
  if (!cfg.apiKey) throw new Error('Missing Sketchfab API key.')
  const info = (await fetchJson(
    `https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}/download`,
    { headers: { Authorization: `Token ${cfg.apiKey}` } },
    60000,
  )) as SketchfabDownloadResponse
  const glbUrl = info.glb?.url
  if (!glbUrl) throw new Error('No GLB download available for this model (it may require Pro).')
  if (needsProxy(glbUrl)) {
    const blob = await proxyFetch(glbUrl, {}, 120000).then((r) => r.blob())
    return new File([blob], `sketchfab-${uid}.glb`, { type: 'model/gltf-binary' })
  }
  const res = await fetch(glbUrl)
  if (!res.ok) throw new Error(`GLB download failed: HTTP ${res.status}`)
  return new File([await res.blob()], `sketchfab-${uid}.glb`, { type: 'model/gltf-binary' })
}
