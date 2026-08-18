import { create } from 'zustand'
import { defaultApiConfig, type ApiConfig, STORAGE_KEY } from './types'

function mergeApiConfig(stored: Partial<ApiConfig>): ApiConfig {
  const merged: Record<string, unknown> = {}
  const defaultKeys = Object.keys(defaultApiConfig) as Array<keyof ApiConfig>
  for (const key of defaultKeys) {
    const fallback = defaultApiConfig[key]
    const value = (stored as Record<string, unknown>)[key]
    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof fallback === 'object' &&
      !Array.isArray(fallback)
    ) {
      const fb = fallback as unknown as Record<string, unknown>
      const val = value as unknown as Record<string, unknown>
      const mergedValue: Record<string, unknown> = { ...fb, ...val }
      for (const nestedKey of Object.keys(val)) {
        const nestedFallback = fb[nestedKey]
        const nestedStored = val[nestedKey]
        if (
          nestedStored != null &&
          typeof nestedStored === 'object' &&
          !Array.isArray(nestedStored) &&
          nestedFallback != null &&
          typeof nestedFallback === 'object' &&
          !Array.isArray(nestedFallback)
        ) {
          mergedValue[nestedKey] = { ...(nestedFallback as unknown as Record<string, unknown>), ...(nestedStored as unknown as Record<string, unknown>) }
        }
      }
      merged[key] = mergedValue
    } else {
      merged[key] = value ?? fallback
    }
  }
  return merged as unknown as ApiConfig
}

function loadFromStorage(): ApiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultApiConfig
    const parsed = JSON.parse(raw) as Partial<ApiConfig>
    return mergeApiConfig(parsed)
  } catch {
    return defaultApiConfig
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null

function saveToStorage(config: ApiConfig): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch (err) {
      console.error('Failed to save API config:', err)
    }
  }, 300)
}

interface ApiConfigState {
  config: ApiConfig
  hydrated: boolean
  error: string | null

  hydrate: () => void
  update: (updater: (draft: ApiConfig) => ApiConfig) => void
  reset: () => void
}

export const useApiConfigStore = create<ApiConfigState>()((set, get) => ({
  config: defaultApiConfig,
  hydrated: false,
  error: null,

  hydrate: () => {
    try {
      const config = loadFromStorage()
      set({ config, hydrated: true, error: null })
    } catch (err) {
      set({ hydrated: true, error: err instanceof Error ? err.message : String(err) })
    }
  },

  update: (updater) => {
    const newConfig = updater(get().config)
    set({ config: newConfig })
    saveToStorage(newConfig)
  },

  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    set({ config: defaultApiConfig, error: null })
  },
}))