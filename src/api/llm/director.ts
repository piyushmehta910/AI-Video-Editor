import { useApiConfigStore } from '@/api/config/store'
import { useTimelineStore } from '@/stores/timelineStore'
import { needsProxy, proxyFetch } from '@/api/proxy'
import type { LLMConfig } from '@/api/config/types'

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

export function getDirectorProvider(): DirectorProvider | null {
  const { config } = useApiConfigStore.getState()
  const preferred = config.preferences.preferredAiProvider
  const candidates: Array<{ name: string; cfg: LLMConfig }> = [
    { name: 'NVIDIA NIM', cfg: config.nvidiaNim },
    { name: 'OpenCode Zen', cfg: config.opencodeZen },
    { name: 'OpenRouter', cfg: config.openRouter },
  ]
  const tryCandidate = (name: string, cfg: LLMConfig): DirectorProvider | null =>
    cfg.enabled && cfg.apiKey && cfg.baseUrl && cfg.model ? { name, config: cfg } : null
  if (preferred) {
    const prefs: Record<string, { name: string; cfg: LLMConfig }> = {
      'nvidia-nim': { name: 'NVIDIA NIM', cfg: config.nvidiaNim },
      'opencode-zen': { name: 'OpenCode Zen', cfg: config.opencodeZen },
      'openrouter': { name: 'OpenRouter', cfg: config.openRouter },
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
    'Most tool calls are staged for review: they are NOT applied until the user approves them, so do not claim ' +
      'you already changed something when you have only proposed it. Only set_playhead applies immediately. ' +
      'When you propose actions, summarize what is awaiting approval. Keep replies short and friendly.',
  )
  lines.push(
    'Before making ANY non-trivial set of edits, call plan_edit first with the goal, the scenes/clips affected, ' +
      'and the exact tool actions plus a one-line reason for each. The plan is shown to the user and nothing is ' +
      'applied until they approve it. For a single obvious action you may call the tool directly instead.',
  )
  lines.push(
    'If a request is genuinely ambiguous, call ask_user exactly once with one concise question, then use the ' +
      'answer. Never ask a question that has already been asked in this project.' +
      (askedQuestions.length ? ` Already asked: ${askedQuestions.join(' | ')}.` : ''),
  )
  lines.push(
    'For open-ended improvement requests such as "make this better", "improve this" or "polish it", call ' +
      'review_project to produce an itemized issue list with Fix All / Review Changes options. Never silently ' +
      'rewrite the project in response to a vague request.',
  )
  lines.push(
    'After any AI edits are applied, a quality check runs automatically and the findings are shown as notes — ' +
      'they are never auto-fixed without your say-so.',
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
    'For broad autonomous requests like "auto-edit my video" or "make a video about X": first call understand_video ' +
      'to build full context (transcripts, scenes, on-screen text), then plan_edit with a concrete creative plan, ' +
      'then execute after approval. Choose pacing, transitions, captions, music, images or slides where they genuinely help.',
  )
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