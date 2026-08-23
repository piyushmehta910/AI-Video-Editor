import { lazy, Suspense } from 'react'
import { createRootRoute, createRoute, createRouter, redirect, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { Skeleton } from '@/components/ui/skeleton'
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary'
import { WebGPULoadingScreen } from '@/components/editor/WebGPULoadingScreen'

const LandingPage = lazy(() =>
  import('@/pages/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const EditorPage = lazy(() =>
  import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function PageFallback() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function withSuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return function Suspended() {
    return (
      <Suspense fallback={<PageFallback />}>
        <Component />
      </Suspense>
    )
  }
}

/** Editor route: error boundary + GPU-flavoured loader around the lazy chunk. */
function SuspendedEditor() {
  return (
    <EditorErrorBoundary>
      <Suspense fallback={<WebGPULoadingScreen />}>
        <EditorPage />
      </Suspense>
    </EditorErrorBoundary>
  )
}

const rootRoute = createRootRoute({
  component: Outlet,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: withSuspense(LandingPage),
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
  component: withSuspense(SettingsPage),
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
