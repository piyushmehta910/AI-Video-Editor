import { useApiConfigStore } from '@/api/config/store'
import { useTimelineStore } from '@/stores/timelineStore'
import { needsProxy, proxyFetch } from '@/api/proxy'
import type { LLMConfig } from '@/api/config/types'
import { VIDEO_EDITING_MANUAL } from './videoEditingManual'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface DirectorProvider {
  name: string
  config: LLMConfig
}

export interface DirectorProviderOverride {
  provider?: string
  model?: string
}

export function getDirectorProvider(override?: DirectorProviderOverride): DirectorProvider | null {
  const { config } = useApiConfigStore.getState()
  const preferred = override?.provider || config.preferences.preferredAiProvider
  const candidates: Array<{ name: string; cfg: LLMConfig }> = [
    { name: 'OpenRouter', cfg: config.openRouter },
    { name: 'OpenCode Zen', cfg: config.opencodeZen },
    { name: 'NVIDIA NIM', cfg: config.nvidiaNim },
  ]
  const tryCandidate = (name: string, cfg: LLMConfig): DirectorProvider | null => {
    if (!cfg.enabled || !cfg.apiKey || !cfg.baseUrl || !cfg.model) return null
    const modelToUse = override?.model || cfg.model
    return { name, config: { ...cfg, model: modelToUse } }
  }
  if (preferred) {
    const prefs: Record<string, { name: string; cfg: LLMConfig }> = {
      openRouter: { name: 'OpenRouter', cfg: config.openRouter },
      openrouter: { name: 'OpenRouter', cfg: config.openRouter },
      opencodeZen: { name: 'OpenCode Zen', cfg: config.opencodeZen },
      'opencode-zen': { name: 'OpenCode Zen', cfg: config.opencodeZen },
      nvidiaNim: { name: 'NVIDIA NIM', cfg: config.nvidiaNim },
      'nvidia-nim': { name: 'NVIDIA NIM', cfg: config.nvidiaNim },
    }
    const chosen = prefs[preferred]
    if (chosen) {
      const direct = tryCandidate(chosen.name, chosen.cfg)
      if (direct) return direct
    }
  }
  for (const candidate of candidates) {
    const direct = tryCandidate(candidate.name, candidate.cfg)
    if (direct) return direct
  }
  return null
}

