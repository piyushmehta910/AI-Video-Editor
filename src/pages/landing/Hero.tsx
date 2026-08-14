import { Play, Settings, Sparkles, Wand2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const HERO_BADGES = ['WebGPU compositing', '100% in-browser', 'No uploads ever']

function EditorMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-r from-violet-600/20 via-fuchsia-500/20 to-amber-500/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-2">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="text-muted-foreground ml-2 text-xs font-medium">
            ClipForge AI Studio — social-reel.mp4
          </span>
        </div>

        <div className="grid grid-cols-[1fr_220px]">
          <div className="relative flex aspect-video items-center justify-center bg-black">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(139,92,246,0.35),transparent_60%),radial-gradient(circle_at_75%_65%,rgba(244,114,182,0.3),transparent_55%)]" />
            <div className="relative flex flex-col items-center gap-3">
              <div className="bg-gradient-to-br from-violet-600 to-fuchsia-500 flex size-14 items-center justify-center rounded-full text-white shadow-lg shadow-fuchsia-500/40">
                <Play className="ml-1 size-6" />
              </div>
              <p className="text-sm font-medium text-white/90">Preview — WebGPU @ 60fps</p>
            </div>
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white/80 backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-400" /> 1920×1080 · 30 fps
            </div>
          </div>

          <div className="hidden flex-col gap-2 border-l bg-muted/40 p-3 sm:flex">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              AI Director
            </p>
            <div className="flex flex-col gap-1.5 text-[11px]">
              {[
                'Trim highlights to 30s',
                'Auto-caption with Whisper',
                'Match music to scenes',
                'Reframe to 9:16',
              ].map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                    i === 0
                      ? 'border-violet-500/50 bg-violet-500/10 text-foreground'
                      : 'border-transparent bg-background/60 text-muted-foreground'
                  }`}
                >
                  {i === 0 ? <Sparkles className="size-3 shrink-0 text-violet-500" /> : <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />}
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t bg-card px-3 py-2.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Timeline
            </span>
            <span className="text-muted-foreground text-[10px]">0:00:00</span>
            <div className="relative ml-auto h-4 flex-1 rounded bg-muted">
              <div className="absolute top-0 bottom-0 left-[30%] w-1 rounded bg-violet-500" />
            </div>
            <span className="text-muted-foreground text-[10px]">0:00:30</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">V1</span>
              <div className="relative h-5 flex-1 rounded bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500/80" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">V2</span>
              <div className="relative h-5 flex-1 rounded bg-gradient-to-r from-sky-500/80 to-emerald-500/80" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">A1</span>
              <div className="relative h-5 flex-1 rounded bg-gradient-to-r from-amber-500/80 to-orange-500/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute -right-40 top-40 h-[360px] w-[360px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute -left-40 top-64 h-[320px] w-[320px] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge className="gap-1.5 border-violet-500/40 bg-violet-500/10 py-1 text-violet-300">
              <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
              Beta · 100% free
            </Badge>
            {HERO_BADGES.map((badge) => (
              <Badge key={badge} variant="secondary" className="gap-1.5 py-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {badge}
              </Badge>
            ))}
          </div>

          <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">
            Edit video.
            <br />
            Command an{' '}
            <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
              AI director.
            </span>
          </h1>

          <p className="text-muted-foreground max-w-xl text-base sm:text-lg">
            A professional video editor that runs entirely in your browser. Every AI result stays
            fully editable — and nothing ever leaves your machine.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/editor">
                <Wand2 />
                Open the Editor
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/settings">
                <Settings />
                Configure APIs
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            No account · No install · Works offline for core editing
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <EditorMockup />
        </div>
      </div>
    </section>
  )
}