import { useApiConfigStore } from '@/api/config/store'
import { needsProxy, proxyFetch } from '@/api/proxy'

export interface WebSearchResult {
  title: string
  url: string
  description: string
  markdown?: string
}

interface FirecrawlSearchResponse {
  data?: Array<{ title?: string; url?: string; description?: string; markdown?: string }>
  error?: string
}

interface FirecrawlScrapeResponse {
  data?: { markdown?: string; title?: string; description?: string }
  error?: string
}

async function postJson<T>(url: string, apiKey: string, body: unknown, timeoutMs: number): Promise<T> {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }
  if (needsProxy(url)) return proxyFetch(url, init, timeoutMs).then((r) => r.json())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

function getCfg() {
  const cfg = useApiConfigStore.getState().config.firecrawl
  const apiKey = cfg.apiKey
  if (!cfg.enabled || !apiKey) throw new Error('Firecrawl is not enabled or missing an API key (Settings → Web Research).')
  return { cfg, apiKey }
}

/** Search the web via Firecrawl and return compact results. */
export async function firecrawlSearch(query: string, limitOverride?: number): Promise<WebSearchResult[]> {
  const { cfg, apiKey } = getCfg()
  const endpoint = (cfg.endpoint ?? 'https://api.firecrawl.dev').replace(/\/$/, '')
  const data = await postJson<FirecrawlSearchResponse>(
    `${endpoint}/v1/search`,
    apiKey,
    { query, limit: limitOverride ?? cfg.maxResults ?? 5 },
    cfg.timeoutMs ?? 30000,
  )
  if (data.error) throw new Error(`Firecrawl search failed: ${data.error}`)
  return (data.data ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    description: r.description ?? '',
    markdown: r.markdown,
  }))
}

/** Scrape a single page to markdown via Firecrawl. */
export async function firecrawlScrape(url: string): Promise<WebSearchResult> {
  const { cfg, apiKey } = getCfg()
  const endpoint = (cfg.endpoint ?? 'https://api.firecrawl.dev').replace(/\/$/, '')
  const data = await postJson<FirecrawlScrapeResponse>(
    `${endpoint}/v1/scrape`,
    apiKey,
    { url, formats: ['markdown'] },
    cfg.timeoutMs ?? 30000,
  )
  if (data.error) throw new Error(`Firecrawl scrape failed: ${data.error}`)
  return {
    title: data.data?.title ?? url,
    url,
    description: data.data?.description ?? '',
    markdown: data.data?.markdown ?? '',
  }
}
