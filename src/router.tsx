import { createRootRoute, createRoute, createRouter, redirect, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { SuspendedLanding, SuspendedSettings, SuspendedEditor } from './router-components'

const rootRoute = createRootRoute({
  component: Outlet,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SuspendedLanding,
})

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
})

const editorRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/editor',
  component: SuspendedEditor,
})

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings',
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: SuspendedSettings,
})

// Legacy / marketing aliases for the editor URL.
const studioRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio',
  beforeLoad: () => {
    throw redirect({ to: '/editor', replace: true })
  },
})

const appRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: () => {
    throw redirect({ to: '/editor', replace: true })
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  studioRedirect,
  appRedirect,
  shellRoute.addChildren([editorRoute, settingsRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
