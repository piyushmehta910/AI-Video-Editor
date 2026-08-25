import { create } from 'zustand'
import type { Project } from '@/engine/types'
import type { QualityIssue } from '@/ai/quality/checker'
import type { EditPlan } from '@/api/llm/plan'
import type { VideoBrief } from '@/ai/videoBrief'
import type { SubagentTask } from '@/ai/subagents/types'

/**
 * AI Director session state: chat transcript, staged proposals, proactive
 * quality suggestions and the pending plan awaiting confirmation. Panel
 * visibility stays in editorStore (aiDirectorOpen) so the toolbar button,
 * keyboard shortcut and layout all read one source.
 */

export type AiDirectorMode = 'suggest' | 'edit'

export interface AiChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  /** AI reasoning shown under the message ("added B-roll because…"). */
  reasoning?: string
  tools?: string[]
  proposed?: boolean
  followups?: string[]
  review?: QualityIssue[] | null
}

export interface AiProposal {
  id: string
  toolName: string
  args: Record<string, unknown>
  label: string
  destructive: boolean
  status: 'pending' | 'applied' | 'failed' | 'discarded'
  message?: string
}

export interface PendingAiPlan {
  plan: EditPlan
  /** Timeline snapshot taken when the plan was staged — the diff "before". */
  before: Project
}

export type VideoProductionStatus = 'idle' | 'briefing' | 'executing' | 'completed' | 'failed' | 'cancelled'

export interface VideoProductionState {
  brief: VideoBrief | null
  step: number
  status: VideoProductionStatus
  progressPercent: number
  message: string
  tasks: SubagentTask[]
  error?: string
}

interface AiState {
  mode: AiDirectorMode
  messages: AiChatMessage[]
  busy: boolean
  analyzing: boolean
  proposals: AiProposal[]
  issues: QualityIssue[]
  dismissedIssueIds: string[]
  pendingPlan: PendingAiPlan | null
  pendingQuestion: string | null
  videoProduction: VideoProductionState

  setMode: (mode: AiDirectorMode) => void
  addMessage: (message: AiChatMessage) => void
  setBusy: (busy: boolean) => void
  setAnalyzing: (analyzing: boolean) => void

  stageProposal: (proposal: Omit<AiProposal, 'id' | 'status'>) => void
  patchProposal: (id: string, changes: Partial<AiProposal>) => void
  discardAllProposals: () => void
  clearResolvedProposals: () => void

  setIssues: (issues: QualityIssue[]) => void
  dismissIssue: (issueId: string) => void
  setDismissedIssues: (ids: string[]) => void

  stagePlan: (plan: EditPlan, before: Project) => void
  clearPlan: () => void

  setPendingQuestion: (question: string | null) => void
  startVideoBrief: (brief: VideoBrief) => void
  updateVideoBrief: (brief: VideoBrief, step: number) => void
  setVideoProduction: (patch: Partial<VideoProductionState>) => void
  clearVideoProduction: () => void
  resetSession: () => void
}

export const useAIStore = create<AiState>((set, get) => ({
  mode: 'suggest',
  messages: [],
  busy: false,
  analyzing: false,
  proposals: [],
  issues: [],
  dismissedIssueIds: [],
  pendingPlan: null,
  pendingQuestion: null,
  videoProduction: { brief: null, step: 0, status: 'idle', progressPercent: 0, message: '', tasks: [] },

  setMode: (mode) => set({ mode }),

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  setBusy: (busy) => set({ busy }),
  setAnalyzing: (analyzing) => set({ analyzing }),

  stageProposal: (proposal) =>
    set((s) => ({
      proposals: [
        ...s.proposals,
        { ...proposal, id: crypto.randomUUID(), status: 'pending' as const },
      ],
    })),

  patchProposal: (id, changes) =>
    set((s) => ({
      proposals: s.proposals.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    })),

  discardAllProposals: () =>
    set((s) => ({
      proposals: s.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'discarded' as const } : p)),
    })),

  clearResolvedProposals: () =>
    set((s) => ({ proposals: s.proposals.filter((p) => p.status === 'pending') })),

  setIssues: (issues) =>
    set((s) => ({
      issues,
      dismissedIssueIds: s.dismissedIssueIds.filter((id) => issues.some((i) => i.id === id)),
    })),

  dismissIssue: (issueId) =>
    set((s) => ({ dismissedIssueIds: [...s.dismissedIssueIds, issueId] })),

  setDismissedIssues: (ids) => set({ dismissedIssueIds: ids }),

  stagePlan: (plan, before) => {
    get().discardAllProposals()
    set({ pendingPlan: { plan, before } })
  },

  clearPlan: () => set({ pendingPlan: null }),

  setPendingQuestion: (question) => set({ pendingQuestion: question }),

  startVideoBrief: (brief) => set({ videoProduction: { brief, step: 0, status: 'briefing', progressPercent: 0, message: 'Tell me about your video.', tasks: [] } }),
  updateVideoBrief: (brief, step) => set((s) => ({ videoProduction: { ...s.videoProduction, brief, step } })),
  setVideoProduction: (patch) => set((s) => ({ videoProduction: { ...s.videoProduction, ...patch } })),
  clearVideoProduction: () => set({ videoProduction: { brief: null, step: 0, status: 'idle', progressPercent: 0, message: '', tasks: [] } }),

  resetSession: () =>
    set({
      messages: [],
      proposals: [],
      issues: [],
      dismissedIssueIds: [],
      pendingPlan: null,
      pendingQuestion: null,
      videoProduction: { brief: null, step: 0, status: 'idle', progressPercent: 0, message: '', tasks: [] },
      busy: false,
      analyzing: false,
    }),
}))
