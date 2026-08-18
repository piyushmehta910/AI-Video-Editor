import { SlidersHorizontal } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultPreferencesConfig, type AiPreferencesConfig } from '@/api/config/types'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FieldRow } from '../FieldRow'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type ConfirmationLevel = AiPreferencesConfig['confirmationLevel']

const CONFIRMATION_OPTIONS: Array<{ value: ConfirmationLevel; label: string }> = [
  { value: 'always', label: 'Always Ask' },
  { value: 'expensive', label: 'Ask for Expensive Operations' },
  { value: 'destructive', label: 'Ask Only for Destructive Operations' },
  { value: 'none', label: 'Fully Automatic' },
]

export function PreferencesCard() {
  const { config, update, save } = useApiConfigStore()
  const prefs = config.preferences

  const set = (patch: Partial<AiPreferencesConfig>) => {
    update((draft) => ({ ...draft, preferences: { ...draft.preferences, ...patch } }))
  }

  const toggles: Array<{ key: 'autoCaptions' | 'autoSave' | 'autoBackup' | 'autoFallback'; label: string }> = [
    { key: 'autoCaptions', label: 'Auto captions' },
    { key: 'autoSave', label: 'Auto save (every 5s)' },
    { key: 'autoBackup', label: 'Auto backup' },
    { key: 'autoFallback', label: 'Automatic provider fallback' },
  ]

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <SlidersHorizontal className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">AI Director Preferences</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">Defaults used by the AI Director</p>
        </div>
      </div>

      <Separator />

      <CardContent className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
        <FieldRow label="Language">
          <Select value={prefs.language} onValueChange={(v) => set({ language: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">Hindi</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Default Aspect Ratio">
          <Select value={prefs.defaultAspectRatio} onValueChange={(v) => set({ defaultAspectRatio: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Aspect ratio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9</SelectItem>
              <SelectItem value="9:16">9:16</SelectItem>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="4:5">4:5</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Default FPS">
          <Select value={String(prefs.defaultFps)} onValueChange={(v) => set({ defaultFps: Number(v) })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="FPS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">24</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="48">48</SelectItem>
              <SelectItem value="60">60</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Default Export Quality">
          <Select value={prefs.defaultExportQuality} onValueChange={(v) => set({ defaultExportQuality: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p</SelectItem>
              <SelectItem value="1440p">1440p</SelectItem>
              <SelectItem value="4k">4K</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Preferred AI Provider">
          <Select value={prefs.preferredAiProvider} onValueChange={(v) => set({ preferredAiProvider: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nvidia-nim">NVIDIA NIM</SelectItem>
              <SelectItem value="opencode-zen">OpenCode Zen</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Preferred Stock Provider">
          <Select value={prefs.preferredStock} onValueChange={(v) => set({ preferredStock: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unsplash">Unsplash</SelectItem>
              <SelectItem value="pexels">Pexels</SelectItem>
              <SelectItem value="pixabay">Pixabay</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="AI Confirmation Level" className="md:col-span-2">
          <div className="flex flex-col gap-2">
            {CONFIRMATION_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`confirm-${option.value}`}
                  name="confirmation-level"
                  checked={prefs.confirmationLevel === option.value}
                  onChange={() => set({ confirmationLevel: option.value })}
                  className="accent-primary size-4"
                />
                <Label htmlFor={`confirm-${option.value}`} className="text-sm font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </FieldRow>

        <div className="flex flex-wrap gap-4 md:col-span-2">
          {toggles.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`pref-${key}`}
                checked={prefs[key]}
                onCheckedChange={(checked) => set({ [key]: checked === true })}
              />
              <Label htmlFor={`pref-${key}`} className="text-sm font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>

      <Separator />

      <div className="flex justify-end gap-2 px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => update((d) => ({ ...d, preferences: { ...defaultPreferencesConfig } }))}>
          Reset
        </Button>
        <Button type="button" size="sm" onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  )
}