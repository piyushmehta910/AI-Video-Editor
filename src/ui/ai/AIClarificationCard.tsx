import * as React from 'react'
import { Check, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ClarificationOption {
  id: string
  label: string
  description?: string
  badge?: string
  previewThumbnail?: string
}

export interface ClarificationQuestion {
  id: string
  question: string
  category: 'style' | 'audience' | 'focus' | 'pacing' | 'avatar'
  options: ClarificationOption[]
  allowCustomInput?: boolean
}

export function AIClarificationCard({
  question,
  onSelectOption,
}: {
  question: ClarificationQuestion
  onSelectOption: (option: ClarificationOption | string) => void
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [customInput, setCustomInput] = React.useState('')
  const [showCustom, setShowCustom] = React.useState(false)

  const handleSelect = (opt: ClarificationOption) => {
    setSelectedId(opt.id)
    onSelectOption(opt)
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customInput.trim()) {
      onSelectOption(customInput.trim())
    }
  }

  return (
    <div className="my-2 rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 text-xs shadow-md backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex size-6 items-center justify-center rounded-lg bg-violet-600/30 text-violet-300">
          <HelpCircle className="size-3.5" />
        </div>
        <span className="font-bold text-foreground">{question.question}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {question.options.map((opt) => {
          const isSelected = selectedId === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              className={cn(
                'flex flex-col text-left p-2.5 rounded-lg border transition-all',
                isSelected
                  ? 'border-violet-500 bg-violet-500/20 text-foreground ring-1 ring-violet-500'
                  : 'border-border/60 bg-card/60 hover:bg-card hover:border-violet-500/50 text-muted-foreground hover:text-foreground',
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  {opt.label}
                  {opt.badge && (
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.2 font-mono text-[9px] text-violet-400">
                      {opt.badge}
                    </span>
                  )}
                </span>
                {isSelected && <Check className="size-3.5 text-violet-400 shrink-0" />}
              </div>
              {opt.description && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{opt.description}</p>
              )}
            </button>
          )
        })}
      </div>

      {question.allowCustomInput && (
        <div className="mt-2.5 pt-2 border-t border-border/40">
          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="text-[11px] text-violet-400 hover:text-violet-300 font-medium"
            >
              + Type custom answer
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
              <input
                autoFocus
                type="text"
                placeholder="Type your answer..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="flex-1 h-7 rounded-lg border border-border/80 bg-background/80 px-2.5 text-xs outline-none focus:border-violet-500"
              />
              <Button type="submit" size="sm" className="h-7 px-2.5 text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold">
                Submit
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
