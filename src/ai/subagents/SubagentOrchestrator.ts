import { useTimelineStore } from '@/stores/timelineStore'
import { applyTool } from '@/api/llm/tools'
import { aiContextManager } from '@/ai/context/AIContextManager'
import type { VideoBrief } from '@/ai/videoBrief'
import { validateBriefProviders } from './providerPreflight'
import { runSceneSequence, SCENE_SEQUENCE_TOOL } from './scriptToPlan'
import { SUBAGENT_REGISTRY } from './subagentsRegistry'
import type { SubagentRole, SubagentTask, AutonomousVideoPlan, SubagentExecutionResult } from './types'

const VISUAL_CLIP_TYPES = new Set(['video', 'image', 'avatar', 'animation', 'slide'])

export type PlanExecutionCallback = (event: {
  planId: string
  stage: 'planning' | 'executing' | 'verifying' | 'completed' | 'failed'
  activeTaskId?: string
  activeRole?: SubagentRole
  progressPercent: number
  message: string
  tasks: SubagentTask[]
}) => void

/**
 * Autonomous Subagent Orchestrator
 *
 * Implements autonomous task decomposition, subagent delegation, ReAct execution loops,
 * and post-generation reflection/quality review modeled after modern autonomous coding agents.
 */
export class SubagentOrchestrator {
  private static instance: SubagentOrchestrator
  private activePlan: AutonomousVideoPlan | null = null
  private isExecuting = false
  private abortController: AbortController | null = null
  private lastRunCancelled = false
  private subscribers = new Set<PlanExecutionCallback>()

  public static getInstance(): SubagentOrchestrator {
    if (!SubagentOrchestrator.instance) {
      SubagentOrchestrator.instance = new SubagentOrchestrator()
    }
    return SubagentOrchestrator.instance
  }

  public subscribe(cb: PlanExecutionCallback): () => void {
    this.subscribers.add(cb)
    return () => this.subscribers.delete(cb)
  }

  private emit(event: Parameters<PlanExecutionCallback>[0]) {
    for (const cb of this.subscribers) {
      cb(event)
    }
  }

  public getActivePlan(): AutonomousVideoPlan | null {
    return this.activePlan
  }

  public abort() {
    if (this.abortController) {
      this.abortController.abort()
      // isExecuting stays true until executePlan's finally block runs, so a
      // retry cannot start a second pipeline while the old one is unwinding.
    }
  }

  /** True when the most recent executePlan run ended because of abort(). */
  public wasLastRunCancelled(): boolean {
    return this.lastRunCancelled
  }

  /**
   * 1. Formulate Autonomous Video Creation Plan
   * Builds the dependency-ordered production task list from the completed user
   * brief. The brief is the single source of truth — no re-inference here.
   */
  public async formulateAutonomousPlan(options: {
    goal: string
    brief: VideoBrief
  }): Promise<AutonomousVideoPlan> {
    const brief = options.brief
    const planId = crypto.randomUUID()
    const id = () => crypto.randomUUID()
    const tasks: SubagentTask[] = [
      { id: id(), role: 'timeline_editor', title: `Set ${brief.aspectRatio} canvas`, description: `Prepare ${brief.platform} format.`, tool: 'set_project_ratio', arguments: { aspect: brief.aspectRatio }, status: 'pending' },
    ]
    if (brief.useResearch) tasks.push({ id: id(), role: 'script_architect', title: 'Research factual context', description: `Collect facts for ${brief.topic}.`, tool: 'web_research', arguments: { query: brief.topic }, status: 'pending' })
    tasks.push({ id: id(), role: 'script_architect', title: 'Write timed narration script', description: `Write for ${brief.audience} in ${brief.language}.`, tool: 'generate_script', arguments: { topic: brief.topic, durationSeconds: brief.durationSeconds, language: brief.language }, status: 'pending' })
    // Scene production is one deterministic adapter pass: per-scene TTS,
    // measured durations, visuals trimmed to narration, captions after VO.
    tasks.push({ id: id(), role: 'visual_animator', title: 'Produce scripted scenes', description: `Voice every scene and place timed ${brief.sourceStrategy} visuals.`, tool: SCENE_SEQUENCE_TOOL, arguments: {}, status: 'pending' })
    if (brief.music !== 'none') tasks.push({ id: id(), role: 'audio_producer', title: 'Add background music', description: `Find ${brief.music} music matching the topic.`, tool: 'search_music', arguments: { query: `${brief.music} ${brief.style} instrumental background` }, status: 'pending' })
    tasks.push({ id: id(), role: 'quality_critic', title: 'Review finished timeline', description: 'Verify timing, media, and story structure.', tool: 'check_quality', arguments: {}, status: 'pending' })
    tasks.push({ id: id(), role: 'timeline_editor', title: 'Render final preview', description: 'Generate the preview render of the finished video.', tool: 'render_preview', arguments: {}, status: 'pending' })

    const plan: AutonomousVideoPlan = {
      id: planId,
      goal: options.goal || `Create ${brief.platform} video about ${brief.topic}`,
      targetDurationSeconds: brief.durationSeconds,
      aspectRatio: brief.aspectRatio,
      style: brief.style,
      tasks,
      createdAt: Date.now(),
      status: 'draft',
      brief,
    }

    this.activePlan = plan
    return plan
  }

