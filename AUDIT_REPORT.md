# ClipForge UI Audit Against NLE Design Requirements

**Date:** 2026-08-21  
**Codebase:** ClipForge AI Video Editor  
**Auditor:** Automated code review

---

## Executive Summary

ClipForge is a sophisticated AI-powered video editor with a well-architected React/TypeScript codebase using Zustand for state, Tailwind v4 for styling, and Radix UI primitives. The editor implements most core NLE patterns with strong AI Director integration. However, several accessibility, responsiveness, and polish gaps remain.

---

## 1. Visual Design System

### What's Solid
- **Dark theme default** with OKLCH color tokens in `src/index.css:28-48` — proper dark-mode CSS variables for all semantic colors (background, foreground, card, primary, destructive, etc.)
- **Theme persistence** via `localStorage` in `src/lib/theme.ts:12-20` with system preference fallback
- **Consistent icon set** — lucide-react used throughout (140+ icons across codebase)
- **Type scale** — CSS variables for radii (`--radius` at `index.css:25,70-73`), base font stack at `index.css:88-90`
- **Component variants** — Button (`button.tsx:10-18`), Switch, Slider, Input all use CVA for consistent variants
- **Focus-visible rings** — All interactive components have `focus-visible:ring-ring/50 focus-visible:ring-[3px]` (e.g., `button.tsx:7`, `input.tsx:11`, `slider.tsx:48`, `switch.tsx:10`)

### What's Weak
- **Spacing scale** — No explicit spacing tokens; relies on Tailwind's default scale (4px base). Inconsistent gaps (e.g., `gap-2`, `gap-1.5`, `gap-0.5` used ad-hoc)
- **Motion tokens** — No centralized animation/duration tokens. Transitions are inline (`transition-all`, `duration-300` at `EditorPage.tsx:146`, `Preview.tsx:144`)
- **WCAG AA contrast** — Not systematically verified. OKLCH tokens help but no automated contrast checking. Some combinations (e.g., `text-muted-foreground` on `bg-muted`) may fall below 4.5:1
- **Color token documentation** — No design token JSON/TS export for design handoff

### What's Missing
- **Reduced motion support** — No `prefers-reduced-motion` media query handling anywhere
- **High contrast mode** — No `prefers-contrast: more` support
- **Design token file** — No `design-tokens.ts` or Figma sync
- **Icon consistency audit** — Some components use inline SVG sizing (`size-3.5`, `size-4`, `size-5`) without a unified scale

---

## 2. Layout & Panels

### What's Solid
- **NLE three-zone layout** — `EditorPage.tsx:104-206` implements classic layout: Media (left), Preview+Timeline (center), Inspector (right)
- **Resizable timeline** — Drag handle at `EditorPage.tsx:176-184` with `pointer-events`, persists to `localStorage` (`clipforge-timeline-height`)
- **Collapsible panels** — Left/right panels collapse to 8px strips with chevron affordances (`EditorPage.tsx:106-121`, `190-206`), state persisted (`clipforge-left-open`, `clipforge-right-open`)
- **Mobile adaptive layout** — Bottom sheets for Media/Inspector (`EditorPage.tsx:209-234`), view switcher (`EditorPage.tsx:125-164`)
- **Panel persistence** — All panel states saved to `localStorage` and restored on mount

### What's Weak
- **No keyboard panel toggle** — No shortcuts to show/hide Media/Inspector (only mouse)
- **No panel width resize** — Left/right panels fixed width (`w-64`, `w-72`), not draggable
- **Timeline height minimum** — `MIN_TIMELINE_HEIGHT = 120` (`EditorPage.tsx:25`) may be too small for multi-track editing
- **No "reset layout" command** — Users can't restore default panel arrangement

### What's Missing
- **Workspace presets** — No save/load layout workspaces (e.g., "Editing", "Color", "Audio")
- **Panel docking/undocking** — Panels can't float or move to second monitor
- **Vertical timeline layout option** — No stacked timeline mode for ultra-wide screens

---

## 3. Timeline UX

