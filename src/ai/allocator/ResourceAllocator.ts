import { useApiConfigStore } from '@/api/config/store'

export type ApiProvider =
  | 'opencode_zen'
  | 'nvidia_nim'
  | 'openrouter'
  | 'elevenlabs'
  | 'nvidia_tts'
  | 'unsplash'
  | 'pexels'
  | 'pixabay'
  | 'giphy'
  | 'sketchfab'
  | 'firecrawl'
  | 'freemusicarchive'

export interface ProviderHealth {
  provider: ApiProvider
  hasKey: boolean
  isRateLimited: boolean
  rateLimitResetTime?: number
  requestCountLastMinute: number
  maxRequestsPerMinute: number
  averageLatencyMs: number
  consecutiveFailures: number
}

export type FallbackCategory = 'llm' | 'tts' | 'stock_images' | 'stickers' | 'models_3d' | 'music' | 'research'

const FALLBACK_WATERFALL: Record<FallbackCategory, ApiProvider[]> = {
  llm: ['nvidia_nim', 'opencode_zen', 'openrouter'],
  tts: ['elevenlabs', 'nvidia_tts'],
  stock_images: ['unsplash', 'pexels', 'pixabay'],
  stickers: ['giphy'],
  models_3d: ['sketchfab'],
  music: ['freemusicarchive'],
  research: ['firecrawl'],
}

const DEFAULT_LIMITS: Record<ApiProvider, number> = {
  opencode_zen: 60,
  nvidia_nim: 40,
  openrouter: 50,
  elevenlabs: 30,
  nvidia_tts: 30,
  unsplash: 50,
  pexels: 60,
  pixabay: 100,
  giphy: 40,
  sketchfab: 30,
  firecrawl: 20,
  freemusicarchive: 60,
}

/**
 * 5.4 Reasoning and Resource Allocator
 * Real-time API rate limit tracker, quota tracker, and intelligent multi-provider fallback waterfall.
 */
export class ResourceAllocator {
  private static instance: ResourceAllocator
  private providerStats = new Map<ApiProvider, ProviderHealth>()

  public static getInstance(): ResourceAllocator {
    if (!ResourceAllocator.instance) {
      ResourceAllocator.instance = new ResourceAllocator()
    }
    return ResourceAllocator.instance
  }

  constructor() {
    this.initStats()
  }

  private initStats() {
    const allProviders: ApiProvider[] = [
      'opencode_zen',
      'nvidia_nim',
      'openrouter',
      'elevenlabs',
      'nvidia_tts',
      'unsplash',
      'pexels',
      'pixabay',
      'giphy',
      'sketchfab',
      'firecrawl',
      'freemusicarchive',
    ]

    for (const p of allProviders) {
      this.providerStats.set(p, {
        provider: p,
        hasKey: false,
        isRateLimited: false,
        requestCountLastMinute: 0,
        maxRequestsPerMinute: DEFAULT_LIMITS[p] || 60,
        averageLatencyMs: 300,
        consecutiveFailures: 0,
      })
    }
  }

  /**
   * Sync API key presence from configured store
   */
  public updateKeyPresence(): void {
    const state = useApiConfigStore.getState?.()
    const cfg = state?.config
    if (!cfg) return

    for (const [provider, stats] of this.providerStats.entries()) {
      if (provider === 'opencode_zen') stats.hasKey = Boolean(cfg.opencodeZen?.apiKey)
      else if (provider === 'nvidia_nim') stats.hasKey = Boolean(cfg.nvidiaNim?.apiKey)
      else if (provider === 'openrouter') stats.hasKey = Boolean(cfg.openRouter?.apiKey)
      else if (provider === 'elevenlabs') stats.hasKey = Boolean(cfg.elevenLabs?.apiKey)
      else if (provider === 'nvidia_tts') stats.hasKey = Boolean(cfg.nvidiaTts?.apiKey || cfg.nvidiaNim?.apiKey)
      else if (provider === 'unsplash') stats.hasKey = Boolean(cfg.stockImages?.unsplash?.accessKey)
      else if (provider === 'pexels') stats.hasKey = Boolean(cfg.stockImages?.pexels?.apiKey)
      else if (provider === 'pixabay') stats.hasKey = Boolean(cfg.stockImages?.pixabay?.apiKey)
      else if (provider === 'giphy') stats.hasKey = Boolean(cfg.giphy?.apiKey)
      else if (provider === 'sketchfab') stats.hasKey = Boolean(cfg.sketchfab?.apiKey)
      else if (provider === 'firecrawl') stats.hasKey = Boolean(cfg.firecrawl?.apiKey)
      else if (provider === 'freemusicarchive') stats.hasKey = true
    }
  }

  /**
   * Get the optimal, available provider for a category based on health & waterfall
   */
  public selectBestProvider(category: FallbackCategory): ApiProvider | null {
    this.updateKeyPresence()
    const cascade = FALLBACK_WATERFALL[category] || []
    const now = Date.now()

    for (const p of cascade) {
      const stats = this.providerStats.get(p)
      if (!stats) continue

      // Check if rate limit reset has passed
      if (stats.isRateLimited && stats.rateLimitResetTime && now > stats.rateLimitResetTime) {
        stats.isRateLimited = false
        stats.consecutiveFailures = 0
      }

      // Check key and availability
      if (stats.hasKey && !stats.isRateLimited && stats.consecutiveFailures < 3) {
        return p
      }
    }

    // Return first configured even if suboptimal as fallback
    for (const p of cascade) {
      const stats = this.providerStats.get(p)
      if (stats?.hasKey) return p
    }

    return cascade[0] || null
  }

  /**
   * Record an API request outcome to adjust health metrics
   */
  public recordCallOutcome(provider: ApiProvider, success: boolean, latencyMs: number = 200, isRateLimitError: boolean = false): void {
    const stats = this.providerStats.get(provider)
    if (!stats) return

    stats.averageLatencyMs = Math.round((stats.averageLatencyMs * 0.7) + (latencyMs * 0.3))

    if (success) {
      stats.consecutiveFailures = 0
      stats.isRateLimited = false
      stats.requestCountLastMinute++
    } else {
      stats.consecutiveFailures++
      if (isRateLimitError) {
        stats.isRateLimited = true
        stats.rateLimitResetTime = Date.now() + 60_000 // pause 1 minute
      }
    }
  }

  /**
   * Get a snapshot of all provider states
   */
  public getHealthSnapshot(): ProviderHealth[] {
    this.updateKeyPresence()
    return Array.from(this.providerStats.values())
  }
}

export const resourceAllocator = ResourceAllocator.getInstance()
