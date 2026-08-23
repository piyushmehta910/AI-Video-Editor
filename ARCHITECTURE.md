# Architecture Specification: ClipForge AI Studio

## 1. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT BROWSER (React 19 + TypeScript)                 │
│                                                                                          │
│  Routing (TanStack Router)                                                               │
│    ├── /                    → LandingPage (SSG/Static)                                   │
│    ├── /editor              → EditorPage (WebGPU/Canvas2D Workspace + Timeline)          │
│    └── /settings            → SettingsPage (API Key Management & Preferences)            │
│                                                                                          │
│  State Management (Zustand + Zundo + Immer)                                              │
│    ├── timelineStore        — Multi-track clips, keyframes, playhead, history stack      │
│    ├── editorStore          — Active panels, inspector mode, tool state, UI preferences  │
│    ├── aiStore              — Director chat transcripts, suggestions, staged tool plans   │
│    ├── exportQueueStore     — Active render jobs, progress tracking, batch queues        │
│    └── apiConfigStore       — Encrypted API keys, provider priorities, timeouts          │
│                                                                                          │
│  Local Persistence Sandbox                                                               │
│    ├── IndexedDB (clipforge-app) → Projects, Assets metadata, Settings, Undo snapshots  │
│    └── OPFS (clipforge-media)   → Binary media files (video/audio/images/models)         │
│                                                                                          │
│  Engine & Media Pipeline (src/engine/)                                                   │
│    ├── Compositor (render/composite.ts)    → Multi-track layered 2D/WebGL2 canvas draw   │
│    ├── MP4 Export (export/exportMp4.ts)    → WebCodecs H.264/AAC + Mediabunny muxer      │
│    ├── Captions (captions/whisper-engine)  → In-browser Transformers.js Whisper WASM     │
│    ├── Audio Denoise (denoise/rnnoise)     → RNNoise WebAssembly C-bindings              │
│    ├── 3D Engine (three/modelRenderer.ts)  → Three.js GLB renderer + Animated Camera Rigs│
│    └── Quality Rules (ai/quality/checker)  → Deterministic timeline heuristic validation │
└───────────────────────────────────────────┬──────────────────────────────────────────────┘
                                            │ (Encrypted API Calls & CORS Bypass)
┌───────────────────────────────────────────▼──────────────────────────────────────────────┐
│                                   BACKEND (Stateless Proxy Only)                         │
│                                                                                          │
│  server/proxy.ts (Vite Dev)  /  api/proxy.ts (Vercel Serverless Function)                │
│    • Forwards requests to external APIs lacking browser CORS headers                     │
│    • ZERO database, ZERO auth cookies, ZERO media storage, ZERO analytics logs          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Layers

### 2.1 Presentation & Routing Layer
- **TanStack Router**: File-system agnostic, type-safe route trees.
- **Route Gates**:
  - `BrowserGate`: Validates browser feature support (WebCodecs, WebAssembly, Canvas 2D) before lazy-loading the heavy editor bundle.
  - `EditorErrorBoundary`: Isolates canvas crashes or WebGPU device loss without breaking the surrounding studio shell.
- **Responsive Dual-Layout**:
  - Desktop: 4-pane layout (Media Bin, Center Preview Canvas, Right Multi-tool Inspector, Bottom Non-linear Timeline).
  - Mobile: Tabbed view toggle (Preview vs Timeline) with drawer-based bottom sheet tools.

### 2.2 State & History Architecture
- **Zustand Store Isolation**:
  - `timelineStore`: Core timeline schema (tracks, clips, keyframes, transitions, markers). Wrapped with `zundo` for temporal time travel (undo/redo).
  - History mutations are grouped using `beginHistoryGroup()` and `endHistoryGroup()` to avoid cluttering the undo stack during continuous drag operations.
- **Immer Updates**: Immutable updates with structural sharing ensure zero UI tearing during 60 FPS playhead scrubs.

### 2.3 Storage Sandbox Architecture
- **IndexedDB (`clipforge-app` v3)**:
  - `projects`: Serialized project graphs, track configurations, and render settings.
  - `assets`: Asset metadata, duration, frame dimensions, OCR text cache, scene boundaries.
  - `settings`: Encrypted API keys, preferred models, UI theme configurations.
  - `history`: Time-travel snapshots persisted between session reloads.
- **Origin Private File System (OPFS)**:
  - High-performance, sandboxed local filesystem.
  - Media files are written directly into OPFS streams, avoiding RAM bloat for 4K video clips.
  - Access paths are sanitized to prevent directory traversal attacks.

---

## 3. Media & Render Pipeline

```
[ Local File / Webcam / URL ]
             │
             ▼
[ OPFS Storage (clipforge-media) ]
             │
             ├──► [ VideoDecoder (WebCodecs) ] ──┐
             ├──► [ AudioDecoder (WebCodecs) ] ──┤
             └──► [ ImageBitmap / Three.js ]   ──┼──► [ Composite Canvas ]
                                                 │           │
                                                 │           ├──► Real-Time Preview
                                                 │           │
                                                 ▼           ▼
                                      [ VideoEncoder ] ◄── [ Mediabunny Muxer ]
                                      [ AudioEncoder ] ──► [ Output .mp4 ]
```

### 3.1 Frame Compositing Pipeline
- Evaluates active clips at time `t` across all tracks.
- Layers clips in track order: `Video Tracks (V1 < V2 < ...)` → `Text Tracks` → `FX Overlays`.
- Applies real-time visual transforms: Position, Scale, Rotation, Opacity, Crop, and Blend Modes.
- Runs canvas filter pipelines: Brightness, Contrast, Saturation, Vignette, Glitch, Chromatic Aberration, and Grain.

### 3.2 Hardware-Accelerated Export Pipeline
- **WebCodecs VideoEncoder**: Encodes raw canvas frames to H.264 (AVC) with configurable bitrates, keyframe intervals, and hardware acceleration profiles (`prefer-hardware`).
- **WebCodecs AudioEncoder**: Encodes mixed multi-track audio to AAC (48kHz, stereo, 192kbps).
- **Mediabunny Multiplexer**: Multiplexes H.264 and AAC streams into clean, standard-compliant MP4 containers ready for instant download.

---

## 4. In-Browser AI & Machine Learning Pipeline

```
                       ┌───────────────────────────────┐
                       │   Local AI / ML Workers       │
                       └──────────────┬────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
 [ Whisper WASM ]             [ RNNoise WASM ]             [ Tesseract.js ]
 (Speech-to-Text)             (Audio Denoise)              (Frame OCR Engine)
  • 30s audio slicing          • 480-sample chunks          • Text region detection
  • Word-level timestamps      • WebAssembly DSP loop       • Safe zone protection
  • VTT/SRT cue builder        • Re-encodes WAV stream      • Subtitle auto-placement
```

---

## 5. Autonomous AI Director Architecture

1. **Context Assembly**: `getProjectContextSystemPrompt()` compiles the complete project graph (tracks, clips, media names, timecodes, user preferences) into the LLM system prompt.
2. **Tool Protocol**: The AI Director communicates via OpenAI-compatible tool definitions (26 distinct tools: `plan_edit`, `add_clip`, `split_clip`, `trim_clip`, `apply_effect`, `generate_script`, etc.).
3. **Staging Engine**: Tool calls from the LLM are staged in `aiStore` as actionable diffs. The user can review, accept, or reject each edit before it modifies the timeline.
4. **Execution Sandbox**: Approved actions call typed store actions with automatic undo-grouping.
