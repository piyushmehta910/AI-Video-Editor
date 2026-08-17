import { Music } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultMusicConfig, type MusicConfig, type FreesoundConfig } from '@/api/config/types'
import { testDeezer, testFreesound, testMusicBrainz } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SliderField } from '../SliderField'

export function MusicCard() {
  const { config, update, save } = useApiConfigStore()
  const music: MusicConfig = config.music

  const setFreesound = (patch: Partial<FreesoundConfig>) => {
    update((draft) => ({
      ...draft,
      music: { ...draft.music, freesound: { ...draft.music.freesound, ...patch } },
    }))
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Music className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Music & Audio</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            MusicBrainz, Deezer & Freesound search providers
          </p>
        </div>
      </div>

      <Separator />

      <CardContent className="grid grid-cols-1 gap-5 px-4 py-4 md:grid-cols-3">
        <Card className="gap-4 py-4">
          <div className="flex items-center justify-between px-4">
            <h4 className="text-sm font-semibold">MusicBrainz</h4>
            <Switch
              checked={music.musicbrainz.enabled}
              onCheckedChange={(enabled) =>
                update((d) => ({
                  ...d,
                  music: { ...d.music, musicbrainz: { ...d.music.musicbrainz, enabled } },
                }))
              }
              aria-label="Toggle MusicBrainz"
            />
          </div>
          <CardContent className="flex flex-col gap-3 px-4">
            <p className="text-muted-foreground text-xs">Free — no API key required.</p>
            <FieldRow label="Base URL" htmlFor="musicbrainz-url">
              <Input
                id="musicbrainz-url"
                value={music.musicbrainz.baseUrl}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    music: { ...d.music, musicbrainz: { ...d.music.musicbrainz, baseUrl: e.target.value } },
                  }))
                }
              />
            </FieldRow>
            <FieldRow label="User-Agent" htmlFor="musicbrainz-ua">
              <Input
                id="musicbrainz-ua"
                value={music.musicbrainz.userAgent}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    music: { ...d.music, musicbrainz: { ...d.music.musicbrainz, userAgent: e.target.value } },
                  }))
                }
              />
            </FieldRow>
            <ApiTester
              label="Test"
              run={() =>
                testMusicBrainz(music.musicbrainz.baseUrl, music.musicbrainz.userAgent, 15000).then((result) => {
                  update((d) => ({
                    ...d,
                    music: {
                      ...d.music,
                      musicbrainz: { ...d.music.musicbrainz, status: result.ok ? 'connected' : 'disconnected' },
                    },
                  }))
                  return result
                })
              }
            />
          </CardContent>
        </Card>

        <Card className="gap-4 py-4">
          <div className="flex items-center justify-between px-4">
            <h4 className="text-sm font-semibold">Deezer</h4>
            <Switch
              checked={music.deezer.enabled}
              onCheckedChange={(enabled) =>
                update((d) => ({
                  ...d,
                  music: { ...d.music, deezer: { ...d.music.deezer, enabled } },
                }))
              }
              aria-label="Toggle Deezer"
            />
          </div>
          <CardContent className="flex flex-col gap-3 px-4">
            <p className="text-muted-foreground text-xs">Free tier — no key required.</p>
            <FieldRow label="Endpoint" htmlFor="deezer-endpoint">
              <Input
                id="deezer-endpoint"
                value={music.deezer.endpoint}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    music: { ...d.music, deezer: { ...d.music.deezer, endpoint: e.target.value } },
                  }))
                }
              />
            </FieldRow>
            <ApiTester
              label="Test"
              run={() =>
                testDeezer(music.deezer.endpoint, 15000).then((result) => {
                  update((d) => ({
                    ...d,
                    music: {
                      ...d.music,
                      deezer: { ...d.music.deezer, status: result.ok ? 'connected' : 'disconnected' },
                    },
                  }))
                  return result
                })
              }
            />
          </CardContent>
        </Card>

        <Card className="gap-4 py-4">
          <div className="flex items-center justify-between px-4">
            <h4 className="text-sm font-semibold">Freesound</h4>
            <Switch
              checked={music.freesound.enabled}
              onCheckedChange={(enabled) =>
                setFreesound({ enabled, status: enabled ? music.freesound.status ?? 'disconnected' : 'disabled' })
              }
              aria-label="Toggle Freesound"
            />
          </div>
          <CardContent className="flex flex-col gap-3 px-4">
            <FieldRow label="API Key" htmlFor="freesound-key">
              <ApiKeyInput
                id="freesound-key"
                value={music.freesound.apiKey}
                placeholder="Freesound token"
                onChange={(e) => setFreesound({ apiKey: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="License Filter" htmlFor="freesound-license">
              <Select value={music.freesound.licenseFilter} onValueChange={(v) => setFreesound({ licenseFilter: v })}>
                <SelectTrigger id="freesound-license" className="w-full">
                  <SelectValue placeholder="License" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cc0">CC0</SelectItem>
                  <SelectItem value="attribution">CC-BY</SelectItem>
                  <SelectItem value="attribution,cc0">CC0 + CC-BY</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Max Duration (s)" htmlFor="freesound-duration">
              <Input
                id="freesound-duration"
                type="number"
                min={5}
                max={300}
                value={music.freesound.maxDuration}
                onChange={(e) => setFreesound({ maxDuration: Number(e.target.value) })}
              />
            </FieldRow>
            <SliderField
              label="Min Rating"
              value={music.freesound.minRating}
              min={0}
              max={5}
              step={1}
              onChange={(v) => setFreesound({ minRating: v })}
            />
            <ApiTester
              label="Test"
              run={() =>
                testFreesound(music.freesound.apiKey, music.freesound.endpoint, 15000).then((result) => {
                  setFreesound({ status: result.ok ? 'connected' : 'disconnected' })
                  return result
                })
              }
            />
          </CardContent>
        </Card>
      </CardContent>

      <Separator />

      <div className="flex justify-end gap-2 px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => update((d) => ({ ...d, music: { ...defaultMusicConfig } }))}>
          Reset
        </Button>
        <Button type="button" size="sm" onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  )
}