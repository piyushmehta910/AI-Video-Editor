import * as React from 'react'
import { Clapperboard, Film, RefreshCw, Settings2, X, Eye, Mic, Bot } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useApiConfigStore } from '@/api/config/store'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import { useAIStore, type AiDirectorMode } from '@/stores/aiStore'
import { projectDuration } from '@/engine/types'
import { useAIDirector } from '@/hooks/useAIDirector'
import { aiContextManager } from '@/ai/context/AIContextManager'
import { subagentOrchestrator } from '@/ai/subagents/SubagentOrchestrator'
import { ChatInterface } from './ChatInterface'
import { SuggestionCard } from './SuggestionCard'

/**
 * AI Director as a collapsible right sidebar (360px). Stays mounted beside
 * the timeline so users can watch edits land while the AI works.
 */

const MODES: Array<{ id: AiDirectorMode; label: string; hint: string }> = [
  { id: 'suggest', label: 'Suggest', hint: 'AI only proposes — nothing applies without approval' },
  { id: 'edit', label: 'Edit', hint: 'AI applies safe actions directly; destructive ones need confirm' },
]

function ContextSummary() {
  const project = useTimelineStore((s) => s.project)
  const transcripts = useTimelineStore((s) => s.transcripts)
  const ocr = useTimelineStore((s) => s.ocr)
  const scenes = useTimelineStore((s) => s.scenes)
  const analyzing = useAIStore((s) => s.analyzing)
  const [isIndexing, setIsIndexing] = React.useState(false)

  const clipCount = project.tracks.reduce((n, t) => n + t.clips.length, 0)
  const transcriptCount = Object.keys(transcripts).length
  const ocrRegionCount = Object.values(ocr).reduce((sum, o) => sum + (o?.regions?.length || 0), 0)
  const sceneCount = Object.values(scenes).reduce((sum, s) => sum + (s?.scenes?.length || 0), 0)

  const handleReindex = async () => {
    if (isIndexing) return
    setIsIndexing(true)
    try {
      await aiContextManager.analyzeAllProjectAssets({ force: true })
    } finally {
      setIsIndexing(false)
    }
  }

  return (
    <div className="border-b border-border/80 bg-muted/10 px-3 py-2" data-testid="ai-context-summary">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1 font-medium text-foreground">
          <Film className="size-3 text-violet-400" />
          {projectDuration(project.tracks).toFixed(1)}s · {clipCount} clip{clipCount !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => void handleReindex()}
          disabled={isIndexing || analyzing}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 transition"
          title="Re-run Whisper speech transcription and frame-by-frame OCR analysis"
        >
          <RefreshCw className={isIndexing || analyzing ? 'size-2.5 animate-spin' : 'size-2.5'} />
          {isIndexing || analyzing ? 'Indexing…' : 'IndexedDB Active'}
        </button>
      </div>

      {/* Multimodal Knowledge Badges */}
      <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-mono text-violet-700 dark:text-violet-300 border border-violet-500/20">
          <Mic className="size-2.5" />
          {transcriptCount > 0 ? `${transcriptCount} Speech Tracks` : 'Auto ASR'}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-mono text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
          <Eye className="size-2.5" />
          {ocrRegionCount > 0 ? `${ocrRegionCount} OCR Texts` : 'Frame OCR'}
        </span>
        {sceneCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <Film className="size-2.5" />
            {sceneCount} Scenes
          </span>
        )}
      </div>
    </div>
  )
}

