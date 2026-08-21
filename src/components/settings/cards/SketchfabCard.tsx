import { Box } from 'lucide-react'
import { useApiConfigStore } from '@/api/config/store'
import { defaultSketchfabConfig, type SketchfabConfig } from '@/api/config/types'
import { testSketchfab } from '@/api/config/validation'
import { ApiKeyInput } from '../ApiKeyInput'
import { ApiTester } from '../ApiTester'
import { FieldRow } from '../FieldRow'
import { ProviderCard } from '../ProviderCard'
import { ProviderStatusBadge } from '../ProviderStatusBadge'

export function SketchfabCard() {
  const { config, update } = useApiConfigStore()
  const cfg: SketchfabConfig = config.sketchfab
  const apiKey = cfg.apiKey ?? ''

  const set = (patch: Partial<SketchfabConfig>) => {
    update((draft) => ({ ...draft, sketchfab: { ...draft.sketchfab, ...patch } }))
  }

  return (
    <ProviderCard
      icon={<Box className="size-4.5" />}
      title="Sketchfab"
      description="Search and download GLB 3D models — requires an API token from sketchfab.com/settings/password"
      enabled={cfg.enabled}
      status={<ProviderStatusBadge status={cfg.status ?? 'disabled'} />}
      onToggleEnabled={(enabled) => set({ enabled, status: enabled ? cfg.status ?? 'disconnected' : 'disabled' })}
      onReset={() => update((draft) => ({ ...draft, sketchfab: { ...defaultSketchfabConfig } }))}
    >
      <FieldRow label="API Token" htmlFor="sketchfab-api-key" className="md:col-span-2">
        <ApiKeyInput id="sketchfab-api-key" value={apiKey} placeholder="Sketchfab API token" onChange={(e) => set({ apiKey: e.target.value })} />
      </FieldRow>

      <FieldRow className="md:col-span-2">
        <ApiTester run={() => testSketchfab(apiKey, 30000).then((r) => { set({ status: r.ok ? 'connected' : 'disconnected' }); return r })} />
      </FieldRow>
    </ProviderCard>
  )
}
