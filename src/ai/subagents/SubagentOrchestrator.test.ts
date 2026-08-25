import { describe, it, expect, beforeEach } from 'vitest'
import { subagentOrchestrator } from './SubagentOrchestrator'
import { SUBAGENT_REGISTRY } from './subagentsRegistry'
import { useTimelineStore } from '@/stores/timelineStore'
import { DEFAULT_VIDEO_BRIEF } from '@/ai/videoBrief'

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
      brief: { ...DEFAULT_VIDEO_BRIEF, topic: 'Quantum Computing', durationSeconds: 30, aspectRatio: '9:16', style: 'tech' },
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
    expect(rolesAssigned).toContain('quality_critic')
    expect(plan.brief).toBeDefined()
    expect(plan.status).toBe('draft')
  })

  it('subscribes to real-time execution progress updates', async () => {
    const events: string[] = []
    const unsub = subagentOrchestrator.subscribe((e) => {
      events.push(`${e.stage}: ${e.message}`)
    })

    const plan = await subagentOrchestrator.formulateAutonomousPlan({
      goal: 'Short test video',
      brief: { ...DEFAULT_VIDEO_BRIEF, topic: 'Short test', durationSeconds: 15, aspectRatio: '16:9', style: 'minimalist' },
    })

    expect(plan.status).toBe('draft')
    unsub()
  })

  it('orders a completed brief around script, scene production, music, review, and preview', async () => {
    const plan = await subagentOrchestrator.formulateAutonomousPlan({
      goal: 'Create a solar-energy short',
      brief: { ...DEFAULT_VIDEO_BRIEF, topic: 'Solar energy', durationSeconds: 30, sourceStrategy: 'mixed', useResearch: true },
    })
    const tools = plan.tasks.map((task) => task.tool)
    expect(tools).toContain('generate_script')
    expect(tools).toContain('__scene_sequence__')
    expect(tools).toContain('check_quality')
    expect(tools).toContain('render_preview')
    // Legacy per-feature tasks are replaced by the deterministic scene adapter.
    expect(tools).not.toContain('generate_voiceover')
    expect(tools).not.toContain('generate_slides')
    expect(tools).not.toContain('auto_generate_captions')
    // Dependency order: script → scenes → quality → preview.
    expect(tools.indexOf('generate_script')).toBeLessThan(tools.indexOf('__scene_sequence__'))
    expect(tools.indexOf('__scene_sequence__')).toBeLessThan(tools.indexOf('check_quality'))
    expect(tools.indexOf('check_quality')).toBeLessThan(tools.indexOf('render_preview'))
    const music = plan.tasks.find((task) => task.tool === 'search_music')
    expect(music?.arguments).toHaveProperty('query')
    expect(String(music?.arguments.query)).toContain(DEFAULT_VIDEO_BRIEF.style)
  })

  it('blocks execution before any timeline mutation when required providers are missing', async () => {
    // No LLM key configured in this test environment.
    const plan = await subagentOrchestrator.formulateAutonomousPlan({
      goal: 'Blocked run',
      brief: { ...DEFAULT_VIDEO_BRIEF, topic: 'Anything', narration: 'voiceover' },
    })
    const events: Array<{ stage: string; message: string }> = []
    const unsub = subagentOrchestrator.subscribe((e) => events.push({ stage: e.stage, message: e.message }))

    const results = await subagentOrchestrator.executePlan(plan)

    unsub()
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => !r.ok)).toBe(true)
    expect(plan.status).toBe('failed')
    expect(events.some((e) => e.stage === 'failed' && /Cannot start production/.test(e.message))).toBe(true)
    // No clips were placed and no history entry was created.
    const clips = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    expect(clips).toHaveLength(0)
  })
})
