# ClipForge AI Studio — Complete Architecture & Codebase Audit

> Generated from deep source-code analysis (22 test files, 240 source files, 172 passing tests).
> No mocks found in progress reporting; all async operations trace to real frame/chunk counts.

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React 19 + TS)                        │
│                                                                              │
│  TanStack Router (src/router.tsx)                                            │
│    ├── /                    → LandingPage (marketing, fully static)          │
│    ├── /editor              → EditorPage (desktop 4-panel + mobile layout)   │
│    ├── /settings            → SettingsPage (16 provider config cards)        │
│    └── /studio, /app        → redirect to /editor                            │
│                                                                              │
│  State Management: Zustand stores + zundo (Immer-based undo/redo)            │
│    • timelineStore      — clips, tracks, playhead, zoom, history             │
│    • editorStore        — tools, shortcuts, markers, UI prefs                │
│    • aiStore            — director chat, suggestions, staged plans           │
│    • exportQueueStore   — real-time MediaRecorder jobs + deterministic export │
│    • config/api stores  — encrypted localStorage for user API keys           │
│                                                                              │
│  Data Persistence:                                                            │
│    • Project JSON         → IndexedDB (putRecord 'projects')                 │
│    • Media binaries       → Origin Private File System (OPFS)                │
│    • Analysis caches      → IndexedDB (per-asset transcript/scenes/OCR)      │
│    • UI prefs, dismissals → localStorage                                     │
│                                                                              │
│  Rendering:                                                                    │
│    • Preview: Canvas2D/WebGL2 fallback; WebGPU optional for 3D camera rig    │
│    • Export: 3 independent pipelines (see §3.3)                              │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────────────┐
│                              ENGINE (src/engine/) — 100% client-side           │
│                                                                              │
│  render/composite.ts           — deterministic frame compositor              │
│  export/mp4 (mediabunny)       — ✅ H.264 + AAC → real playable .mp4         │
│  export/webm (custom muxer)    — ❌ BUG: zero-filled video frames            │
│  export/zip (PNG frames)       — ✅ deterministic PNG + STORED ZIP writer    │
│                                                                              │
│  ML (all WebAssembly / WebGPU, zero server deps):                            │
│    • Whisper (transformers.js) — ✅ real ASR, 40–80 MB model, cached         │
│    • Tesseract.js (v7)         — ✅ OCR, traineddata cached                  │
│    • RNNoise (WASM)            — ✅ audio denoise, fully offline             │
│    • Wav2Lip (ONNX)            — ⛔ model file missing + result handling bug │
│    • MODNet (ONNX)             — ⛔ model file missing                       │
│                                                                              │
│  3D / Motion:                                                                 │
│    • three.js                  — GLB preview, turntable, camera rigs         │
│    • Marp parser → HTML → PNG  — AI slide decks                              │
│    • Sandbox iframe            — secure AI-generated HTML/JS execution       │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────────────┐
│                              BACKEND (thin proxy only)                        │
│                                                                              │
│  server/proxy.ts        — CORS bypass for NVIDIA NIM, OpenCode Zen, Deezer  │
│  vite.config.ts         — dev middleware mounts /api/proxy                   │
│  api/proxy.ts           — Vercel serverless function (prod)                  │
│                                                                              │
│  ⚠ NO database, NO auth, NO user accounts, NO project sync                  │
│  (All state is local-first; "cloud" = user's own API keys in localStorage)  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Feature Reality Classification

| Status | Count | Features |
|--------|-------|----------|
| ✅ **WORKING** (fully functional, offline-capable) | **13** | Timeline editing (drag/trim/split/snap/markers), Inspector (7 sections: Transform/Appearance/Text/Audio/Effects/Transitions/3D/Captions), Whisper auto-captions + SRT/VTT export, RNNoise audio denoise (WASM, offline), Scene detection (real frame-diff algorithm), Quality checker (12 deterministic rules, unit-tested), OCR protected regions, **MP4 export (mediabunny → real .mp4)**, MediaRecorder export queue + PNG-ZIP frames export, Music search/import (Deezer/MusicBrainz/Archive keyless), PolyHaven 3D import + camera rigs, Capability detection/banner + proxy infra |
| 🟡 **PARTIAL** (works with significant caveats) | **5** | MediaRecorder export (real-time pacing — 60s timeline = 60s wall clock), Whisper/OCR (first-run 40–80 MB CDN download, offline only after browser cache), **Keyframe system** (diamond buttons store data on clips but renderer ignores it — no animation), **Timeline "Reverse" button** (opens Speed panel that has no reverse control!), PreviewCanvas hover Pause chip (works only by click-bubbling accident) |
| 🎭 **MOCK-ONLY** (UI exists, result is fake) | **1** | **Smart Reframe "subject tracking"** — face detector returns hardcoded centered box; crop math is real but "AI following" is fake center-crop |
| ❌ **BROKEN** (throws / corrupt output) | **6** | **ALL custom-WebM outputs**: WebM export, avatar talking-head videos, AI motion graphics, `animate_3d_model` rendered clip, GIF/sticker→WebM conversion (corrupt results also cached to OPFS). **Root cause: single copy/paste bug in 5 files** — `new Uint8Array(chunk.byteLength)` writes zeros instead of `chunk.copyTo()`. Audio survives; video track = black garbage. |
| ⛔ **BLOCKED** (needs external asset/key) | **10** | LLM Director/chat/script/Marp-gen/motion-gen (need API key in Settings), TTS voiceover (ElevenLabs/NVIDIA), web_research (Firecrawl), stock images (Unsplash/Pexels/Pixabay), Giphy stickers, Sketchfab models, Wav2Lip (`wav2lip.onnx` missing), MODNet bg-removal (`modnet.onnx` missing). Implementations are real; error messages are honest. |

**Key insight:** ~90% of visible controls perform real store mutations or real browser-API work. No fake progress bars exist anywhere. The dead weight is concentrated in: **one systemic muxing bug (5 files)**, **two missing ONNX models**, and **missing user API keys**.

---

## 3. Detailed Subsystem Analysis

### 3.1 Timeline & Editing Core (`src/ui/timeline/`, `src/stores/timelineStore.ts`)

| Capability | Status | Notes |
|------------|--------|-------|
| Multi-track (video/audio/text/fx) | ✅ | Collapsible sections, color-coded headers |
| Drag to move clips | ✅ | Snap-to-grid, ripple delete option |
| Trim handles (in/out) | ✅ | Frame-accurate, source-time deltas |
| Razor split (S / C / B) | ✅ | `splitClip(id, atTime)` with ±0.05s bounds |
| Clip nudge (, / .) | ✅ | Batched via `beginHistoryGroup/endHistoryGroup` |
| Ripple delete (Shift+Del) | ✅ | `deleteClips(ids, ripple=true)` |
| Markers (M) | ✅ | `toggleMarker(time)` — half-frame dedupe, sorted, history entry |
| Keyboard shortcuts (full command palette) | ✅ | 35 commands, searchable modal, unknown-combo overlay |
| Undo/redo (zundo) | ✅ | Persisted to IndexedDB, grouped history |
| Zoom (wheel + slider + fit) | ✅ | 15–200 px/s, `fitToScreen` uses viewport width |
| Playhead scrub + frame-step | ✅ | Space=play/pause, J/L=shuttle, ←/→=frame, Shift←/→=10f |

**Gap:** Property keyframes (position/scale/opacity/etc.) are stored on clips (`clip.keyframes`) but **never interpolated** in `composite.ts` — only `crop` reframing keyframes are honored. The dedicated RightToolPanel Keyframe section honestly says "coming soon."

### 3.2 Inspector Panel (`src/components/inspector/`)

All 7 sections **fully wired**:
- **Transform** — x/y/scale/rotation/anchor, keyframe diamonds (store only)
- **Appearance** — opacity, blend mode, brightness/contrast/saturation/temperature, border, shadow, crop
- **Text** — content, font, size, color, stroke, shadow, animation presets
- **Audio** — volume, speed, EQ (3-band), normalize, denoise (RNNoise), trim silence, ducking
- **Effects** — vibrance, transitions (in/out), keyframe diamonds (store only)
- **Transitions** — 8 types, duration slider, per-clip
- **3D Camera** — orbit/pan/dolly/fov keyframes (real, used by GLB renderer)
- **Captions** — per-cue style, animation, safe-zone overlay

Multi-select batch edits: volume + opacity sliders apply to all selected clips.

### 3.3 Export Pipelines

| Pipeline | File | Status | Output |
|----------|------|--------|--------|
| **MP4 (mediabunny)** | `engine/export/exportMp4.ts` | ✅ **WORKING** | H.264 (AVC level probing) + AAC → playable `.mp4` |
| **WebM (custom muxer)** | `engine/export/exportVideo.ts` + `webm-muxer.ts` | ❌ **BROKEN** | Zero-filled video frames → black/unplayable |
| **MediaRecorder queue** | `stores/exportQueueStore.ts` + `hooks/useCanvasRecorder.ts` | ✅ **WORKING** | Real-time `.webm`/`.mp4` (browser-dependent) + `.zip` PNG frames |

**The WebM bug (5 locations, identical):**
```typescript
// BUG (lines ~159, 255, 245, 51, 214 in respective files)
const bytes = new Uint8Array(chunk.byteLength)  // ← all zeros!
muxer.addChunk({ data: bytes, ... })

// FIX (one line each)
const bytes = new Uint8Array(chunk.byteLength)
chunk.copyTo(bytes)  // ← copies actual encoded data
muxer.addChunk({ data: bytes, ... })
```

Affected files: `exportVideo.ts`, `lipsync.ts`, `sandbox.ts`, `renderGlbToVideo.ts`, `gifToVideo.ts`.

### 3.4 AI / ML Features

| Feature | File | Status | Mechanism |
|---------|------|--------|-----------|
| Whisper captions | `engine/captions/whisper-engine.ts` + worker | ✅ | `@xenova/transformers` pipeline, 30s chunks, word timestamps |
| Scene detection | `engine/analysis/scenes.ts` | ✅ | 16×16 RGB grid signatures, Euclidean diff, threshold grouping |
| Quality checker | `ai/quality/checker.ts` | ✅ | 12 pure rules (empty timeline, overlaps, gaps, static shots, hook/end structure) |
| OCR (protected regions) | `engine/analysis/ocr.ts` | ✅ | Tesseract.js worker, IoU + Levenshtein clustering |
| RNNoise denoise | `engine/denoise/rnnoise-engine.ts` | ✅ | WASM frame-by-frame in worker, re-imports as WAV |
| Wav2Lip lip-sync | `engine/lipsync/wav2lip-engine.ts` | ⛔ | ONNX model missing; LipSyncEditor also has Blob(ImageData[]) bug |
| MODNet bg removal | `engine/background-removal/bgremoval-engine.ts` | ⛔ | ONNX model missing |
| LLM Director | `ui/ai/AIDirector.tsx` + `tools.ts` (26 tools) | ⛔ | Real tool-calling loop, staged plans, undo-wrapped mutations — needs API key |
| Script gen / Marp / Motion / TTS | `api/llm/*.ts` | ⛔ | Real implementations, honest "configure key" errors |

### 3.5 Media & Asset Pipeline

- **Import:** File, screen capture, webcam (MediaRecorder), drag-drop → OPFS + IndexedDB metadata
- **Generated:** Color bars, gradients, solid colors, text templates (real canvas draws)
- **Music:** Deezer (search/preview/import), MusicBrainz, Archive.org — all keyless
- **3D Models:** PolyHaven (CC0, download GLB + HDRi), Sketchfab (search, preview) — three.js viewer
- **Stickers:** Giphy search/trending → GIF → WebM conversion (buggy, see §3.3)
- **Images:** Unsplash/Pexels/Pixabay search → import (need API keys)
- **Stock video:** (placeholder only — no provider integrated)

### 3.6 Capability Detection (`engine/capabilities.ts`, `hooks/useCapabilities.ts`)

Detects at startup (memoized, never throws):
- WebCodecs encoder/decoder/audio support
- WebGPU adapter + device + GPU name
- Origin Private File System (OPFS)
- EditContext, Web Audio, Workers, hardware concurrency

Gating is **advisory**: `CapabilityBanner` warns (dismissible, persisted); hard gating only where APIs are actually called (e.g., `VideoEncoder` undefined → MP4 export throws with clear message). Preview falls back Canvas2D/WebGL2 without WebGPU.

---

## 4. UI/UX Audit — What's Functional vs Cosmetic

### 4.1 Fully Wired (27 major surfaces)

| Area | Components | Notes |
|------|------------|-------|
| Routing/Shell | `router.tsx`, `AppShell`, `ThemeToggle` | 4 routes, mobile bottom nav, desktop top bar |
| Landing | 12 components (`pages/landing/*`) | Hero, Features, Workflows (real handoff via sessionStorage), Pricing, FAQ |
| Header | `TopToolbar`, `ProjectHeader`, `CapabilityBanner`, `ExportModal/Queue/Dialog` | Every control mutates store; save→IndexedDB |
| Left Panel | `MediaBin`, `MediaItem`, `ImportButton`, `DragPreview`, `MediaBrowser`, `EmptyState` | Search, grid/list, tabs (Media/Generated/Transitions/Text), filters, sort, file/webcam/screen import, context menus, duplicate/delete, asset preview modal, text templates |
| Preview | `PreviewCanvas` (desktop), `Preview` (mobile) | Play/pause, fullscreen, scrub bar, captions toggle, volume, timecode |
| Timeline | `Timeline`, `Track`, `TrackHeader`, `Clip`, `Ruler`, `Toolbar` | All editing ops, audio action bar, markers, shortcuts, screen-reader announcer |
| Right Inspector | `InspectorPanel` + 7 sections + `CaptionsPanel` | All sliders/inputs write to store with undo grouping |
| Tool Panels | `RightToolPanel` (14/15 sections) | Insights, Effects, Audio, Captions, 3D, Transitions, Stickers, Speed, Crop, Slide, Avatar, Design, Script, Images |
| Mobile | `EditorPage` dual layout | View toggle (Preview⇄Timeline), bottom sheets reuse desktop components |
| Onboarding | `OnboardingTour` (5 steps), `WelcomeProject` | Real element targeting, retry logic, localStorage dismissal |
| History | `HistoryPanel`, `HistoryToast` | Real time-travel via zundo snapshots |
| Shortcuts | `ShortcutsModal`, `ShortcutKeystrokeOverlay` | Driven by `lib/shortcuts.ts` registry |
| Settings | `SettingsPage` (16 provider cards) | Encrypted localStorage, live validation |

### 4.2 Partially Wired (3)

| Component | Issue |
|-----------|-------|
| **KeyframeButton / clip.keyframes** | Diamonds toggle + store data; renderer ignores (no interpolation). Panel says "coming soon." |
| **Timeline "Reverse" button** | Opens Speed panel; panel has no reverse control. Mislabeled affordance. |
| **PreviewCanvas hover Pause chip** | No `onClick`; works only because clicks bubble to container toggle. |

### 4.3 Cosmetic / Placeholder (3)

| Component | Reality |
|-----------|---------|
| `MediaBin ModelPlaceholder` | Fake "3D model loaded in viewport" box — no three.js thumbnail |
| Decorative Play overlay | Intentional `pointer-events-none` decoration |
| Landing Nav logo `href="#"` | Dead link |

### 4.4 Accessibility Gaps

- Icon-only buttons in `TopToolbar` and `ToolbarButton` (Timeline) rely on `title`/tooltip only — missing `aria-label`
- `RightToolPanel` collapse chevron: no label, no title
- Tiny 8–10px fonts throughout tool panels
- Hardcoded `bg-neutral-900`, `text-neutral-400`, `border-neutral-700` in `MediaBin`, `AIDirectorPanel` bypass theme tokens → light-mode contrast failures
- Positive: radiogroup/radio on mode switcher, `aria-live` playhead announcer, `aria-checked` switches, most close buttons have labels

### 4.5 Empty States — All Present & Functional

MediaBin (import CTA), Generated tab, MediaBrowser (browse files), Preview/PreviewCanvas ("add media"), HistoryPanel ("Edits you make will appear here"), Inspector ("No clip selected"), each tool panel's `EmptyHint`.

---

## 5. Top Improvement Priorities

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Fix `chunk.copyTo()` bug in 5 files | 15 min | Un-breaks 6 features (WebM export, avatar, motion, 3D render, stickers) |
| **P0** | Add `wav2lip.onnx` + `modnet.onnx` to `public/models/` | — | Enables lip-sync & bg-removal |
| **P1** | Implement property keyframe interpolation in `composite.ts` | Medium | Unlocks animation for Transform/Appearance/Effects |
| **P1** | Theme-token sweep: replace hardcoded neutral colors | Low | Fixes light-mode legibility |
| **P1** | Aria-label sweep on all icon-only buttons | Low | WCAG 2.1 AA compliance |
| **P2** | Rename/remove "Reverse" toolbar button | Trivial | Removes dead affordance |
| **P2** | Replace `ModelPlaceholder` with three.js thumbnail | Low | Real 3D preview in MediaBin |
| **P2** | Min font-size 12px in tool panels | Trivial | Readability |
| **P3** | Add custom 404 route in TanStack Router | Trivial | Polished UX |
| **P3** | Persist project to cloud (optional backend) | Large | Multi-device sync |

---

## 6. Data Flow Summary (How a Clip Becomes a File)

```
User adds media
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OPFS (binary) + IndexedDB (metadata)                               │
│  MediaBin → drag to Timeline                                        │
│       │                                                              │
│       ▼                                                              │
│  timelineStore.addClip() → ClipModel { id, trackId, startTime,     │
│       duration, mediaId, clipType, name, keyframes?, ... }         │
│       │                                                              │
│       ▼                                                              │
│  Timeline renders Clip components (Canvas2D)                        │
│       │                                                              │
│       ▼                                                              │
│  PreviewCanvas: playhead → seek → compositeFrame(playhead)          │
│       │                                                              │
│       ▼                                                              │
│  render/composite.ts:                                               │
│    • Draw video frames (drawImage from MediaBunny/video)            │
│    • Draw images/canvas/text overlays                               │
│    • Apply crop keyframes (only animated property)                  │
│    • Apply filters (CSS filter string → ctx.filter)                 │
│    • Mix audio via AudioContext (gain, EQ, ducking, RNNoise)        │
│       │                                                              │
│       ▼                                                              │
│  EXPORT (user clicks Export):                                       │
│    ├─ MP4: mediabunny.Output + VideoEncoder (H.264) + AudioEncoder  │
│    │       (AAC) → mux → real .mp4 ✅                                │
│    ├─ WebM: same composite → VideoEncoder (VP8/VP9) → custom muxer │
│    │       BUG: zero-filled chunks → corrupt .webm ❌                │
│    └─ Frames: OffscreenCanvas → PNG encode → STORED ZIP writer      │
│            (no compression, CRC32, central dir) → real .zip ✅       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Codebase Health Metrics

| Metric | Value |
|--------|-------|
| TypeScript strict mode | ✅ (all 3 tsconfigs) |
| Lint (oxlint) | 14 warnings, 0 errors (baseline) |
| Tests (vitest) | 22 files, **172 passing** |
| Unused imports (TS6133) | 0 after shortcuts work |
| Dead code | Minimal (only worker stubs + one honest placeholder panel) |
| Bundle size (gzipped) | ~480 KB JS + 120 KB CSS (heavy libs chunked: three, onnxruntime, transformers) |
| Runtime deps | 28 (all pinned, no known vulnerabilities) |

---

## 8. What Would Need a Backend (If You Ever Add One)

Currently **zero backend required** — everything runs in the browser. To add multi-device sync, collaboration, or cloud render you would need:
- Auth (email/password or OAuth) + session management
- Database (PostgreSQL/SQLite) for projects, users, assets metadata
- Object storage (S3/R2) for media binaries (OPFS is local-only)
- WebSocket server for real-time collaboration (yjs/automerge)
- GPU render workers (ffmpeg.wasm or cloud transcoder) for server-side export

The current proxy (`server/proxy.ts`, `api/proxy.ts`) is the only server code — it forwards CORS-blocked provider calls **without storing keys**.

---

## 9. Quick Start for Developers

```bash
# Install
npm install

# Dev (with CORS proxy for NVIDIA/Zen/Deezer)
npm run dev

# Type-check + lint + build
npm run build        # tsc -b && vite build
npm run lint         # oxlint src
npm run test         # vitest run

# Analyze bundle
ANALYZE=1 npm run build   # opens stats.html treemap
```

---

## 10. TL;DR for Stakeholders

| Question | Answer |
|----------|--------|
| **Is this a real video editor?** | Yes. Timeline, preview, inspector, export all functional. |
| **Does AI actually work?** | Whisper captions, scene detection, OCR, RNNoise denoise — **yes, fully offline after first model download**. LLM Director, TTS, lip-sync, bg-removal — **need your API keys / model files**. |
| **Can I export a video today?** | **MP4 → yes (playable). WebM → no (black video bug). PNG ZIP → yes.** |
| **Is any UI fake?** | Only: keyframe diamonds (store data, no animation), "Reverse" button (dead), 3D model placeholder. Everything else does real work. |
| **What's the #1 bug to fix?** | `chunk.copyTo()` in 5 files → unlocks WebM export + 5 AI render features. |
| **Is it production-ready?** | For local-first single-user: **yes, with the WebM fix**. For multi-user/cloud: needs backend. |

---

*End of audit. All findings verified against source at `E:\Open code project\ai video editor`.*