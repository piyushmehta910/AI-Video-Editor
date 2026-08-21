import * as React from 'react'
import { Bot, Check, ListChecks, MessageSquare, Send, Settings, Sparkles, Trash2, User, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import { chatCompletion, getDirectorProvider, getProjectContextSystemPrompt, type ChatMessage } from '@/api/llm/director'
import {
  DIRECTOR_TOOLS,
  applyTool,
  canonicalTool,
  describeTool,
  isStagedTool,
} from '@/api/llm/tools'
import { buildDirectorContext, collectTimelineScenes } from '@/api/llm/context'
import { checkTimeline, type QualityIssue } from '@/ai/quality/checker'
import {
  applyPlan,
  normalizePlan,
  qualityNotes,
  runQualityReview,
  type EditPlan,
} from '@/api/llm/plan'
import { loadAskedQuestions, rememberAskedQuestion } from '@/api/llm/askedQuestions'
import { Button } from '@/components/ui/button'

interface UiMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  tools?: string[]
  proposed?: boolean
  followups?: string[]
  review?: QualityIssue[] | null
}

interface Proposal {
  id: string
  name: string
  args: Record<string, unknown>
  label: string
  status: 'pending' | 'applied' | 'failed' | 'discarded'
  message?: string
}

interface PendingPlan {
  plan: EditPlan
  status: 'pending' | 'applied' | 'failed'
}

const SUGGESTIONS = [
  'Reframe this project to a vertical Reel (9:16)',
  'Add captions to this video',
  'Remove silent parts',
  'Make this into a 30-second short',
  'Make this better',
]

const FOLLOWUP_SUGGESTIONS: Record<string, string[]> = {
  search_stock_image: ['Add a stock image for the intro', 'Search for background music', 'Add captions'],
  search_music: ['Search for another music track', 'Adjust music volume', 'Add captions'],
  generate_captions: ['Style the captions bold', 'Add a stock image', 'Generate a voiceover'],
  add_caption: ['Style the captions', 'Add a stock image', 'Generate a voiceover'],
  generate_voiceover: ['Generate a longer voiceover', 'Search for music', 'Add captions'],
  duplicate_clip: ['Duplicate another clip', 'Trim the duplicate', 'Add a transition'],
  generate_transcript: ['Add captions from the transcript', 'Remove silent parts', 'Summarize the content'],
  understand_video: ['Add captions from the transcript', 'Remove silent parts', 'Summarize the content'],
  review_project: ['Fix all issues', 'Make this into a 30-second short', 'Add captions'],
  default: ['Add captions', 'Search for music', 'Search for a stock image'],
}

function suggestFollowups(usedTools: string[]): string[] {
  const picks = new Set<string>()
  for (const t of usedTools) {
    const list = FOLLOWUP_SUGGESTIONS[t] || FOLLOWUP_SUGGESTIONS.default
    for (const s of list) picks.add(s)
    if (picks.size >= 3) break
  }
  return [...picks].slice(0, 3)
}

const MAX_PROPOSALS = 20

const ISSUE_STYLE: Record<QualityIssue['severity'], string> = {
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'border-muted bg-muted/40 text-muted-foreground',
}

