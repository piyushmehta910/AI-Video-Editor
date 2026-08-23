import * as React from 'react'
import { Bot, Check, ListChecks, Send, Sparkles, User, X } from 'lucide-react'
import { useAIStore } from '@/stores/aiStore'
import type { AiDirectorApi } from '@/hooks/useAIDirector'
import { ActionPreview } from './ActionPreview'

const QUICK_PROMPTS = [
  'Make this better',
  'Remove silent parts',
  'Add captions to this video',
  'Make this into a 30-second short',
]

function MessageBubble({ role, text }: { role: 'user' | 'ai'; text: string }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div
          className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
            isUser ? 'bg-[#1e3a5f] text-blue-300' : 'bg-neutral-800 text-neutral-400'
          }`}
        >
          {isUser ? <User className="size-3" /> : <Bot className="size-3" />}
        </div>
        <div
          className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${
            isUser ? 'rounded-tr-sm bg-[#1e3a5f] text-neutral-100' : 'rounded-tl-sm bg-[#2a2a3e] text-neutral-200'
          }`}
          data-testid={isUser ? 'chat-user-message' : 'chat-ai-message'}
        >
          {text}
        </div>
      </div>
    </div>
  )
}

export function ChatInterface({ director }: { director: AiDirectorApi }) {
  const messages = useAIStore((s) => s.messages)
  const busy = useAIStore((s) => s.busy)
  const pendingPlan = useAIStore((s) => s.pendingPlan)
  const pendingQuestion = useAIStore((s) => s.pendingQuestion)
  const proposals = useAIStore((s) => s.proposals)

  const [input, setInput] = React.useState('')
  const [answer, setAnswer] = React.useState('')
  const [showReview, setShowReview] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, busy, pendingPlan, pendingQuestion])

  const submit = () => {
    if (!input.trim() || busy) return
    void director.send(input.trim())
    setInput('')
  }

  const pendingCount = proposals.filter((p) => p.status === 'pending').length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* History */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" data-testid="chat-history">
        {messages.length === 0 && !busy && (
          <div className="space-y-1.5 pt-1">
            <p className="px-1 text-[11px] text-neutral-500">Try one of these, or type anything about your project:</p>
            {QUICK_PROMPTS.map((s) => (
              <button
                key={s}
                onClick={() => void director.send(s)}
                className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-[#2a2a3e]/50 px-2.5 py-1.5 text-left text-[11px] text-neutral-300 transition hover:border-violet-500/40 hover:bg-violet-500/5"
              >
                <Sparkles className="size-3 shrink-0 text-neutral-500" />
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className="space-y-1.5">
            <MessageBubble role={m.role} text={m.text} />
            {m.reasoning && m.role === 'ai' && (
              <p className="ml-9 rounded-md bg-neutral-900/60 px-2 py-1 text-[10px] italic leading-relaxed text-neutral-500">
                {m.reasoning}
              </p>
            )}
            {m.review && m.review.length > 0 && (
              <div className="ml-9 flex flex-wrap gap-1">
                <button
                  onClick={() => void Promise.resolve(director.applyAllFixes())}
                  className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-500"
                >
                  <Check className="size-3" /> Apply All ({m.review.filter((i) => i.fix.kind !== 'none').length})
                </button>
                <button
                  onClick={() => setShowReview((v) => !v)}
                  className="rounded-md border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-800"
                >
                  <ListChecks className="mr-1 inline size-3" />
                  Review Changes
                </button>
                <button
                  onClick={() => m.review?.forEach((i) => director.dismissIssueForever(i))}
                  className="rounded-md border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-800"
                >
                  Ignore
                </button>
              </div>
            )}
            {m.followups && m.followups.length > 0 && (
              <div className="ml-9 flex flex-wrap gap-1">
                {m.followups.map((f) => (
                  <button
                    key={f}
                    disabled={busy}
                    onClick={() => void director.send(f)}
                    className="rounded-full border border-violet-500/30 bg-violet-500/5 px-2 py-0.5 text-[10px] text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-50"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Staged plan diff */}
        {pendingPlan && (
          <ActionPreview
            plan={pendingPlan.plan}
            before={pendingPlan.before}
            onConfirm={() => void director.confirmPlan()}
            onRevise={(revision) => director.revisePlan(revision)}
            onDiscard={() => director.revisePlan()}
          />
        )}

        {/* Pending proposal chips */}
        {!pendingPlan && showReview && proposals.some((p) => p.status === 'pending') && (
          <div className="ml-9 space-y-1 rounded-lg border border-neutral-800 bg-neutral-900/70 p-2">
            {proposals
              .filter((p) => p.status === 'pending')
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[11px] text-neutral-300">
                  <span className={`size-1.5 shrink-0 rounded-full ${p.destructive ? 'bg-red-400' : 'bg-cyan-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  <button
                    onClick={() => void director.applyOne(p.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-emerald-400 hover:bg-neutral-800"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => director.discardOne(p.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-neutral-800"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* ask_user prompt */}
        {pendingQuestion && (
          <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold text-violet-300">The director needs to know:</p>
            <p className="mb-2 text-xs text-neutral-200">{pendingQuestion}</p>
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && answer.trim()) director.submitAnswer(answer.trim())
                }}
                placeholder="Type your answer…"
                className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-violet-500"
              />
              <button
                onClick={() => answer.trim() && director.submitAnswer(answer.trim())}
                disabled={!answer.trim()}
                className="rounded-lg bg-violet-600 px-2.5 text-white hover:bg-violet-500 disabled:opacity-50"
                aria-label="Send answer"
              >
                <Send className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 pl-1" aria-live="polite" data-testid="ai-busy-indicator">
            <Bot className="size-4 shrink-0 animate-pulse text-neutral-400" />
            <div className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-500" />
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:0.2s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 p-2.5">
        {pendingCount > 0 && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="flex-1 text-[10px] text-neutral-500">
              {pendingCount} pending change{pendingCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowReview(true)}
              className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-800"
            >
              Review Changes
            </button>
            <button
              onClick={director.discardAll}
              className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-800"
            >
              Ignore All
            </button>
            <button
              data-testid="apply-all-button"
              onClick={() => void Promise.resolve(director.applyAll())}
              className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-500"
            >
              Apply All ({pendingCount})
            </button>
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="Type instruction…"
            data-testid="ai-chat-input"
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-violet-500"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || busy}
            data-testid="ai-chat-send"
            className="rounded-lg bg-blue-600 px-3 text-white transition hover:bg-blue-500 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
