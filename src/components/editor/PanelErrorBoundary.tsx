import * as React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PanelErrorBoundaryProps {
  children: React.ReactNode
  panelName: string
}

interface PanelErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Generic React error boundary scoped to a single editor panel.
 *
 * Why: a crash in one panel (e.g. MediaBin) used to take down the entire
 * editor. This boundary isolates failures, shows a recovery UI, and lets the
 * user continue editing with the remaining panels.
 */
export class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Centralized error sink (extend with Sentry/Datadog later)
    // eslint-disable-next-line no-console
    console.error(`[${this.props.panelName}] crashed:`, error, info.componentStack)
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-card/30 p-6 text-center"
          role="alert"
          data-testid={`${this.props.panelName}-error-boundary`}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{this.props.panelName} hit an error</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {this.state.error?.message ?? 'Something unexpected happened in this panel.'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={this.handleReload}>
            <RotateCcw className="mr-1.5 size-3.5" />
            Reload {this.props.panelName}
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
