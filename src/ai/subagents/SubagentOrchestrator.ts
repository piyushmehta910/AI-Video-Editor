import { useTimelineStore } from '@/stores/timelineStore'
import { applyTool } from '@/api/llm/tools'
import { aiContextManager } from '@/ai/context/AIContextManager'
import { contextUnderstandingEngine } from '@/ai/context/ContextUnderstandingEngine'
import { resourceAllocator } from '@/ai/allocator/ResourceAllocator'
import { colorDesignEngine } from '@/engine/design/ColorDesignEngine'
import { SUBAGENT_REGISTRY } from './subagentsRegistry'
import type { SubagentRole, SubagentTask, AutonomousVideoPlan, SubagentExecutionResult } from './types'

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
      this.isExecuting = false
    }
  }

  /**
   * 1. Formulate Autonomous Video Creation Plan
   * Decomposes user goal into specialized subagent tasks using timeline context,
   * prompt understanding, and multi-provider resource allocation.
   */
  public async formulateAutonomousPlan(options: {
    goal: string
    targetDurationSeconds?: number
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
    style?: 'energetic' | 'educational' | 'cinematic' | 'minimalist' | 'tech'
    topic?: string
  }): Promise<AutonomousVideoPlan> {
    const context = await aiContextManager.getComprehensiveContext()
    const userPrefs = await contextUnderstandingEngine.getUserPreferences()
    const analysis = contextUnderstandingEngine.analyzePrompt(options.goal, userPrefs)
    const palette = colorDesignEngine.selectPalette(analysis.suggestedColorMood)

    const targetDuration = options.targetDurationSeconds || analysis.estimatedDurationSeconds || (context.duration > 0 ? Math.round(context.duration) : 30)
    const aspect = options.aspectRatio || analysis.visualStrategy.recommendedAspect || '9:16'
    const style = options.style || (analysis.desiredTone === 'dramatic' ? 'cinematic' : analysis.desiredTone === 'educational' ? 'educational' : 'energetic')
    const topic = options.topic || options.goal

    const planId = crypto.randomUUID()
    const tasks: SubagentTask[] = []

    // 1. Aspect Ratio Configuration
    tasks.push({
      id: crypto.randomUUID(),
      role: 'timeline_editor',
      title: `Set Project Aspect Ratio to ${aspect}`,
      description: `Configures canvas viewport to ${aspect} (${analysis.videoType} format, ${style} aesthetic, ${palette.name} palette).`,
      tool: 'set_project_ratio',
      arguments: { aspect },
      status: 'pending',
    })

    // 2. Script Subagent: Generate Structured Narrative
    tasks.push({
      id: crypto.randomUUID(),
      role: 'script_architect',
      title: `Draft ${analysis.videoType} Script & Storyboard`,
      description: `Drafts targeted narrative for ${analysis.targetAudience} audience with hook, 3 key points, and CTA about "${topic}".`,
      tool: 'generate_script',
      arguments: {
        topic,
        style,
        targetDuration,
      },
      status: 'pending',
    })

    // 3. Visual Subagent: AI Presentation Slides
    tasks.push({
      id: crypto.randomUUID(),
      role: 'visual_animator',
      title: 'Create AI Visual Slide Deck',
      description: `Compiles modern Marp presentation slides to accompany key topic points.`,
      tool: 'generate_slides',
      arguments: {
        topic,
        style: style === 'tech' ? 'tech' : style === 'cinematic' ? 'minimal' : 'modern',
        slideCount: 3,
      },
      status: 'pending',
    })

    const bestStockProvider = resourceAllocator.selectBestProvider('stock_images') || 'unsplash'
    const best3DProvider = resourceAllocator.selectBestProvider('models_3d') || 'sketchfab'

    // 4. Asset Subagent: Curate 3D Model / B-Roll Visuals
    tasks.push({
      id: crypto.randomUUID(),
      role: 'asset_curator',
      title: 'Discover 3D Model / Visual Assets',
      description: `Searches and downloads high-quality assets matching topic context via ${best3DProvider} and ${bestStockProvider}.`,
      tool: 'add_3d_model',
      arguments: {
        query: topic.split(' ')[0] || 'robot',
        provider: 'polyhaven',
      },
      status: 'pending',
    })

    // 5. Audio Subagent: Curate Background Music Track
    tasks.push({
      id: crypto.randomUUID(),
      role: 'audio_producer',
      title: 'Curate Atmospheric Background Music',
      description: `Finds and downloads royalty-free background score matching ${style} mood.`,
      tool: 'search_music',
      arguments: {
        mood: style === 'energetic' ? 'upbeat' : style === 'tech' ? 'electronic' : 'cinematic',
      },
      status: 'pending',
    })

    // 6. Subtitles & Motion Subagent: Synchronized Captions
    tasks.push({
      id: crypto.randomUUID(),
      role: 'motion_subtitler',
      title: 'Generate Animated Kinetic Captions',
      description: 'Generates animated karaoke subtitle overlays across speech track.',
      tool: 'auto_generate_captions',
      arguments: {
        style: 'karaoke',
      },
      status: 'pending',
    })

    // 7. Quality Critic Subagent: Post-Assembly Timeline Audit
    tasks.push({
      id: crypto.randomUUID(),
      role: 'quality_critic',
      title: 'Timeline Health & Pacing Review',
      description: 'Audits audio balance, removes dead silence gaps, and verifies pacing.',
      tool: 'check_quality',
      arguments: {},
      status: 'pending',
    })

    const plan: AutonomousVideoPlan = {
      id: planId,
      goal: options.goal,
      targetDurationSeconds: targetDuration,
      aspectRatio: aspect,
      style,
      tasks,
      createdAt: Date.now(),
      status: 'draft',
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
    const signal = this.abortController.signal
    plan.status = 'executing'

    const results: SubagentExecutionResult[] = []
    const totalTasks = plan.tasks.length

    this.emit({
      planId: plan.id,
      stage: 'executing',
      progressPercent: 5,
      message: `Starting autonomous generation with ${totalTasks} subagents...`,
      tasks: plan.tasks,
    })

    const store = useTimelineStore.getState()
    store.begin()

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
          const res = await applyTool(task.tool, task.arguments, { undoStep: false })
          task.status = res.ok ? 'completed' : 'failed'
          task.resultMessage = res.message

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

      plan.status = 'completed'
      this.emit({
        planId: plan.id,
        stage: 'completed',
        progressPercent: 100,
        message: `Autonomous generation complete! Duration: ${health.totalDuration.toFixed(1)}s, ${health.clipCount} clips.`,
        tasks: plan.tasks,
      })
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
      this.isExecuting = false
      this.abortController = null
    }

    return results
  }
}

export const subagentOrchestrator = SubagentOrchestrator.getInstance()