### What's Solid
- **Track headers with controls** — Lock/mute/hide per track (`Timeline.tsx:753-773`) with icon buttons and active states
- **Section headers** — Collapsible track groups by type (Video/Audio/Text) with clip counts (`Timeline.tsx:683-718`)
- **Thumbnails & waveforms** — Filmstrip for video (`Timeline.tsx:802-811`), waveform for audio (`812-821`), fallback thumbnail (`822-831`)
- **Zoom controls** — Toolbar buttons + Ctrl+wheel (`Timeline.tsx:462-478`, `544-548`), zoom range 15-400px/s (`timelineStore.ts:726`)
- **Fit-to-content zoom** — Auto-fit on asset import (`Timeline.tsx:251-261`)
- **Snapping** — Configurable snap to clip edges/playhead (`Timeline.tsx:66-72`, `338-348`), Shift to disable
- **Drag ghost** — `dragActive` overlay (`Timeline.tsx:634`) + pointer capture during drag
- **Trim handles** — Left/right edge draggers appear on hover, expand in trim mode (`Timeline.tsx:842-861`)
- **Playhead** — Fixed overlay with triangle marker (`Timeline.tsx:626-632`), scrubbing via ruler/timeline click
- **Ruler with timecode** — Dynamic tick density (`computeTicks` at `Timeline.tsx:89-102`), labels every N ticks
- **Multi-select** — Shift+click, Ctrl+A (`useEditorShortcuts.ts:51-56`), ripple delete (Shift+Del)
- **Clip context bar** — Audio clips get floating action bar with denoise, split, trim toggle (`Timeline.tsx:637-672`)
- **Undo/redo** — 200-step history with transaction batching (`timelineStore.ts:261-267`, `279-287`)

### What's Weak
- **No keyboard clip navigation** — No Up/Down to select track, Left/Right to select adjacent clip
- **No ripple insert/overwrite modes** — Only ripple delete exists
- **No track height resize** — Fixed 44px/48px (`Timeline.tsx:50-52`)
- **No scroll sync** — Horizontal scroll doesn't sync ruler/header (uses sticky positioning which works but no virtualized sync)
- **No marquee selection** — Can't drag-select multiple clips
- **Trim preview** — No live preview of trim in/out points while dragging
- **No track renaming** — Track names auto-generated (`types.ts:332-335`), not editable
- **No clip color labels** — All clips use type-based gradient, no custom tagging

### What's Missing
- **Waveform zoom detail** — Audio waveform doesn't scale with timeline zoom
- **Filmstrip frame accuracy** — Background-position calculation assumes uniform frame distribution
- **Timecode display format** — Only seconds (`formatSeconds`), no SMPTE timecode option
- **Markers/regions** — No timeline markers, in/out points, or range selection
- **Keyboard trim** — `[` / `]` trim by 1 frame exists (`useEditorShortcuts.ts:86-91`) but no visual feedback

---

## 4. AI Director UX

### What's Solid
- **Conversational UI** — Chat-style message history with user/assistant bubbles (`AIDirector.tsx:687-737`)
- **Proposal/staging model** — Tools staged as "proposals" requiring approval (`AIDirector.tsx:271-298`, `proposals` state)
- **Fix All / Review UI** — Quality issues shown with severity badges, "Fix All" + per-issue "Fix" buttons (`AIDirector.tsx:777-828`, `854-897`)
- **Visual highlighting** — Quality issues color-coded: error (destructive), warning (amber), info (muted) via `ISSUE_STYLE` (`AIDirector.tsx:83-87`)
- **Progress states** — Thinking animation (bouncing dots `AIDirector.tsx:767-773`), per-tool progress for analysis (`MediaBrowser.tsx:249-266`)
- **Plan review** — Structured plan card with numbered actions, reasons, "Approve"/"Revise" (`AIDirector.tsx:627-684`)
- **Follow-up suggestions** — Contextual chips after each response (`AIDirector.tsx:720-734`)
- **Destructive confirmations** — Tools marked `destructive: true` trigger confirmation dialog (`AIDirector.tsx:399-420`)
- **Question prompting** — AI can ask clarifying questions, blocks until answered (`AIDirector.tsx:140-155`, `739-759`)
- **State persistence** — Remembers asked questions per project (`AIDirector.tsx:121-122`, `api/llm/askedQuestions`)

