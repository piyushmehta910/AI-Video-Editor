import * as React from 'react'
import {
  ArrowLeftRight,
  Archive,
  Captions,
  Clapperboard,
  CornerDownLeft,
  Crop,
  Diamond,
  Download,
  FilePlus2,
  FolderOpen,
  Gauge,
  History,
  Image as ImageIcon,
  LayoutPanelLeft,
  Magnet,
  Mic,
  PanelRight,
  Redo2,
  Scissors,
  ScrollText,
  Search,
  Settings,
  Smile,
  Sparkles,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
  Wand2,
  Zap,
} from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { cn } from '@/lib/utils'
import { openEditorDialog } from '@/lib/uiEvents'
import type { ToolSection } from '@/ui/common/RightToolPanel'

interface PaletteItem {
  id: string
  label: string
  category: string
  icon: React.ReactNode
  hint?: string
  run: () => void
}

const STUDIO_SECTIONS: Array<{ id: ToolSection; label: string; icon: React.ReactNode }> = [
  { id: 'text', label: 'Text & Titles Studio', icon: <Type className="size-4" /> },
  { id: 'captions', label: 'Auto Captions Studio', icon: <Captions className="size-4" /> },
  { id: 'voiceover', label: 'Voiceover & Audio Studio', icon: <Mic className="size-4" /> },
  { id: 'slide', label: 'Slides & Keynotes Studio', icon: <CornerDownLeft className="size-4" /> },
  { id: 'avatar', label: 'AI Avatar Studio', icon: <Clapperboard className="size-4" /> },
  { id: 'effects', label: 'Visual Effects Studio', icon: <Wand2 className="size-4" /> },
  { id: 'transitions', label: 'Transitions Studio', icon: <ArrowLeftRight className="size-4" /> },
  { id: 'stickers', label: 'Animated Stickers Studio', icon: <Smile className="size-4" /> },
  { id: 'images', label: 'Stock Media Search', icon: <ImageIcon className="size-4" /> },
  { id: 'script', label: 'Script Studio', icon: <ScrollText className="size-4" /> },
  { id: 'design', label: 'Design & Layout Studio', icon: <Sparkles className="size-4" /> },
  { id: 'keyframe', label: 'Keyframe Editor', icon: <Diamond className="size-4" /> },
  { id: 'crop', label: 'Crop & Reframe Studio', icon: <Crop className="size-4" /> },
  { id: 'speed', label: 'Speed & Rate Stretch', icon: <Gauge className="size-4" /> },
  { id: 'insights', label: 'AI Insights & Analysis', icon: <Zap className="size-4" /> },
]

function fmtHint(hint: string): string {
  return hint.replaceAll('mod+', 'Ctrl ').replaceAll(' +', ' ')
}

