import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import { router } from './router'
import { useApiConfigStore } from '@/api/config/store'

useApiConfigStore.getState().hydrate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Analytics />
  </StrictMode>,
)