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
  source: 'procedural' | 'internetarchive'
}

/**
 * Synthesize a procedural sound effect directly in the browser via Web Audio API.
 * 100% offline, zero latency, zero API keys required.
 */
function createProceduralSfx(type: string): { blob: Blob; url: string; duration: number } {
  const sampleRate = 44100
  let duration = 0.5
  const t = type.toLowerCase()
  if (t.includes('riser') || t.includes('transition')) duration = 1.5
  else if (t.includes('impact') || t.includes('boom') || t.includes('cinematic')) duration = 1.2
  else if (t.includes('whoosh') || t.includes('swoosh')) duration = 0.6
  else if (t.includes('bell') || t.includes('chime')) duration = 1.0
  else if (t.includes('pop') || t.includes('click')) duration = 0.15

  const length = Math.floor(sampleRate * duration)
  const buffer = new Float32Array(length)

  for (let i = 0; i < length; i++) {
    const progress = i / length
    const time = i / sampleRate
    if (t.includes('whoosh') || t.includes('swoosh')) {
      const freq = 120 + Math.sin(progress * Math.PI) * 800
      const noise = (Math.random() * 2 - 1) * 0.4
      const sine = Math.sin(2 * Math.PI * freq * time) * 0.6
      const env = Math.sin(progress * Math.PI)
      buffer[i] = (sine + noise) * env * 0.7
    } else if (t.includes('impact') || t.includes('boom') || t.includes('cinematic')) {
      const freq = Math.max(30, 200 * Math.exp(-progress * 6))
      const env = Math.exp(-progress * 4)
      const sub = Math.sin(2 * Math.PI * freq * time)
      const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 15) * 0.3
      buffer[i] = (sub + noise) * env * 0.85
    } else if (t.includes('pop') || t.includes('click')) {
      const freq = 600 * Math.exp(-progress * 25)
      const env = Math.exp(-progress * 20)
      buffer[i] = Math.sin(2 * Math.PI * freq * time) * env * 0.9
    } else if (t.includes('riser') || t.includes('transition')) {
      const freq = 100 + Math.pow(progress, 2.5) * 1400
      const env = Math.pow(progress, 1.5)
      const sine = Math.sin(2 * Math.PI * freq * time)
      buffer[i] = sine * env * 0.75
    } else if (t.includes('bell') || t.includes('chime')) {
      const env = Math.exp(-progress * 3)
      const harmonic1 = Math.sin(2 * Math.PI * 587.33 * time) * 0.5
      const harmonic2 = Math.sin(2 * Math.PI * 880.0 * time) * 0.3
      const harmonic3 = Math.sin(2 * Math.PI * 1760.0 * time) * 0.2
      buffer[i] = (harmonic1 + harmonic2 + harmonic3) * env * 0.8
    } else {
      // Default modern UI UI blip / swoop
      const freq = 300 + Math.sin(progress * Math.PI * 2) * 200
      const env = Math.sin(progress * Math.PI)
      buffer[i] = Math.sin(2 * Math.PI * freq * time) * env * 0.6
    }
  }

  // Convert Float32Array PCM to 16-bit Mono WAV Blob
  const wavBuffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(wavBuffer)
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * 2, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  const blob = new Blob([wavBuffer], { type: 'audio/wav' })
  return { blob, url: URL.createObjectURL(blob), duration }
}

const PROCEDURAL_SFX_PRESETS = [
  { id: 'proc-whoosh-fast', name: 'Fast Cinematic Whoosh', category: 'whoosh' },
  { id: 'proc-whoosh-soft', name: 'Soft Air Swoosh', category: 'whoosh' },
  { id: 'proc-impact-heavy', name: 'Heavy Bass Impact', category: 'impact' },
  { id: 'proc-impact-sub', name: 'Cinematic Sub Boom', category: 'boom' },
  { id: 'proc-pop-bubble', name: 'UI Bubble Pop', category: 'pop' },
  { id: 'proc-click-mechanical', name: 'Crisp Button Click', category: 'click' },
  { id: 'proc-riser-epic', name: 'Epic Tension Riser', category: 'riser' },
  { id: 'proc-transition-sweep', name: 'Glitch Sweep Transition', category: 'transition' },
  { id: 'proc-bell-chime', name: 'Notification Bell Chime', category: 'bell' },
]

export async function searchSoundEffects(query: string, options: { maxResults?: number } = {}): Promise<SoundEffectResult[]> {
  const limit = options.maxResults ?? 8
  const q = query.toLowerCase().trim()

  const matchingPresets = PROCEDURAL_SFX_PRESETS.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || q.includes(p.category),
  )

  const proceduralResults: SoundEffectResult[] = matchingPresets.slice(0, limit).map((p) => {
    const sfx = createProceduralSfx(p.category)
    return {
      id: p.id,
      name: p.name,
      duration: Math.round(sfx.duration * 10) / 10,
      previewUrl: sfx.url,
      license: 'Royalty-Free (Procedural CC0)',
      source: 'procedural' as const,
    }
  })

  if (proceduralResults.length >= limit) return proceduralResults

  // Supplement with Internet Archive Open Audio SFX
  try {
    const archiveResults = await searchInternetArchive(`${query} sound effect`, limit - proceduralResults.length)
    const convertedArchive: SoundEffectResult[] = archiveResults.map((t) => ({
      id: t.id,
      name: t.title,
      duration: t.duration,
      previewUrl: t.previewUrl,
      license: 'Creative Commons (Internet Archive)',
      source: 'internetarchive' as const,
    }))
    return [...proceduralResults, ...convertedArchive]
  } catch {
    return proceduralResults
  }
}