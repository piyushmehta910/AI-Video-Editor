import * as React from 'react'
import {
  ChevronRight,
  SlidersHorizontal,
  LayoutGrid,
  Search,
  X,
  ChevronLeft,
} from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import {
  TOOL_SECTIONS,
  TOOL_CATEGORIES,
  TOOL_SECTION_CATEGORY,
  SECTION_DESCRIPTIONS,
  getToolMeta,
  type ToolSection,
  type ToolCategory,
} from '@/ui/common/toolSections'
import { InspectorPanel } from './InspectorPanel'
import { RightToolPanel } from '@/ui/common/RightToolPanel'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function RightPanelContainer() {
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab)
  const setRightPanelTab = useEditorStore((s) => s.setRightPanelTab)
  const toolPanelSection = useEditorStore((s) => s.toolPanelSection)
  const setToolPanelSection = useEditorStore((s) => s.setToolPanelSection)
  const toggleInspector = useEditorStore((s) => s.toggleInspector)

  // Current active tool (defaults to 'text' for Text Presets)
  const activeToolId: ToolSection = (toolPanelSection as ToolSection) || 'text'
  const activeToolMeta = getToolMeta(activeToolId)
  const ActiveToolIcon = activeToolMeta.icon

  // State for the tool switcher bar in tools mode
  const [search, setSearch] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState<ToolCategory>('all')
  const [viewMode, setViewMode] = React.useState<'studio' | 'directory'>('studio')

  // Ref for the horizontal ribbon to auto-scroll active tool
  const ribbonRef = React.useRef<HTMLDivElement>(null)
  const activePillRef = React.useRef<HTMLButtonElement>(null)

  // Scroll active tool into view when tool changes
  React.useEffect(() => {
    if (activePillRef.current && ribbonRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeToolId])

  // Filter tools based on search query and category
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

  const handleSelectTool = (id: ToolSection) => {
    setToolPanelSection(id)
    setRightPanelTab('tools')
    setViewMode('studio')
  }

  const scrollRibbon = (direction: 'left' | 'right') => {
    if (ribbonRef.current) {
      const offset = direction === 'left' ? -180 : 180
      ribbonRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  return (
    <div className="@container flex h-full w-full flex-col bg-card/60 backdrop-blur-md select-none">
      {/* ─── Top Segmented Control Header (Exact Mockup Match) ─── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-2 @[310px]:px-2.5 bg-card/90 dark:bg-zinc-950/60 gap-1.5 @[310px]:gap-2">
        {/* Segmented Pill Container */}
        <div className="inline-flex items-center rounded-xl bg-zinc-900/90 dark:bg-zinc-900/90 border border-border/40 p-0.5 @[310px]:p-1 text-xs font-semibold shadow-inner min-w-0">
          {/* Tab 1: Clip Properties */}
          <button
            type="button"
            onClick={() => setRightPanelTab('properties')}
            className={cn(
              'flex items-center gap-1 @[310px]:gap-1.5 rounded-lg px-2 @[310px]:px-2.5 py-1 text-xs transition-all select-none whitespace-nowrap min-w-0',
              rightPanelTab === 'properties'
                ? 'bg-zinc-800 text-violet-400 font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground font-medium hover:bg-zinc-800/40',
            )}
            title="Inspect selected clip properties (transform, appearance, audio, effects)"
          >
            <SlidersHorizontal
              className={cn(
                'size-3.5 shrink-0',
                rightPanelTab === 'properties' ? 'text-violet-400' : 'text-muted-foreground',
              )}
            />
            <span className="truncate whitespace-nowrap">
              <span className="hidden @[310px]:inline">Clip </span>Properties
            </span>
          </button>

          {/* Tab 2: Active Tool / Text Presets */}
          <button
            type="button"
            onClick={() => setRightPanelTab('tools')}
            className={cn(
              'flex items-center gap-1 @[310px]:gap-1.5 rounded-lg px-2 @[310px]:px-2.5 py-1 text-xs transition-all select-none whitespace-nowrap min-w-0',
              rightPanelTab === 'tools'
                ? 'bg-zinc-800 text-violet-400 font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground font-medium hover:bg-zinc-800/40',
            )}
            title={`Open ${activeToolMeta.label} studio`}
          >
            <ActiveToolIcon
              className={cn(
                'size-3.5 shrink-0',
                rightPanelTab === 'tools' ? 'text-violet-400' : 'text-muted-foreground',
              )}
            />
            <span className="truncate whitespace-nowrap">
              {activeToolId === 'text' ? (
                <>
                  Text<span className="hidden @[310px]:inline"> Presets</span>
                </>
              ) : activeToolId === 'images' ? (
                <>
                  <span className="hidden @[310px]:inline">Stock </span>Media
                </>
              ) : (
                activeToolMeta.label
              )}
            </span>
          </button>
        </div>

        {/* Right Action: Collapse Panel */}
        <button
          type="button"
          onClick={toggleInspector}
          className="size-7 flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Collapse inspector"
          aria-label="Collapse inspector"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* ─── Quick Tool Switcher Ribbon (when in Tools mode) ─── */}
      {rightPanelTab === 'tools' && (
        <div className="shrink-0 border-b bg-muted/15">
          {/* Horizontal Tool Ribbon with left/right scroll controls */}
          <div className="relative flex items-center px-1.5 py-1.5 gap-1">
            <button
              type="button"
              onClick={() => scrollRibbon('left')}
              className="size-6 flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Scroll left"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            {/* Scrollable Tool Pills */}
            <div
              ref={ribbonRef}
              className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
            >
              {TOOL_SECTIONS.map((sec) => {
                const Icon = sec.icon
                const isCurrent = activeToolId === sec.id && viewMode === 'studio'
                return (
                  <button
                    key={sec.id}
                    ref={isCurrent ? activePillRef : null}
                    type="button"
                    onClick={() => handleSelectTool(sec.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-all shrink-0',
                      isCurrent
                        ? 'bg-violet-600 text-white font-bold shadow-xs shadow-violet-500/25 scale-[1.02]'
                        : 'bg-card/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40 hover:border-violet-500/30',
                    )}
                    title={SECTION_DESCRIPTIONS[sec.id] || sec.label}
                  >
                    <Icon className={cn('size-3.5 shrink-0', isCurrent ? 'text-white' : 'text-muted-foreground')} />
                    <span>{sec.label}</span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollRibbon('right')}
              className="size-6 flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Scroll right"
            >
              <ChevronRight className="size-3.5" />
            </button>

            {/* Toggle Directory Grid View */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'directory' ? 'studio' : 'directory')}
              className={cn(
                'size-6 flex shrink-0 items-center justify-center rounded-md transition-colors border',
                viewMode === 'directory'
                  ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/50',
              )}
              title={viewMode === 'directory' ? 'Back to studio view' : 'Browse all 16 tools directory'}
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>

          {/* Directory Search & Filter Sub-Bar (only when browsing directory) */}
          {viewMode === 'directory' && (
            <div className="border-t border-border/50 px-3 py-2 space-y-2 bg-background/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tools & studios..."
                  className="h-7 pl-8 text-xs bg-card/70"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Categories */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                {TOOL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors shrink-0',
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
          )}
        </div>
      )}

      {/* ─── Content Area ─── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightPanelTab === 'properties' ? (
          <InspectorPanel
            hideHeader={true}
            onCollapse={toggleInspector}
            onOpenMiddleTools={() => setRightPanelTab('tools')}
          />
        ) : viewMode === 'directory' ? (
          /* Directory Grid View */
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {filteredTools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-1">
                <p className="text-xs font-semibold text-foreground">No tools found</p>
                <p className="text-[11px]">Try adjusting your search query or filter category.</p>
              </div>
            ) : (
              filteredTools.map((tool) => {
                const Icon = tool.icon
                const desc = SECTION_DESCRIPTIONS[tool.id]
                const isCurrent = activeToolId === tool.id
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleSelectTool(tool.id)}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-all hover:shadow-xs active:scale-[0.99]',
                      isCurrent
                        ? 'border-violet-500/50 bg-violet-500/10'
                        : 'border-border/60 bg-card/40 hover:border-violet-500/40 hover:bg-violet-500/5',
                    )}
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
                          {isCurrent ? 'Active' : 'Open'}
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
        ) : (
          /* Studio View */
          <RightToolPanel
            section={activeToolId}
            hideHeader={true}
            onCollapse={toggleInspector}
          />
        )}
      </div>
    </div>
  )
}
