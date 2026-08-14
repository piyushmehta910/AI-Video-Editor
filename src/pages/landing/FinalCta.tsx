import { Clapperboard, Settings } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function FinalCta() {
  return (
    <section className="relative py-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/2 h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-4xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 rounded-3xl border bg-card p-10 text-center shadow-2xl sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to direct your next video?
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm sm:text-base">
            Open the editor and start cutting. Connect optional providers later — nothing is
            required to begin.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/editor">
                <Clapperboard />
                Start editing
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/settings">
                <Settings />
                Connect providers
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}