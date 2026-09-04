import { create } from 'zustand'
import { defaultApiConfig, type ApiConfig, STORAGE_KEY } from './types'
import {
  encryptConfig,
  decryptConfig,
  getMasterKeyState,
  verifyMasterPassphrase,
  migrateToPassphrase,
  clearMasterKey,
} from './crypto'

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
  const config = merged as unknown as ApiConfig
  // Upgrade the app's previous default model for people who already have
  // settings saved, while preserving any model selected intentionally.
  if (!modelMigrated) {
    if (config.nvidiaNim.model === 'nvidia/nemotron-3-super-120b-a12b') {
      config.nvidiaNim.model = 'meta/llama-3.1-8b-instruct'
    }
    const defunctOpenRouterModels = [
      'google/gemini-2.0-flash-exp:free',
      'openai/gpt-oss-20b:free',
      'nvidia/nemotron-nano-9b-v2:free',
    ]
    if (defunctOpenRouterModels.includes(config.openRouter?.model)) {
      config.openRouter.model = 'nvidia/nemotron-3.5-lightning:free'
    }
    modelMigrated = true
  }
  return config
}

let modelMigrated = false

async function loadFromStorage(passphrase?: string): Promise<ApiConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultApiConfig
    const parsed = JSON.parse(raw) as Partial<ApiConfig>
    const decrypted = await decryptConfig(parsed as Record<string, unknown>, passphrase)
    return mergeApiConfig(decrypted as Partial<ApiConfig>)
  } catch {
    return defaultApiConfig
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null

async function saveToStorage(config: ApiConfig, passphrase?: string): Promise<void> {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    try {
      const encrypted = await encryptConfig(config as unknown as Record<string, unknown>, passphrase)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted))
    } catch (err) {
      console.error('Failed to save API config:', err)
    }
  }, 300)
}

interface ApiConfigState {
  config: ApiConfig
  hydrated: boolean
  error: string | null
  needsPassphrase: boolean
  passphraseVerified: boolean

  hydrate: (passphrase?: string) => Promise<void>
  verifyPassphrase: (passphrase: string) => Promise<boolean>
  setPassphrase: (passphrase: string) => Promise<void>
  update: (updater: (draft: ApiConfig) => ApiConfig) => void
  reset: () => void
  clearMasterKey: () => Promise<void>
}

export const useApiConfigStore = create<ApiConfigState>()((set, get) => ({
  config: defaultApiConfig,
  hydrated: false,
  error: null,
  needsPassphrase: false,
  passphraseVerified: false,

  hydrate: async (passphrase?: string) => {
    try {
      const keyState = await getMasterKeyState()
      if (keyState.version === 2 && keyState.hasPassphrase) {
        // v2 with passphrase - need passphrase to decrypt
        if (!passphrase) {
          set({ needsPassphrase: true, hydrated: true, error: null })
          return
        }
        const verified = await verifyMasterPassphrase(passphrase)
        if (!verified) {
          set({ needsPassphrase: true, hydrated: true, error: 'Invalid passphrase' })
          return
        }
        set({ passphraseVerified: true, needsPassphrase: false })
      } else if (keyState.version === 1 && keyState.hasPassphrase) {
        // Legacy v1 - auto-migrate on first unlock
        if (!passphrase) {
          set({ needsPassphrase: true, hydrated: true, error: null })
          return
        }
        // Verify legacy key works
        const legacyKey = localStorage.getItem('clipforge-master-key')
        if (!legacyKey) {
          set({ needsPassphrase: true, hydrated: true, error: 'Master key missing' })
          return
        }
        // Migrate to new passphrase
        await migrateToPassphrase(passphrase)
        set({ passphraseVerified: true, needsPassphrase: false })
      }
      // No master key set - load without encryption
      const config = await loadFromStorage(passphrase)
      set({ config, hydrated: true, error: null })
    } catch (err) {
      set({ hydrated: true, error: err instanceof Error ? err.message : String(err) })
    }
  },

  verifyPassphrase: async (passphrase: string) => {
    const verified = await verifyMasterPassphrase(passphrase)
    if (verified) {
      set({ passphraseVerified: true, needsPassphrase: false, error: null })
      // Reload config with passphrase
      const config = await loadFromStorage(passphrase)
      set({ config })
    } else {
      set({ error: 'Invalid passphrase' })
    }
    return verified
  },

  setPassphrase: async (passphrase: string) => {
    if (passphrase.length < 8) {
      set({ error: 'Passphrase must be at least 8 characters' })
      return
    }
    try {
      await migrateToPassphrase(passphrase)
      set({ passphraseVerified: true, needsPassphrase: false, error: null })
      const config = await loadFromStorage(passphrase)
      set({ config })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  update: (updater) => {
    const newConfig = updater(get().config)
    set({ config: newConfig })
    // Save with passphrase if verified
    const passphrase = get().passphraseVerified ? undefined : undefined // We don't store passphrase in state
    saveToStorage(newConfig, passphrase)
  },

  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    set({ config: defaultApiConfig, error: null })
  },

  clearMasterKey: async () => {
    await clearMasterKey()
    localStorage.removeItem(STORAGE_KEY)
    set({ config: defaultApiConfig, passphraseVerified: false, needsPassphrase: false, error: null })
  },
}))