### What's Weak
- **No streaming responses** — AI replies appear atomically after full completion (no token streaming)
- **Proposal list truncation** — Max 20 pending (`MAX_PROPOSALS = 20` at `AIDirector.tsx:81`), older ones hidden
- **No proposal grouping** — Related proposals not batched visually
- **Quality check not automatic** — Must manually click "Check" button (`AIDirector.tsx:594-598`)
- **No diff preview** — "Review Changes" shows issue list but not visual timeline diff
- **Floating action button** — FAB at bottom-right (`AIDirector.tsx:569-576`) may conflict with mobile panels

### What's Missing
- **Voice input** — No speech-to-text for director prompts
- **Prompt history** — No command palette or recent prompts list
- **AI model selector** — Provider configured in Settings only, not switchable in Director
- **Undo AI actions** — Applied proposals create undo steps but no "Revert AI changes" bulk action
- **Offline/queue indicator** — No indication if requests queued offline

---

## 5. Feedback & States

### What's Solid
- **Loading states** — Button spinners (`Loader2` animate-spin at `AIDirector.tsx:648`, `Inspector.tsx:307`), thinking animation (`AIDirector.tsx:767-773`)
- **Empty states** — Media browser shows illustrated empty state with "Browse files" CTA (`MediaBrowser.tsx:164-176`), Preview shows "Add media" prompt (`Preview.tsx:122-138`)
- **Destructive confirmations** — Asset delete requires double-click confirm with 1.5s timeout (`MediaBrowser.tsx:335-339`), AI destructive tools confirm (`AIDirector.tsx:399-420`)
- **Drag targets** — Timeline viewport click-to-set-playhead (`Timeline.tsx:551-559`), drop zone for import (`MediaBrowser.tsx:132-143`)
- **Toast-like notices** — Media import success/error banners (`MediaBrowser.tsx:145-156`)
- **Tooltip system** — Radix Tooltip on all toolbar buttons (`Timeline.tsx:899-920`)

### What's Weak
- **No global toast/notification system** — Notices scoped to Media panel only
- **No progress for long operations** — Export, proxy generation, analysis run without progress UI (except asset analysis)
- **Skeleton loaders** — `Skeleton` component exists (`skeleton.tsx`) but not used in timeline/media loading
- **Drag feedback** — No visual drag image/ghost for clips being dragged (only cursor change)
- **No haptic/touch feedback** — Mobile drag lacks visual ripple

### What's Missing
- **Command palette** — No Cmd+K global search/command UI
- **Onboarding/tips** — No first-run guidance or feature discovery
- **Error boundaries** — No React error boundary UI for graceful degradation
- **Connection status** — No indicator for API/WebSocket connectivity

---

## 6. Responsiveness

### What's Solid
- **Mobile breakpoint** — `useIsMobile.ts` uses 767px matchMedia, reactive
- **Mobile layout** — `EditorPage.tsx:166-187` switches to single-view (Preview OR Timeline) with bottom sheets
- **Touch-friendly targets** — Most buttons >=44px (icon buttons `size-7`/`size-8` = 28-32px, slightly small)
- **Safe area insets** — CSS utilities for `env(safe-area-inset-*)` at `index.css:124-135`
- **Responsive toolbar** — Timeline toolbar collapses secondary tools into "More" menu on mobile (`Timeline.tsx:502-536`)
- **Bottom nav** — Mobile-only fixed bottom navigation in `AppShell.tsx:51-71`
- **Flexible preview** — `Preview.tsx:45-68` uses ResizeObserver to fit canvas to container

### What's Weak
- **Touch drag on timeline** — Pointer events work but no touch-specific handling (no passive listeners, no touch-action)
- **Inspector on mobile** — Bottom sheet max-height `70svh` (`EditorPage.tsx:216`) may clip content, no internal scroll indicator
- **Timeline horizontal scroll** — No touch scroll momentum tuning, no horizontal scroll indicator
- **Text size** — Many `text-[10px]`/`text-[11px]` labels below 12px minimum for mobile readability
- **FAB position** — AI Director FAB at `bottom-20`/`bottom-5` (`AIDirector.tsx:572`) overlaps mobile bottom nav

### What's Missing
- **Tablet layout** — No intermediate layout (768-1024px); jumps from mobile to desktop
- **Landscape mobile** — No specific landscape optimizations
- **PWA install prompt** — `manifest.json` exists but no install promotion UI
- **Offline support** — Service worker exists (`public/sw.js`) but no offline banner or cached asset strategy

---

## 7. Accessibility & Keyboard

