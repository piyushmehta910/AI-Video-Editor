import { beforeEach, describe, expect, it } from 'vitest'
import { useAIStore } from './aiStore'
import type { Project } from '@/engine/types'
import type { EditPlan } from '@/api/llm/plan'
import type { QualityIssue } from '@/ai/quality/checker'

describe('aiStore', () => {
  beforeEach(() => {
    useAIStore.getState().resetSession()
  })

  it('starts in suggest mode with an empty session', () => {
    const s = useAIStore.getState()
    expect(s.mode).toBe('suggest')
    expect(s.messages).toHaveLength(0)
    expect(s.busy).toBe(false)
    expect(s.proposals).toHaveLength(0)
  })

  it('switches modes', () => {
    useAIStore.getState().setMode('edit')
    expect(useAIStore.getState().mode).toBe('edit')
    useAIStore.getState().setMode('suggest')
    expect(useAIStore.getState().mode).toBe('suggest')
  })

  it('stages proposals as pending and patches their status', () => {
    const store = useAIStore.getState()
    store.stageProposal({ toolName: 'delete_clip', args: {}, label: 'Delete intro.mp4', destructive: true })
    const [proposal] = useAIStore.getState().proposals
    expect(proposal.status).toBe('pending')
    expect(proposal.destructive).toBe(true)

    useAIStore.getState().patchProposal(proposal.id, { status: 'applied' })
    expect(useAIStore.getState().proposals[0].status).toBe('applied')
  })

  it('discardAll only touches pending proposals', () => {
    const store = useAIStore.getState()
    store.stageProposal({ toolName: 'trim_clip', args: {}, label: 'Trim A', destructive: true })
    store.stageProposal({ toolName: 'move_clip', args: {}, label: 'Move B', destructive: true })
    const first = useAIStore.getState().proposals[0]
    useAIStore.getState().patchProposal(first.id, { status: 'applied' })

    useAIStore.getState().discardAllProposals()
    const statuses = useAIStore.getState().proposals.map((p) => p.status)
    expect(statuses).toEqual(['applied', 'discarded'])
  })

  it('clearResolvedProposals keeps pending work', () => {
    const store = useAIStore.getState()
    store.stageProposal({ toolName: 'split_clip', args: {}, label: 'Split', destructive: true })
    store.stageProposal({ toolName: 'join_clips', args: {}, label: 'Join', destructive: true })
    const ids = useAIStore.getState().proposals.map((p) => p.id)
    useAIStore.getState().patchProposal(ids[1], { status: 'failed' })

    useAIStore.getState().clearResolvedProposals()
    expect(useAIStore.getState().proposals.map((p) => p.label)).toEqual(['Split'])
  })

  it('dismissed issues are filtered when a fresh issue set arrives', () => {
    const issue = (id: string): QualityIssue => ({
      id,
      type: 'overlap',
      severity: 'warning',
      message: id,
      fix: { kind: 'none', clipIds: [], label: '' },
    })
    useAIStore.getState().setIssues([issue('a'), issue('b')])
    useAIStore.getState().dismissIssue('a')

    // Re-run finds both again — dismissal persists through setIssues.
    useAIStore.getState().setIssues([issue('a'), issue('b'), issue('c')])
    let dismissed = useAIStore.getState().dismissedIssueIds
    expect(dismissed).toContain('a')

    // A run that no longer reports 'a' drops its dismissal.
    useAIStore.getState().setIssues([issue('b'), issue('c')])
    dismissed = useAIStore.getState().dismissedIssueIds
    expect(dismissed).not.toContain('a')
  })

  it('staging a plan clears pending proposals and stores the before snapshot', () => {
    const before = { id: 'p1' } as unknown as Project
    const plan: EditPlan = { goal: 'Tighten pacing', scenesAffected: [], actions: [] }
    const store = useAIStore.getState()
    store.stageProposal({ toolName: 'delete_clip', args: {}, label: 'X', destructive: true })

    store.stagePlan(plan, before)
    const state = useAIStore.getState()
    expect(state.pendingPlan?.plan.goal).toBe('Tighten pacing')
    expect(state.pendingPlan?.before.id).toBe('p1')
    expect(state.proposals.every((p) => p.status === 'discarded')).toBe(true)

    state.clearPlan()
    expect(useAIStore.getState().pendingPlan).toBeNull()
  })
})

