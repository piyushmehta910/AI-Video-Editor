import { useTimelineStore } from '@/stores/timelineStore'
import { applyTool, describeTool } from './tools'
import { collectTimelineScenes } from './context'
import { checkTimeline, type QualityIssue } from '@/ai/quality/checker'

/** A single concrete timeline action proposed inside an edit plan. */
export interface PlannedAction {
  tool: string
  arguments: Record<string, unknown>
  reason: string
}

/** The execution plan the Director stages before touching the timeline. */
export interface EditPlan {
  goal: string
  scenesAffected: string[]
  actions: PlannedAction[]
}

/**
 * Validate + normalize raw LLM output into an EditPlan. Every action must
 * resolve through describeTool (same validation the tools themselves use), so a
 * plan can never reference unknown tools or invalid arguments. Returns null
 * when the plan is unusable.
 */
export function normalizePlan(raw: Record<string, unknown>): EditPlan | null {
  const goal = String(raw.goal ?? '').trim()
  if (!goal) return null
  const scenesRaw = Array.isArray(raw.scenesAffected) ? raw.scenesAffected : []
  const actionsRaw = Array.isArray(raw.actions) ? raw.actions : []
  const actions: PlannedAction[] = []
  for (const entry of actionsRaw) {
    if (!entry || typeof entry !== 'object') continue
    const a = entry as Record<string, unknown>
    const tool = String(a.tool ?? '').trim()
    const args =
      a.arguments && typeof a.arguments === 'object' && !Array.isArray(a.arguments)
        ? (a.arguments as Record<string, unknown>)
        : {}
    const reason = String(a.reason ?? '').trim()
    if (!tool || !describeTool(tool, args)) continue
    actions.push({ tool, arguments: args, reason })
  }
  if (!actions.length) return null
  return {
    goal,
    scenesAffected: scenesRaw.map(String).filter(Boolean).slice(0, 12),
    actions,
  }
}

export interface AppliedPlanAction {
  label: string
  reason: string
  message: string
  ok: boolean
}

export interface ApplyPlanResult {
  applied: AppliedPlanAction[]
  skipped: AppliedPlanAction[]
}

/**
 * Apply every action in a plan as a single undo step (one snapshot). Non-mutating
 * actions are applied as-is; invalid/stale ones are reported, never half-applied.
 */
export async function applyPlan(plan: EditPlan): Promise<ApplyPlanResult> {
  const store = useTimelineStore.getState()
  const applied: AppliedPlanAction[] = []
  const skipped: AppliedPlanAction[] = []
  // One snapshot for the whole plan; inner snapshots the store actions take are
  // suppressed so the entire plan undoes in a single step.
  store.begin()
  store.suspendHistory(true)
  try {
    for (const action of plan.actions) {
      const label = describeTool(action.tool, action.arguments)
      if (!label) {
        skipped.push({ label: action.tool, reason: action.reason, message: 'This action is no longer valid.', ok: false })
        continue
      }
      const result = await applyTool(action.tool, action.arguments, { undoStep: false })
      const item: AppliedPlanAction = { label, reason: action.reason, message: result.message, ok: result.ok }
      ;(result.ok ? applied : skipped).push(item)
    }
  } finally {
    store.suspendHistory(false)
  }
  return { applied, skipped }
}

/** Run a fresh quality review of the whole timeline. */
export async function runQualityReview(): Promise<QualityIssue[]> {
  const store = useTimelineStore.getState()
  const scenes = await collectTimelineScenes()
  return checkTimeline(store.project, store.assets, { scenes })
}

/** Plain-language quality notes after an edit (never auto-fixed). */
export function qualityNotes(issues: QualityIssue[]): string[] {
  return issues.map((i) => `[${i.severity}] ${i.message}`)
}