export type ProviderStatus = 'connected' | 'disconnected' | 'disabled'

export type PriorityLevel = 1 | 2 | 3

export interface BaseProviderConfig {
  enabled: boolean
  status?: ProviderStatus
  lastCheckedAt?: number
}

export interface LLMProviderConfig extends BaseProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  priority: PriorityLevel
}

export interface NvidiaNimConfig extends LLMProviderConfig {}

export interface OpenCodeZenConfig extends LLMProviderConfig {
  reasoningLevel: string
}

export interface OpenRouterConfig extends LLMProviderConfig {}

export interface ElevenLabsConfig extends BaseProviderConfig {
  apiKey: string
  endpoint: string
  voiceId: string
  model: string
  language: string
  stability: number
  similarity: number
  style: number
  speed: number
  outputFormat: string
}

/**
 * Browser-only avatar & lip-sync generation settings. Lip sync is rendered
 * on-device (Web Audio + canvas + WebCodecs) — no API, no external service.
 */
export interface AvatarConfig extends BaseProviderConfig {
  resolution: string
  fps: number
  background: string
  /** On-device mouth anchor (fractions of the output frame). */
  mouthX: number
  mouthY: number
  mouthWidth: number
  mouthMaxOpen: number
}

export interface StockProviderConfig extends BaseProviderConfig {
  apiKey: string
  priority: PriorityLevel
  orientation: string
  safeSearch: boolean
  minResolution?: string
}

export interface StockImagesConfig {
  unsplash: StockProviderConfig
  pexels: StockProviderConfig
  pixabay: StockProviderConfig
  order: Array<'unsplash' | 'pexels' | 'pixabay'>
}

export interface FirecrawlConfig extends BaseProviderConfig {
  apiKey: string
  endpoint: string
  searchEngine: string
  timeoutMs: number
  maxResults: number
  useForResearch: boolean
  useForFactCheck: boolean
  useForArticleExtraction: boolean
}

export interface MusicBrainzConfig extends BaseProviderConfig {
  baseUrl: string
  userAgent: string
}

export interface DeezerConfig extends BaseProviderConfig {
  endpoint: string
}

export interface FreesoundConfig extends BaseProviderConfig {
  apiKey: string
  endpoint: string
  licenseFilter: string
  minRating: number
  maxDuration: number
  priority: PriorityLevel
}

export interface MusicConfig {
  musicbrainz: MusicBrainzConfig
  deezer: DeezerConfig
  freesound: FreesoundConfig
}

export interface SecurityConfig {
  encryptKeys: boolean
  hasMasterPassword: boolean
  masterPasswordSetAt?: number
  algorithm: 'AES-GCM'
  iterations: number
}

export interface AiPreferencesConfig {
  language: string
  defaultAspectRatio: string
  defaultFps: number
  defaultExportQuality: string
  preferredAiProvider: string
  preferredVoice: string
  preferredAvatar: string
  preferredStock: string
  autoCaptions: boolean
  autoSave: boolean
  autoBackup: boolean
  autoFallback: boolean
  confirmationLevel: 'always' | 'expensive' | 'destructive' | 'none'
}

export interface ApiConfig {
  nvidiaNim: NvidiaNimConfig
  opencodeZen: OpenCodeZenConfig
  openRouter: OpenRouterConfig
  elevenLabs: ElevenLabsConfig
  avatar: AvatarConfig
  stockImages: StockImagesConfig
  firecrawl: FirecrawlConfig
  music: MusicConfig
  security: SecurityConfig
  preferences: AiPreferencesConfig
}

export const defaultNvidiaNimConfig: NvidiaNimConfig = {
  enabled: true,
  apiKey: '',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'nvidia/nemotron-3-super-120b-a12b',
  temperature: 0.7,
  maxTokens: 2048,
  timeoutMs: 30000,
  priority: 1,
  status: 'disabled',
}

export const defaultOpenCodeZenConfig: OpenCodeZenConfig = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://opencode.ai/zen/v1',
  model: 'deepseek-v4-flash-free',
  temperature: 0.7,
  maxTokens: 2048,
  timeoutMs: 30000,
  priority: 2,
  reasoningLevel: 'standard',
  status: 'disabled',
}