### What's Solid
- **Comprehensive shortcuts** — 25+ shortcuts documented in `ShortcutsDialog.tsx:4-40` and implemented in `useEditorShortcuts.ts`
- **Shortcuts dialog** — Accessible via toolbar button (`Timeline.tsx:489-491`) and `?` key (not implemented but dialog exists)
- **Focus management** — `focus-visible` rings on all interactive elements, `outline-none` base
- **ARIA labels** — Tooltips on icon buttons (`Tooltip` wrapper), `aria-label` on FAB (`AIDirector.tsx:573`)
- **Semantic HTML** — Buttons for actions, `select` for choices, proper `label` associations
- **Keyboard trap in dialogs** — Radix Dialog/Tooltip handle focus trapping
- **Skip input capture** — Shortcuts ignore input/textarea/contenteditable (`useEditorShortcuts.ts:8-11`)

### What's Weak
- **No reduced motion** — No `prefers-reduced-motion` handling; animations run regardless (`transition-all`, `animate-spin`, `animate-bounce`)
- **Color-only status** — Track lock/mute/hide use color-only active state (`TrackHeaderButton.tsx:891-892`)
- **Tooltip keyboard access** — Tooltips only on hover/focus, no keyboard-only trigger
- **No live regions** — AI Director status (thinking, errors) not announced to screen readers
- **Focus order in mobile sheets** — Bottom sheet focus not trapped, background content reachable
- **No high contrast mode** — `prefers-contrast: more` not supported

### What's Missing
- **Screen reader announcements** — No `aria-live` for playhead position, clip selection, AI responses
- **Keyboard navigation in timeline** — No arrow-key clip/track navigation, no Home/End for first/last clip
- **Shortcut discoverability** — No on-screen shortcut hints (only dialog)
- **VoiceOver/TalkBack testing** — No evidence of testing
- **Focus restoration** — After closing dialogs/sheets, focus not returned to trigger element
- **Keyboard shortcut customization** — Hardcoded, not user-configurable

---

## Priority Fixes

| Priority | Area | Issue | File:Line |
|----------|------|-------|-----------|
| P0 | A11y | Add `prefers-reduced-motion` support | `index.css`, all components |
| P0 | A11y | Add `aria-live` for AI Director status | `AIDirector.tsx:761-774` |
| P0 | A11y | Fix color-only states (lock/mute/hide) | `Timeline.tsx:891-892` |
| P1 | Timeline | Add keyboard clip navigation (Up/Down/Left/Right) | `useEditorShortcuts.ts` |
| P1 | Mobile | Fix FAB overlap with bottom nav | `AIDirector.tsx:572`, `AppShell.tsx:51` |
| P1 | Mobile | Increase minimum touch target to 44px | `button.tsx:24` (icon size-9=36px) |
| P1 | Timeline | Add marquee selection | `Timeline.tsx` |
| P2 | Design | Create design token export | New file |
| P2 | Layout | Add panel width resize | `EditorPage.tsx` |
| P2 | AI | Add streaming responses | `AIDirector.tsx:198-309` |
| P3 | Feedback | Global toast system | New component |
| P3 | A11y | Focus restoration after dialogs | `ShortcutsDialog.tsx`, `AIDirector.tsx` |

---

## File Reference Index

| Component | Path |
|-----------|------|
| Theme tokens | `src/index.css:1-136`, `src/lib/theme.ts` |
| App shell / nav | `src/components/layout/AppShell.tsx` |
| Editor page layout | `src/pages/EditorPage.tsx` |
| Timeline | `src/ui/timeline/Timeline.tsx` |
| AI Director | `src/ui/ai/AIDirector.tsx` |
| Inspector | `src/ui/inspector/Inspector.tsx` |
| Media Browser | `src/ui/media/MediaBrowser.tsx` |
| Preview | `src/ui/preview/Preview.tsx` |
| Captions | `src/ui/inspector/CaptionsPanel.tsx` |
| Timeline store | `src/stores/timelineStore.ts` |
| Shortcuts | `src/hooks/useEditorShortcuts.ts`, `src/ui/common/ShortcutsDialog.tsx` |
| Mobile hook | `src/hooks/useIsMobile.ts` |
| UI primitives | `src/components/ui/*.tsx` |
| Types | `src/engine/types.ts` |
