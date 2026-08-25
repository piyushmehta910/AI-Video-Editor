import * as React from 'react'
import {
  Check,
  Clapperboard,
  Cpu,
  GripHorizontal,
  HelpCircle,
  ListChecks,
  Maximize2,
  Mic,
  Minimize2,
  Palette,
  Scissors,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Subtitles,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useApiConfigStore } from '@/api/config/store'
import { chatCompletion, getDirectorProvider, getProjectContextSystemPrompt, type ChatMessage } from '@/api/llm/director'
import {
  DIRECTOR_TOOLS,
  applyTool,
  canonicalTool,
  describeTool,
  isStagedTool,
} from '@/api/llm/tools'
import { buildDirectorContext, collectTimelineScenes } from '@/api/llm/context'
import { checkTimeline, type QualityIssue } from '@/ai/quality/checker'
import {
  applyPlan,
  normalizePlan,
  qualityNotes,
  runQualityReview,
  type EditPlan,
} from '@/api/llm/plan'
import { loadAskedQuestions, rememberAskedQuestion } from '@/api/llm/askedQuestions'
import { Button } from '@/components/ui/button'

interface UiMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  tools?: string[]
  proposed?: boolean
  followups?: string[]
  review?: QualityIssue[] | null
}

interface Proposal {
  id: string
  name: string
  args: Record<string, unknown>
  label: string
  status: 'pending' | 'applied' | 'failed' | 'discarded'
  message?: string
}

interface PendingPlan {
  plan: EditPlan
  status: 'pending' | 'applied' | 'failed'
}

const FOLLOWUP_SUGGESTIONS: Record<string, string[]> = {
  search_stock_image: ['Add a stock image for the intro', 'Search for background music', 'Add captions'],
  search_music: ['Search for another music track', 'Adjust music volume', 'Add captions'],
  generate_captions: ['Style the captions bold', 'Add a stock image', 'Generate a voiceover'],
  add_caption: ['Style the captions', 'Add a stock image', 'Generate a voiceover'],
  generate_voiceover: ['Generate a longer voiceover', 'Search for music', 'Add captions'],
  duplicate_clip: ['Duplicate another clip', 'Trim the duplicate', 'Add a transition'],
  generate_transcript: ['Add captions from the transcript', 'Remove silent parts', 'Summarize the content'],
  understand_video: ['Add captions from the transcript', 'Remove silent parts', 'Summarize the content'],
  review_project: ['Fix all issues', 'Make this into a 30-second short', 'Add captions'],
  default: ['Add captions', 'Search for music', 'Search for a stock image'],
}

function suggestFollowups(usedTools: string[]): string[] {
  const picks = new Set<string>()
  for (const t of usedTools) {
    const list = FOLLOWUP_SUGGESTIONS[t] || FOLLOWUP_SUGGESTIONS.default
    for (const s of list) picks.add(s)
    if (picks.size >= 3) break
  }
  return [...picks].slice(0, 3)
}

import {
  NVIDIA_NIM_MODELS,
  OPENROUTER_MODELS,
  OPENCODE_ZEN_MODELS,
  type ModelOption,
} from '@/api/llm/models'

export const DIRECTOR_NVIDIA_MODELS = NVIDIA_NIM_MODELS
export const DIRECTOR_OPENROUTER_MODELS = OPENROUTER_MODELS
export const DIRECTOR_ZEN_MODELS = OPENCODE_ZEN_MODELS

const MAX_PROPOSALS = 20

const ISSUE_STYLE: Record<QualityIssue['severity'], string> = {
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'border-muted bg-muted/40 text-muted-foreground',
}

interface Position {
  x: number
  y: number
}

interface PanelSize {
  width: number
  height: number
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const STORAGE_KEY = 'clipforge_ai_director_pos'
const SIZE_STORAGE_KEY = 'clipforge_ai_director_size'
const LAUNCHER_STORAGE_KEY = 'clipforge-ai-director-launcher-pos'

function getInitialSize(): PanelSize {
  if (typeof window === 'undefined') return { width: 440, height: 580 }
  try {
    const saved = localStorage.getItem(SIZE_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        const maxWidth = Math.max(320, window.innerWidth - 20)
        const maxHeight = Math.max(380, window.innerHeight - 20)
        return {
          width: Math.min(Math.max(320, parsed.width), maxWidth),
          height: Math.min(Math.max(380, parsed.height), maxHeight),
        }
      }
    }
  } catch {
    // fallback
  }
  const defaultWidth = Math.min(440, window.innerWidth - 20)
  const defaultHeight = Math.min(580, window.innerHeight - 60)
  return { width: defaultWidth, height: defaultHeight }
}

function getInitialPosition(): Position {
  if (typeof window === 'undefined') return { x: 20, y: 100 }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const maxX = Math.max(10, window.innerWidth - 410)
        const maxY = Math.max(10, window.innerHeight - 560)
        return {
          x: Math.min(Math.max(10, parsed.x), maxX),
          y: Math.min(Math.max(10, parsed.y), maxY),
        }
      }
    }
  } catch {
    // fallback
  }
  const defaultX = Math.max(10, window.innerWidth - 460)
  const defaultY = Math.max(10, window.innerHeight - 640)
  return { x: defaultX, y: defaultY }
}

function getInitialLauncherPosition(): Position {
  if (typeof window === 'undefined') return { x: 20, y: 20 }
  try {
    const saved = localStorage.getItem(LAUNCHER_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const maxX = Math.max(10, window.innerWidth - 70)
        const maxY = Math.max(10, window.innerHeight - 70)
        return {
          x: Math.min(Math.max(10, parsed.x), maxX),
          y: Math.min(Math.max(10, parsed.y), maxY),
        }
      }
    }
  } catch {
    // fallback
  }
  const defaultX = Math.max(10, window.innerWidth - 85)
  const defaultY = Math.max(10, window.innerHeight - 130)
  return { x: defaultX, y: defaultY }
}

