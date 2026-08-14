import { useApiConfigStore } from '@/api/config/store'
import { NvidiaNimCard } from '@/components/settings/cards/NvidiaNimCard'
import { OpenCodeZenCard } from '@/components/settings/cards/OpenCodeZenCard'
import { ElevenLabsCard } from '@/components/settings/cards/ElevenLabsCard'
import { AvatarCard } from '@/components/settings/cards/AvatarCard'
import { Wav2LipCard } from '@/components/settings/cards/Wav2LipCard'
import { StockImagesCard } from '@/components/settings/cards/StockImagesCard'
import { FirecrawlCard } from '@/components/settings/cards/FirecrawlCard'
import { MusicCard } from '@/components/settings/cards/MusicCard'
import { SecurityCard } from '@/components/settings/cards/SecurityCard'
import { PreferencesCard } from '@/components/settings/cards/PreferencesCard'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'text-muted-foreground text-xs font-semibold tracking-widest uppercase',
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function SettingsPage() {
  const hydrated = useApiConfigStore((s) => s.hydrated)
  const error = useApiConfigStore((s) => s.error)

  if (!hydrated) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure external API providers. All keys are stored locally and encrypted with your master password.
        </p>
        {error && (
          <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Storage error: {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <SectionLabel>AI & Reasoning</SectionLabel>
          <NvidiaNimCard />
          <OpenCodeZenCard />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Voice</SectionLabel>
          <ElevenLabsCard />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Avatar & Lip Sync</SectionLabel>
          <AvatarCard />
          <Wav2LipCard />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Stock Images</SectionLabel>
          <StockImagesCard />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Web Research</SectionLabel>
          <FirecrawlCard />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Music & Audio</SectionLabel>
          <MusicCard />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Security</SectionLabel>
          <SecurityCard />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>AI Preferences</SectionLabel>
          <PreferencesCard />
        </section>
      </div>
    </div>
  )
}