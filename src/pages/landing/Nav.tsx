import { useEffect, useState } from 'react'
import { Clapperboard, Menu, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#modes', label: 'Modes' },
  { href: '#workflows', label: 'Workflows' },
  { href: '#tech', label: 'Technology' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#security', label: 'Security' },
] as const

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all',
        scrolled
          ? 'border-b bg-background/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-violet-600 to-fuchsia-500 flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white shadow-lg shadow-violet-500/30">
            CF
          </div>
          <span className="text-base font-bold tracking-tight">
            ClipForge <span className="text-muted-foreground font-medium">AI Studio</span>
          </span>
        </a>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link to="/settings">Settings</Link>
          </Button>
          <Button asChild>
            <Link to="/editor">
              <Clapperboard />
              Open Editor
            </Link>
          </Button>
        </div>

        <button
          type="button"
          className="text-muted-foreground ml-auto flex size-9 items-center justify-center rounded-md sm:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-background/95 backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-3">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2.5 text-sm font-medium"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t pt-3">
              <Button variant="outline" asChild className="flex-1">
                <Link to="/settings" onClick={() => setOpen(false)}>
                  Settings
                </Link>
              </Button>
              <Button asChild className="flex-1">
                <Link to="/editor" onClick={() => setOpen(false)}>
                  Open Editor
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}