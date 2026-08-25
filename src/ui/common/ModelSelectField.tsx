import * as React from 'react'
import { Cpu } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NVIDIA_NIM_MODELS, OPENROUTER_MODELS } from '@/api/llm/models'

export interface ModelSelectFieldProps {
  label?: string
  provider: 'nvidia-nim' | 'openrouter'
  model: string
  onProviderChange: (provider: 'nvidia-nim' | 'openrouter') => void
  onModelChange: (model: string) => void
  className?: string
}

export function ModelSelectField({
  label = 'AI Model & Provider',
  provider,
  model,
  onProviderChange,
  onModelChange,
  className,
}: ModelSelectFieldProps) {
  const isNvidia = provider === 'nvidia-nim'
  const activeModels = isNvidia ? NVIDIA_NIM_MODELS : OPENROUTER_MODELS

  // Ensure current model belongs to active provider list, fallback if needed
  React.useEffect(() => {
    const exists = activeModels.some((m) => m.id === model)
    if (!exists && activeModels.length > 0) {
      onModelChange(activeModels[0].id)
    }
  }, [provider, model, activeModels, onModelChange])

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
          <Cpu className="size-3 text-violet-500" />
          <span>{label}</span>
        </Label>
        <span className="text-[9px] font-semibold text-violet-600 dark:text-violet-400">
          {isNvidia ? '⚡ NVIDIA NIM' : '🌐 OpenRouter'}
        </span>
      </div>

      <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2">
        {/* Provider Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-md border bg-card p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => {
              onProviderChange('nvidia-nim')
              onModelChange('meta/llama-3.3-70b-instruct')
            }}
            className={cn(
              'flex items-center justify-center gap-1 rounded py-1 text-[10px] font-bold transition-all',
              isNvidia
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>⚡ NVIDIA NIM</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onProviderChange('openrouter')
              onModelChange('anthropic/claude-3.5-sonnet')
            }}
            className={cn(
              'flex items-center justify-center gap-1 rounded py-1 text-[10px] font-bold transition-all',
              !isNvidia
                ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>🌐 OpenRouter</span>
          </button>
        </div>

        {/* Model Dropdown */}
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet-400 transition"
        >
          {activeModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.tag ? `(${m.tag})` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
