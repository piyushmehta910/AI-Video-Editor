import { describe, it, expect, beforeEach, vi } from 'vitest'
import { subagentOrchestrator } from './SubagentOrchestrator'
import { useTimelineStore } from '@/stores/timelineStore'
import { applyTool } from '@/api/llm/tools'
import type { AutonomousVideoPlan, SubagentTask } from './types'
import type { Clip } from '@/engine/types'
import { DEFAULT_VIDEO_BRIEF } from '@/ai/videoBrief'

// The current run id is set per-test; the mocked applyTool tags clips with it.
let currentRunId = 'plan-happy'

async function placeMockClip(): Promise<{ ok: boolean; message: string }> {
  const { useTimelineStore: store } = await import('@/stores/timelineStore')
  const st = store.getState()
  const videoTrack = st.project.tracks.find((t) => t.type === 'video')
  if (!videoTrack) return { ok: false, message: 'no video track' }
  const end = videoTrack.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0)
  st.addClipToTrack({
    id: crypto.randomUUID(),
    assetId: 'asset-1',
    trackId: videoTrack.id,
    startTime: Math.round(end * 10) / 10,
    duration: 3,
    sourceStart: 0,
    sourceEnd: 3,
    speed: 1,
    name: 'placed-by-mock',
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    effects: [],
    transitions: {},
    clipType: 'image',
    createdBy: 'director',
    directorRunId: currentRunId,
  } as Clip)
  return { ok: true, message: 'placed' }
}

vi.mock('@/api/llm/tools', async () => {
  return {
    applyTool: vi.fn(async (tool: string) => {
      if (tool === 'explode') return { ok: false, message: 'mocked failure' }
      if (tool !== 'fake_place') return { ok: true, message: 'ok' }
      return placeMockClip()
    }),
  }
})

vi.mock('@/ai/context/AIContextManager', () => ({
  aiContextManager: {
    evaluateTimelineHealth: vi.fn(async () => ({ totalDuration: 12, clipCount: 4, issues: [], warnings: [] })),
  },
}))

// Provider availability has its own dedicated tests — stub a fully
// provisioned environment here so execution paths can be exercised.
vi.mock('./providerPreflight', () => ({
  validateBriefProviders: vi.fn(() => ({ blockers: [], warnings: [] })),
}))

function makePlan(overrides: Partial<AutonomousVideoPlan> = {}): AutonomousVideoPlan {
  const tasks: SubagentTask[] = [
    { id: 't1', role: 'visual_animator', title: 'Place A', description: '', tool: 'fake_place', arguments: {}, status: 'pending' },
    { id: 't2', role: 'visual_animator', title: 'Place B', description: '', tool: 'fake_place', arguments: {}, status: 'pending' },
    { id: 't3', role: 'quality_critic', title: 'Review', description: '', tool: 'check_quality', arguments: {}, status: 'pending' },
    { id: 't4', role: 'timeline_editor', title: 'Preview', description: '', tool: 'render_preview', arguments: {}, status: 'pending' },
  ]
  return {
    id: 'plan-happy',
    goal: 'Integration test',
    targetDurationSeconds: 12,
    aspectRatio: '16:9',
    style: 'tech',
    tasks,
    createdAt: Date.now(),
    status: 'draft',
    brief: { ...DEFAULT_VIDEO_BRIEF, topic: 'Test topic', narration: 'silent' },
    ...overrides,
  }
}

describe('executePlan integration (mocked tools)', () => {
  beforeEach(() => {
    currentRunId = 'plan-happy'
    useTimelineStore.setState({
      project: {
        id: 'p',
        name: 't',
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: '16:9',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        tracks: [
          { id: 'v1', name: 'Video', type: 'video', clips: [], locked: false, muted: false, hidden: false, index: 0 },
          { id: 'a1', name: 'Audio', type: 'audio', clips: [], locked: false, muted: false, hidden: false, index: 1 },
          { id: 't1x', name: 'Text', type: 'text', clips: [], locked: false, muted: false, hidden: false, index: 2 },
        ],
      },
      assets: [],
    })
    subagentOrchestrator.abort()
  })

  it('completes a silent-brief run and undoes the whole production in one step', async () => {
    const plan = makePlan()
    const events: string[] = []
    const unsub = subagentOrchestrator.subscribe((e) => events.push(`${e.stage}|${e.message}`))

    const results = await subagentOrchestrator.executePlan(plan)
    unsub()

    expect(plan.status).toBe('completed')
    expect(results.every((r) => r.ok)).toBe(true)
    expect(events.some((m) => m.startsWith('completed|Video complete!'))).toBe(true)

    // Whole run collapses into ONE undo step.
    const clipsAfter = () => useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    expect(clipsAfter().length).toBeGreaterThanOrEqual(2)
    useTimelineStore.getState().undo()
    expect(clipsAfter()).toHaveLength(0)
  })

  it('refuses completion when narration was requested but no voice clip exists', async () => {
    currentRunId = 'plan-vo'
    const plan = makePlan({
      id: 'plan-vo',
      brief: { ...DEFAULT_VIDEO_BRIEF, topic: 'Test topic', narration: 'voiceover' },
    })
    const events: Array<{ stage: string; message: string }> = []
    const unsub = subagentOrchestrator.subscribe((e) => events.push({ stage: e.stage, message: e.message }))

    await subagentOrchestrator.executePlan(plan)
    unsub()

    expect(plan.status).toBe('failed')
    const failedEvent = events.find((e) => e.stage === 'failed')
    expect(failedEvent?.message).toMatch(/narration missing/)
  })

  it('reports cancellation while retaining created work', async () => {
    currentRunId = 'plan-cancel'
    const plan = makePlan({ id: 'plan-cancel' })
    // Abort from inside the first task execution, after its clip is placed.
    vi.mocked(applyTool).mockImplementationOnce(async (tool) => {
      const res = await placeMockClip()
      void tool
      subagentOrchestrator.abort()
      return res
    })
    const events: Array<{ stage: string; message: string }> = []
    const unsub = subagentOrchestrator.subscribe((e) => events.push({ stage: e.stage, message: e.message }))

    await subagentOrchestrator.executePlan(plan)
    unsub()

    expect(subagentOrchestrator.wasLastRunCancelled()).toBe(true)
    expect(events.some((e) => /cancelled/i.test(e.message) && /remains on the timeline/.test(e.message))).toBe(true)
    const clips = useTimelineStore.getState().project.tracks.flatMap((t) => t.clips)
    expect(clips.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps running after an individual tool fails and still finishes remaining steps', async () => {
    currentRunId = 'plan-partial'
    const plan = makePlan({ id: 'plan-partial' })
    plan.tasks.splice(1, 0, { id: 't1f', role: 'audio_producer', title: 'Fails', description: '', tool: 'explode', arguments: {}, status: 'pending' })

    const results = await subagentOrchestrator.executePlan(plan)

    expect(results.some((r) => !r.ok && r.message === 'mocked failure')).toBe(true)
    expect(results.filter((r) => r.ok).length).toBeGreaterThanOrEqual(3)
    expect(plan.status).toBe('completed')
  })
})
