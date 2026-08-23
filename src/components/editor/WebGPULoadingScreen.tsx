/**
 * Branded loading screen shown while the editor's lazy chunk downloads and the
 * canvas/WebGPU stack warms up. Purely presentational — no browser-only APIs,
 * so it is safe to render in any environment.
 */
export function WebGPULoadingScreen() {
  return (
    <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-5 bg-background p-8">
      <div className="relative flex size-16 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
        <div className="bg-gradient-to-br from-violet-400 to-fuchsia-600 size-6 rounded-md shadow-lg shadow-violet-500/40" />
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-semibold">Initializing WebGPU…</p>
        <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
          Loading the render engine, decoder workers and timeline. This happens once per session.
        </p>
      </div>

      <div className="bg-muted h-1 w-48 overflow-hidden rounded-full">
        <div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
          style={{ animation: 'webgpu-loading-slide 1.2s ease-in-out infinite' }}
        />
      </div>

      <style>{`
        @keyframes webgpu-loading-slide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(380%); }
        }
      `}</style>
    </div>
  )
}
