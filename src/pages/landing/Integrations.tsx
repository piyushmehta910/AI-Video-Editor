import { Section } from './Section'

const GROUPS = [
  {
    label: 'AI & Reasoning',
    providers: ['NVIDIA NIM', 'OpenCode Zen', 'OpenRouter (free)'],
  },
  {
    label: 'Voice & Avatars',
    providers: ['ElevenLabs', 'On-device lip-sync (no API)'],
  },
  {
    label: 'Stock & Media',
    providers: ['Unsplash', 'Pexels', 'Pixabay'],
  },
  {
    label: 'Music & Research',
    providers: ['MusicBrainz', 'Deezer', 'Firecrawl', 'MARP'],
  },
]

export function Integrations() {
  return (
    <Section
      id="integrations"
      eyebrow="Your ecosystem"
      title="Bring your own API keys"
      subtitle="Every provider is optional and configured by you. The core editor works with zero keys."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group.label} className="rounded-xl border bg-card p-5">
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.providers.map((provider) => (
                <span
                  key={provider}
                  className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:border-violet-500/40"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}