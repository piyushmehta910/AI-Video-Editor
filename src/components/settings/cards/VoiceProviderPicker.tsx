import { useApiConfigStore } from '@/api/config/store'
import { TTS_PROVIDER_IDS } from '@/api/tts'
import { FieldRow } from '../FieldRow'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Pick which voice provider the AI uses for generate_voiceover. Lists every
 * known provider; "Auto" picks the first configured one.
 */
export function VoiceProviderPicker() {
  const prefs = useApiConfigStore((s) => s.config.preferences)
  const set = (value: string) => {
    useApiConfigStore.getState().update((draft) => ({ ...draft, preferences: { ...draft.preferences, preferredVoice: value } }))
  }
  return (
    <FieldRow label="Active voice provider" htmlFor="voice-provider" hint="Used by generate_voiceover when the director adds narration">
      <Select value={prefs.preferredVoice || 'auto'} onValueChange={set}>
        <SelectTrigger id="voice-provider" className="w-full">
          <SelectValue placeholder="Auto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto (first configured)</SelectItem>
          {Object.entries(TTS_PROVIDER_IDS).map(([id, name]) => (
            <SelectItem key={id} value={id}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  )
}