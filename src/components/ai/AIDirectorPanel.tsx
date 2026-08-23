import * as React from 'react'
import { Bot, Film, FileText, RefreshCw, Settings2, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useApiConfigStore } from '@/api/config/store'
import { useTimelineStore } from '@/stores/timelineStore'
import { useEditorStore } from '@/stores/editorStore'
import { useAIStore, type AiDirectorMode } from '@/stores/aiStore'
import { projectDuration } from '@/engine/types'
import { useAIDirector } from '@/hooks/useAIDirector'
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
  const analyzing = useAIStore((s) => s.analyzing)

  const clipCount = project.tracks.reduce((n, t) => n + t.clips.length, 0)
  const transcriptText = React.useMemo(() => {
    for (const t of Object.values(transcripts)) {
      const text = typeof t === 'string' ? t : (t as { text?: string }).text
      if (text && text.trim()) return text.trim()
    }
    return ''
  }, [transcripts])

  return (
    <div className="border-b border-neutral-800 px-3 py-2" data-testid="ai-context-summary">
      <div className="flex items-center gap-3 text-[10px] text-neutral-400">
        <span className="flex items-center gap-1">
          <Film className="size-3" />
          {projectDuration(project.tracks).toFixed(1)}s · {clipCount} clip{clipCount !== 1 ? 's' : ''} ·{' '}
          {project.tracks.filter((t) => t.clips.length > 0).length} active track
          {project.tracks.filter((t) => t.clips.length > 0).length !== 1 ? 's' : ''}
        </span>
        <span className={`ml-auto flex items-center gap-1 ${analyzing ? 'text-violet-300' : 'text-neutral-600'}`}>
          {analyzing ? (
            <>
              <RefreshCw className="size-3 animate-spin" />
              Analyzing…
            </>
          ) : (
            'Idle'
          )}
        </span>
      </div>
      {transcriptText && (
        <p className="mt-1 flex items-start gap-1 truncate text-[10px] italic leading-relaxed text-neutral-500" title={transcriptText}>
          <FileText className="mt-px size-3 shrink-0" />
          {transcriptText.slice(0, 200)}
          {transcriptText.length > 200 ? '…' : ''}
        </p>
      )}
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
        <Bot className="size-4 text-violet-400" />
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
