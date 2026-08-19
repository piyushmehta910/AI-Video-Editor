import { Clapperboard, Home, Settings } from 'lucide-react'
import { Link, Outlet } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/common/ThemeToggle'

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
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.to}
                asChild
                variant="ghost"
                size="sm"
                className="gap-1.5"
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
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
      <nav className="border-t bg-background/95 fixed inset-x-0 bottom-0 z-40 flex backdrop-blur md:hidden">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-stretch justify-around px-2 pb-safe">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.to}
              asChild
              variant="ghost"
              className="h-full flex-1 flex-col gap-0.5 rounded-none text-[10px]"
            >
              <Link
                to={item.to}
                activeProps={{ className: 'text-primary' }}
                activeOptions={{ exact: item.to === '/' }}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            </Button>
          ))}
        </div>
      </nav>
    </div>
  )
}