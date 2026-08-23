# UI & Design System Guidelines: ClipForge AI Studio

## 1. Visual Identity & Aesthetic Philosophy

ClipForge AI Studio is built with a **Dark-First Creative Studio Aesthetic**. The interface is designed to minimize eye fatigue during extended editing sessions, maximize contrast against media previews, and maintain visual hierarchy across multi-panel layouts.

### 1.1 Color Palette & Theme Tokens

```
┌─────────────────────────────────────────────────────────────┐
│                       Color Tokens                          │
├─────────────────┬──────────────────────┬────────────────────┤
│ Token           │ Hex / HSL Equivalent │ Usage              │
├─────────────────┼──────────────────────┼────────────────────┤
│ `background`    │ `#0b0d13` / Slate-950│ Application root   │
│ `surface-1`     │ `#121620` / Slate-900│ Panel backgrounds  │
│ `surface-2`     │ `#1a202c` / Slate-800│ Cards, dialogs     │
│ `border`        │ `#2d3748` / Slate-700│ Panel dividers     │
│ `primary`       │ `#6366f1` / Indigo-500│ Active actions     │
│ `accent`        │ `#ec4899` / Pink-500 │ Highlights & badges│
└─────────────────┴──────────────────────┴────────────────────┘
```

### 1.2 Track Type Color Coding
Each timeline track type has a dedicated semantic accent color to allow instant visual distinction:

- 🎬 **Video Tracks (`V1`, `V2`, ...)**: Sky Blue (`#0284c7` / `text-sky-400`, `border-sky-600/30`)
- 🎵 **Audio Tracks (`A1`, `A2`, ...)**: Emerald Green (`#059669` / `text-emerald-400`, `border-emerald-600/30`)
- 📝 **Text & Captions (`T1`, `T2`, ...)**: Amber / Gold (`#d97706` / `text-amber-400`, `border-amber-600/30`)
- ✨ **FX & Overlays (`FX1`, ...)**: Purple / Fuchsia (`#9333ea` / `text-purple-400`, `border-purple-600/30`)

---

## 2. Component System Architecture

1. **Radix UI Primitives**: All interactive controls (Dialog, DropdownMenu, Slider, Tabs, Tooltip, Switch) leverage headless Radix primitives to ensure complete keyboard navigation and ARIA accessibility.
2. **Tailwind CSS 4**: Modern CSS utility-first styling with inline CSS variables and zero runtime CSS overhead.
3. **Class Variance Authority (`cva`)**: Type-safe component variant declarations for buttons, badges, and cards.

---

## 3. Workspace Layouts

### 3.1 Desktop Studio (4-Pane Grid)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Top Header: Project Title, Ratio, Undo/Redo, AI Director, Export Button     │
├─────────────────┬──────────────────────────────────────────┬─────────────────┤
│                 │                                          │                 │
│  Media Bin      │             Preview Canvas               │  Inspector      │
│  • Upload       │     • Responsive Aspect Ratio Box        │  • Transform    │
│  • Stock search │     • Play/Pause & Shuttle Controls      │  • Appearance   │
│  • 3D Models    │     • Safe Zone & Grid Overlays          │  • Audio / EQ   │
│  • Audio clips  │     • Timecode Display                   │  • Captions     │
│  • Stickers     │                                          │  • Effects      │
│                 │                                          │                 │
├─────────────────┴──────────────────────────────────────────┴─────────────────┤
│  Non-Linear Timeline:                                                        │
│  • Time Ruler & Snapping Playhead                                            │
│  • V1, V2 Video Tracks │ A1, A2 Audio Waveforms │ T1 Captions │ FX Overlays  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Mobile Responsive Mode
On mobile viewports (`< 768px`):
- The viewport switches to a single-column layout.
- The top header provides a segmented control to toggle between **Preview Mode** and **Timeline Mode**.
- The Media Bin and Inspector panels open as sliding bottom drawers.

---

## 4. Interaction & Feedback Rules

1. **Timeline Interactions**:
   - **Playhead Scrubbing**: Smooth 60 FPS scrub tracking with immediate canvas redraw.
   - **Snap Lines**: Visual magnetic guide lines when dragging clip edges near adjacent clips or timeline markers.
   - **Clip Drag Feedback**: Semi-transparent ghost preview with active timecode delta badge.
2. **Keyboard Shortcuts**:
   - `Space`: Play / Pause toggle
   - `J` / `K` / `L`: Shuttle backward / Stop / Shuttle forward
   - `S` / `C`: Razor Split clip at playhead
   - `M`: Add timeline marker
   - `Ctrl+Z` / `Ctrl+Y`: Undo / Redo
   - `?`: Toggle Keyboard Shortcuts Modal
3. **Screen Reader Support**:
   - A live screen-reader announcer (`aria-live="polite"`) speaks timeline operations (e.g. *"Split clip at 04:12"*, *"Deleted 2 selected clips"*).
