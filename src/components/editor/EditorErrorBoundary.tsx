import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EditorErrorBoundaryProps {
  children: React.ReactNode
}

interface EditorErrorBoundaryState {
  error: Error | null
}

function webgpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/**
 * Catches render/runtime errors inside the editor (WebGPU init failures,
 * missing browser APIs, decoder worker crashes) and shows a graceful
 * recovery screen instead of a blank page.
 */
export class EditorErrorBoundary extends React.Component<EditorErrorBoundaryProps, EditorErrorBoundaryState> {
  state: EditorErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[editor] crashed:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const gpuMissing = !webgpuSupported()

    return (
      <div className="flex h-full min-h-[60vh] w-full items-center justify-center bg-background p-8">
        <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10">
              <AlertTriangle className="text-destructive size-4.5" />
            </span>
            <h2 className="text-sm font-semibold">{gpuMissing ? 'WebGPU is not available' : 'The editor hit an unexpected error'}</h2>
          </div>

          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {gpuMissing ? (
              <>
                ClipForge renders through WebGPU. Use a recent Chromium-based browser (Chrome or Edge 113+)
                — in Safari it requires enabling the WebGPU feature flag. Firefox support is still rolling out.
              </>
            ) : (
              <>Something failed while starting the editor timeline or its media workers.</>
            )}
          </p>

          {!gpuMissing && (
            <pre className="bg-muted mt-3 max-h-24 overflow-auto rounded-md p-2 text-[10px] whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          )}

          <div className="mt-5 flex gap-2">
            <Button size="sm" variant="outline" onClick={this.reset}>
              <RotateCcw className="mr-1.5 size-3.5" />
              Try again
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/">
                <Home className="mr-1.5 size-3.5" />
                Back to home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
