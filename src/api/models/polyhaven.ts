import { WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

export interface PolyHavenModel {
  id: string
  name: string
  description: string
  categories: string[]
  tags: string[]
  polycount: number
  dimensions: [number, number, number]
}

const ASSETS_URL = 'https://api.polyhaven.com/assets?type=models'
const FILES_URL = (id: string) => `https://api.polyhaven.com/files/${encodeURIComponent(id)}`

interface PolyHavenAssetEntry {
  name?: string
  categories?: string[]
  tags?: string[]
  description?: string
  polycount?: number
  dimensions?: number[]
}

function normalize(query: string): string {
  return query.trim().toLowerCase()
}

function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  return fetch(url, { signal }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
}

/**
 * Search the Poly Haven model library (CC0, no API key required). The API
 * returns the full catalog, which we filter + score client-side by name,
 * categories, tags and description.
 */
export async function searchModels(
  query: string,
  options: { maxResults?: number; signal?: AbortSignal } = {},
): Promise<PolyHavenModel[]> {
  const q = normalize(query)
  const data = (await fetchJson(ASSETS_URL, options.signal)) as Record<string, PolyHavenAssetEntry>
  const maxResults = options.maxResults ?? 8

  const entries = Object.entries(data).map(([id, v]) => ({ id, ...v }))

  const scored: Array<{ score: number; model: PolyHavenModel }> = []
  for (const entry of entries) {
    const name = entry.name ?? entry.id
    const haystack = normalize([name, entry.id, ...(entry.categories ?? []), ...(entry.tags ?? []), entry.description ?? ''].join(' '))
    const index = haystack.indexOf(q)
    if (index === -1) continue
    let score = 0
    if (normalize(name).includes(q)) score += 100
    if (normalize(name).startsWith(q)) score += 50
    if ((entry.categories ?? []).some((c) => normalize(c).includes(q))) score += 30
    if ((entry.tags ?? []).some((t) => normalize(t).includes(q))) score += 10
    if (index >= 0) score += Math.max(0, 10 - index)
    scored.push({
      score,
      model: {
        id: entry.id,
        name,
        description: entry.description ?? '',
        categories: entry.categories ?? [],
        tags: entry.tags ?? [],
        polycount: entry.polycount ?? 0,
        dimensions: (entry.dimensions as [number, number, number]) ?? [0, 0, 0],
      },
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxResults).map((s) => s.model)
}

/**
 * Download a Poly Haven model and convert it to a single self-contained GLB
 * file. Poly Haven serves glTF as a folder of files, so we use gltf-transform
 * to read the glTF + resources and write out one binary GLB (which is what the
 * Three.js renderer loads from OPFS).
 */
export async function downloadModelAsGlb(
  id: string,
  options: { resolution?: '1k' | '2k' | '4k'; signal?: AbortSignal } = {},
): Promise<File> {
  const resolution = options.resolution ?? '2k'
  const files = (await fetchJson(FILES_URL(id), options.signal)) as {
    gltf?: Partial<Record<'1k' | '2k' | '4k', { gltf?: { url?: string } }>>
  }

  const variants = ['2k', '1k', '4k'] as const
  let gltfUrl = ''
  if (files.gltf) {
    const preferred = files.gltf[resolution]?.gltf?.url
    if (preferred) {
      gltfUrl = preferred
    } else {
      for (const v of variants) {
        const url = files.gltf[v]?.gltf?.url
        if (url) {
          gltfUrl = url
          break
        }
      }
    }
  }
  if (!gltfUrl) throw new Error('This model has no glTF variant on Poly Haven.')

  const io = new WebIO()
  io.registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(gltfUrl)
  const glb = await io.writeBinary(doc)
  return new File([glb], `${id}.glb`, { type: 'model/gltf-binary' })
}