export function AIDirector({ initialPrompt }: { initialPrompt?: string }) {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<UiMessage[]>([])
  const [busy, setBusy] = React.useState(false)
  const [proposals, setProposals] = React.useState<Proposal[]>([])
  const [showQuality, setShowQuality] = React.useState(false)
  const [issues, setIssues] = React.useState<QualityIssue[]>([])
  const [checking, setChecking] = React.useState(false)
  const [plan, setPlan] = React.useState<PendingPlan | null>(null)
  const [pendingQuestion, setPendingQuestion] = React.useState<string | null>(null)
  const [questionAnswer, setQuestionAnswer] = React.useState('')
  const [revising, setRevising] = React.useState(false)
  const [reviseInput, setReviseInput] = React.useState('')
  const [askedQuestions, setAskedQuestions] = React.useState<string[]>([])
  // @ts-expect-error - Used in JSX but TypeScript doesn't detect it
  const [confirmAction, setConfirmAction] = React.useState<{ toolName: string; args: Record<string, unknown>; onConfirm: () => void } | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const pendingAnswerRef = React.useRef<((answer: string) => void) | null>(null)

  const hydrateTimeline = useTimelineStore((s) => s.hydrate)
  const hydrateConfig = useApiConfigStore((s) => s.hydrate)
  const configHydrated = useApiConfigStore((s) => s.hydrated)
  const timelineHydrated = useTimelineStore((s) => s.hydrated)
  const projectId = useTimelineStore((s) => s.project.id)

  React.useEffect(() => {
    void hydrateTimeline()
    void hydrateConfig()
  }, [hydrateTimeline, hydrateConfig])

  React.useEffect(() => {
    if (timelineHydrated) setAskedQuestions(loadAskedQuestions(projectId))
  }, [timelineHydrated, projectId])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const runQualityCheck = React.useCallback(async () => {
    setChecking(true)
    try {
      const store = useTimelineStore.getState()
      const scenes = await collectTimelineScenes()
      setIssues(checkTimeline(store.project, store.assets, { scenes }))
    } finally {
      setChecking(false)
    }
  }, [])

  /** Prompt the user for the answer to an AI question and resolve with it. */
  const promptQuestion = React.useCallback((question: string): Promise<string> => {
    return new Promise((resolve) => {
      pendingAnswerRef.current = resolve
      setQuestionAnswer('')
      setPendingQuestion(question)
    })
  }, [])

  const submitAnswer = () => {
    const answer = questionAnswer.trim()
    if (!answer || !pendingAnswerRef.current) return
    const resolve = pendingAnswerRef.current
    pendingAnswerRef.current = null
    setPendingQuestion(null)
    resolve(answer)
  }

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setInput('')
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
      setBusy(true)
      try {
        const provider = getDirectorProvider()
        if (!provider) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'ai',
              text: 'No AI provider is configured yet. Add an API key for NVIDIA NIM, OpenCode Zen or OpenRouter in Settings, then I can help you edit.',
              tools: [],
            },
          ])
          return
        }

        const confirmationLevel = useApiConfigStore.getState().config.preferences.confirmationLevel
        const autoApply = confirmationLevel === 'none'

        const baseSystem = getProjectContextSystemPrompt(askedQuestions)
        let understanding = ''
        try {
          understanding = await buildDirectorContext()
        } catch {
          understanding = ''
        }

        const apiMessages: ChatMessage[] = [
          { role: 'system', content: understanding ? `${baseSystem}\n\n${understanding}` : baseSystem },
        ]
        for (const m of messages) {
          apiMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
        }
        apiMessages.push({ role: 'user', content: trimmed })

        let finalText = ''
        const usedTools: string[] = []
        const proposedTools: string[] = []
        let stagedCount = 0
        let appliedThisTurn = false
        let reviewIssues: QualityIssue[] | null = null
        let reviewDone = false
        let pendingPlan: EditPlan | null = null
        let planned = false
        let loops = 0
        while (loops < 6) {
          loops++
          const reply = await chatCompletion(provider, apiMessages, DIRECTOR_TOOLS)
          apiMessages.push(reply)
          if (!reply.tool_calls?.length) {
            if (reply.content) {
              finalText = reply.content
              break
            }
            loops++
            continue
          }

          planned = false
          let asked = false
          for (const tc of reply.tool_calls) {
            const name = canonicalTool(tc.name)
            if (name === 'plan_edit') {
              const p = normalizePlan(tc.arguments)
              if (p) {
                pendingPlan = p
                setPlan({ plan: p, status: 'pending' })
                planned = true
                apiMessages.push({ role: 'tool', content: `Plan staged for approval: ${p.goal}`, tool_call_id: tc.id })
              } else {
                apiMessages.push({
                  role: 'tool',
                  content: 'The proposed plan was invalid (unknown tool or bad arguments). Re-plan with valid tool actions.',
                  tool_call_id: tc.id,
                })
              }
              break
            } else if (name === 'ask_user') {
              const q = String(tc.arguments.question ?? '').trim()
              if (q && !askedQuestions.includes(q)) {
                const next = rememberAskedQuestion(projectId, q)
                setAskedQuestions(next)
                const answer = await promptQuestion(q)
                apiMessages.push({ role: 'tool', content: `User answered: ${answer}`, tool_call_id: tc.id })
                asked = true
              } else {
                apiMessages.push({
                  role: 'tool',
                  content: 'You already asked that question in this project. Make your best guess instead.',
                  tool_call_id: tc.id,
                })
              }
            } else if (name === 'review_project') {
              const found = await runQualityReview()
              setIssues(found)
              setShowQuality(true)
              reviewIssues = found
              reviewDone = true
              const msg = found.length
                ? found.map((i) => `- [${i.severity}] ${i.message}${i.fix.kind !== 'none' ? ` (${i.fix.label})` : ''}`).join('\n')
                : 'The project looks clean — no improvements needed right now.'
              apiMessages.push({ role: 'tool', content: msg, tool_call_id: tc.id })
            } else if (isStagedTool(name)) {
              if (autoApply) {
                const result = await applyTool(name, tc.arguments)
                appliedThisTurn = true
                usedTools.push(name)
                apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
              } else if (stagedCount < MAX_PROPOSALS) {
                const label = describeTool(name, tc.arguments)
                if (label) {
                  stagedCount++
                  proposedTools.push(name)
                  setProposals((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), name, args: tc.arguments, label, status: 'pending' },
                  ])
                  apiMessages.push({
                    role: 'tool',
                    content: `Staged for user review (not yet applied): ${label}`,
                    tool_call_id: tc.id,
                  })
                } else {
                  apiMessages.push({
                    role: 'tool',
                    content: 'Invalid arguments for that action; do not call it again.',
                    tool_call_id: tc.id,
                  })
                }
              } else {
                apiMessages.push({
                  role: 'tool',
                  content: `Too many pending actions (max ${MAX_PROPOSALS}). The user must approve or discard pending actions before more can be staged.`,
                  tool_call_id: tc.id,
                })
              }
            } else {
              const result = await applyTool(name, tc.arguments)
              usedTools.push(name)
              apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
            }
          }
          if (planned) break
          if (asked) continue
          if (reviewDone) break
          loops++
        }

        if (pendingPlan) {
          finalText = `Here's my plan for "${pendingPlan.goal}" — approve it to apply the edits, or tell me what to change.`
        }
        if (reviewDone) {
          finalText =
            reviewIssues && reviewIssues.length
              ? `${reviewIssues.length} improvement${reviewIssues.length > 1 ? 's' : ''} available — use Fix All or review the changes below.`
              : 'The project looks clean — no improvements needed right now.'
        }
        if (!finalText && usedTools.length) {
          finalText = `Done — applied ${usedTools.join(', ')}.`
        }
        if (!finalText && stagedCount > 0) {
          finalText = `I've proposed ${stagedCount} change${stagedCount > 1 ? 's' : ''} — review ${
            stagedCount > 1 ? 'them' : 'it'
          } above before it takes effect.`
        }
        if (!finalText) finalText = 'I could not complete that request. Please rephrase it.'

        let notes: string[] = []
        if (appliedThisTurn) {
          const found = await runQualityReview()
          setIssues(found)
          notes = qualityNotes(found)
          if (notes.length) {
            finalText += `\n\nQuality notes after my edits:\n${notes.map((n) => `- ${n}`).join('\n')}`
          }
        }
        if (reviewIssues && reviewIssues.length) {
          finalText += `\n\n${reviewIssues.length} improvement${reviewIssues.length > 1 ? 's' : ''} available — use Fix All or review the changes below.`
        }

        const isPlan = pendingPlan !== null
        const followups = suggestFollowups(
          pendingPlan
            ? pendingPlan.actions.map((a) => a.tool)
            : usedTools.length
              ? usedTools
              : proposedTools,
        )
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: finalText,
            tools: pendingPlan
              ? pendingPlan.actions.map((a) => a.tool)
              : proposedTools.length
                ? proposedTools
                : usedTools.length
                  ? usedTools
                  : undefined,
            proposed: isPlan || (!autoApply && proposedTools.length > 0),
            followups,
            review: reviewIssues,
          },
        ])
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: `Something went wrong: ${err instanceof Error ? err.message : String(err)}`,
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [busy, messages, askedQuestions, projectId, promptQuestion],
  )

  React.useEffect(() => {
    if (!open || !initialPrompt) return
    if (!timelineHydrated || !configHydrated) return
    const p = initialPrompt
    setOpen(true)
    void send(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, timelineHydrated, configHydrated])

  const applyOne = async (id: string) => {
    const target = proposals.find((p) => p.id === id)
    if (!target || target.status !== 'pending') return

    // Check if the tool is destructive and requires confirmation
    const toolDef = DIRECTOR_TOOLS.find((t) => t.function.name === target.name)
    const isDestructive = toolDef?.function.destructive === true

    if (isDestructive) {
      setConfirmAction({
        toolName: target.name,
        args: target.args,
        onConfirm: async () => {
          const store = useTimelineStore.getState()
          store.withTransaction(() => {
            void (async () => {
              const result = await applyTool(target.name, target.args, { undoStep: false })
              setProposals((prev) =>
                prev.map((p) => (p.id === id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p)),
              )
              void refreshQualityAfterEdit()
            })()
          })
        },
      })
      return
    }

    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      void (async () => {
        const result = await applyTool(target.name, target.args, { undoStep: false })
        setProposals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p)),
        )
        void refreshQualityAfterEdit()
      })()
    })
  }

  const applyAll = () => {
    const pending = proposals.filter((p) => p.status === 'pending')
    if (!pending.length) return
    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      for (const target of pending) {
        void (async () => {
          const result = await applyTool(target.name, target.args, { undoStep: false })
          setProposals((prev) =>
            prev.map((p) =>
              p.id === target.id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p,
            ),
          )
        })()
      }
      void refreshQualityAfterEdit()
    })
  }

  const refreshQualityAfterEdit = React.useCallback(async () => {
    const found = await runQualityReview()
    setIssues(found)
    if (found.length) setShowQuality(true)
  }, [])

  const approvePlan = async () => {
    if (!plan || plan.status !== 'pending') return
    setPlan({ ...plan, status: 'applied' })
    try {
      const result = await applyPlan(plan.plan)
      let text = `Applied ${result.applied.length} change${result.applied.length !== 1 ? 's' : ''}:`
      text +=
        '\n' +
        result.applied.map((a) => `- ${a.label}${a.reason ? ` — ${a.reason}` : ''}`).join('\n')
      if (result.skipped.length) {
        text += `\nSkipped ${result.skipped.length} (no longer valid): ${result.skipped.map((s) => s.label).join(', ')}`
      }
      const found = await runQualityReview()
      setIssues(found)
      const notes = qualityNotes(found)
      if (notes.length) {
        text += `\n\nQuality notes after my edits:\n${notes.map((n) => `- ${n}`).join('\n')}`
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          text,
          tools: plan.plan.actions.map((a) => a.tool),
        },
      ])
    } catch (err) {
      setPlan({ ...plan, status: 'failed' })
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          text: `Applying the plan failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ])
    }
  }

  const startRevise = () => {
    setRevising(true)
    setReviseInput('')
  }

  const submitRevise = () => {
    const revised = reviseInput.trim()
    setRevising(false)
    setPlan(null)
    if (revised) void send(revised)
  }

  const discardOne = (id: string) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'discarded' } : p)))
  }

  const discardAll = () => {
    setProposals((prev) => prev.map((p) => (p.status === 'pending' ? { ...p, status: 'discarded' } : p)))
  }

  const clearResolved = () => {
    setProposals((prev) => prev.filter((p) => p.status === 'pending'))
  }

  const pendingCount = proposals.filter((p) => p.status === 'pending').length
  const resolvedCount = proposals.length - pendingCount

  const applyIssueFix = (issue: QualityIssue) => {
    if (issue.fix.kind === 'none') return
    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      if (issue.fix.kind === 'remove_clip') {
        store.deleteClips(issue.fix.clipIds)
      } else if (issue.fix.kind === 'resolve_overlap' && issue.fix.moveClipId && issue.fix.targetTime != null) {
        const clip = store.project.tracks
          .flatMap((t) => t.clips)
          .find((c) => c.id === issue.fix.moveClipId)
        if (!clip) return
        const delta = issue.fix.targetTime - clip.startTime
        if (Math.abs(delta) >= 0.01) store.moveClip(clip.id, delta)
      }
    })
    void refreshQualityAfterEdit()
  }

  const applyAllFixes = () => {
    const fixable = issues.filter((i) => i.fix.kind !== 'none')
    if (!fixable.length) return
    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      for (const issue of fixable) {
        if (issue.fix.kind === 'remove_clip') {
          store.deleteClips(issue.fix.clipIds)
        } else if (issue.fix.kind === 'resolve_overlap' && issue.fix.moveClipId && issue.fix.targetTime != null) {
          const clip = store.project.tracks
            .flatMap((t) => t.clips)
            .find((c) => c.id === issue.fix.moveClipId)
          if (!clip) continue
          const delta = issue.fix.targetTime - clip.startTime
          if (Math.abs(delta) >= 0.01) store.moveClip(clip.id, delta)
        }
      }
    })
    void refreshQualityAfterEdit()
  }

  const fixableCount = issues.filter((i) => i.fix.kind !== 'none').length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-5 bottom-20 z-50 flex size-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-2xl shadow-violet-600/30 transition-all hover:bg-violet-500 md:bottom-5"
        aria-label="AI Director"
      >
        {open ? <X className="size-6" /> : <Bot className="size-7" />}
      </button>

      {open && (
        <div className="fixed right-5 bottom-[5.5rem] z-50 flex h-[560px] max-h-[70svh] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl md:bottom-24">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">AI Director</h3>
              <p className="text-muted-foreground truncate text-[11px]">
                Proposes edits — you approve them before they apply
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowQuality((s) => !s)
                if (!checking && issues.length === 0) void runQualityCheck()
              }}
              className={`text-muted-foreground hover:text-foreground ${showQuality ? 'text-violet-600 dark:text-violet-400' : ''}`}
              title="Check project quality"
              aria-label="Check project quality"
            >
              <ListChecks className="size-4" />
            </button>
            <Link to="/settings" className="ml-auto text-muted-foreground hover:text-foreground" title="Configure AI provider">
              <Settings className="size-4" />
            </Link>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && !busy && (
              <div className="space-y-3 pt-2">
                <p className="text-muted-foreground text-xs">
                  Try one of these, or type anything about your project:
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-left text-xs transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
                  >
                    <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {plan && plan.status === 'pending' && (
              <div className="space-y-2 rounded-xl border border-violet-500/40 bg-violet-500/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
                  <Bot className="size-3.5" />
                  Proposed plan — nothing has been changed yet
                </div>
                <p className="text-sm font-medium">{plan.plan.goal}</p>
                {plan.plan.scenesAffected.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Affects: {plan.plan.scenesAffected.join(', ')}
                  </div>
                )}
                <div className="space-y-1.5">
                  {plan.plan.actions.map((a, i) => (
                    <div key={i} className="flex gap-2 rounded-md border border-violet-500/20 bg-background/60 px-2 py-1.5 text-xs">
                      <span className="mt-0.5 size-4 shrink-0 rounded-full bg-violet-600/15 text-center text-[10px] leading-4 text-violet-600 dark:text-violet-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{describeTool(a.tool, a.arguments)}</div>
                        {a.reason && <div className="text-muted-foreground">Why: {a.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {revising ? (
                  <div className="space-y-1.5">
                    <input
                      autoFocus
                      value={reviseInput}
                      onChange={(e) => setReviseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRevise()
                      }}
                      placeholder="What should change? (e.g. 'instead, trim the start')"
                      className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:border-violet-500"
                    />
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={submitRevise}>
                        Send revision
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRevising(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={() => void approvePlan()}>
                      <Check className="size-3" />
                      Approve plan
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={startRevise}>
                      Revise
                    </Button>
                  </div>
                )}
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {m.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>
                <div className={`max-w-[80%] space-y-1.5 ${m.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${
                      m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-muted text-foreground'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.tools && m.tools.length > 0 && (
                    <div className="text-muted-foreground text-[10px]">
                      {m.proposed ? 'Proposed' : 'Used'}: {m.tools.join(', ')}
                    </div>
                  )}
                  {m.review && m.review.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <Button type="button" size="sm" className="h-6 px-2 text-[11px]" onClick={applyAllFixes}>
                        <Check className="size-3" />
                        Fix All ({m.review.filter((i) => i.fix.kind !== 'none').length})
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setShowQuality(true)}>
                        Review Changes
                      </Button>
                    </div>
                  )}
                  {m.followups && m.followups.length > 0 && (
                    <div className="flex flex-wrap justify-start gap-1 pt-0.5">
                      {m.followups.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => void send(f)}
                          disabled={busy}
                          className="rounded-full border border-violet-500/30 bg-violet-500/5 px-2.5 py-1 text-[11px] text-violet-600 transition-colors hover:bg-violet-500/15 disabled:opacity-50 dark:text-violet-400"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pendingQuestion && (
              <div className="space-y-2 rounded-xl border border-violet-500/40 bg-violet-500/5 p-3">
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">The director needs to know:</p>
                <p className="text-sm">{pendingQuestion}</p>
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={questionAnswer}
                    onChange={(e) => setQuestionAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitAnswer()
                    }}
                    placeholder="Type your answer…"
                    className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:border-violet-500"
                  />
                  <Button size="sm" className="h-8" onClick={submitAnswer} disabled={!questionAnswer.trim()} aria-label="Send answer">
                    <Send className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {busy && (
              <div className="flex gap-2" aria-live="polite" aria-atomic="true" aria-label="AI Director status">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                  <Bot className="size-3.5" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2" role="status">
                  <div className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-current" aria-hidden="true" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.1s]" aria-hidden="true" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.2s]" aria-hidden="true" />
                  </div>
                  <span className="sr-only">AI Director is thinking</span>
                </div>
              </div>
            )}
          </div>

          {showQuality && (
            <div className="border-t border-amber-500/30 bg-amber-500/5" aria-live="polite" aria-atomic="true" aria-label="Quality check status">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <ListChecks className="size-3.5" />
                  {checking
                    ? 'Checking…'
                    : issues.length
                      ? `${issues.length} issue${issues.length > 1 ? 's' : ''} found`
                      : 'No issues found — timeline looks clean'}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {!checking && (
                    <>
                      {fixableCount > 0 && (
                        <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={applyAllFixes}>
                          Fix all ({fixableCount})
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => void runQualityCheck()}>
                        Re-check
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {issues.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto px-3 pb-2.5">
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${ISSUE_STYLE[issue.severity]}`}
                    >
                      <span className="min-w-0 flex-1">{issue.message}</span>
                      {issue.fix.kind !== 'none' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 shrink-0 px-2 text-xs"
                          onClick={() => applyIssueFix(issue)}
                        >
                          <Check className="size-3" />
                          {issue.fix.kind === 'remove_clip' ? 'Remove' : 'Fix'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {proposals.length > 0 && (
            <div className="border-t border-violet-500/30 bg-violet-500/5" aria-live="polite" aria-atomic="true" aria-label="AI Director proposals">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                  <Bot className="size-3.5" />
                  {pendingCount > 0 ? `${pendingCount} proposed change${pendingCount > 1 ? 's' : ''} awaiting review` : 'No pending changes'}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {pendingCount > 0 && (
                    <>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={discardAll}>
                        Discard all
                      </Button>
                      <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={applyAll}>
                        Apply all ({pendingCount})
                      </Button>
                    </>
                  )}
                  {resolvedCount > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearResolved}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto px-3 pb-2.5">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                      p.status === 'applied'
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : p.status === 'failed'
                          ? 'border-destructive/40 bg-destructive/10'
                          : p.status === 'discarded'
                            ? 'border-muted bg-muted/30 opacity-60'
                            : 'border-violet-500/40 bg-violet-500/10'
                    }`}
                  >
                    {p.status === 'applied' ? (
                      <Check className="size-3.5 shrink-0 text-emerald-500" />
                    ) : p.status === 'failed' || p.status === 'discarded' ? (
                      <X className="size-3.5 shrink-0 text-destructive" />
                    ) : (
                      <Bot className="size-3.5 shrink-0 text-violet-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate" title={p.label}>
                      {p.label}
                      {p.status !== 'pending' && p.message && (
                        <span className="text-muted-foreground ml-1 truncate text-[10px]">— {p.message}</span>
                      )}
                    </span>
                    {p.status === 'pending' && (
                      <>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => discardOne(p.id)}>
                          <Trash2 className="size-3" />
                          Discard
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => applyOne(p.id)}>
                          <Check className="size-3" />
                          Apply
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t p-3">
            <div className="mb-2 flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-[11px]"
                disabled={busy}
                onClick={() =>
                  void send(
                    'Auto-pilot: understand the current media, analyze the video (transcribe audio if needed, read on-screen text), then plan and apply the best edit — pacing, transitions, captions, music or images where they help. Ask me only if a decision is truly blocking.',
                  )
                }
              >
                <Sparkles className="mr-1 size-3" />
                Auto-Pilot
              </Button>
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send(input)
                }}
                placeholder="Tell the director what to do…"
                className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-violet-500"
              />
              <Button size="icon" onClick={() => void send(input)} disabled={!input.trim() || busy} aria-label="Send">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}