export function AIDirector({
  initialPrompt,
  open: controlledOpen,
  onOpenChange,
}: {
  initialPrompt?: string
  /** Controlled visibility (e.g. from the top toolbar). Uncontrolled floating launcher is used when omitted. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const changeOpen = (value: boolean | ((o: boolean) => boolean)) => {
    const current = controlledOpen ?? internalOpen
    const next = typeof value === 'function' ? value(current) : value
    setOpen(next)
    onOpenChange?.(next)
  }
  const [position, setPosition] = React.useState<Position>(getInitialPosition)
  const [size, setSize] = React.useState<PanelSize>(getInitialSize)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [isMaximized, setIsMaximized] = React.useState(false)
  const preMaximizeRef = React.useRef<{ position: Position; size: PanelSize } | null>(null)

  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null)
  const resizeStartRef = React.useRef<{
    direction: ResizeDirection
    mouseX: number
    mouseY: number
    startWidth: number
    startHeight: number
    startX: number
    startY: number
  } | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  // Dedicated drag ref for the minimized pill (independent from full-panel drag)
  const minimizedDragRef = React.useRef<{
    mouseX: number
    mouseY: number
    startX: number
    startY: number
    hasMoved: boolean
  } | null>(null)

  // Production mode: autopilot = auto-apply all changes; review = stage for approval
  const [productionMode, setProductionMode] = React.useState<'autopilot' | 'review'>(() => {
    try { return (localStorage.getItem('ai_director_mode') as 'autopilot' | 'review') || 'autopilot' } catch { return 'autopilot' }
  })

  // Viewport resize guard
  React.useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const width = size.width || 440
        const height = size.height || 580
        const maxX = Math.max(10, window.innerWidth - width - 10)
        const maxY = Math.max(10, window.innerHeight - height - 10)
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(10, prev.y), maxY),
        }
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [size.width, size.height])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isMaximized) return
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('input')) return

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    }
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY
    const width = size.width || 440
    const height = size.height || 580
    const maxX = Math.max(10, window.innerWidth - width - 10)
    const maxY = Math.max(10, window.innerHeight - height - 10)

    const nextX = Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX)
    const nextY = Math.min(Math.max(10, dragStartRef.current.startY + dy), maxY)

    setPosition({ x: nextX, y: nextY })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    dragStartRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
    } catch {
      // ignore
    }
  }

  const handleResizePointerDown = (e: React.PointerEvent, direction: ResizeDirection) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0 || isMaximized) return

    resizeStartRef.current = {
      direction,
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
      startX: position.x,
      startY: position.y,
    }
    setIsResizing(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeStartRef.current) return
    const { direction, mouseX, mouseY, startWidth, startHeight, startX, startY } = resizeStartRef.current
    const dx = e.clientX - mouseX
    const dy = e.clientY - mouseY

    const minWidth = 320
    const minHeight = 380
    const maxWidth = Math.max(minWidth, window.innerWidth - 20)
    const maxHeight = Math.max(minHeight, window.innerHeight - 20)

    let newWidth = startWidth
    let newHeight = startHeight
    let newX = startX
    let newY = startY

    if (direction.includes('e')) {
      newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + dx))
    }
    if (direction.includes('w')) {
      const desiredWidth = startWidth - dx
      newWidth = Math.min(maxWidth, Math.max(minWidth, desiredWidth))
      newX = startX + (startWidth - newWidth)
    }
    if (direction.includes('s')) {
      newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight + dy))
    }
    if (direction.includes('n')) {
      const desiredHeight = startHeight - dy
      newHeight = Math.min(maxHeight, Math.max(minHeight, desiredHeight))
      newY = startY + (startHeight - newHeight)
    }

    newX = Math.max(10, Math.min(newX, window.innerWidth - newWidth - 10))
    newY = Math.max(10, Math.min(newY, window.innerHeight - newHeight - 10))

    const updatedSize = { width: Math.round(newWidth), height: Math.round(newHeight) }
    const updatedPos = { x: Math.round(newX), y: Math.round(newY) }
    setSize(updatedSize)
    setPosition(updatedPos)
  }

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!isResizing) return
    setIsResizing(false)
    resizeStartRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
    } catch {
      // ignore
    }
  }

  const toggleMaximize = () => {
    if (isMaximized) {
      if (preMaximizeRef.current) {
        setPosition(preMaximizeRef.current.position)
        setSize(preMaximizeRef.current.size)
      }
      setIsMaximized(false)
    } else {
      preMaximizeRef.current = { position, size }
      setPosition({ x: 16, y: 16 })
      setSize({
        width: Math.max(320, window.innerWidth - 32),
        height: Math.max(380, window.innerHeight - 32),
      })
      setIsMaximized(true)
    }
  }

  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<UiMessage[]>([])
  const [busy, setBusy] = React.useState(false)
  const [proposals, setProposals] = React.useState<Proposal[]>([])
  const [showQuality, setShowQuality] = React.useState(false)
  const [issues, setIssues] = React.useState<QualityIssue[]>([])
  const [checking, setChecking] = React.useState(false)

  const [launcherPos, setLauncherPos] = React.useState<Position>(getInitialLauncherPosition)
  const launcherDragStartRef = React.useRef<{
    mouseX: number
    mouseY: number
    startX: number
    startY: number
    hasMoved: boolean
  } | null>(null)

  const handleLauncherPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    launcherDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: launcherPos.x,
      startY: launcherPos.y,
      hasMoved: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleLauncherPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!launcherDragStartRef.current) return
    const dx = e.clientX - launcherDragStartRef.current.mouseX
    const dy = e.clientY - launcherDragStartRef.current.mouseY
    if (!launcherDragStartRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      launcherDragStartRef.current.hasMoved = true
    }
    if (launcherDragStartRef.current.hasMoved) {
      const maxX = Math.max(10, window.innerWidth - 65)
      const maxY = Math.max(10, window.innerHeight - 65)
      const nextX = Math.min(Math.max(10, launcherDragStartRef.current.startX + dx), maxX)
      const nextY = Math.min(Math.max(10, launcherDragStartRef.current.startY + dy), maxY)
      setLauncherPos({ x: nextX, y: nextY })
    }
  }

  const handleLauncherPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!launcherDragStartRef.current) return
    const wasMoved = launcherDragStartRef.current.hasMoved
    const finalX = launcherPos.x
    const finalY = launcherPos.y
    launcherDragStartRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (wasMoved) {
      try {
        localStorage.setItem(LAUNCHER_STORAGE_KEY, JSON.stringify({ x: finalX, y: finalY }))
      } catch {
        // ignore
      }
    } else {
      // Clean tap/click -> open panel!
      changeOpen(true)
      setIsMinimized(false)
    }
  }

  // ── Minimized pill dedicated drag handlers ──────────────────────────────────
  const handleMinimizedPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.target as HTMLElement
    // Allow button clicks through without starting drag
    if (target.closest('button') || target.closest('a')) return
    minimizedDragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
      hasMoved: false,
    }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleMinimizedPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!minimizedDragRef.current) return
    const dx = e.clientX - minimizedDragRef.current.mouseX
    const dy = e.clientY - minimizedDragRef.current.mouseY
    if (!minimizedDragRef.current.hasMoved && Math.hypot(dx, dy) > 3) {
      minimizedDragRef.current.hasMoved = true
    }
    if (minimizedDragRef.current.hasMoved) {
      const pillW = (e.currentTarget as HTMLElement).offsetWidth || 210
      const pillH = (e.currentTarget as HTMLElement).offsetHeight || 38
      const maxX = Math.max(5, window.innerWidth - pillW - 5)
      const maxY = Math.max(5, window.innerHeight - pillH - 5)
      const nextX = Math.min(Math.max(5, minimizedDragRef.current.startX + dx), maxX)
      const nextY = Math.min(Math.max(5, minimizedDragRef.current.startY + dy), maxY)
      setPosition({ x: nextX, y: nextY })
    }
  }

  const handleMinimizedPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!minimizedDragRef.current) return
    const hasMoved = minimizedDragRef.current.hasMoved
    const finalPos = { ...position }
    minimizedDragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    if (hasMoved) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos))
      } catch {
        // ignore
      }
    }
  }

  const toggleProductionMode = () => {
    setProductionMode((prev) => {
      const next = prev === 'review' ? 'autopilot' : 'review'
      try { localStorage.setItem('ai_director_mode', next) } catch { /* ignore */ }
      return next
    })
  }

  interface PendingQuestionState {
    question: string
    options?: string[]
  }

  const [plan, setPlan] = React.useState<PendingPlan | null>(null)
  const [pendingQuestion, setPendingQuestion] = React.useState<PendingQuestionState | null>(null)
  const [questionAnswer, setQuestionAnswer] = React.useState('')
  const [revising, setRevising] = React.useState(false)
  const [reviseInput, setReviseInput] = React.useState('')
  const [askedQuestions, setAskedQuestions] = React.useState<string[]>([])
  // Destructive tools park their effect here until the user confirms (dialog below).
  const [confirmAction, setConfirmAction] = React.useState<{ toolName: string; args: Record<string, unknown>; onConfirm: () => void } | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const pendingAnswerRef = React.useRef<((answer: string) => void) | null>(null)

  const apiConfig = useApiConfigStore((s) => s.config)
  const updateApiConfig = useApiConfigStore((s) => s.update)
  const [showModelMenu, setShowModelMenu] = React.useState(false)

  const [onlyFreeModels, setOnlyFreeModels] = React.useState(false)

  const rawProvider = apiConfig.preferences.preferredAiProvider || 'nvidia-nim'
  const activeProviderKey: 'nvidia-nim' | 'openrouter' | 'opencode-zen' =
    rawProvider === 'openRouter' || rawProvider === 'openrouter'
      ? 'openrouter'
      : rawProvider === 'opencodeZen' || rawProvider === 'opencode-zen'
        ? 'opencode-zen'
        : 'nvidia-nim'

  const activeModel =
    activeProviderKey === 'nvidia-nim'
      ? (apiConfig.nvidiaNim.model || 'meta/llama-3.3-70b-instruct')
      : activeProviderKey === 'opencode-zen'
        ? (apiConfig.opencodeZen.model || 'deepseek-v4-flash-free')
        : (apiConfig.openRouter.model || 'nvidia/nemotron-3.5-lightning:free')

  const handleSelectDirectorModel = (providerKey: 'nvidia-nim' | 'openrouter' | 'opencode-zen', modelId: string) => {
    updateApiConfig((draft) => {
      draft.preferences.preferredAiProvider = providerKey
      if (providerKey === 'nvidia-nim') {
        draft.nvidiaNim.model = modelId
        draft.nvidiaNim.enabled = true
      } else if (providerKey === 'opencode-zen') {
        draft.opencodeZen.model = modelId
        draft.opencodeZen.enabled = true
      } else {
        draft.openRouter.model = modelId
        draft.openRouter.enabled = true
      }
      return draft
    })
    setShowModelMenu(false)
  }

  const hydrateTimeline = useTimelineStore((s) => s.hydrate)
  const hydrateConfig = useApiConfigStore((s) => s.hydrate)
  const configHydrated = useApiConfigStore((s) => s.hydrated)
  const timelineHydrated = useTimelineStore((s) => s.hydrated)
  const projectId = useTimelineStore((s) => s.project.id)

  React.useEffect(() => {
    void hydrateTimeline()
    void hydrateConfig()
  }, [hydrateTimeline, hydrateConfig])

  React.useEffect(() => {
    if (timelineHydrated) setAskedQuestions(loadAskedQuestions(projectId))
  }, [timelineHydrated, projectId])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const runQualityCheck = React.useCallback(async () => {
    setChecking(true)
    try {
      const store = useTimelineStore.getState()
      const scenes = await collectTimelineScenes()
      setIssues(checkTimeline(store.project, store.assets, { scenes }))
    } finally {
      setChecking(false)
    }
  }, [])

  /** Prompt the user for the answer to an AI question with optional MCQ options and resolve with it. */
  const promptQuestion = React.useCallback((question: string, options?: string[]): Promise<string> => {
    return new Promise((resolve) => {
      pendingAnswerRef.current = resolve
      setQuestionAnswer('')
      setPendingQuestion({ question, options })
    })
  }, [])

  const submitAnswer = (customVal?: string) => {
    const answer = (typeof customVal === 'string' ? customVal : questionAnswer).trim()
    if (!answer || !pendingAnswerRef.current) return
    const resolve = pendingAnswerRef.current
    pendingAnswerRef.current = null
    setPendingQuestion(null)
    setQuestionAnswer('')
    resolve(answer)
  }

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setInput('')
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
      setBusy(true)
      try {
        const provider = getDirectorProvider()
        if (!provider) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'ai',
              text: 'No AI provider is configured yet. Add an API key for NVIDIA NIM, OpenCode Zen or OpenRouter in Settings, then I can help you edit.',
              tools: [],
            },
          ])
          return
        }

        const confirmationLevel = useApiConfigStore.getState().config.preferences.confirmationLevel
        const autoApply = productionMode === 'autopilot' || confirmationLevel !== 'always'

        const baseSystem = getProjectContextSystemPrompt(askedQuestions)
        let understanding = ''
        try {
          understanding = await buildDirectorContext()
        } catch {
          understanding = ''
        }

        const apiMessages: ChatMessage[] = [
          { role: 'system', content: understanding ? `${baseSystem}\n\n${understanding}` : baseSystem },
        ]
        for (const m of messages) {
          apiMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
        }
        apiMessages.push({ role: 'user', content: trimmed })

        let finalText = ''
        const usedTools: string[] = []
        const proposedTools: string[] = []
        let stagedCount = 0
        let appliedThisTurn = false
        let reviewIssues: QualityIssue[] | null = null
        let reviewDone = false
        let pendingPlan: EditPlan | null = null
        let planned = false
        let loops = 0
        while (loops < 6) {
          loops++
          const reply = await chatCompletion(provider, apiMessages, DIRECTOR_TOOLS)
          apiMessages.push(reply)
          if (!reply.tool_calls?.length) {
            if (reply.content) {
              finalText = reply.content
              break
            }
            loops++
            continue
          }

          planned = false
          let asked = false
          for (const tc of reply.tool_calls) {
            const name = canonicalTool(tc.name)
            if (name === 'plan_edit') {
              const p = normalizePlan(tc.arguments)
              if (p) {
                pendingPlan = p
                setPlan({ plan: p, status: 'pending' })
                planned = true
                apiMessages.push({ role: 'tool', content: `Plan staged for approval: ${p.goal}`, tool_call_id: tc.id })
              } else {
                apiMessages.push({
                  role: 'tool',
                  content: 'The proposed plan was invalid (unknown tool or bad arguments). Re-plan with valid tool actions.',
                  tool_call_id: tc.id,
                })
              }
              break
            } else if (name === 'ask_user') {
              const q = String(tc.arguments.question ?? '').trim()
              const rawOptions = Array.isArray(tc.arguments.options)
                ? (tc.arguments.options as unknown[]).map(String).filter((s) => s.trim().length > 0)
                : []
              if (q && !askedQuestions.includes(q)) {
                const next = rememberAskedQuestion(projectId, q)
                setAskedQuestions(next)
                const answer = await promptQuestion(q, rawOptions.length > 0 ? rawOptions : undefined)
                apiMessages.push({ role: 'tool', content: `User answered: ${answer}`, tool_call_id: tc.id })
                asked = true
              } else {
                apiMessages.push({
                  role: 'tool',
                  content: 'You already asked that question in this project. Make your best guess instead.',
                  tool_call_id: tc.id,
                })
              }
            } else if (name === 'review_project') {
              const found = await runQualityReview()
              setIssues(found)
              setShowQuality(true)
              reviewIssues = found
              reviewDone = true
              const msg = found.length
                ? found.map((i) => `- [${i.severity}] ${i.message}${i.fix.kind !== 'none' ? ` (${i.fix.label})` : ''}`).join('\n')
                : 'The project looks clean — no improvements needed right now.'
              apiMessages.push({ role: 'tool', content: msg, tool_call_id: tc.id })
            } else if (isStagedTool(name)) {
              if (autoApply) {
                const result = await applyTool(name, tc.arguments)
                appliedThisTurn = true
                usedTools.push(name)
                apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
              } else if (stagedCount < MAX_PROPOSALS) {
                const label = describeTool(name, tc.arguments)
                if (label) {
                  stagedCount++
                  proposedTools.push(name)
                  setProposals((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), name, args: tc.arguments, label, status: 'pending' },
                  ])
                  apiMessages.push({
                    role: 'tool',
                    content: `Staged for user review (not yet applied): ${label}`,
                    tool_call_id: tc.id,
                  })
                } else {
                  apiMessages.push({
                    role: 'tool',
                    content: 'Invalid arguments for that action; do not call it again.',
                    tool_call_id: tc.id,
                  })
                }
              } else {
                apiMessages.push({
                  role: 'tool',
                  content: `Too many pending actions (max ${MAX_PROPOSALS}). The user must approve or discard pending actions before more can be staged.`,
                  tool_call_id: tc.id,
                })
              }
            } else {
              const result = await applyTool(name, tc.arguments)
              usedTools.push(name)
              apiMessages.push({ role: 'tool', content: result.message, tool_call_id: tc.id })
            }
          }
          if (planned) break
          if (asked) continue
          if (reviewDone) break
          loops++
        }

        if (pendingPlan) {
          finalText = `Here's my plan for "${pendingPlan.goal}" — approve it to apply the edits, or tell me what to change.`
        }
        if (reviewDone) {
          finalText =
            reviewIssues && reviewIssues.length
              ? `${reviewIssues.length} improvement${reviewIssues.length > 1 ? 's' : ''} available — use Fix All or review the changes below.`
              : 'The project looks clean — no improvements needed right now.'
        }
        if (!finalText && usedTools.length) {
          finalText = `Done — applied ${usedTools.join(', ')}.`
        }
        if (!finalText && stagedCount > 0) {
          finalText = `I've proposed ${stagedCount} change${stagedCount > 1 ? 's' : ''} — review ${
            stagedCount > 1 ? 'them' : 'it'
          } above before it takes effect.`
        }
        if (!finalText) finalText = 'I could not complete that request. Please rephrase it.'

        let notes: string[] = []
        if (appliedThisTurn) {
          const found = await runQualityReview()
          setIssues(found)
          notes = qualityNotes(found)
          if (notes.length) {
            finalText += `\n\nQuality notes after my edits:\n${notes.map((n) => `- ${n}`).join('\n')}`
          }
        }
        if (reviewIssues && reviewIssues.length) {
          finalText += `\n\n${reviewIssues.length} improvement${reviewIssues.length > 1 ? 's' : ''} available — use Fix All or review the changes below.`
        }

        const isPlan = pendingPlan !== null
        const followups = suggestFollowups(
          pendingPlan
            ? pendingPlan.actions.map((a) => a.tool)
            : usedTools.length
              ? usedTools
              : proposedTools,
        )
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: finalText,
            tools: pendingPlan
              ? pendingPlan.actions.map((a) => a.tool)
              : proposedTools.length
                ? proposedTools
                : usedTools.length
                  ? usedTools
                  : undefined,
            proposed: isPlan || (!autoApply && proposedTools.length > 0),
            followups,
            review: reviewIssues,
          },
        ])
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: `Something went wrong: ${err instanceof Error ? err.message : String(err)}`,
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [busy, messages, askedQuestions, projectId, promptQuestion, productionMode],
  )

  React.useEffect(() => {
    if (!open || !initialPrompt) return
    if (!timelineHydrated || !configHydrated) return
    const p = initialPrompt
    changeOpen(true)
    void send(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, timelineHydrated, configHydrated])

  const applyOne = async (id: string) => {
    const target = proposals.find((p) => p.id === id)
    if (!target || target.status !== 'pending') return

    // Check if the tool is destructive and requires confirmation
    const toolDef = DIRECTOR_TOOLS.find((t) => t.function.name === target.name)
    const isDestructive = toolDef?.function.destructive === true

    if (isDestructive) {
      setConfirmAction({
        toolName: target.name,
        args: target.args,
        onConfirm: async () => {
          const store = useTimelineStore.getState()
          store.withTransaction(() => {
            void (async () => {
              const result = await applyTool(target.name, target.args, { undoStep: false })
              setProposals((prev) =>
                prev.map((p) => (p.id === id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p)),
              )
              void refreshQualityAfterEdit()
            })()
          }, { type: 'edit', description: `AI: ${target.name}` })
        },
      })
      return
    }

    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      void (async () => {
        const result = await applyTool(target.name, target.args, { undoStep: false })
        setProposals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p)),
        )
        void refreshQualityAfterEdit()
      })()
    }, { type: 'edit', description: `AI: ${target.name}` })
  }

  const applyAll = () => {
    const pending = proposals.filter((p) => p.status === 'pending')
    if (!pending.length) return
    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      for (const target of pending) {
        void (async () => {
          const result = await applyTool(target.name, target.args, { undoStep: false })
          setProposals((prev) =>
            prev.map((p) =>
              p.id === target.id ? { ...p, status: result.ok ? 'applied' : 'failed', message: result.message } : p,
            ),
          )
        })()
      }
      void refreshQualityAfterEdit()
    }, { type: 'edit', description: `AI: applied ${pending.length} proposal${pending.length !== 1 ? 's' : ''}` })
  }

  const refreshQualityAfterEdit = React.useCallback(async () => {
    const found = await runQualityReview()
    setIssues(found)
    if (found.length) setShowQuality(true)
  }, [])

  const approvePlan = async () => {
    if (!plan || plan.status !== 'pending') return
    setPlan({ ...plan, status: 'applied' })
    try {
      const result = await applyPlan(plan.plan)
      let text = `Applied ${result.applied.length} change${result.applied.length !== 1 ? 's' : ''}:`
      text +=
        '\n' +
        result.applied.map((a) => `- ${a.label}${a.reason ? ` — ${a.reason}` : ''}`).join('\n')
      if (result.skipped.length) {
        text += `\nSkipped ${result.skipped.length} (no longer valid): ${result.skipped.map((s) => s.label).join(', ')}`
      }
      const found = await runQualityReview()
      setIssues(found)
      const notes = qualityNotes(found)
      if (notes.length) {
        text += `\n\nQuality notes after my edits:\n${notes.map((n) => `- ${n}`).join('\n')}`
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          text,
          tools: plan.plan.actions.map((a) => a.tool),
        },
      ])
    } catch (err) {
      setPlan({ ...plan, status: 'failed' })
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          text: `Applying the plan failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ])
    }
  }

  const startRevise = () => {
    setRevising(true)
    setReviseInput('')
  }

  const submitRevise = () => {
    const revised = reviseInput.trim()
    setRevising(false)
    setPlan(null)
    if (revised) void send(revised)
  }

  const discardOne = (id: string) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'discarded' } : p)))
  }

  const discardAll = () => {
    setProposals((prev) => prev.map((p) => (p.status === 'pending' ? { ...p, status: 'discarded' } : p)))
  }

  const clearResolved = () => {
    setProposals((prev) => prev.filter((p) => p.status === 'pending'))
  }

  const pendingCount = proposals.filter((p) => p.status === 'pending').length
  const resolvedCount = proposals.length - pendingCount

  const applyIssueFix = (issue: QualityIssue) => {
    if (issue.fix.kind === 'none') return
    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      if (issue.fix.kind === 'remove_clip') {
        store.deleteClips(issue.fix.clipIds)
      } else if (issue.fix.kind === 'resolve_overlap' && issue.fix.moveClipId && issue.fix.targetTime != null) {
        const clip = store.project.tracks
          .flatMap((t) => t.clips)
          .find((c) => c.id === issue.fix.moveClipId)
        if (!clip) return
        const delta = issue.fix.targetTime - clip.startTime
        if (Math.abs(delta) >= 0.01) store.moveClip(clip.id, delta)
      }
    }, { type: 'edit', description: 'AI: fixed quality issue' })
    void refreshQualityAfterEdit()
  }

  const applyAllFixes = () => {
    const fixable = issues.filter((i) => i.fix.kind !== 'none')
    if (!fixable.length) return
    const store = useTimelineStore.getState()
    store.withTransaction(() => {
      for (const issue of fixable) {
        if (issue.fix.kind === 'remove_clip') {
          store.deleteClips(issue.fix.clipIds)
        } else if (issue.fix.kind === 'resolve_overlap' && issue.fix.moveClipId && issue.fix.targetTime != null) {
          const clip = store.project.tracks
            .flatMap((t) => t.clips)
            .find((c) => c.id === issue.fix.moveClipId)
          if (!clip) continue
          const delta = issue.fix.targetTime - clip.startTime
          if (Math.abs(delta) >= 0.01) store.moveClip(clip.id, delta)
        }
      }
    }, { type: 'edit', description: `AI: fixed ${fixable.length} issue${fixable.length !== 1 ? 's' : ''}` })
    void refreshQualityAfterEdit()
  }

  const fixableCount = issues.filter((i) => i.fix.kind !== 'none').length

  return (
    <>
      {!open && (
        <div
          style={{ transform: `translate3d(${launcherPos.x}px, ${launcherPos.y}px, 0)` }}
          className="fixed top-0 left-0 z-50 flex items-center gap-2 group cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={handleLauncherPointerDown}
          onPointerMove={handleLauncherPointerMove}
          onPointerUp={handleLauncherPointerUp}
          onDoubleClick={(e) => {
            e.stopPropagation()
            changeOpen(true)
            setIsMinimized(false)
          }}
          title="Double-click or click to open AI Director (Drag anywhere)"
          aria-label="AI Director"
        >
          <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600/80 via-purple-600/75 to-indigo-600/80 text-white shadow-[0_8px_32px_0_rgba(124,58,237,0.4)] backdrop-blur-2xl border border-white/30 ring-1 ring-white/20 hover:scale-105 hover:border-white/50 transition-all">
            <Clapperboard className="size-7 text-white drop-shadow-md" />
            <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-amber-400/90 shadow-md ring-1 ring-white/40 backdrop-blur-xs">
              <Sparkles className="size-2.5 text-amber-950 fill-amber-950" />
            </span>
            {busy && (
              <span className="absolute -bottom-1 -right-1 size-3.5 animate-ping rounded-full bg-emerald-400" />
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl bg-background/75 dark:bg-slate-950/70 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-xl border border-white/20 backdrop-blur-xl whitespace-nowrap">
            AI Director <span className="text-muted-foreground font-normal">(Double-click or drag)</span>
          </div>
        </div>
      )}

      {open && isMinimized && (
        <div
          ref={panelRef}
          style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
          className="fixed top-0 left-0 z-50 flex select-none items-center gap-2 rounded-full border border-white/30 dark:border-white/15 bg-background/80 dark:bg-slate-950/80 px-3 py-1.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-2xl cursor-grab active:cursor-grabbing touch-none ring-1 ring-white/10"
          onPointerDown={handleMinimizedPointerDown}
          onPointerMove={handleMinimizedPointerMove}
          onPointerUp={handleMinimizedPointerUp}
          onPointerCancel={handleMinimizedPointerUp}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsMinimized(false)
          }}
          title="Drag to move — double-click or click Expand to restore"
        >
          <div className="flex size-5 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xs flex-shrink-0">
            <Clapperboard className="size-3" />
          </div>
          <span className="text-[11px] font-bold text-foreground tracking-tight whitespace-nowrap">AI Director</span>
          {busy && <span className="size-1.5 animate-ping rounded-full bg-violet-400 flex-shrink-0" />}
          <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 flex-shrink-0 ${
            productionMode === 'autopilot'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {productionMode === 'autopilot' ? 'Auto' : 'Review'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsMinimized(false)
            }}
            className="ml-0.5 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground transition flex-shrink-0"
            title="Expand AI Director"
          >
            <Maximize2 className="size-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              changeOpen(false)
            }}
            className="rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground transition flex-shrink-0"
            title="Close AI Director"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {open && !isMinimized && (
        <div
          ref={panelRef}
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            width: isMaximized ? 'calc(100vw - 32px)' : `${size.width}px`,
            height: isMaximized ? 'calc(100vh - 32px)' : `${size.height}px`,
            maxWidth: 'calc(100vw - 20px)',
            maxHeight: 'calc(100vh - 20px)',
          }}
          className={`fixed top-0 left-0 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/30 dark:border-white/15 bg-background/75 dark:bg-slate-950/75 shadow-[0_16px_48px_0_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all ${
            isResizing ? 'select-none' : ''
          }`}
        >
          {/* Draggable Header Bar with Glassmorphism */}
          <div
            className="relative flex cursor-grab active:cursor-grabbing select-none items-center gap-2.5 border-b border-white/15 dark:border-white/10 bg-white/20 dark:bg-white/5 px-4 py-2.5 backdrop-blur-xl touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={toggleMaximize}
            title="Drag header to move • Double-click to maximize or restore"
          >
            <div className="flex items-center text-muted-foreground hover:text-foreground transition">
              <GripHorizontal className="size-4 opacity-75" />
            </div>
            <div className="flex size-7 items-center justify-center rounded-xl bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 shadow-xs">
              <Clapperboard className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold leading-none text-foreground tracking-tight">AI Director</h3>
                {busy ? (
                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-semibold text-violet-400 border border-violet-500/30 animate-pulse">
                    Thinking...
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-muted-foreground truncate text-[10px] pt-0.5">
                Drag to move • Drag edges to resize
              </p>
            </div>

            {/* Header Controls */}
            {/* Header Controls */}
            <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
              {/* AI Model & Provider Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelMenu((s) => !s)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all border ${
                    activeProviderKey === 'nvidia-nim'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : activeProviderKey === 'opencode-zen'
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
                        : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/20'
                  }`}
                  title="Select AI Director Model & Provider"
                >
                  <Cpu className="size-3 shrink-0" />
                  <span className="truncate max-w-[110px]">
                    {activeProviderKey === 'nvidia-nim' ? '⚡ NIM' : activeProviderKey === 'opencode-zen' ? '💻 Zen' : '🌐 Router'}:{' '}
                    {activeModel.split('/').pop()?.replace('-instruct', '')}
                  </span>
                </button>
                {showModelMenu && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-white/25 dark:border-white/15 bg-background/95 dark:bg-slate-950/95 p-2.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI Director Engine</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOnlyFreeModels(!onlyFreeModels)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[9px] font-bold transition border',
                            onlyFreeModels
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground',
                          )}
                          title="Filter to only free endpoint models"
                        >
                          {onlyFreeModels ? '✓ Free Only' : 'Show Free'}
                        </button>
                        <Link to="/settings" className="text-[9px] text-violet-500 hover:underline font-semibold" onClick={() => setShowModelMenu(false)}>
                          Keys
                        </Link>
                      </div>
                    </div>

                    {/* Provider switcher (3 tabs) */}
                    <div className="grid grid-cols-3 gap-0.5 bg-muted/40 p-0.5 rounded-lg border">
                      <button
                        type="button"
                        onClick={() => handleSelectDirectorModel('nvidia-nim', apiConfig.nvidiaNim.model || 'meta/llama-3.3-70b-instruct')}
                        className={cn(
                          'flex items-center justify-center gap-1 py-1 rounded-md text-[9px] font-bold transition truncate',
                          activeProviderKey === 'nvidia-nim' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span>⚡ NIM</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDirectorModel('openrouter', apiConfig.openRouter.model || 'nvidia/nemotron-3.5-lightning:free')}
                        className={cn(
                          'flex items-center justify-center gap-1 py-1 rounded-md text-[9px] font-bold transition truncate',
                          activeProviderKey === 'openrouter' ? 'bg-card text-violet-600 dark:text-violet-400 shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span>🌐 Router</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDirectorModel('opencode-zen', apiConfig.opencodeZen.model || 'deepseek-v4-flash-free')}
                        className={cn(
                          'flex items-center justify-center gap-1 py-1 rounded-md text-[9px] font-bold transition truncate',
                          activeProviderKey === 'opencode-zen' ? 'bg-card text-sky-600 dark:text-sky-400 shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span>💻 Zen</span>
                      </button>
                    </div>

                    {/* Models list */}
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                      {(() => {
                        const rawList: ModelOption[] =
                          activeProviderKey === 'nvidia-nim'
                            ? DIRECTOR_NVIDIA_MODELS
                            : activeProviderKey === 'opencode-zen'
                              ? DIRECTOR_ZEN_MODELS
                              : DIRECTOR_OPENROUTER_MODELS

                        const list = onlyFreeModels ? rawList.filter((m) => m.isFree) : rawList
                        const currentModelId =
                          activeProviderKey === 'nvidia-nim'
                            ? apiConfig.nvidiaNim.model
                            : activeProviderKey === 'opencode-zen'
                              ? apiConfig.opencodeZen.model
                              : apiConfig.openRouter.model

                        if (list.length === 0) {
                          return (
                            <p className="text-[11px] text-muted-foreground text-center py-3">No free models in this category.</p>
                          )
                        }

                        return list.map((m) => {
                          const isSelected = currentModelId === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectDirectorModel(activeProviderKey, m.id)}
                              className={cn(
                                'w-full flex items-start justify-between gap-2 rounded-lg p-2 text-xs text-left transition border',
                                isSelected
                                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-600 dark:text-violet-300 font-bold'
                                  : 'border-transparent bg-muted/20 hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                              )}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="truncate text-[11px] font-semibold text-foreground">{m.name}</span>
                                  {m.isFree ? (
                                    <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 text-[8px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      FREE
                                    </span>
                                  ) : (
                                    <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 text-[8px] font-mono font-semibold text-amber-600 dark:text-amber-400">
                                      PRO
                                    </span>
                                  )}
                                  {m.tag && (
                                    <span className="rounded bg-muted px-1 py-0.2 text-[8px] text-muted-foreground">
                                      {m.tag}
                                    </span>
                                  )}
                                </div>
                                {m.description && (
                                  <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
                                    {m.description}
                                  </p>
                                )}
                              </div>
                              {isSelected && <Check className="size-3.5 text-violet-500 shrink-0 mt-0.5" />}
                            </button>
                          )
                        })
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Autopilot / Review mode toggle */}
              <button
                type="button"
                onClick={toggleProductionMode}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all border ${
                  productionMode === 'autopilot'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                }`}
                title={productionMode === 'autopilot' ? 'Autopilot mode: changes executed directly. Click to switch to Review mode.' : 'Review mode: changes staged for approval. Click to switch to Autopilot.'}
              >
                {productionMode === 'autopilot' ? (
                  <><Zap className="size-2.5 text-emerald-500" /> Auto</>
                ) : (
                  <><ListChecks className="size-2.5 text-amber-500" /> Review</>
                )}
              </button>

              {/* Quality Audit Button with badge */}
              <button
                type="button"
                onClick={() => {
                  setShowQuality((s) => !s)
                  if (!checking && issues.length === 0) void runQualityCheck()
                }}
                className={`relative rounded-lg p-1.5 text-muted-foreground hover:bg-white/15 hover:text-foreground transition ${
                  showQuality ? 'text-violet-600 dark:text-violet-400 bg-white/10' : ''
                }`}
                title="Audit Project Timeline Quality"
                aria-label="Audit Project Quality"
              >
                <ListChecks className="size-3.5" />
                {issues.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white shadow-xs">
                    {issues.length}
                  </span>
                )}
              </button>

              {/* Clear Chat Button */}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([])
                    setProposals([])
                    setPlan(null)
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition"
                  title="Clear chat history"
                  aria-label="Clear chat"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}

              {/* Settings Link */}
              <Link
                to="/settings"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/15 hover:text-foreground transition"
                title="Configure AI provider API keys"
              >
                <Settings className="size-3.5" />
              </Link>

              {/* Maximize / Restore */}
              <button
                type="button"
                onClick={toggleMaximize}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/15 hover:text-foreground transition"
                title={isMaximized ? 'Restore window' : 'Maximize window'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </button>

              {/* Minimize to Pill */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/15 hover:text-foreground transition flex items-center justify-center"
                title="Minimize to floating pill"
                aria-label="Minimize"
              >
                <span className="inline-block w-2.5 h-0.5 bg-current rounded-full" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => changeOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition"
                title="Close AI Director"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && !busy && (
              <div className="space-y-3.5 pt-1">
                {/* Hero Welcome Card */}
                <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-500/10 via-background to-background p-4 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/20">
                      <Sparkles className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">AI Director Studio</h4>
                      <p className="text-[10px] text-muted-foreground">Autonomous video editing & creation engine</p>
                    </div>
                    <span className="ml-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                      Autopilot Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ask me to auto-edit, cut pauses, generate captions, apply color grading, synthesize voiceovers, or construct complete videos.
                  </p>
                </div>

                {/* 1-Click Quick Action Cards */}
                <div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Suggested Actions
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      {
                        icon: Sparkles,
                        title: 'Auto-Edit Project',
                        desc: 'Analyze media & optimize pacing',
                        prompt: 'Auto-pilot: understand media, analyze scenes, remove silence and polish timeline with best pacing and transitions.',
                        color: 'text-violet-500 bg-violet-500/10 border-violet-500/30 hover:border-violet-500/60',
                      },
                      {
                        icon: Scissors,
                        title: 'Cut Silent Pauses',
                        desc: 'Remove dead air & trim clips',
                        prompt: 'Remove all silent parts and gaps longer than 1.2 seconds from the timeline clips to tighten the pacing.',
                        color: 'text-rose-500 bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60',
                      },
                      {
                        icon: Subtitles,
                        title: 'Generate Captions',
                        desc: 'Dynamic animated subtitles',
                        prompt: 'Transcribe speech and generate animated karaoke captions for all spoken audio clips on the timeline.',
                        color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-500/60',
                      },
                      {
                        icon: Palette,
                        title: 'Cinematic Colors',
                        desc: 'Teal & Orange Hollywood grade',
                        prompt: 'Apply a cinematic Teal & Orange color grade preset across all video clips on the timeline.',
                        color: 'text-amber-500 bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60',
                      },
                      {
                        icon: Smartphone,
                        title: 'Reframe for Reels (9:16)',
                        desc: 'Format for TikTok & Shorts',
                        prompt: 'Reframe this project to a vertical 9:16 aspect ratio suitable for TikTok and Instagram Reels.',
                        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60',
                      },
                      {
                        icon: Mic,
                        title: 'Generate Voiceover',
                        desc: 'Synthesize AI narration',
                        prompt: 'Generate an energetic, high-quality voiceover narration for this video using TTS.',
                        color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/60',
                      },
                    ].map((act, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => void send(act.prompt)}
                        className={`flex flex-col text-left p-2.5 rounded-xl border transition-all hover:scale-[1.02] shadow-xs group bg-card/60 backdrop-blur-sm ${act.color}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <act.icon className="size-3.5 shrink-0" />
                          <span className="text-xs font-bold text-foreground group-hover:text-violet-500 transition-colors">
                            {act.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {act.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {plan && plan.status === 'pending' && (
              <div className="space-y-2.5 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3.5 backdrop-blur-xl shadow-md">
                <div className="flex items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-300">
                  <Clapperboard className="size-3.5" />
                  Proposed plan — nothing has been changed yet
                </div>
                <p className="text-sm font-semibold">{plan.plan.goal}</p>
                {plan.plan.scenesAffected.length > 0 && (
                  <div className="text-xs text-muted-foreground font-medium">
                    Affects: {plan.plan.scenesAffected.join(', ')}
                  </div>
                )}
                <div className="space-y-1.5">
                  {plan.plan.actions.map((a, i) => (
                    <div key={i} className="flex gap-2 rounded-lg border border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 px-2.5 py-1.5 text-xs backdrop-blur-md">
                      <span className="mt-0.5 size-4 shrink-0 rounded-full bg-violet-600/20 text-center text-[10px] leading-4 text-violet-700 dark:text-violet-300 font-bold">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{describeTool(a.tool, a.arguments)}</div>
                        {a.reason && <div className="text-muted-foreground text-[11px]">Why: {a.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {revising ? (
                  <div className="space-y-1.5 pt-1">
                    <input
                      autoFocus
                      value={reviseInput}
                      onChange={(e) => setReviseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRevise()
                      }}
                      placeholder="What should change? (e.g. 'instead, trim the start')"
                      className="w-full rounded-xl border border-white/30 dark:border-white/15 bg-white/50 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:border-violet-500 backdrop-blur-md"
                    />
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" className="h-7 flex-1 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white" onClick={submitRevise}>
                        Send revision
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRevising(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button type="button" size="sm" className="h-8 flex-1 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-xs" onClick={() => void approvePlan()}>
                      <Check className="size-3.5 mr-1" />
                      Approve plan
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-semibold border-white/20 bg-white/10 hover:bg-white/20" onClick={startRevise}>
                      Revise
                    </Button>
                  </div>
                )}
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full shadow-xs ${
                    m.role === 'user'
                      ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white'
                      : 'bg-violet-600/20 text-violet-700 dark:text-violet-300 border border-violet-500/30'
                  }`}
                >
                  {m.role === 'user' ? <User className="size-3.5" /> : <Clapperboard className="size-3.5" />}
                </div>
                <div className={`max-w-[82%] space-y-1.5 ${m.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-xs sm:text-sm leading-relaxed shadow-sm transition-all ${
                      m.role === 'user'
                        ? 'bg-gradient-to-tr from-violet-600/90 to-purple-600/90 text-white backdrop-blur-md border border-white/25 rounded-tr-xs'
                        : 'bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/20 dark:border-white/10 text-foreground rounded-tl-xs'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.tools && m.tools.length > 0 && (
                    <div className="text-muted-foreground text-[10px] font-mono">
                      {m.proposed ? 'Proposed' : 'Used'}: {m.tools.join(', ')}
                    </div>
                  )}
                  {m.review && m.review.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <Button type="button" size="sm" className="h-6 px-2 text-[11px] font-bold bg-violet-600 text-white" onClick={applyAllFixes}>
                        <Check className="size-3 mr-1" />
                        Fix All ({m.review.filter((i) => i.fix.kind !== 'none').length})
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px] border-white/20 bg-white/10" onClick={() => setShowQuality(true)}>
                        Review Changes
                      </Button>
                    </div>
                  )}
                  {m.followups && m.followups.length > 0 && (
                    <div className="flex flex-wrap justify-start gap-1 pt-0.5">
                      {m.followups.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => void send(f)}
                          disabled={busy}
                          className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50 backdrop-blur-xs"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pendingQuestion && (
              <div className="space-y-3 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3.5 backdrop-blur-xl shadow-md animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-lg bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                    <HelpCircle className="size-3.5" />
                  </div>
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300">Clarification Question</span>
                  <span className="ml-auto text-[9px] font-semibold rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5">Choose or Custom</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">{pendingQuestion.question}</p>

                {/* MCQ Options */}
                {pendingQuestion.options && pendingQuestion.options.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Select Options:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {pendingQuestion.options.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setQuestionAnswer(opt)
                            submitAnswer(opt)
                          }}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/30 dark:border-white/15 bg-white/50 dark:bg-white/10 px-3 py-2 text-left text-xs font-medium text-foreground hover:border-violet-500 hover:bg-violet-500/15 hover:text-violet-600 dark:hover:text-violet-300 transition-all shadow-xs group"
                        >
                          <span className="min-w-0 flex-1">{opt}</span>
                          <Check className="size-3.5 text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Write-in Input */}
                <div className="space-y-1 pt-1.5 border-t border-white/15 dark:border-white/10">
                  <div className="text-[10px] font-semibold text-muted-foreground">Or enter custom answer:</div>
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={questionAnswer}
                      onChange={(e) => setQuestionAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitAnswer()
                      }}
                      placeholder="Type your custom answer..."
                      className="min-w-0 flex-1 rounded-xl border border-white/30 dark:border-white/15 bg-white/50 dark:bg-white/5 px-3 py-2 text-xs outline-none focus:border-violet-500 backdrop-blur-md text-foreground placeholder:text-muted-foreground"
                    />
                    <Button
                      size="sm"
                      className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-xs shrink-0"
                      onClick={() => submitAnswer()}
                      disabled={!questionAnswer.trim()}
                      aria-label="Send answer"
                    >
                      <Send className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {busy && (
              <div className="flex gap-2.5" aria-live="polite" aria-atomic="true" aria-label="AI Director status">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 shadow-xs" aria-hidden="true">
                  <Clapperboard className="size-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-xs border border-white/20 dark:border-white/10 bg-white/50 dark:bg-white/10 px-3.5 py-2.5 backdrop-blur-md shadow-xs" role="status">
                  <div className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-violet-500" aria-hidden="true" />
                    <span className="size-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:0.15s]" aria-hidden="true" />
                    <span className="size-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:0.3s]" aria-hidden="true" />
                  </div>
                  <span className="sr-only">AI Director is thinking</span>
                </div>
              </div>
            )}
          </div>

          {showQuality && (
            <div className="border-t border-white/15 dark:border-white/10 bg-amber-500/10 backdrop-blur-xl" aria-live="polite" aria-atomic="true" aria-label="Quality check status">
              <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  <ListChecks className="size-3.5" />
                  {checking
                    ? 'Checking...'
                    : issues.length
                      ? `${issues.length} issue${issues.length > 1 ? 's' : ''} found`
                      : 'No issues found — timeline looks clean'}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {!checking && (
                    <>
                      {fixableCount > 0 && (
                        <Button type="button" size="sm" className="h-6 px-2 text-xs font-bold bg-amber-600 text-white hover:bg-amber-500" onClick={applyAllFixes}>
                          Fix all ({fixableCount})
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-white/15" onClick={() => void runQualityCheck()}>
                        Re-check
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {issues.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto px-3.5 pb-2.5">
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`flex items-center gap-2 rounded-xl border border-white/20 px-2.5 py-1.5 text-xs backdrop-blur-md ${ISSUE_STYLE[issue.severity]}`}
                    >
                      <span className="min-w-0 flex-1 font-medium">{issue.message}</span>
                      {issue.fix.kind !== 'none' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 shrink-0 px-2 text-xs hover:bg-white/20 font-bold"
                          onClick={() => applyIssueFix(issue)}
                        >
                          <Check className="size-3 mr-1" />
                          {issue.fix.kind === 'remove_clip' ? 'Remove' : 'Fix'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {proposals.length > 0 && (
            <div className="border-t border-white/15 dark:border-white/10 bg-violet-500/10 backdrop-blur-xl" aria-live="polite" aria-atomic="true" aria-label="AI Director proposals">
              <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                  <Clapperboard className="size-3.5" />
                  {pendingCount > 0 ? `${pendingCount} proposed change${pendingCount > 1 ? 's' : ''} awaiting review` : 'No pending changes'}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {pendingCount > 0 && (
                    <>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-white/15" onClick={discardAll}>
                        Discard all
                      </Button>
                      <Button type="button" size="sm" className="h-6 px-2 text-xs font-bold bg-violet-600 text-white" onClick={applyAll}>
                        Apply all ({pendingCount})
                      </Button>
                    </>
                  )}
                  {resolvedCount > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-white/15" onClick={clearResolved}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto px-3.5 pb-2.5">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs backdrop-blur-md ${
                      p.status === 'applied'
                        ? 'border-emerald-500/40 bg-emerald-500/20'
                        : p.status === 'failed'
                          ? 'border-destructive/40 bg-destructive/20'
                          : p.status === 'discarded'
                            ? 'border-muted/40 bg-muted/30 opacity-60'
                            : 'border-violet-500/40 bg-violet-500/20'
                    }`}
                  >
                    {p.status === 'applied' ? (
                      <Check className="size-3.5 shrink-0 text-emerald-500" />
                    ) : p.status === 'failed' || p.status === 'discarded' ? (
                      <X className="size-3.5 shrink-0 text-destructive" />
                    ) : (
                      <Clapperboard className="size-3.5 shrink-0 text-violet-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium" title={p.label}>
                      {p.label}
                      {p.status !== 'pending' && p.message && (
                        <span className="text-muted-foreground ml-1 truncate text-[10px]">— {p.message}</span>
                      )}
                    </span>
                    {p.status === 'pending' && (
                      <>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-white/20" onClick={() => discardOne(p.id)}>
                          <Trash2 className="size-3" />
                          Discard
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs hover:bg-white/20 font-bold text-violet-600 dark:text-violet-300" onClick={() => applyOne(p.id)}>
                          <Check className="size-3 mr-0.5" />
                          Apply
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action & Input Bar with Glassmorphism */}
          <div className="border-t border-white/15 dark:border-white/10 bg-white/20 dark:bg-white/5 p-3 backdrop-blur-xl space-y-2">
            {/* Quick Action Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {[
                { label: '⚡ Auto-Edit', prompt: 'Auto-pilot: understand media, analyze scenes, remove silence and polish timeline with best pacing and transitions.' },
                { label: '📝 Captions', prompt: 'Transcribe speech and generate animated karaoke captions for all spoken audio clips.' },
                { label: '✂️ Cut Silence', prompt: 'Remove all silent parts and dead gaps longer than 1.2 seconds from the timeline clips.' },
                { label: '🎨 Teal & Orange', prompt: 'Apply a Hollywood Teal & Orange cinematic color grade preset to all video clips.' },
                { label: '📱 9:16 Reel', prompt: 'Reframe this project to a vertical 9:16 Reel/Shorts format.' },
              ].map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void send(p.prompt)}
                  disabled={busy}
                  className="rounded-full border border-border/70 bg-card/80 hover:bg-muted hover:border-violet-500/50 px-2.5 py-1 text-[10px] font-semibold text-foreground transition-all shadow-xs shrink-0 disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input Field & Send Button */}
            <div className="flex gap-2 items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && input.trim()) void send(input)
                }}
                placeholder="Ask the Director to edit, cut, grade, add captions..."
                className="min-w-0 flex-1 rounded-xl border border-white/25 dark:border-white/15 bg-white/40 dark:bg-white/5 px-3 py-2 text-xs sm:text-sm outline-none placeholder:text-muted-foreground focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 backdrop-blur-md text-foreground transition-all"
              />
              <Button
                size="icon"
                className="size-9 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-md shrink-0"
                onClick={() => void send(input)}
                disabled={!input.trim() || busy}
                aria-label="Send message"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>

          {/* 8-Directional Interactive Resize Handles */}
          {!isMaximized && (
            <>
              {/* Top edge */}
              <div
                className="absolute top-0 left-4 right-4 h-2 cursor-ns-resize z-40 touch-none"
                onPointerDown={(e) => handleResizePointerDown(e, 'n')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                title="Drag to resize height"
              />
              {/* Bottom edge */}
              <div
                className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize z-40 touch-none"
                onPointerDown={(e) => handleResizePointerDown(e, 's')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                title="Drag to resize height"
              />
              {/* Left edge */}
              <div
                className="absolute left-0 top-4 bottom-4 w-2 cursor-ew-resize z-40 touch-none"
                onPointerDown={(e) => handleResizePointerDown(e, 'w')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                title="Drag to resize width"
              />
              {/* Right edge */}
              <div
                className="absolute right-0 top-4 bottom-4 w-2 cursor-ew-resize z-40 touch-none"
                onPointerDown={(e) => handleResizePointerDown(e, 'e')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                title="Drag to resize width"
              />
              {/* Top-Left corner */}
              <div
                className="absolute top-0 left-0 size-4 cursor-nwse-resize z-50 touch-none"
                onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
              />
              {/* Top-Right corner */}
              <div
                className="absolute top-0 right-0 size-4 cursor-nesw-resize z-50 touch-none"
                onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
              />
              {/* Bottom-Left corner */}
              <div
                className="absolute bottom-0 left-0 size-4 cursor-nesw-resize z-50 touch-none"
                onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
              />
              {/* Bottom-Right corner with visual grip ridges */}
              <div
                className="absolute bottom-0 right-0 size-6 cursor-nwse-resize z-50 flex items-end justify-end p-1 group/grip touch-none select-none"
                onPointerDown={(e) => handleResizePointerDown(e, 'se')}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                title="Drag corner to resize window"
              >
                <svg
                  className="size-3 text-muted-foreground/40 group-hover/grip:text-violet-500 transition-colors pointer-events-none"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M10 2L2 10" strokeLinecap="round" />
                  <path d="M10 6L6 10" strokeLinecap="round" />
                  <path d="M10 9L9 10" strokeLinecap="round" />
                </svg>
              </div>
            </>
          )}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Confirm destructive action">
          <div className="w-full max-w-sm rounded-xl border bg-background p-4 shadow-lg">
            <h3 className="text-sm font-semibold">Apply {confirmAction.toolName}?</h3>
            <p className="text-muted-foreground mt-1 text-xs">This tool destructively modifies the timeline. You can undo it afterwards with Ctrl+Z.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const action = confirmAction
                  setConfirmAction(null)
                  void action.onConfirm()
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}