import { Clapperboard, Home, Settings } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { cn } from '@/lib/utils'
import { Outlet } from '@tanstack/react-router'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/editor', label: 'Editor', icon: Clapperboard },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background/95 sticky top-0 z-40 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
              CF
            </div>
            <span className="text-sm font-semibold">ClipForge AI Studio</span>
          </div>
          <nav className="ml-2 flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.to}
                asChild
                variant="ghost"
                size="sm"
                className={cn('gap-1.5')}
              >
                <Link
                  to={item.to}
                  activeProps={{ className: 'bg-accent text-accent-foreground' }}
                  activeOptions={{ exact: item.to === '/' }}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs sm:block">
              Browser-native · WebGPU · WebCodecs
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}