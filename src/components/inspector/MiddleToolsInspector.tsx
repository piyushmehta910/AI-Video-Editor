import * as React from 'react'
import {
  ChevronRight,
  LayoutGrid,
  Search,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react'
import { RightToolPanel } from '@/ui/common/RightToolPanel'
import {
  TOOL_SECTIONS,
  SECTION_DESCRIPTIONS,
  TOOL_CATEGORIES,
  TOOL_SECTION_CATEGORY,
  type ToolSection,
  type ToolCategory,
} from '@/ui/common/toolSections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface MiddleToolsInspectorProps {
  section: ToolSection | null
  onSelectSection: (section: ToolSection | null) => void
  onCollapse: () => void
  hasSelectedClip?: boolean
  onShowClipInspector?: () => void
}

export function MiddleToolsInspector({
  section,
  onSelectSection,
  onCollapse,
  hasSelectedClip,
  onShowClipInspector,
}: MiddleToolsInspectorProps) {
  const [search, setSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState<ToolCategory>('all')

  const filteredTools = React.useMemo(() => {
    return TOOL_SECTIONS.filter((t) => {
      const matchesCategory =
        activeCategory === 'all' || TOOL_SECTION_CATEGORY[t.id] === activeCategory
      const query = search.trim().toLowerCase()
      if (!query) return matchesCategory
      const label = t.label.toLowerCase()
      const desc = (SECTION_DESCRIPTIONS[t.id] || '').toLowerCase()
      return matchesCategory && (label.includes(query) || desc.includes(query))
    })
  }, [search, activeCategory])

  const currentMeta = React.useMemo(() => {
    return section ? TOOL_SECTIONS.find((s) => s.id === section) : null
  }, [section])

  // If a section is active, render that tool's inspector with navigation controls
  if (section) {
    const CurrentIcon = currentMeta?.icon || Sparkles
    return (
      <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">
        {/* Top Master Switcher Bar */}
        <div className="border-b bg-muted/20 px-3 py-2 space-y-2 shrink-0">
          {hasSelectedClip && onShowClipInspector && (
            <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={onShowClipInspector}
                className="flex-1 rounded-md py-1 text-center text-muted-foreground hover:text-foreground transition-colors"
              >
                Clip Properties
              </button>
              <button
                type="button"
                className="flex-1 rounded-md bg-card py-1 text-center text-violet-600 dark:text-violet-400 font-bold shadow-xs transition-colors"
              >
                Middle Tools
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-1.5 min-w-0">
            {/* Quick Switch Dropdown */}
            <div className="flex-1 min-w-0">
              <Select
                value={section}
                onValueChange={(val) => onSelectSection(val as ToolSection)}
              >
                <SelectTrigger className="h-7 text-xs font-semibold bg-card/80 border-border/70 truncate">
                  <div className="flex items-center gap-1.5 truncate">
                    <CurrentIcon className="size-3.5 text-violet-500 shrink-0" />
                    <SelectValue>{currentMeta?.label ?? section}</SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TOOL_SECTIONS.map((s) => {
                    const Icon = s.icon
                    return (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Icon className="size-3.5 text-muted-foreground" />
                          <span>{s.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Back to All Tools Hub */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 rounded-md"
              onClick={() => onSelectSection(null)}
              title="Browse all 16 middle tools"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline text-[11px]">All Tools</span>
            </Button>

            {/* Collapse Panel Button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
              onClick={onCollapse}
              title="Collapse inspector"
              aria-label="Collapse inspector"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Studio Content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <RightToolPanel
            section={section}
            onCollapse={onCollapse}
          />
        </div>
      </div>
    )
  }

  // Otherwise, render the Middle Tools Directory Hub
  return (
    <div className="flex h-full w-full flex-col bg-card/60 backdrop-blur-md">
      {/* Header */}
      <div className="border-b bg-muted/20 px-3 py-2.5 space-y-2.5 shrink-0">
        {hasSelectedClip && onShowClipInspector && (
          <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={onShowClipInspector}
              className="flex-1 rounded-md py-1 text-center text-muted-foreground hover:text-foreground transition-colors"
            >
              Clip Properties
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-card py-1 text-center text-violet-600 dark:text-violet-400 font-bold shadow-xs transition-colors"
            >
              Middle Tools
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold">
              <SlidersHorizontal className="size-3.5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-foreground truncate">Middle Tools Inspector</h3>
              <p className="text-[10px] text-muted-foreground truncate">16 creative tools & studio inspectors</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
            onClick={onCollapse}
            title="Collapse inspector"
            aria-label="Collapse inspector"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools & studios..."
            className="h-8 pl-8 text-xs bg-background/60"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-colors shrink-0',
                activeCategory === cat.id
                  ? 'bg-violet-600 text-white font-bold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tools List / Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-1">
            <p className="text-xs font-semibold text-foreground">No tools found</p>
            <p className="text-[11px]">Try adjusting your search query or filter category.</p>
          </div>
        ) : (
          filteredTools.map((tool) => {
            const Icon = tool.icon
            const desc = SECTION_DESCRIPTIONS[tool.id]
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelectSection(tool.id)}
                className="group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-2.5 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/5 hover:shadow-xs active:scale-[0.99]"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors shadow-xs">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {tool.label}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Open
                    </span>
                  </div>
                  {desc && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                      {desc}
                    </p>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
