import { Music } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultMusicConfig, type MusicConfig } from '@/api/config/types'
import { testDeezer, testMusicBrainz } from '@/api/config/validation'
import { FieldRow } from '../FieldRow'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ApiTester } from '../ApiTester'

export function MusicCard() {
  const { config, update } = useApiConfigStore()
  const music: MusicConfig = config.music
  const mbBaseUrl = music.musicbrainz.baseUrl ?? 'https://musicbrainz.org'
  const mbUserAgent = music.musicbrainz.userAgent ?? 'ClipForgeAI/1.0'
  const mbTimeoutMs = music.musicbrainz.timeoutMs ?? 30000
  const deezerEndpoint = music.deezer.endpoint ?? 'https://api.deezer.com'
  const deezerTimeoutMs = music.deezer.timeoutMs ?? 30000

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Music className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Music & Audio Search</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">MusicBrainz & Deezer audio providers</p>
        </div>
      </div>

      <Separator />

      <CardContent className="grid grid-cols-1 gap-5 px-4 py-4 md:grid-cols-2">
        <Card className="gap-4 py-4">
          <div className="flex items-center justify-between px-4">
            <h4 className="text-sm font-semibold">MusicBrainz</h4>
            <Switch checked={music.musicbrainz.enabled} onCheckedChange={(enabled) => update((d) => ({ ...d, music: { ...d.music, musicbrainz: { ...d.music.musicbrainz, enabled } } }))} aria-label="Toggle MusicBrainz" />
          </div>
          <CardContent className="flex flex-col gap-3 px-4">
            <p className="text-muted-foreground text-xs">Free — no API key required.</p>
            <FieldRow label="Base URL" htmlFor="musicbrainz-url">
              <Input id="musicbrainz-url" value={mbBaseUrl} onChange={(e) => update((d) => ({ ...d, music: { ...d.music, musicbrainz: { ...d.music.musicbrainz, baseUrl: e.target.value } } }))} />
            </FieldRow>
            <FieldRow label="User-Agent" htmlFor="musicbrainz-ua">
              <Input id="musicbrainz-ua" value={mbUserAgent} onChange={(e) => update((d) => ({ ...d, music: { ...d.music, musicbrainz: { ...d.music.musicbrainz, userAgent: e.target.value } } }))} />
            </FieldRow>
            <ApiTester run={() => testMusicBrainz(mbBaseUrl, mbUserAgent, mbTimeoutMs).then((r) => { update((d) => ({ ...d, music: { ...d.music, musicbrainz: { ...d.music.musicbrainz, status: r.ok ? 'connected' : 'disconnected' } } })); return r })} label="Test" />
          </CardContent>
        </Card>

        <Card className="gap-4 py-4">
          <div className="flex items-center justify-between px-4">
            <h4 className="text-sm font-semibold">Deezer</h4>
            <Switch checked={music.deezer.enabled} onCheckedChange={(enabled) => update((d) => ({ ...d, music: { ...d.music, deezer: { ...d.music.deezer, enabled } } }))} aria-label="Toggle Deezer" />
          </div>
          <CardContent className="flex flex-col gap-3 px-4">
            <p className="text-muted-foreground text-xs">Free tier — no key required.</p>
            <FieldRow label="Endpoint" htmlFor="deezer-endpoint">
              <Input id="deezer-endpoint" value={deezerEndpoint} onChange={(e) => update((d) => ({ ...d, music: { ...d.music, deezer: { ...d.music.deezer, endpoint: e.target.value } } }))} />
            </FieldRow>
            <ApiTester run={() => testDeezer(deezerEndpoint, deezerTimeoutMs).then((r) => { update((d) => ({ ...d, music: { ...d.music, deezer: { ...d.music.deezer, status: r.ok ? 'connected' : 'disconnected' } } })); return r })} label="Test" />
          </CardContent>
        </Card>
      </CardContent>

      <Separator />

      <div className="flex justify-end gap-2 px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => update((d) => ({ ...d, music: { ...defaultMusicConfig } }))}>Reset</Button>
      </div>
    </Card>
  )
}