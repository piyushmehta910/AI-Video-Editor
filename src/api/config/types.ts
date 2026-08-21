export type ProviderStatus = 'connected' | 'disconnected' | 'disabled'
export type PriorityLevel = 1 | 2 | 3

export interface BaseConfig {
  enabled: boolean
  apiKey?: string
  baseUrl?: string
  timeoutMs: number
  status?: ProviderStatus
}

export interface LLMConfig extends BaseConfig {
  model: string
  temperature: number
  maxTokens: number
  priority: PriorityLevel
}

export interface NvidiaNimConfig extends LLMConfig {}

export interface OpenCodeZenConfig extends LLMConfig {
  reasoningLevel: string
}

export interface OpenRouterConfig extends LLMConfig {}

export interface ElevenLabsConfig extends BaseConfig {
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

export interface NvidiaTtsConfig extends BaseConfig {
  baseUrl: string
  model: string
  voice: string
  format: string
  speed: number
}

export interface StockProviderConfig extends BaseConfig {
  priority: PriorityLevel
  orientation: string
  safeSearch: boolean
  minResolution?: string
}

export interface UnsplashProviderConfig extends StockProviderConfig {
  accessKey: string
  applicationId: string
  secretKey: string
}

export interface StockImagesConfig {
  unsplash: UnsplashProviderConfig
  pexels: StockProviderConfig
  pixabay: StockProviderConfig
  order: Array<'unsplash' | 'pexels' | 'pixabay'>
}

export interface FirecrawlConfig extends BaseConfig {
  endpoint: string
  searchEngine: string
  maxResults: number
  useForResearch: boolean
  useForFactCheck: boolean
  useForArticleExtraction: boolean
}

export interface MusicBrainzConfig extends BaseConfig {
  baseUrl: string
  userAgent: string
}

export interface DeezerConfig extends BaseConfig {
  endpoint: string
}

export interface MusicConfig {
  musicbrainz: MusicBrainzConfig
  deezer: DeezerConfig
}

export interface GiphyConfig extends BaseConfig {
  rating: string
  limit: number
}

export interface AvatarConfig extends BaseConfig {
  resolution: string
  fps: number
  background: string
  mouthX: number
  mouthY: number
  mouthWidth: number
  mouthMaxOpen: number
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
  nvidiaTts: NvidiaTtsConfig
  avatar: AvatarConfig
  stockImages: StockImagesConfig
  firecrawl: FirecrawlConfig
  music: MusicConfig
  giphy: GiphyConfig
  sketchfab: SketchfabConfig
  preferences: AiPreferencesConfig
}

export interface SketchfabConfig extends BaseConfig {
  apiKey: string
}

export const defaultNvidiaNimConfig: NvidiaNimConfig = {
  enabled: true,
  apiKey: '',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  // A broadly available chat model; users can refresh the catalog for their
  // account before selecting a different one.
  model: 'meta/llama-3.1-8b-instruct',
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
  timeoutMs: 30000,
  status: 'disabled',
}

export const defaultNvidiaTtsConfig: NvidiaTtsConfig = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: '',
  voice: '',
  format: 'mp3',
  speed: 1.0,
  timeoutMs: 60000,
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
  timeoutMs: 30000,
  status: 'disabled',
}

const defaultStockProvider = (): StockProviderConfig => ({
  enabled: true,
  apiKey: '',
  priority: 3,
  orientation: 'all',
  safeSearch: true,
  timeoutMs: 30000,
  status: 'disabled',
})

export const defaultStockImagesConfig: StockImagesConfig = {
  unsplash: { ...defaultStockProvider(), priority: 1, minResolution: '1920x1080', accessKey: '', applicationId: '', secretKey: '' },
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
  timeoutMs: 30000,
  status: 'disabled',
}

export const defaultDeezerConfig: DeezerConfig = {
  enabled: true,
  endpoint: 'https://api.deezer.com',
  timeoutMs: 30000,
  status: 'disabled',
}

export const defaultMusicConfig: MusicConfig = {
  musicbrainz: defaultMusicBrainzConfig,
  deezer: defaultDeezerConfig,
}

export const defaultGiphyConfig: GiphyConfig = {
  enabled: true,
  apiKey: '',
  rating: 'g',
  limit: 24,
  timeoutMs: 30000,
  status: 'disabled',
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

export interface SketchfabConfig extends BaseConfig {
  apiKey: string
}

export const defaultSketchfabConfig: SketchfabConfig = {
  enabled: false,
  apiKey: '',
  timeoutMs: 30000,
}

export const defaultApiConfig: ApiConfig = {
  nvidiaNim: defaultNvidiaNimConfig,
  opencodeZen: defaultOpenCodeZenConfig,
  openRouter: defaultOpenRouterConfig,
  elevenLabs: defaultElevenLabsConfig,
  nvidiaTts: defaultNvidiaTtsConfig,
  avatar: defaultAvatarConfig,
  stockImages: defaultStockImagesConfig,
  firecrawl: defaultFirecrawlConfig,
  music: defaultMusicConfig,
  giphy: defaultGiphyConfig,
  sketchfab: defaultSketchfabConfig,
  preferences: defaultPreferencesConfig,
}

export const STORAGE_KEY = 'clipforge-api-config'