export const defaultOpenRouterConfig: OpenRouterConfig = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'nvidia/nemotron-3.5-lightning:free',
  temperature: 0.7,
  maxTokens: 2048,
  timeoutMs: 30000,
  priority: 3,
  status: 'disabled',
}

export const defaultElevenLabsConfig: ElevenLabsConfig = {
  enabled: true,
  apiKey: '',
  endpoint: 'https://api.elevenlabs.io',
  voiceId: '',
  model: 'eleven_multilingual_v2',
  language: 'auto',
  stability: 0.5,
  similarity: 0.75,
  style: 0.3,
  speed: 1.0,
  outputFormat: 'mp3_44100_128',
  status: 'disabled',
}

export const defaultAvatarConfig: AvatarConfig = {
  enabled: true,
  resolution: '512x512',
  fps: 25,
  background: 'solid',
  mouthX: 0.5,
  mouthY: 0.78,
  mouthWidth: 0.16,
  mouthMaxOpen: 0.1,
  status: 'disabled',
}

const defaultStockProvider = (): StockProviderConfig => ({
  enabled: true,
  apiKey: '',
  priority: 3,
  orientation: 'all',
  safeSearch: true,
  status: 'disabled',
})

export const defaultStockImagesConfig: StockImagesConfig = {
  unsplash: { ...defaultStockProvider(), priority: 1, minResolution: '1920x1080' },
  pexels: { ...defaultStockProvider(), priority: 2 },
  pixabay: { ...defaultStockProvider(), priority: 3 },
  order: ['unsplash', 'pexels', 'pixabay'],
}

export const defaultFirecrawlConfig: FirecrawlConfig = {
  enabled: false,
  apiKey: '',
  endpoint: 'https://api.firecrawl.dev',
  searchEngine: 'default',
  timeoutMs: 30000,
  maxResults: 5,
  useForResearch: true,
  useForFactCheck: true,
  useForArticleExtraction: true,
  status: 'disabled',
}

export const defaultMusicBrainzConfig: MusicBrainzConfig = {
  enabled: true,
  baseUrl: 'https://musicbrainz.org',
  userAgent: 'ClipForgeAI/1.0',
  status: 'disabled',
}

export const defaultDeezerConfig: DeezerConfig = {
  enabled: true,
  endpoint: 'https://api.deezer.com',
  status: 'disabled',
}

export const defaultFreesoundConfig: FreesoundConfig = {
  enabled: false,
  apiKey: '',
  endpoint: 'https://freesound.org/apiv2',
  licenseFilter: 'cc0',
  minRating: 3,
  maxDuration: 60,
  priority: 1,
  status: 'disabled',
}

export const defaultMusicConfig: MusicConfig = {
  musicbrainz: defaultMusicBrainzConfig,
  deezer: defaultDeezerConfig,
  freesound: defaultFreesoundConfig,
}

export const defaultSecurityConfig: SecurityConfig = {
  encryptKeys: true,
  hasMasterPassword: false,
  algorithm: 'AES-GCM',
  iterations: 100000,
}

export const defaultPreferencesConfig: AiPreferencesConfig = {
  language: 'en',
  defaultAspectRatio: '16:9',
  defaultFps: 30,
  defaultExportQuality: '1080p',
  preferredAiProvider: 'nvidia-nim',
  preferredVoice: 'default',
  preferredAvatar: 'default',
  preferredStock: 'unsplash',
  autoCaptions: true,
  autoSave: true,
  autoBackup: true,
  autoFallback: true,
  confirmationLevel: 'destructive',
}

export const defaultApiConfig: ApiConfig = {
  nvidiaNim: defaultNvidiaNimConfig,
  opencodeZen: defaultOpenCodeZenConfig,
  openRouter: defaultOpenRouterConfig,
  elevenLabs: defaultElevenLabsConfig,
  avatar: defaultAvatarConfig,
  stockImages: defaultStockImagesConfig,
  firecrawl: defaultFirecrawlConfig,
  music: defaultMusicConfig,
  security: defaultSecurityConfig,
  preferences: defaultPreferencesConfig,
}
