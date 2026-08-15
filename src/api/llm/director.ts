import { useApiConfigStore } from '@/api/config/store'
import { useTimelineStore } from '@/stores/timelineStore'
import type { LLMProviderConfig } from '@/api/config/types'

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
  config: LLMProviderConfig
}

export function getDirectorProvider(): DirectorProvider | null {
  const { config } = useApiConfigStore.getState()
  const candidates: Array<{ name: string; cfg: LLMProviderConfig }> = [
    { name: 'NVIDIA NIM', cfg: config.nvidiaNim },
    { name: 'OpenCode Zen', cfg: config.opencodeZen },
  ]
  for (const { name, cfg } of candidates) {
    if (cfg.enabled && cfg.apiKey && cfg.baseUrl && cfg.model) {
      return { name, config: cfg }
    }
  }
  return null
}

export function getProjectContextSystemPrompt(): string {
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
    for (const a of assets) lines.push(`  - "${a.name}" (${a.type})`)
  }
  lines.push(
    `User preferences: language=${prefs.language}, aspect=${prefs.defaultAspectRatio}, confirm=${prefs.confirmationLevel}.`,
  )
  lines.push(
    'Most tool calls are staged for review: they are NOT applied until the user approves them, so do not claim ' +
      'you already changed something when you have only proposed it. Only set_playhead applies immediately. ' +
      'When you propose actions, summarize what is awaiting approval. Keep replies short and friendly.',
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
    const res = await fetch(`${provider.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
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