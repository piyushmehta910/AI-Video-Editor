import { create } from 'zustand'

const STORAGE_KEY = 'clipforge-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export type Theme = 'dark' | 'light'

function systemPref(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
}

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // ignore storage errors
  }
  return systemPref()
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'dark' ? '#0b0b10' : '#ffffff')
}

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme(),
  toggle: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore storage errors
      }
      applyTheme(next)
      return { theme: next }
    }),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore storage errors
    }
    applyTheme(theme)
    set({ theme })
  },
}))

export function initTheme() {
  const state = useThemeStore.getState()
  applyTheme(state.theme)
}
