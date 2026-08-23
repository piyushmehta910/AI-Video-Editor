import * as React from 'react'
import { useTimelineStore } from '@/stores/timelineStore'
import { useAIStore } from '@/stores/aiStore'
import { chatCompletion, getDirectorProvider, getProjectContextSystemPrompt, type ChatMessage } from '@/api/llm/director'
import { DIRECTOR_TOOLS, applyTool, canonicalTool, describeTool, isStagedTool } from '@/api/llm/tools'
import { buildDirectorContext } from '@/api/llm/context'
import type { QualityIssue } from '@/ai/quality/checker'
import { applyPlan, normalizePlan, qualityNotes, runQualityReview, type EditPlan } from '@/api/llm/plan'
import { loadAskedQuestions, rememberAskedQuestion } from '@/api/llm/askedQuestions'

/**
 * AI Director engine: owns the LLM tool loop, proposal staging and quality
 * review flow. UI components consume the actions; state lives in aiStore.
 *
 * Mode semantics:
 *  - suggest: every timeline action is staged as a proposal — nothing applies
 *    until the user approves.
 *  - edit: non-destructive actions apply immediately; destructive ones
 *    (delete/trim/move/join/ratio) still stage for explicit confirmation.
 */

const MAX_PROPOSALS = 20

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

function isDestructiveTool(name: string): boolean {
  const def = DIRECTOR_TOOLS.find((t) => t.function.name === name)
  return def?.function.destructive === true
}

/** Resolver for the ask_user tool — module-level, never enters store state. */
let pendingAnswerResolver: ((answer: string) => void) | null = null