function SubagentActivityBar() {
  const [activeEvent, setActiveEvent] = React.useState<{
    stage: string
    activeRole?: string
    progressPercent: number
    message: string
  } | null>(null)

  React.useEffect(() => {
    const unsub = subagentOrchestrator.subscribe((event) => {
      if (event.stage === 'completed' || event.stage === 'failed') {
        setActiveEvent(event)
        const timer = setTimeout(() => setActiveEvent(null), 6000)
        return () => clearTimeout(timer)
      } else {
        setActiveEvent(event)
      }
    })
    return unsub
  }, [])

  if (!activeEvent) return null

  return (
    <div className="border-b border-border/80 bg-violet-500/10 px-3 py-2 animate-in fade-in duration-200">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5 truncate">
          <Bot className="size-3.5 text-violet-500 animate-pulse shrink-0" />
          <span className="truncate">{activeEvent.message}</span>
        </span>
        <span className="font-mono text-[10px] text-violet-600 dark:text-violet-400 font-bold ml-2 shrink-0">
          {activeEvent.progressPercent}%
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
          style={{ width: `${activeEvent.progressPercent}%` }}
        />
      </div>
    </div>
  )
}

export function AIDirectorPanel({ initialPrompt }: { initialPrompt?: string }) {
  const open = useEditorStore((s) => s.aiDirectorOpen)
  const close = useEditorStore((s) => s.setAIDirectorOpen)
  const mode = useAIStore((s) => s.mode)
  const setMode = useAIStore((s) => s.setMode)
  const issues = useAIStore((s) => s.issues)
  const dismissedIssueIds = useAIStore((s) => s.dismissedIssueIds)

  const projectId = useTimelineStore((s) => s.project.id)
  const director = useAIDirector(projectId)

  React.useEffect(() => {
    if (open) director.loadDismissedIssues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId])

  // Pipeline hand-off: auto-run the incoming prompt once everything is ready.
  const configHydrated = useApiConfigStore((s) => s.hydrated)
  const timelineHydrated = useTimelineStore((s) => s.hydrated)
  React.useEffect(() => {
    void useApiConfigStore.getState().hydrate()
  }, [])
  React.useEffect(() => {
    if (!open || !initialPrompt || !timelineHydrated || !configHydrated) return
    const prompt = initialPrompt
    void director.send(prompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, timelineHydrated, configHydrated])

  if (!open) return null

  const visibleIssues = issues.filter((i) => !dismissedIssueIds.includes(i.id))
  const activeModeHint = MODES.find((m) => m.id === mode)?.hint

  return (
    <aside
      className="flex w-[360px] shrink-0 flex-col border-l border-neutral-800 bg-[#1e1e2e]"
      data-testid="ai-director-panel"
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-neutral-800 px-3">
        <Clapperboard className="size-4 text-violet-400" />
        <h2 className="text-xs font-semibold tracking-wide text-neutral-200">AI Director</h2>
        <Link
          to="/settings"
          className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
          title="Configure AI provider"
        >
          <Settings2 className="size-3.5" />
        </Link>
        <button
          onClick={() => close(false)}
          aria-label="Close AI Director panel"
          title="Close (Ctrl+Shift+A)"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <div className="flex rounded-lg border border-neutral-700 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              data-testid={`ai-mode-${m.id}`}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                mode === m.id ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-neutral-500">{activeModeHint}</p>
      </div>

      {/* Project context */}
      <ContextSummary />

      {/* Live Autonomous Subagents Status */}
      <SubagentActivityBar />

      {/* Suggestions */}
      {(visibleIssues.length > 0 || issues.length > 0) && (
        <div className="max-h-44 shrink-0 space-y-1.5 overflow-y-auto border-b border-neutral-800 px-3 py-2" data-testid="ai-suggestions">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Suggestions {visibleIssues.length > 0 && `(${visibleIssues.length})`}
            </p>
            <button
              onClick={() => void director.runQualityCheck()}
              title="Re-run quality check"
              className="rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>
          {visibleIssues.length === 0 ? (
            <p className="text-[11px] text-neutral-600">All caught up — no open suggestions.</p>
          ) : (
            visibleIssues.map((issue) => (
              <SuggestionCard
                key={issue.id}
                issue={issue}
                onFix={(i) => void Promise.resolve(director.applyIssueFix(i))}
                onIgnore={director.dismissIssueForever}
                onHideForever={director.dismissIssueForever}
              />
            ))
          )}
        </div>
      )}

      {/* Chat */}
      <ChatInterface director={director} />
    </aside>
  )
}
