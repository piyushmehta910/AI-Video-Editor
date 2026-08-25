import type { VideoBrief } from '@/ai/videoBrief'

export type SubagentRole =
  | 'script_architect'
  | 'audio_producer'
  | 'visual_animator'
  | 'asset_curator'
  | 'timeline_editor'
  | 'motion_subtitler'
  | 'quality_critic'

export interface SubagentInfo {
  role: SubagentRole
  name: string
  title: string
  description: string
  capabilities: string[]
  icon: string
}

export interface SubagentTask {
  id: string
  role: SubagentRole
  title: string
  description: string
  tool: string
  arguments: Record<string, unknown>
  dependencies?: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  progress?: number
  resultMessage?: string
  error?: string
}

export interface AutonomousVideoPlan {
  id: string
  goal: string
  targetDurationSeconds: number
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
  style: 'energetic' | 'educational' | 'cinematic' | 'minimalist' | 'tech'
  tasks: SubagentTask[]
  createdAt: number
  status: 'draft' | 'executing' | 'completed' | 'failed'
  /** The completed user brief this plan was built from (drives pre-flight). */
  brief?: VideoBrief
}

/** Public result consumed by the Director production status UI. */
export interface GenerationResult {
  planId: string
  status: 'completed' | 'failed' | 'cancelled'
  results: SubagentExecutionResult[]
  completedTasks: number
  failedTasks: number
}

export interface SubagentExecutionResult {
  taskId: string
  role: SubagentRole
  ok: boolean
  message: string
  outputData?: Record<string, unknown>
}