export function getProjectContextSystemPrompt(askedQuestions: string[] = []): string {
  const { project, assets } = useTimelineStore.getState()
  const prefs = useApiConfigStore.getState().config.preferences
  const lines: string[] = [
    'You are the AI Director inside ClipForge, a browser-native video editor.',
    'You help the user edit their project. You can call tools to perform edits.',
    `Project: "${project.name}" ${project.width}×${project.height} @ ${project.fps}fps (${project.aspectRatio}).`,
    'Tracks:',
  ]
  for (const track of project.tracks) {
    const label = track.name
    if (!track.clips.length) {
      lines.push(`  - ${label} (${track.type}, empty)`)
      continue
    }
    const clips = track.clips
      .map((c) => `"${c.name}" ${c.startTime.toFixed(1)}s→${(c.startTime + c.duration).toFixed(1)}s`)
      .join(', ')
    lines.push(`  - ${label} (${track.type}): ${clips}`)
  }
  if (assets.length) {
    lines.push('Available media:')
    for (const a of assets) {
      const label = a.type === 'model' ? '3D model' : a.type
      lines.push(`  - "${a.name}" (${label})`)
    }
  }
  lines.push(
    `User preferences: language=${prefs.language}, aspect=${prefs.defaultAspectRatio}, confirm=${prefs.confirmationLevel}.`,
  )
  lines.push(
    'CRITICAL EXECUTION MANDATE: You are an active agentic video director. When the user asks you to make an edit, ' +
      'split, trim, delete, move clips, change speed/volume/opacity, add captions/subtitles, apply filters/effects, ' +
      'generate voiceover/music, add slides/avatars/3D models, or modify the project in ANY way, YOU MUST CALL ' +
      'THE CORRESPONDING FUNCTION TOOL(S) IMMEDIATELY to execute the task. DO NOT just explain in plain text how ' +
      'the user can do it manually — ALWAYS EXECUTE IT DIRECTLY via tool calls.',
  )
  lines.push(
    'All tool actions are immediately applied to the project and canvas in real time. Provide a concise, clear ' +
      'summary of the completed actions after the tool execution completes.',
  )
  lines.push(
    'If a request is genuinely ambiguous, call ask_user once to clarify, then execute. Never ask a question ' +
      'that has already been asked.' +
      (askedQuestions.length ? ` Already asked: ${askedQuestions.join(' | ')}.` : ''),
  )
  lines.push(
    'Editing capabilities: You can split clips at any time position, trim start/end edges to shorten or extend, ' +
      'move clips to different positions, join adjacent clips on the same track into one, delete clips, ' +
      'adjust properties (opacity, volume, speed, rotation), and change the project aspect ratio. ' +
      'You can also add 3D models from Poly Haven or Sketchfab (add_3d_model), animate their camera with set_3d_camera ' +
      '(turntable spin, orbit, dolly zoom, or static; set azimuth/elevation/radius/fov to frame the shot), and render a ' +
      'fully camera-animated 3D shot to a video clip with animate_3d_model. ' +
      'You can research facts on the web via web_research (Firecrawl) to ground scripts and slides in real information. ' +
      'You can analyze the video locally (analyze_video / understand_video: transcripts, scenes, on-screen text), add a ' +
      'captions layer (add_caption), and render a preview (render_preview). ' +
      'Always target clips by name. To remove a section from the middle of a clip, split it twice then delete the middle part. ' +
      'Before making big changes, consider running check_quality (applies immediately, read-only) to spot problems ' +
      'such as overlapping clips, missing media, or a weak opening/ending.',
  )
  lines.push(
    'Subagent Orchestration: You operate as the Master AI Director coordinating 7 specialized subagent roles:',
    '  1. Script & Narrative Architect (script_architect): Formulates viral hooks, scene structures, CTAs (generate_script, rewrite_script, script_hook, script_cta).',
    '  2. Audio & Voiceover Producer (audio_producer): Synthesizes TTS voiceovers, searches background music, ducks audio under dialogue, and denoises clips (generate_voiceover, search_music, denoise_audio).',
    '  3. Visual & Avatar Animator (visual_animator): Renders Wav2Lip avatar presenters, Marp presentation slides, and motion graphics (generate_avatar_intro, generate_avatar_presenter, generate_slides, generate_motion_graphics).',
    '  4. Media & 3D Asset Curator (asset_curator): Discovers Poly Haven/Sketchfab 3D models with animated cameras, stock photos, and reaction stickers (add_3d_model, animate_3d_model, set_3d_camera, search_stock_image, add_sticker).',
    '  5. Timeline & Pacing Assembler (timeline_editor): Executes cuts, splits, trimming, transitions, playback speed ramps, and magnetic snapping (split_clip, trim_clip, move_clip, join_clips, set_transition, set_clip_speed, set_project_ratio).',
    '  6. Typography & Motion Subtitler (motion_subtitler): Generates animated karaoke captions, styled title cards, and lower thirds (auto_generate_captions, add_text_overlay, add_caption).',
    '  7. Quality Critic & Director Reviewer (quality_critic): Audits timeline health, eliminates dead gaps (>1.5s), resolves audio overlaps, and refines pacing (check_quality, review_project).',
  )
  lines.push(
    'For comprehensive, high-level requests (e.g. "Create a 30-second video about Quantum Computing" or "Auto-edit my raw footage"): ' +
      'call execute_autonomous_video_plan or plan_edit with clear subagent actions. ' +
      'You have complete context over all timeline tracks, transcripts, OCR text, and media assets.',
  )
  lines.push('\n' + VIDEO_EDITING_MANUAL)
  return lines.join('\n')
}

export async function chatCompletion(
  provider: DirectorProvider,
  messages: ChatMessage[],
  tools?: Array<Record<string, unknown>>,
): Promise<ChatMessage> {
  const body: Record<string, unknown> = {
    model: provider.config.model,
    temperature: provider.config.temperature,
    max_tokens: provider.config.maxTokens,
    messages: messages.map((m) => {
      const base: Record<string, unknown> = { role: m.role, content: m.content }
      if (m.tool_call_id) base.tool_call_id = m.tool_call_id
      if (m.name) base.name = m.name
      if (m.tool_calls) {
        base.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      }
      return base
    }),
  }
  if (tools && tools.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), provider.config.timeoutMs)
  try {
    const baseUrl = provider.config.baseUrl ?? ''
    const apiKey = provider.config.apiKey ?? ''
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }
    const res = needsProxy(url)
      ? await proxyFetch(url, { ...init, signal: undefined }, provider.config.timeoutMs)
      : await fetch(url, init)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`AI provider error ${res.status}: ${text.slice(0, 200) || res.statusText}`)
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          role?: string
          content?: string | null
          tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
        }
      }>
    }
    const msg = data.choices?.[0]?.message
    if (!msg) throw new Error('Empty response from AI provider')
    return {
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: (msg.tool_calls ?? []).map((tc) => ({
        id: tc.id ?? crypto.randomUUID(),
        name: tc.function?.name ?? '',
        arguments: safeParse(tc.function?.arguments),
      })),
    }
  } finally {
    clearTimeout(timer)
  }
}

export function safeParse(json: string | undefined): Record<string, unknown> {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}