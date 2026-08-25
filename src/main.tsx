import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { router } from './router'
import { useApiConfigStore } from '@/api/config/store'
import { initTheme } from '@/lib/theme'
import { preloadEssentialFonts } from '@/lib/fonts'

await useApiConfigStore.getState().hydrate()
initTheme()
preloadEssentialFonts()

// Ask the browser to never evict OPFS media (project files) under storage pressure.
// Without this, browsers can wipe media while IndexedDB metadata survives.
if ('storage' in navigator && typeof navigator.storage?.persist === 'function') {
  void navigator.storage.persist().catch(() => {})
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)