  /**
   * 2. Execute Autonomous Video Creation Plan
   * Runs the subagent task pipeline with real-time progress broadcasts.
   */
  public async executePlan(plan: AutonomousVideoPlan): Promise<SubagentExecutionResult[]> {
    if (this.isExecuting) {
      throw new Error('Another autonomous subagent pipeline is already executing.')
    }

    this.isExecuting = true
    this.abortController = new AbortController()
    this.lastRunCancelled = false
    const signal = this.abortController.signal
    plan.status = 'executing'

    const results: SubagentExecutionResult[] = []
    const totalTasks = plan.tasks.length

    // Stage 0 — provider pre-flight. Hard blockers stop the run BEFORE any
    // timeline mutation; missing optional providers are disclosed and degraded.
    const preflight = plan.brief
      ? validateBriefProviders(plan.brief)
      : { blockers: [], warnings: [] }
    if (preflight.warnings.length) {
      this.emit({
        planId: plan.id,
        stage: 'planning',
        progressPercent: 2,
        message: `Provider check: ${preflight.warnings.join(' ')}`,
        tasks: plan.tasks,
      })
    }
    if (preflight.blockers.length) {
      plan.status = 'failed'
      for (const blocker of preflight.blockers) {
        results.push({ taskId: 'preflight', role: 'quality_critic', ok: false, message: blocker })
      }
      this.emit({
        planId: plan.id,
        stage: 'failed',
        progressPercent: 100,
        message: `Cannot start production: ${preflight.blockers.join(' ')}`,
        tasks: plan.tasks,
      })
      return results
    }

    this.emit({
      planId: plan.id,
      stage: 'executing',
      progressPercent: 5,
      message: preflight.warnings.length
        ? `Starting production with ${totalTasks} tasks (with ${preflight.warnings.length} limitation${preflight.warnings.length > 1 ? 's' : ''})...`
        : `Starting autonomous generation with ${totalTasks} subagents...`,
      tasks: plan.tasks,
    })

    const store = useTimelineStore.getState()
    // One undo step for the whole Director run: capture pre-state, suppress all
    // intermediate snapshots, and commit once when the run ends (even on cancel).
    store.begin({ type: 'edit', description: `AI Director: ${plan.goal}` })
    store.suspendHistory(true)

    try {
      for (let i = 0; i < plan.tasks.length; i++) {
        if (signal.aborted) {
          plan.status = 'failed'
          break
        }

        const task = plan.tasks[i]
        task.status = 'running'
        const subagentMeta = SUBAGENT_REGISTRY[task.role]

        const percent = Math.round(((i + 0.1) / totalTasks) * 90)
        this.emit({
          planId: plan.id,
          stage: 'executing',
          activeTaskId: task.id,
          activeRole: task.role,
          progressPercent: percent,
          message: `[${subagentMeta.name}]: ${task.title}...`,
          tasks: plan.tasks,
        })

        try {
          // Scene production is executed by the deterministic adapter, not
          // through the generic tool switch.
          if (task.tool === SCENE_SEQUENCE_TOOL) {
            if (!plan.brief) throw new Error('Scene production requires a completed brief.')
            const seqResults = await runSceneSequence({
              brief: plan.brief,
              runId: plan.id,
              signal,
              onStage: (message) =>
                this.emit({
                  planId: plan.id,
                  stage: 'executing',
                  activeRole: task.role,
                  progressPercent: percent,
                  message,
                  tasks: plan.tasks,
                }),
            })
            results.push(...seqResults)
            const failedCount = seqResults.filter((r) => !r.ok).length
            // Partial scene failures keep the run alive (cancel-retention rule);
            // total failure marks the task failed.
            task.status = failedCount < seqResults.length ? 'completed' : 'failed'
            task.resultMessage = `${seqResults.length - failedCount}/${seqResults.length} steps succeeded`
            continue
          }

          const args = { ...task.arguments }
          const res = await applyTool(task.tool, args, { undoStep: false })
          task.status = res.ok ? 'completed' : 'failed'
          task.resultMessage = res.message

          // Background music must sit under the narration, never over it.
          // Duck level follows the brief's style: driving genres stay a bit
          // louder, calm/cinematic mixes duck deeper.
          if (task.tool === 'search_music' && res.ok) {
            const st = useTimelineStore.getState()
            const musicClips = st.project.tracks.flatMap((t) => t.clips).filter((c) => c.clipType === 'music')
            const latest = musicClips[musicClips.length - 1]
            if (latest) {
              const duckByStyle: Record<VideoBrief['style'], number> = {
                energetic: 0.25,
                tech: 0.2,
                educational: 0.18,
                minimalist: 0.15,
                cinematic: 0.12,
              }
              const volume = plan.brief ? duckByStyle[plan.brief.style] ?? 0.18 : 0.18
              st.updateClip(latest.id, { volume })
            }
          }

          results.push({
            taskId: task.id,
            role: task.role,
            ok: res.ok,
            message: res.message,
          })
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          task.status = 'failed'
          task.error = errMsg
          results.push({
            taskId: task.id,
            role: task.role,
            ok: false,
            message: errMsg,
          })
        }
      }

      // Verification Stage
      this.emit({
        planId: plan.id,
        stage: 'verifying',
        progressPercent: 95,
        message: '[Quality Critic]: Running timeline integrity check...',
        tasks: plan.tasks,
      })

      const health = await aiContextManager.evaluateTimelineHealth()

      // Completion gate — never claim success without the brief's essentials.
      this.lastRunCancelled = signal.aborted
      const finalState = useTimelineStore.getState()
      const directorClips = finalState.project.tracks
        .flatMap((t) => t.clips)
        .filter((c) => c.createdBy === 'director' && c.directorRunId === plan.id)
      const hasVisuals = directorClips.some((c) => c.clipType !== undefined && VISUAL_CLIP_TYPES.has(c.clipType))
      const hasNarration = directorClips.some((c) => c.clipType === 'voice' || c.clipType === 'audio')
      const narrationRequired = plan.brief?.narration === 'voiceover'
      const failedCount = results.filter((r) => !r.ok).length

      if (signal.aborted) {
        plan.status = 'failed'
        this.emit({
          planId: plan.id,
          stage: 'completed',
          progressPercent: 100,
          message: `Generation cancelled. Work created so far (${directorClips.length} clips, ${health.totalDuration.toFixed(1)}s) remains on the timeline.`,
          tasks: plan.tasks,
        })
      } else if (!hasVisuals || (narrationRequired && !hasNarration)) {
        plan.status = 'failed'
        const missing = [!hasVisuals ? 'timed visuals' : null, narrationRequired && !hasNarration ? 'narration' : null]
          .filter(Boolean)
          .join(' and ')
        this.emit({
          planId: plan.id,
          stage: 'failed',
          progressPercent: 100,
          message: `Production incomplete — ${missing} missing. Partial work remains on the timeline for inspection.`,
          tasks: plan.tasks,
        })
      } else {
        plan.status = 'completed'
        const caveats = failedCount > 0 ? ` (${failedCount} step${failedCount > 1 ? 's' : ''} need attention)` : ''
        this.emit({
          planId: plan.id,
          stage: 'completed',
          progressPercent: 100,
          message: `Video complete! Duration: ${health.totalDuration.toFixed(1)}s, ${health.clipCount} clips.${caveats}`,
          tasks: plan.tasks,
        })
      }
    } catch (err: unknown) {
      plan.status = 'failed'
      const errMsg = err instanceof Error ? err.message : String(err)
      this.emit({
        planId: plan.id,
        stage: 'failed',
        progressPercent: 100,
        message: `Autonomous execution failed: ${errMsg}`,
        tasks: plan.tasks,
      })
    } finally {
      store.suspendHistory(false)
      this.isExecuting = false
      this.abortController = null
    }

    return results
  }
}

export const subagentOrchestrator = SubagentOrchestrator.getInstance()
