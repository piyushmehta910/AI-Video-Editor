import { create } from 'zustand'
import { defaultApiConfig, type ApiConfig } from './types'
import { loadApiConfig, saveApiConfig, clearApiConfig, type StoredApiConfig } from './persistence'
import { encryptWithPassword, decryptWithPassword, isEncryptedPayload } from './encryption'

/**
 * Merge a previously saved config with the current defaults so that new keys
 * (e.g. a newly added provider) get default values and removed keys are dropped.
 */
function mergeApiConfig(stored: Partial<ApiConfig>): ApiConfig {
  const merged = {} as Record<string, unknown>
  for (const key of Object.keys(defaultApiConfig) as Array<keyof ApiConfig>) {
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
      // Deep-merge one more level so new fields on nested provider configs
      // (e.g. Unsplash accessKey) inherit defaults for previously-saved configs.
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
          mergedValue[nestedKey] = { ...(nestedFallback as Record<string, unknown>), ...(nestedStored as Record<string, unknown>) }
        }
      }
      merged[key] = mergedValue
    } else {
      merged[key] = value ?? fallback
    }
  }
  return merged as unknown as ApiConfig
}

interface ApiConfigState {
  config: ApiConfig
  hydrated: boolean
  locked: boolean
  isSaving: boolean
  lastSavedAt: number | null
  error: string | null
  masterPassword: string | null

  hydrate: () => Promise<void>
  update: (updater: (draft: ApiConfig) => ApiConfig) => void
  save: () => Promise<void>
  setMasterPassword: (password: string | null) => void
  unlock: (password: string) => Promise<boolean>
  lock: () => void
  changeMasterPassword: (oldPassword: string, newPassword: string) => Promise<void>
  reset: () => Promise<void>
}

function shouldEncrypt(config: ApiConfig): boolean {
  return config.security.encryptKeys && config.security.hasMasterPassword
}

export const useApiConfigStore = create<ApiConfigState>()((set, get) => ({
  config: defaultApiConfig,
  hydrated: false,
  locked: false,
  isSaving: false,
  lastSavedAt: null,
  error: null,
  masterPassword: null,

  hydrate: async () => {
    try {
      const stored = await loadApiConfig()
      if (stored === null) {
        set({ hydrated: true, locked: false })
        return
      }
      if ('plain' in stored) {
        const config = JSON.parse(stored.plain) as Partial<ApiConfig>
        set({ config: mergeApiConfig(config), hydrated: true, locked: false })
      } else {
        set({ hydrated: true, locked: true })
      }
    } catch (err) {
      set({ hydrated: true, error: err instanceof Error ? err.message : String(err) })
    }
  },

  update: (updater) => {
    set((state) => ({ config: updater(state.config) }))
  },

  save: async () => {
    const { config, locked, masterPassword } = get()
    if (locked) {
      throw new Error('Vault is locked. Unlock it before saving changes.')
    }
    set({ isSaving: true, error: null })
    try {
      let stored: StoredApiConfig
      if (shouldEncrypt(config)) {
        if (!masterPassword) {
          throw new Error('A master password is required to encrypt API keys.')
        }
        const encrypted = await encryptWithPassword(JSON.stringify(config), masterPassword)
        stored = { encrypted }
      } else {
        stored = { plain: JSON.stringify(config) }
      }
      await saveApiConfig(stored)
      set({ isSaving: false, lastSavedAt: Date.now() })
    } catch (err) {
      set({
        isSaving: false,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },

  setMasterPassword: (password) => {
    set((state) => ({
      masterPassword: password,
      config: {
        ...state.config,
        security: {
          ...state.config.security,
          hasMasterPassword: password !== null,
        },
      },
    }))
  },

  unlock: async (password) => {
    try {
      const stored = await loadApiConfig()
      if (stored === null || !('encrypted' in stored) || !isEncryptedPayload(stored.encrypted)) {
        return false
      }
      const json = await decryptWithPassword(stored.encrypted, password)
      const config = JSON.parse(json) as Partial<ApiConfig>
      set({ config: mergeApiConfig(config), masterPassword: password, locked: false })
      return true
    } catch {
      return false
    }
  },

  lock: () => {
    set({ masterPassword: null, locked: true })
  },

  changeMasterPassword: async (oldPassword, newPassword) => {
    const state = get()
    if (state.locked) throw new Error('Store is locked. Unlock first.')
    const ok = await state.unlock(oldPassword)
    if (!ok && state.config.security.hasMasterPassword) {
      throw new Error('Incorrect current master password.')
    }
    state.setMasterPassword(newPassword)
    await state.save()
  },

  reset: async () => {
    await clearApiConfig()
    set({
      config: defaultApiConfig,
      masterPassword: null,
      locked: false,
      lastSavedAt: null,
      error: null,
    })
  },
}))