export function useAIDirector(projectId: string) {
  const [askedQuestions, setAskedQuestions] = React.useState<string[]>([])

  React.useEffect(() => {
    setAskedQuestions(loadAskedQuestions(projectId))
  }, [projectId])

  const promptQuestion = React.useCallback((question: string): Promise<string> => {
    return new Promise((resolve) => {
      pendingAnswerResolver = resolve
      useAIStore.getState().setPendingQuestion(question)
    })
  }, [])

  const submitAnswer = React.useCallback((answer: string) => {
    const resolver = pendingAnswerResolver
    pendingAnswerResolver = null
    useAIStore.getState().setPendingQuestion(null)
    resolver?.(answer)
  }, [])

  const runQualityCheck = React.useCallback(async (): Promise<QualityIssue[]> => {
    useAIStore.getState().setAnalyzing(true)
    try {
      const found = await runQualityReview()
      useAIStore.getState().setIssues(found)
      return found
    } finally {
      useAIStore.getState().setAnalyzing(false)
    }
  }, [])

  const refreshQualityAfterEdit = React.useCallback(async () => {
    const found = await runQualityCheck()
    if (found.length === 0) return
    // Surface fresh issues as proactive suggestion cards in the chat.
    useAIStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'ai',
      text: `After my edits I noticed ${found.length} thing${found.length > 1 ? 's' : ''} worth fixing.`,
      reasoning: 'I re-checked pacing, overlaps and empty sections because edits can introduce new problems.',
      review: found,
      proposed: true,
    })
  }, [runQualityCheck])

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      const ai = useAIStore.getState()
      if (!trimmed || ai.busy) return

      ai.addMessage({ id: crypto.randomUUID(), role: 'user', text: trimmed })
      ai.setBusy(true)
      try {
        const provider = getDirectorProvider()
        if (!provider) {
          ai.addMessage({
            id: crypto.randomUUID(),
            role: 'ai',
            text: 'No AI provider is configured yet. Add an API key for NVIDIA NIM, OpenCode Zen or OpenRouter in Settings, then I can help you edit.',
          })
          return
        }

        const mode = useAIStore.getState().mode
        const editMode = mode === 'edit'

        let understanding = ''
        ai.setAnalyzing(true)
        try {
          understanding = await buildDirectorContext()
        } catch {
          understanding = ''
        } finally {
          ai.setAnalyzing(false)
        }

        const baseSystem = getProjectContextSystemPrompt(askedQuestions)
        const history = useAIStore.getState().messages.filter((m) => !m.review)
        const apiMessages: ChatMessage[] = [
          { role: 'system', content: understanding ? `${baseSystem}\n\n${understanding}` : baseSystem },
        ]
        for (const m of history.slice(-12)) {
          apiMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
        }
        apiMessages.push({ role: 'user', content: trimmed })

        let finalText = ''
        let finalReasoning: string | undefined
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
                const before = useTimelineStore.getState().project
                useAIStore.getState().stagePlan(p, structuredClone(before))
                planned = true
                apiMessages.push({
                  role: 'tool',
                  content: `Plan staged for approval: ${p.goal}`,
                  tool_call_id: tc.id,
                })
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
              const found = await runQualityCheck()
              reviewIssues = found
              reviewDone = true
              const msg = found.length
                ? found.map((i) => `- [${i.severity}] ${i.message}${i.fix.kind !== 'none' ? ` (${i.fix.label})` : ''}`).join('\n')
                : 'The project looks clean — no improvements needed right now.'
              apiMessages.push({ role: 'tool', content: msg, tool_call_id: tc.id })
            } else if (!isStagedTool(name)) {
              // Analysis / playback / read-only tools are safe everywhere.
              const result = await applyTool(name, tc.arguments)
              usedTools.push(name)
              apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
            } else {
              // Timeline-mutating or content-generating action.
              const shouldStage = !editMode || isDestructiveTool(name)
              if (!shouldStage) {
                const result = await applyTool(name, tc.arguments)
                usedTools.push(name)
                appliedThisTurn = true
                apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
              } else if (stagedCount < MAX_PROPOSALS) {
                const label = describeTool(name, tc.arguments)
                if (label) {
                  stagedCount++
                  proposedTools.push(name)
                  useAIStore.getState().stageProposal({
                    toolName: name,
                    args: tc.arguments,
                    label,
                    destructive: isDestructiveTool(name),
                  })
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
            }
          }
          if (planned) break
          if (asked) continue
          if (reviewDone) break
        }

        if (pendingPlan) {
          finalText = `Here's my plan for "${pendingPlan.goal}" — review the diff and confirm to apply it, or tell me what to change.`
        }
        if (reviewDone && !finalText) {
          finalText =
            reviewIssues && reviewIssues.length
              ? `${reviewIssues.length} improvement${reviewIssues.length > 1 ? 's' : ''} available — fix them individually below or ignore what you don't care about.`
              : 'The project looks clean — no improvements needed right now.'
        }
        if (!finalText && usedTools.length) {
          finalText = `Done — applied ${usedTools.join(', ')}.`
        }
        if (!finalText && stagedCount > 0) {
          finalText =
            mode === 'suggest'
              ? `I've suggested ${stagedCount} change${stagedCount > 1 ? 's' : ''} — nothing is applied until you approve.`
              : `I need your confirmation for ${stagedCount} destructive change${stagedCount > 1 ? 's' : ''} before applying.`
          finalReasoning =
            mode === 'suggest'
              ? 'Suggest mode keeps the timeline untouched until you approve each change.'
              : 'Destructive changes always require an explicit confirm so you never lose work accidentally.'
        }
        if (!finalText) finalText = 'I could not complete that request. Please rephrase it.'

        if (appliedThisTurn) {
          const found = await runQualityReview()
          useAIStore.getState().setIssues(found)
          const notes = qualityNotes(found)
          if (notes.length) {
            finalText += `\n\nQuality notes after my edits:\n${notes.map((n) => `- ${n}`).join('\n')}`
          }
        }

        useAIStore.getState().addMessage({
          id: crypto.randomUUID(),
          role: 'ai',
          text: finalText,
          reasoning: finalReasoning,
          tools: pendingPlan
            ? pendingPlan.actions.map((a) => a.tool)
            : proposedTools.length
              ? proposedTools
              : usedTools.length
                ? usedTools
                : undefined,
          proposed: Boolean(pendingPlan || stagedCount > 0),
          followups: suggestFollowups(
            pendingPlan ? pendingPlan.actions.map((a) => a.tool) : usedTools.length ? usedTools : proposedTools,
          ),
          review: reviewIssues,
        })
      } catch (err) {
        useAIStore.getState().addMessage({
          id: crypto.randomUUID(),
          role: 'ai',
          text: `Something went wrong: ${err instanceof Error ? err.message : String(err)}`,
        })
      } finally {
        useAIStore.getState().setBusy(false)
      }
    },
    [askedQuestions, projectId, promptQuestion, runQualityCheck],
  )

  const applyOne = React.useCallback(async (id: string) => {
    const target = useAIStore.getState().proposals.find((p) => p.id === id)
    if (!target || target.status !== 'pending') return
    const store = useTimelineStore.getState()
    store.withTransaction(
      () => {
        void (async () => {
          const result = await applyTool(target.toolName, target.args, { undoStep: false })
          useAIStore
            .getState()
            .patchProposal(id, { status: result.ok ? 'applied' : 'failed', message: result.message })
          void refreshQualityAfterEdit()
        })()
      },
      { type: 'edit', description: `AI: ${target.label}` },
    )
  }, [refreshQualityAfterEdit])

  const applyAll = React.useCallback(() => {
    const pending = useAIStore.getState().proposals.filter((p) => p.status === 'pending')
    if (!pending.length) return
    const store = useTimelineStore.getState()
    store.withTransaction(
      () => {
        for (const target of pending) {
          void (async () => {
            const result = await applyTool(target.toolName, target.args, { undoStep: false })
            useAIStore
              .getState()
              .patchProposal(target.id, { status: result.ok ? 'applied' : 'failed', message: result.message })
          })()
        }
        void refreshQualityAfterEdit()
      },
      { type: 'edit', description: `AI: applied ${pending.length} suggestion${pending.length !== 1 ? 's' : ''}` },
    )
  }, [refreshQualityAfterEdit])

  const discardOne = React.useCallback((id: string) => {
    useAIStore.getState().patchProposal(id, { status: 'discarded' })
  }, [])

  const discardAll = React.useCallback(() => {
    useAIStore.getState().discardAllProposals()
  }, [])

  const clearResolved = React.useCallback(() => {
    useAIStore.getState().clearResolvedProposals()
  }, [])

  const applyIssueFix = React.useCallback(
    (issue: QualityIssue) => {
      if (issue.fix.kind === 'none') return
      const store = useTimelineStore.getState()
      store.withTransaction(
        () => {
          if (issue.fix.kind === 'remove_clip') {
            store.deleteClips(issue.fix.clipIds)
          } else if (issue.fix.kind === 'resolve_overlap' && issue.fix.moveClipId && issue.fix.targetTime != null) {
            const clip = store.project.tracks.flatMap((t) => t.clips).find((c) => c.id === issue.fix.moveClipId)
            if (!clip) return
            const delta = issue.fix.targetTime - clip.startTime
            if (Math.abs(delta) >= 0.01) store.moveClip(clip.id, delta)
          }
        },
        { type: 'edit', description: `AI: fixed "${issue.message}"` },
      )
      void refreshQualityAfterEdit()
    },
    [refreshQualityAfterEdit],
  )

  const applyAllFixes = React.useCallback(() => {
    const fixable = useAIStore.getState().issues.filter((i) => i.fix.kind !== 'none')
    if (!fixable.length) return
    const store = useTimelineStore.getState()
    store.withTransaction(
      () => {
        for (const issue of fixable) {
          if (issue.fix.kind === 'remove_clip') {
            store.deleteClips(issue.fix.clipIds)
          } else if (issue.fix.kind === 'resolve_overlap' && issue.fix.moveClipId && issue.fix.targetTime != null) {
            const clip = store.project.tracks.flatMap((t) => t.clips).find((c) => c.id === issue.fix.moveClipId)
            if (!clip) continue
            const delta = issue.fix.targetTime - clip.startTime
            if (Math.abs(delta) >= 0.01) store.moveClip(clip.id, delta)
          }
        }
      },
      { type: 'edit', description: `AI: fixed ${fixable.length} issue${fixable.length !== 1 ? 's' : ''}` },
    )
    void refreshQualityAfterEdit()
  }, [refreshQualityAfterEdit])

  const confirmPlan = React.useCallback(async () => {
    const pending = useAIStore.getState().pendingPlan
    if (!pending) return
    useAIStore.getState().clearPlan()
    try {
      const result = await applyPlan(pending.plan)
      let text = `Applied ${result.applied.length} change${result.applied.length !== 1 ? 's' : ''}:`
      text += '\n' + result.applied.map((a) => `- ${a.label}${a.reason ? ` — ${a.reason}` : ''}`).join('\n')
      if (result.skipped.length) {
        text += `\nSkipped ${result.skipped.length} (no longer valid): ${result.skipped.map((s) => s.label).join(', ')}`
      }
      useAIStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'ai',
        text,
        reasoning: 'Every action in an approved plan lands as one undo step — Ctrl+Z reverts all of it together.',
        tools: pending.plan.actions.map((a) => a.tool),
      })
      void refreshQualityAfterEdit()
    } catch (err) {
      useAIStore.getState().addMessage({
        id: crypto.randomUUID(),
        role: 'ai',
        text: `Applying the plan failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }, [refreshQualityAfterEdit])

  /** Discard the staged plan and optionally send a revision request. */
  const revisePlan = React.useCallback(
    (revision?: string) => {
      useAIStore.getState().clearPlan()
      if (revision?.trim()) void send(revision.trim())
    },
    [send],
  )

  const dismissIssueForever = React.useCallback(
    (issue: QualityIssue) => {
      useAIStore.getState().dismissIssue(issue.id)
      try {
        const key = `clipforge-ai-dismissed:${projectId}`
        const current = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
        localStorage.setItem(key, JSON.stringify([...new Set([...current, issue.id])]))
      } catch {
        // storage unavailable — dismissal lasts for this session only
      }
    },
    [projectId],
  )

  const loadDismissedIssues = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(`clipforge-ai-dismissed:${projectId}`)
      useAIStore.getState().setDismissedIssues(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      useAIStore.getState().setDismissedIssues([])
    }
  }, [projectId])

  return {
    send,
    submitAnswer,
    runQualityCheck,
    applyOne,
    applyAll,
    discardOne,
    discardAll,
    clearResolved,
    applyIssueFix,
    applyAllFixes,
    confirmPlan,
    revisePlan,
    dismissIssueForever,
    loadDismissedIssues,
  }
}

export type AiDirectorApi = ReturnType<typeof useAIDirector>
