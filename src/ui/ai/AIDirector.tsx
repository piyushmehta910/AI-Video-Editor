import * as React from 'react'
import { Bot, MessageSquare, Send, Settings, X, User } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import { chatCompletion, getDirectorProvider, getProjectContextSystemPrompt, type ChatMessage } from '@/api/llm/director'
import { DIRECTOR_TOOLS, executeTool } from '@/api/llm/tools'
import { Button } from '@/components/ui/button'

interface UiMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  tools?: string[]
}

const SUGGESTIONS = [
  'Reframe this project to a vertical Reel (9:16)',
  'Add captions to this video',
  'Remove silent parts',
  'Make this into a 30-second short',
]

export function AIDirector({ initialPrompt }: { initialPrompt?: string }) {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<UiMessage[]>([])
  const [busy, setBusy] = React.useState(false)
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
              text: 'No AI provider is configured yet. Add an API key for NVIDIA NIM or OpenCode Zen in Settings, then I can help you edit.',
              tools: [],
            },
          ])
          return
        }

        const apiMessages: ChatMessage[] = [
          { role: 'system', content: getProjectContextSystemPrompt() },
        ]
        for (const m of messages) {
          apiMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
        }
        apiMessages.push({ role: 'user', content: trimmed })

        let finalText = ''
        const usedTools: string[] = []
        let loops = 0
        while (loops < 6) {
          const reply = await chatCompletion(provider, apiMessages, DIRECTOR_TOOLS)
          apiMessages.push(reply)
          if (reply.tool_calls?.length) {
            for (const tc of reply.tool_calls) {
              usedTools.push(tc.name)
              const result = executeTool(tc.name, tc.arguments)
              apiMessages.push({ role: 'tool', content: result, tool_call_id: tc.id })
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
        if (!finalText) finalText = 'I could not complete that request. Please rephrase it.'
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'ai', text: finalText, tools: usedTools },
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
              <p className="text-muted-foreground truncate text-[11px]">Describe an edit, I’ll use the timeline tools</p>
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
                      Used: {m.tools.join(', ')}
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