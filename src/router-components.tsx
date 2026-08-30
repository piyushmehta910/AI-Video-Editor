import * as React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary'
import { WebGPULoadingScreen } from '@/components/editor/WebGPULoadingScreen'
import { BrowserGate } from '@/components/editor/BrowserGate'

const LandingPage = React.lazy(() =>
  import('@/pages/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const EditorPage = React.lazy(() =>
  import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })),
)
const SettingsPage = React.lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

export function PageFallback() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export function SuspendedLanding() {
  return (
    <React.Suspense fallback={<PageFallback />}>
      <LandingPage />
    </React.Suspense>
  )
}

export function SuspendedSettings() {
  return (
    <React.Suspense fallback={<PageFallback />}>
      <SettingsPage />
    </React.Suspense>
  )
}

export function SuspendedEditor() {
  return (
    <EditorErrorBoundary>
      <BrowserGate>
        <React.Suspense fallback={<WebGPULoadingScreen />}>
          <EditorPage />
        </React.Suspense>
      </BrowserGate>
    </EditorErrorBoundary>
  )
}
