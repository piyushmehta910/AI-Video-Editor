import { Link } from '@tanstack/react-router'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Editor', to: '/editor' },
      { label: 'Settings', to: '/settings' },
    ],
  },
  {
    title: 'Capabilities',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Modes', href: '#modes' },
      { label: 'Workflows', href: '#workflows' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Technology', href: '#tech' },
      { label: 'Integrations', href: '#integrations' },
      { label: 'Security', href: '#security' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="bg-gradient-to-br from-violet-600 to-fuchsia-500 flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white">
                CF
              </div>
              <span className="text-base font-bold tracking-tight">ClipForge AI Studio</span>
            </div>
            <p className="text-muted-foreground mt-3 max-w-xs text-sm">
              Browser-native video editing with an autonomous AI director. Fast, private and yours.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {column.title}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) =>
                  'to' in link ? (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ClipForge AI Studio. All processing happens in your browser.</p>
          <p>WebGPU · WebCodecs · Mediabunny · Transformers.js</p>
        </div>
      </div>
    </footer>
  )
}