import * as React from 'react'
import { Bot, Check, MessageSquare, Send, Settings, Trash2, X, User } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import { chatCompletion, getDirectorProvider, getProjectContextSystemPrompt, type ChatMessage } from '@/api/llm/director'
import { DIRECTOR_TOOLS, applyTool, describeTool, isStagedTool } from '@/api/llm/tools'
import { buildProjectUnderstanding } from '@/api/llm/understanding'
import { Button } from '@/components/ui/button'

interface UiMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  tools?: string[]
  proposed?: boolean
  followups?: string[]
}

interface Proposal {
  id: string
  name: string
  args: Record<string, unknown>
  label: string
  status: 'pending' | 'applied' | 'failed' | 'discarded'
  message?: string
}

const SUGGESTIONS = [
  'Reframe this project to a vertical Reel (9:16)',
  'Add captions to this video',
  'Remove silent parts',
  'Make this into a 30-second short',
]

const FOLLOWUP_SUGGESTIONS: Record<string, string[]> = {
  search_stock_image: ['Add a stock image for the intro', 'Search for background music', 'Add captions'],
  search_music: ['Search for another music track', 'Adjust music volume', 'Add captions'],
  generate_captions: ['Style the captions bold', 'Add a stock image', 'Generate a voiceover'],
  generate_voiceover: ['Generate a longer voiceover', 'Search for music', 'Add captions'],
  denoise_clip: ['Denoise another clip', 'Add music', 'Add captions'],
  duplicate_clip: ['Duplicate another clip', 'Trim the duplicate', 'Add a transition'],
  generate_transcript: ['Add captions from the transcript', 'Remove silent parts', 'Summarize the content'],
  understand_video: ['Add captions from the transcript', 'Remove silent parts', 'Summarize the content'],
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

export function AIDirector({ initialPrompt }: { initialPrompt?: string }) {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<UiMessage[]>([])
  const [busy, setBusy] = React.useState(false)
  const [proposals, setProposals] = React.useState<Proposal[]>([])
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const hydrateTimeline = useTimelineStore((s) => s.hydrate)
  const hydrateConfig = useApiConfigStore((s) => s.hydrate)
  const configHydrated = useApiConfigStore((s) => s.hydrated)
  const timelineHydrated = useTimelineStore((s) => s.hydrated)

  React.useEffect(() => {
    void hydrateTimeline()
    void hydrateConfig()
  }, [hydrateTimeline, hydrateConfig])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

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

        // "Fully Automatic" confirmation level applies proposals immediately; otherwise changes are staged for review.
        const confirmationLevel = useApiConfigStore.getState().config.preferences.confirmationLevel
        const autoApply = confirmationLevel === 'none'

        const baseSystem = getProjectContextSystemPrompt()
        let understanding = ''
        try {
          understanding = await buildProjectUnderstanding()
        } catch {
          understanding = ''
        }

        const apiMessages: ChatMessage[] = [
          {
            role: 'system',
            content: understanding
              ? `${baseSystem}\n\nVIDEO UNDERSTANDING (from a local transcript, so trust it):\n${understanding}`
              : baseSystem,
          },
        ]
        for (const m of messages) {
          apiMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
        }
        apiMessages.push({ role: 'user', content: trimmed })

        let finalText = ''
        const usedTools: string[] = []
        const proposedTools: string[] = []
        let stagedCount = 0
        let loops = 0
        while (loops < 6) {
          const reply = await chatCompletion(provider, apiMessages, DIRECTOR_TOOLS)
          apiMessages.push(reply)
          if (reply.tool_calls?.length) {
            for (const tc of reply.tool_calls) {
              if (isStagedTool(tc.name)) {
                if (autoApply) {
                  const result = await applyTool(tc.name, tc.arguments)
                  usedTools.push(tc.name)
                  apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
                } else if (stagedCount < MAX_PROPOSALS) {
                  const label = describeTool(tc.name, tc.arguments)
                  if (label) {
                    stagedCount++
                    proposedTools.push(tc.name)
                    setProposals((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), name: tc.name, args: tc.arguments, label, status: 'pending' },
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
                const result = await applyTool(tc.name, tc.arguments)
                usedTools.push(tc.name)
                apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
              }
            }
            loops++
            continue
          }
          if (reply.content) {
            finalText = reply.content
            break
          }
          loops++
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
        const followups = suggestFollowups(usedTools.length ? usedTools : proposedTools)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: finalText,
            tools: proposedTools.length ? proposedTools : usedTools.length ? usedTools : undefined,
            proposed: !autoApply && proposedTools.length > 0,
            followups,
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
    [busy, messages],
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
    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      void (async () => {
        const result = await applyTool(target.name, target.args)
        setProposals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p)),
        )
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
          const result = await applyTool(target.name, target.args)
          setProposals((prev) =>
            prev.map((p) =>
              p.id === target.id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p,
            ),
          )
        })()
      }
    })
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-5 bottom-5 z-50 flex size-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-2xl shadow-violet-600/30 transition-all hover:bg-violet-500"
        aria-label="AI Director"
      >
        {open ? <X className="size-6" /> : <Bot className="size-7" />}
      </button>

      {open && (
        <div className="fixed right-5 bottom-24 z-50 flex h-[560px] max-h-[70svh] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
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

            {busy && (
              <div className="flex gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bot className="size-3.5" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-current" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {proposals.length > 0 && (
            <div className="border-t border-violet-500/30 bg-violet-500/5">
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