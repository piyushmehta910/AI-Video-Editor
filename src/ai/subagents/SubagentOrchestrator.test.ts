import { describe, it, expect, beforeEach } from 'vitest'
import { subagentOrchestrator } from './SubagentOrchestrator'
import { SUBAGENT_REGISTRY } from './subagentsRegistry'
import { useTimelineStore } from '@/stores/timelineStore'

describe('SubagentOrchestrator & Multi-Agent Architecture', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      project: {
        id: 'test-project',
        name: 'Autonomous AI Test',
        width: 1080,
        height: 1920,
        fps: 30,
        aspectRatio: '9:16',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        tracks: [
          { id: 'v1', name: 'Video Track', type: 'video', clips: [], locked: false, muted: false, hidden: false, index: 0 },
          { id: 'a1', name: 'Audio Track', type: 'audio', clips: [], locked: false, muted: false, hidden: false, index: 1 },
          { id: 't1', name: 'Text Track', type: 'text', clips: [], locked: false, muted: false, hidden: false, index: 2 },
        ],
      },
      assets: [],
    })
  })

  it('has all 7 specialized subagents registered with distinct capabilities', () => {
    const roles = Object.keys(SUBAGENT_REGISTRY)
    expect(roles).toHaveLength(7)
    expect(roles).toContain('script_architect')
    expect(roles).toContain('audio_producer')
    expect(roles).toContain('visual_animator')
    expect(roles).toContain('asset_curator')
    expect(roles).toContain('timeline_editor')
    expect(roles).toContain('motion_subtitler')
    expect(roles).toContain('quality_critic')

    for (const role of roles as Array<keyof typeof SUBAGENT_REGISTRY>) {
      const subagent = SUBAGENT_REGISTRY[role]
      expect(subagent.name).toBeTruthy()
      expect(subagent.capabilities.length).toBeGreaterThan(0)
    }
  })

  it('formulates an autonomous video creation plan with subagent task delegation', async () => {
    const plan = await subagentOrchestrator.formulateAutonomousPlan({
      goal: 'Create an engaging vertical short about Quantum Computing',
      targetDurationSeconds: 30,
      aspectRatio: '9:16',
      style: 'tech',
      topic: 'Quantum Computing',
    })

    expect(plan).toBeDefined()
    expect(plan.goal).toBe('Create an engaging vertical short about Quantum Computing')
    expect(plan.targetDurationSeconds).toBe(30)
    expect(plan.aspectRatio).toBe('9:16')
    expect(plan.tasks.length).toBeGreaterThanOrEqual(5)

    const rolesAssigned = plan.tasks.map((t) => t.role)
    expect(rolesAssigned).toContain('timeline_editor')
    expect(rolesAssigned).toContain('script_architect')
    expect(rolesAssigned).toContain('visual_animator')
    expect(rolesAssigned).toContain('audio_producer')
    expect(rolesAssigned).toContain('motion_subtitler')
    expect(rolesAssigned).toContain('quality_critic')
  })

  it('subscribes to real-time execution progress updates', async () => {
    const events: string[] = []
    const unsub = subagentOrchestrator.subscribe((e) => {
      events.push(`${e.stage}: ${e.message}`)
    })

    const plan = await subagentOrchestrator.formulateAutonomousPlan({
      goal: 'Short test video',
      targetDurationSeconds: 15,
      aspectRatio: '16:9',
      style: 'minimalist',
    })

    expect(plan.status).toBe('draft')
    unsub()
  })
})