export function CommandPalette() {
  const open = useEditorStore((s) => s.commandPaletteOpen)
  const setOpen = useEditorStore((s) => s.setCommandPaletteOpen)
  const [query, setQuery] = React.useState('')
  const [index, setIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const items = React.useMemo<PaletteItem[]>(() => {
    const ed = useEditorStore.getState
    const tl = () => useTimelineStore.getState()
    const clampZoom = (next: number) => tl().setZoom(Math.max(15, Math.min(400, next)))
    const fitZoom = () => {
      const vp = document.querySelector<HTMLElement>('[data-testid="timeline-root"]')
      const dur = tl().duration()
      if (!vp || dur <= 0) return
      clampZoom((vp.clientWidth - 78) / dur)
    }

    const project: PaletteItem[] = [
      { id: 'export', label: 'Export project…', category: 'Project', icon: <Download className="size-4" />, run: () => openEditorDialog('export') },
      { id: 'new-project', label: 'New project…', category: 'Project', icon: <FilePlus2 className="size-4" />, run: () => openEditorDialog('newProject') },
      { id: 'open-project', label: 'Open project…', category: 'Project', icon: <FolderOpen className="size-4" />, run: () => openEditorDialog('openProject') },
      { id: 'save', label: 'Save project', category: 'Project', icon: <Archive className="size-4" />, hint: 'Ctrl S', run: () => void tl().save() },
      {
        id: 'settings',
        label: 'Settings & integrations',
        category: 'Project',
        icon: <Settings className="size-4" />,
        run: () => document.querySelector<HTMLAnchorElement>('a[href="/settings"]')?.click(),
      },
    ]

    const edit: PaletteItem[] = [
      {
        id: 'split',
        label: 'Split at playhead',
        category: 'Edit',
        icon: <Scissors className="size-4" />,
        hint: 'S',
        run: () => {
          const s = tl()
          const t = s.playhead
          for (const id of s.selection.clipIds) {
            for (const track of s.project.tracks) {
              const clip = track.clips.find((c) => c.id === id)
              if (clip && t > clip.startTime + 0.05 && t < clip.startTime + clip.duration - 0.05) {
                s.splitClip(id, t)
                break
              }
            }
          }
        },
      },
      {
        id: 'duplicate',
        label: 'Duplicate selected clips',
        category: 'Edit',
        icon: <CornerDownLeft className="size-4" />,
        hint: 'Ctrl D',
        run: () => tl().duplicateClips(tl().selection.clipIds),
      },
      {
        id: 'delete',
        label: 'Delete selected clips',
        category: 'Edit',
        icon: <Trash2 className="size-4" />,
        hint: 'Del',
        run: () => tl().deleteClips(tl().selection.clipIds, false),
      },
      { id: 'undo', label: 'Undo', category: 'Edit', icon: <Undo2 className="size-4" />, hint: 'Ctrl Z', run: () => tl().undo() },
      { id: 'redo', label: 'Redo', category: 'Edit', icon: <Redo2 className="size-4" />, hint: 'Ctrl Shift Z', run: () => tl().redo() },
      { id: 'snap', label: 'Toggle magnetic snapping', category: 'Edit', icon: <Magnet className="size-4" />, hint: 'N', run: () => tl().setSnapEnabled(!tl().snapEnabled) },
      { id: 'trim-mode', label: 'Toggle trim mode', category: 'Edit', icon: <ArrowLeftRight className="size-4" />, run: () => ed().toggleTrimMode() },
    ]

    const view: PaletteItem[] = [
      { id: 'ai-director', label: 'Toggle AI Director', category: 'View', icon: <Sparkles className="size-4" />, run: () => ed().toggleAIDirector() },
      { id: 'media-bin', label: 'Toggle Media Bin', category: 'View', icon: <LayoutPanelLeft className="size-4" />, run: () => ed().toggleLeft() },
      { id: 'inspector', label: 'Toggle Inspector', category: 'View', icon: <PanelRight className="size-4" />, run: () => ed().toggleInspector() },
      { id: 'history-panel', label: 'History & undo log', category: 'View', icon: <History className="size-4" />, run: () => ed().toggleHistoryPanel() },
      { id: 'shortcuts', label: 'Keyboard shortcuts', category: 'View', icon: <CornerDownLeft className="size-4" />, hint: '?', run: () => ed().setShortcutsOpen(true) },
      { id: 'fit-screen', label: 'Fit timeline to screen', category: 'View', icon: <SquareDashed className="size-4" />, hint: 'F', run: fitZoom },
    ]

    return [...project, ...edit, ...view, ...STUDIO_SECTIONS.map((s) => ({ id: `studio-${s.id}`, label: s.label, category: 'Studio', icon: s.icon, run: () => ed().setToolPanelSection(s.id) }))]
  }, [])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const trimmed = query.trim().toLowerCase()
  const visible = React.useMemo(
    () => (trimmed ? items.filter((i) => i.label.toLowerCase().includes(trimmed) || i.category.toLowerCase().includes(trimmed)) : items),
    [items, trimmed],
  )
  const groups = React.useMemo(() => {
    const order = ['Project', 'Edit', 'View', 'Studio']
    return order.map((name) => ({ name, items: visible.filter((i) => i.category === name) })).filter((g) => g.items.length > 0)
  }, [visible])

  React.useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh]" data-testid="command-palette">
      <button aria-label="Close command palette" className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100" onClick={() => setOpen(false)} />
      <div className="bg-background relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border shadow-2xl animate-in zoom-in-95 duration-100">
        <div className="flex items-center gap-2.5 border-b px-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(i + 1, visible.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && visible[index]) {
                e.preventDefault()
                visible[index].run()
                setOpen(false)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
              }
            }}
            placeholder="Type a command or search…"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="bg-muted shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-1.5">
          {visible.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No commands match “{query}”.</p>}
          {groups.map((group) => (
            <div key={group.name}>
              <p className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70">{group.name}</p>
              {group.items.map((item) => {
                const globalIdx = visible.indexOf(item)
                const isActive = globalIdx === index
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-active={isActive}
                    onMouseEnter={() => setIndex(globalIdx)}
                    onClick={() => {
                      item.run()
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]',
                      isActive ? 'bg-violet-600/15 text-violet-700 dark:text-violet-300' : 'text-foreground',
                    )}
                  >
                    <span className={cn('shrink-0', isActive ? 'text-violet-500' : 'text-muted-foreground')}>{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground/60">{item.category}</span>
                    {item.hint && (
                      <kbd className="bg-muted shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{fmtHint(item.hint)}</kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}