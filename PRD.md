# ClipForge — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | ClipForge (repo: `ai-video-editor`) |
| **Version** | 0.x Beta |
| **Document status** | Living document — reflects implementation as of Aug 2026 |
| **Platform** | Web (desktop-first), 100% client-side |
| **Related docs** | `ARCHITECTURE.md`, `ARCHITECTURE_AND_CODEBASE_AUDIT.md`, `UI_GUIDELINES.md`, `SECURITY.md`, `TESTING.md`, `PERFORMANCE.md`, `DEPLOYMENT.md` |

---

## 1. Executive Summary

ClipForge is a **browser-native AI video editor** that runs entirely on the user's machine. It combines a professional multi-track timeline editor (cut, trim, move, layer, keyframe-style transforms) with an **AI Director** — a conversational agent that can operate ~50 editing tools on the user's behalf via LLM function-calling against any OpenAI-compatible endpoint the user configures (OpenRouter, OpenCode Zen, NVIDIA NIM).

Heavy media work — compositing (WebGPU/WebGL), transcription (Whisper WASM), audio denoising (RNNoise WASM), OCR (tesseract.js), neural effects (ONNX Runtime Web), encoding/muxing (WebCodecs + mediabunny), and storage (OPFS + IndexedDB) — happens **locally in the browser**. Video files are never uploaded to any server. The only network calls are user-directed: BYO-key LLM/TTS/stock/research APIs through a CORS proxy.

**One-sentence pitch:** *"Edit video. Command an AI director."* — a free, private, offline-capable alternative to cloud editors where users bring their own AI keys.

---

## 2. Problem Statement

1. **Cloud AI editors require uploads.** Creators must hand raw footage (often gigabytes, sometimes sensitive) to third parties, paying storage/egress costs and accepting privacy risk.
2. **Pro desktop tools are heavy and paid.** DaVinci/Premiere demand installs, powerful hardware management, and subscriptions; casual creators bounce off them.
3. **AI features are fragmented.** Transcription, auto-reframe, background removal, lip-sync, and "edit my video" agents exist only inside separate walled products, each requiring accounts.
4. **Free-tier AI access is underused.** Free LLM endpoints (OpenRouter free models, NVIDIA NIM hosted builds, OpenCode Zen free tiers) exist but have no consumer editing product built on top of them.

ClipForge solves all four by putting the entire pipeline — including on-device ML — into one web app with zero upload and zero hard-coded keys.

---

## 3. Vision & Differentiation

- **Privacy as architecture, not policy:** no account system, no server-side media, keys stored locally encrypted (AES-256-GCM).
- **Human/AI/Hybrid modes:** manual precision editing; fully delegated "AI Mode"; or staged approval where every plan is reviewed before applying (confirmation levels: always / expensive / destructive / none).
- **Graceful capability degradation:** WebGPU compositing with WebGL fallback; procedural TTS fallback when no ElevenLabs/NIM key; procedural avatar fallback when no neural model.
- **Everything inspectable:** AI plans are shown before apply, applied atomically as one undo step; project context fed to the LLM is derived from real transcripts/scenes/OCR cached locally.

---

## 4. Goals & Non-Goals

### Goals
| # | Goal |
|---|---|
| G1 | Full manual editing parity with a basic NLE: import → arrange → trim → transform → caption → export |
| G2 | AI Director that reliably executes natural-language edit requests via tool-calling |
| G3 | All media processing local; app usable offline after first load (models aside) |
| G4 | Zero-cost core: free providers/models supported end-to-end without any key |
| G5 | Fast perceived performance: instant timeline interactions, workerized heavy jobs |

### Non-Goals (v1)
- Multi-user collaboration / cloud projects / sync
- Mobile touch-optimized editing (responsive view exists but is read-mostly)
- Server-side rendering farms or GPU cloud acceleration
- Account systems, subscriptions, payments, telemetry
- Color grading suites / advanced scopes (basic filters only)

---

## 5. Target Users & Personas

| Persona | Description | Primary value |
|---|---|---|
| **Content creator (Priya)** | YouTube/Shorts creator, edits weekly, owns footage, privacy-aware | Fast rough cuts + captions + vertical reframe; keeps raw footage local |
| **Educator (Marco)** | Turns PDFs/articles/lectures into lesson videos | PDF→Lesson and Article→Video pipelines, slide decks, TTS voiceover |
| **Indie marketer (Sana)** | Makes product/avatar sales videos without a studio | Avatar generator, stock/sticker/music search, script styles |
| **Privacy-conscious pro (Alex)** | Has sensitive footage (legal, medical, enterprise) | No-upload guarantee, local-only storage, encrypted keys |
| **Hacker/tinkerer (Dev)** | Wants free-model AI tooling | BYO keys incl. free tiers, transparent plans, cheat-sheet UX |

---

## 6. Key User Journeys

### 6.1 First run (zero-friction)
Land on `/` → "Open the Editor" → `/editor` gated by browser-capability check (WebGPU/WebCodecs/OPFS) → guided 5-step tour → procedurally generated Welcome Project (color bars + ambient pad + title/captions) demonstrates timeline immediately. No signup, no download.

### 6.2 Manual edit loop
Import media (drag-drop / picker / paste / record screen-webcam-mic) → assets stored OPFS with thumbnails/filmstrips/waveforms → drag to tracks → trim by dragging clip edges (or Shift+T trim mode / `[` `]` / I/O) → split (S), move, duplicate → style via Inspector (transform, opacity, volume, fades, speed, filters, text) → preview scrubbing with GPU compositor → export MP4.

### 6.3 AI-delegated edit ("Hybrid mode")
Open floating AI Director (FAB) → type "turn this into a 30s vertical reel with captions" → Director calls `plan_edit` → EditPlan staged with human-readable steps → user approves → plan applied atomically (single undo step) → quality checker flags weak hook/static sections → iterate conversationally.

### 6.4 Pipeline flows (from landing Workflows section)
Video→Reel · PDF→Lesson · Article→Video · Avatar Sales Video — clicking navigates to `/editor` with a sessionStorage pipeline key that seeds a Director trigger prompt and step list.

---

## 7. Functional Requirements

Legend: **Priority** P0 = launch-blocking, P1 = important, P2 = nice-to-have. **Status** ✅ shipped · 🟡 partial · ❌ broken · 🧩 planned/not started.

### 7.1 App Shell & Routing
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-SH-01 | Routes: `/` landing, `/editor` editor, `/settings` provider config; `/studio` & `/app` redirect to `/editor` | P0 | ✅ |
| FR-SH-02 | Capability gate before editor chunk loads (WebGPU/WebCodecs/OPFS check); unsupported browsers see guidance screen, never download editor bundle | P0 | ✅ |
| FR-SH-03 | Error boundary around editor isolating crashes from rest of app | P0 | ✅ |
| FR-SH-04 | Responsive layout: desktop 4-pane (toolbar/media/compositor+timeline/inspector); mobile stacked with bottom nav and uncontrolled floating panels | P1 | 🟡 |

### 7.2 Media Import & Library
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-ME-01 | Import video/audio/image/GIF/SVG/GLB-GLTF via drag-drop, file picker, clipboard paste | P0 | ✅ |
| FR-ME-02 | Size caps: video ≤2 GB, audio/model ≤500 MB, image ≤100 MB; MIME+extension validation with clear rejection messages | P0 | ✅ |
| FR-ME-03 | Files persisted to OPFS (`clipforge-media`), metadata in IndexedDB, path-traversal-safe writes | P0 | ✅ |
| FR-ME-04 | Auto-generated thumbnails, filmstrips (video), waveforms (audio), proxies on import with granular progress | P1 | ✅ |
| FR-ME-05 | Screen recorder (getDisplayMedia) and webcam recorder (getUserMedia) captured via MediaRecorder → imported as assets | P1 | ✅ |
| FR-ME-06 | Voiceover recorder: mic-only capture with live level meter → asset | P1 | ✅ |
| FR-ME-07 | Media Bin tabs: Media / Generated (images, voice, avatars, animations) / Transitions / Text templates; search, filter, sort, duplicate, preview modal | P1 | ✅ |
| FR-ME-08 | Drag asset from bin onto timeline track (correct track type enforcement) | P0 | ✅ |

### 7.3 Timeline Editing
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-TL-01 | Multi-track timeline: video, audio, text (T1 overlay), FX track types; header per track with mute/solo/lock/hide controls | P0 | ✅ |
| FR-TL-02 | Clip selection (click, Ctrl-multi, marquee-free), select-all-on-track (Ctrl+A) | P0 | ✅ |
| FR-TL-03 | Move clips horizontally and across same-type tracks via pointer drag; auto-grouped undo history | P0 | ✅ |
| FR-TL-04 | Split at playhead (S / Ctrl+K) with ±0.05s self-intersection guards | P0 | ✅ |
| FR-TL-05 | **Drag-to-trim**: click-and-hold left/right clip edges to adjust in/out; handles always visible (2px, expand on hover), enlarged with indicator in trim mode | P0 | ✅ |
| FR-TL-06 | Trim mode toggle (Shift+T) enlarging hit targets; frame-step trims via `[` `]`; in/out points via I/O | P1 | ✅ |
| FR-TL-07 | Ripple delete (Shift+Del) closing gaps on track | P1 | ✅ |
| FR-TL-08 | Copy/cut/paste/duplicate clips (Ctrl+C/X/V/D) | P1 | ✅ |
| FR-TL-09 | Snapping (N): to clip edges of other clips and playhead; zoom-aware threshold | P0 | ✅ |
| FR-TL-10 | Zoom (Ctrl+=/-, Ctrl+0 reset, F fit), px-per-second scale default 90 | P0 | ✅ |
| FR-TL-11 | Markers (M add/remove) rendered as amber ticks; playhead scrub anywhere; playhead announcer for a11y (aria-live, throttled ≥0.95s) | P1 | ✅ |
| FR-TL-12 | Rate-stretch tool (R) adjusting speed by dragging edge | P2 | ✅ |
| FR-TL-13 | Text tool (T): click timeline viewport to place text clip | P1 | ✅ |
| FR-TL-14 | Undo/redo (zundo) covering all mutations incl. atomic AI plan application | P0 | ✅ |
| FR-TL-15 | Autosave to IndexedDB (debounced) + manual Ctrl+S | P0 | ✅ |

### 7.4 Preview & Compositor
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-CM-01 | Real-time composited preview canvas (video layers, images, text, GIF stickers, 3D GLB via three.js) | P0 | ✅ |
| FR-CM-02 | Per-clip transform: position/scale/rotation/opacity, crop, fit modes | P0 | ✅ |
| FR-CM-03 | Audio graph: per-clip volume, fade-in/out, master volume/mute, track mute/solo semantics | P0 | ✅ |
| FR-CM-04 | Speed control per clip incl. playback shuttle J/K/L with speed −8…+8 | P1 | ✅ |
| FR-CM-05 | Aspect ratio presets (16:9, 9:16, 1:1, …) re-framing composition | P0 | ✅ |
| FR-CM-06 | Keyframes: UI exists in Inspector to store transform keyframes per clip | P2 | 🟡 stored but **not interpolated** in compositor render path |
| FR-CM-07 | Transition overlays between adjacent clips (cross-dissolve family) | P1 | 🟡 subset working |

### 7.5 Inspector (unified right panel)
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-IN-01 | Contextual sections per selection type: Transform, Crop, Filters/LUT-lite, Text styling, Volume/Fades/Speed, Effects list, Transitions | P0 | ✅ |
| FR-IN-02 | Numeric drag-sliders with keyboard entry; immediate store commit; undo-integrated | P0 | ✅ |
| FR-IN-03 | Project settings section (canvas size/fps/background) when nothing selected | P1 | ✅ |
| FR-IN-04 | Keyframe buttons per transform property (see FR-CM-06 caveat) | P2 | 🟡 |

### 7.6 AI Director (conversational agent)
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-AI-01 | Floating chat panel (FAB on desktop controlled via store; mobile uncontrolled) with task-list visualization of multi-step operations | P0 | ✅ |
| FR-AI-02 | Function/tool calling over OpenAI-compatible `/chat/completions`; ~50 tools spanning: clip ops (split/trim/move/join/delete/rate), project (ratio, transitions), text overlays, stock/music/web search, captions, voiceover, 3D (add/animate/camera), video understanding, quality check, planning/review, ask-user, scripts, slides, motion graphics, avatar roles, smart reframe, background removal, filters, stickers, denoise | P0 | ✅ |
| FR-AI-03 | Provider resolution: preferred provider first, then fallback order OpenRouter → OpenCode Zen → NVIDIA NIM; null-safe when none configured | P0 | ✅ |
| FR-AI-04 | System prompt injects live project manifest + editing manual + already-asked questions memory | P1 | ✅ |
| FR-AI-05 | `plan_edit` produces validated EditPlan staged for approval; applied as ONE atomic undo group | P0 | ✅ |
| FR-AI-06 | Confirmation levels (always/expensive/destructive/none) gate execution without approval | P1 | ✅ |
| FR-AI-07 | Script generation with creator styles (MrBeast, Veritasium, Ali Abdaal, MKBHD, Vox, Hormozi, MagnatesMedia, TikTok viral) at 2.5 words/sec pacing, hook/CTA structure | P1 | ✅ |
| FR-AI-08 | Motion graphics generator: LLM emits deterministic `__INIT`/`__ANIMATE` JS executed in sandboxed renderer → generated animation asset | P2 | ✅ |
| FR-AI-09 | Video understanding: transcript/scenes/OCR-based Q&A about project content | P1 | ✅ |
| FR-AI-10 | Works with zero keys via free-tier models (documented defaults e.g. `nvidia/nemotron-3.5-lightning:free`) | P1 | ✅ |

### 7.7 One-Click Pipelines
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-PP-01 | Landing Workflows seed sessionStorage pipeline key consumed by editor → Director trigger prompt + checklist | P1 | ✅ |
| FR-PP-02 | Pipelines: Video→Reel (highlight pick + 9:16 + captions), PDF→Lesson (extract→script→slides→VO), Article→Video (Firecrawl fetch→script→b-roll), Avatar Sales Video (role script→avatar→CTA) | P1 | 🟡 functional via Director tool chains, not yet single-click autonomous |

### 7.8 Captions, Transcription & Analysis
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-CA-01 | Local transcription via Transformers.js Whisper (tiny/base/small/medium/large-v3, quantized, word timestamps, transcribe/translate), worker-isolated; model choice in settings; first-run downloads model | P0 | ✅ |
| FR-CA-02 | Captions editor: word-level timing display, text correction, styling presets, burn-in during export | P0 | ✅ |
| FR-CA-03 | Scene detection via color-signature shot boundaries (no ML), cached per asset in IndexedDB | P1 | ✅ |
| FR-CA-04 | OCR of on-screen text (tesseract.js, eng) feeding AI context | P2 | ✅ |
| FR-CA-05 | Asset analysis cache invalidated only on asset replace; surfaced to Director prompts | P1 | ✅ |

### 7.9 Audio Tools
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-AU-01 | RNNoise WASM speech denoise (48 kHz) per audio clip with before/after preview | P1 | ✅ |
| FR-AU-02 | Music search: MusicBrainz (keyless) / Deezer / Freesound; import result as asset | P1 | ✅ |
| FR-AU-03 | Auto-ducking engine primitives (`collectTriggerRanges`, `buildDuckSegments`) for music-under-voice mixing | P2 | 🟡 engine done; not yet exposed as one-click action |
| FR-AU-04 | TTS voiceover: ElevenLabs (voice/model/stability/similarity/style/speed sliders) or NVIDIA NIM OpenAI-compatible TTS; procedural fallback without keys | P1 | ✅ |

### 7.10 Vision / Neural Effects
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-VI-01 | Background removal via MODNet ONNX (`onnxruntime-web`, wasm/webgl/webgpu EPs): transparent/blur/color/image replacement | P2 | 🟡 requires `/models/modnet.onnx` present (not bundled) |
| FR-VI-02 | Face-tracked smart reframe to target aspect (e.g. 9:16) with smoothing | P2 | 🟡 tracking partial; Director tool currently centers-crop fallback |
| FR-VI-03 | Wav2Lip ONNX lip-sync (96×96 @25fps) driving avatar mouth | P2 | 🟡 requires `/models/wav2lip.onnx` (not bundled); procedural fallback ships |
| FR-VI-04 | Talking-avatar generator: role scripts (intro/outro/presenter/narrator), styles (realistic/cartoon/robotic/circle), on-device render (512×512 @25fps, configurable mouth anchor) | P2 | ✅ (with FR-VI-03 caveat) |

### 7.11 Slides & Documents
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-SL-01 | Slide deck generation: 6 themes, fonts, animations (fade/slide_up/zoom_pop/glass_glow/kinetic), layouts → rendered to image assets on T1 | P1 | ✅ |
| FR-SL-02 | Marp markdown deck mode: markdown → HTML → PNG slides | P2 | ✅ |
| FR-SL-03 | PDF import for Lesson pipeline content extraction | P1 | 🟡 |

### 7.12 Stock & Research Integrations
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-ST-01 | Stock images Unsplash/Pexels/Pixabay (BYO keys, priority order, orientation, safe-search) | P1 | ✅ |
| FR-ST-02 | Giphy sticker search (rating/limit); GIF→WebM conversion preserving playback via WebCodecs | P2 | ✅ |
| FR-ST-03 | 3D models: Poly Haven (keyless) + Sketchfab (token) GLB import → three.js scene | P2 | ✅ |
| FR-ST-04 | Web research via Firecrawl: article extraction, fact-check tool for Director claims | P2 | ✅ |

### 7.13 Export
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-EX-01 | **MP4 export (primary)**: H.264/AVC via WebCodecs + AAC, muxed with mediabunny; resolutions Match/720p/1080p/1440p/4K; FPS 24/25/30/48/60; bitrate presets 2/5/10/35 Mbps; progress + abort | P0 | ✅ |
| FR-EX-02 | WebM export (VP8/VP9/AV1 + Opus) via custom muxer | P1 | ❌ **broken**: zero-filled buffers — `chunk.copyTo(bytes)` fix required in 5 engine files |
| FR-EX-03 | PNG frames ZIP export | P2 | ✅ |
| FR-EX-04 | MediaRecorder queue path (ExportModal) with job queue store, 1080p/720p/360p, High/Medium/Low bitrates | P1 | 🟡 real-time pacing (render slower than realtime) |
| FR-EX-05 | Export composite includes captions burn-in, 3D frames, transforms/filters | P0 | ✅ |
| FR-EX-06 | High-res memory warning (>1080p) before start | P2 | ✅ |

### 7.14 Settings & Provider Configuration
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-SE-01 | Settings page sections: Connections overview, AI & Reasoning, Voice, Stock Images, Stickers, 3D Models, Web Research, Music, Preferences, Engine, Shortcuts | P0 | ✅ |
| FR-SE-02 | Provider cards: NVIDIA NIM (catalog refresh, params, retirement-date warning), OpenCode Zen (reasoning level), OpenRouter (free-models refresh) | P0 | ✅ |
| FR-SE-03 | API keys stored locally, AES-256-GCM encrypted; never transmitted except to the configured provider via proxy | P0 | ✅ |
| FR-SE-04 | Engine card: capability diagnostics + worker health check/restart | P1 | ✅ |
| FR-SE-05 | Preferences: language (en/hi/es/fr), default aspect/fps/quality, preferred AI/voice/stock providers, confirmation level, autosave toggles | P1 | ✅ |

### 7.15 Onboarding & Help
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-OB-01 | First-run 5-step guided tour (cutout highlight + anchored cards); "don't show again" persisted | P1 | ✅ |
| FR-OB-02 | Procedural Welcome Project (SMPTE bars ×3 with dissolves, 15s ambient WAV, title + caption samples + transcript) so timeline demos instantly with zero bundled media | P1 | ✅ |
| FR-OB-03 | Keyboard cheat sheet modal (`?`), ShortcutHelp button on toolbar, keystroke overlay feedback | P1 | ✅ |
| FR-OB-04 | Media Bin empty state communicating local-only privacy | P2 | ✅ |

### 7.16 Accessibility & Input
| ID | Requirement | Pri | Status |
|---|---|---|---|
| FR-AX-01 | Global shortcut registry (command pattern) doubling as documentation source-of-truth; ~40 commands in 6 categories (Playback/Editing/Navigation/Tools/View) | P1 | ✅ |
| FR-AX-02 | Typing-guard: shortcuts suppressed in inputs/textareas/contenteditable | P0 | ✅ |
| FR-AX-03 | ARIA labels on all icon-only buttons; aria-expanded on disclosure controls; clip role="button" with descriptive label (name/type/duration/start) | P1 | ✅ |
| FR-AX-04 | Visible focus rings (#60a5fa outline) globally | P1 | ✅ |
| FR-AX-05 | Auto-repeat for held navigation keys (step/nudge/trim/shuttle/zoom) | P2 | ✅ |

---

## 8. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | **Privacy** | Media never leaves device; zero telemetry; no accounts; keys AES-256-GCM at rest; only outbound traffic is user-configured provider APIs (via CORS proxy) |
| NFR-02 | **Offline** | After first load + model caches, editing/export work offline; AI chat/TTS/stock degrade gracefully |
| NFR-03 | **Performance** | Timeline interactions <16 ms frame budget; heavy jobs (transcribe, denoise, encode, analysis) in Workers; proxy generation on import; lazy route chunks |
| NFR-04 | **Capability scaling** | Detect WebGPU/WebCodecs/OPFS/EditContext; WebGL fallback compositor; quality presets adapt to device |
| NFR-05 | **Reliability** | Undo/redo total coverage; atomic multi-op application; debounced autosave; error boundary isolation |
| NFR-06 | **Quality gates** | `vitest run` (187 tests green), `oxlint` (0 errors), `tsc -b && vite build` clean — enforced pre-push |
| NFR-07 | **Security** | No hard-coded secrets; path-traversal-safe OPFS writes; sandboxed eval for motion-JS; CSP-friendly static deploy |
| NFR-08 | **Compatibility targets** | Chrome/Edge current (primary), Firefox/Safari best-effort behind capability gate |
| NFR-09 | **Deployability** | Static SPA on Vercel; single serverless function (`api/proxy.ts`) for CORS bypass; dev middleware equivalent |

---

## 9. Architecture Summary (context for requirements)

```
┌────────────── Browser ───────────────────────────────────────────┐
│  React 19 + TanStack Router + Zustand/zundo                      │
│  ├─ pages: Landing · Editor (BrowserGate→AppShell) · Settings    │
│  ├─ stores: timeline · editor · ai · apiConfig · exportQueue     │
│  ├─ ui/: timeline (Canvas-less DOM clips) · inspector · panels   │
│  └─ engine/                                                      │
│      ├─ composite: WebGPU/WebGL renderer + three.js (3D/GLB)     │
│      ├─ export: WebCodecs encoders · mediabunny mux · ZIP frames │
│      ├─ captions: whisper-engine (Transformers.js WASM)          │
│      ├─ analysis: scenes · ocr(tesseract.js)                     │
│      ├─ denoise: RNNoise WASM · lipsync: Wav2Lip ONNX            │
│      └─ background-removal: MODNet ONNX                          │
│  Storage: OPFS (media) + IndexedDB (project/assets/cache/keys*)  │
└──────────────┬───────────────────────────────────────────────────┘
               │ fetch (LLM/TTS/stock/research, BYO keys)
        ┌──────▼──────┐
        │ CORS proxy  │  dev: vite middleware · prod: Vercel function
        └──────┬──────┘  (proxy-only: no auth, no DB, no persistence)
        ┌──────▼─────────────────────────┐
        │ OpenRouter · OpenCode Zen ·    │
        │ NVIDIA NIM · ElevenLabs ·      │
        │ Unsplash/Pexels/Pixabay ·      │
        │ Giphy · Sketchfab/PolyHaven ·  │
        │ MusicBrainz/Deezer/Freesound · │
        │ Firecrawl                      │
        └────────────────────────────────┘
```
*keys stored client-side encrypted; proxy forwards Authorization headers untouched and stores nothing.*

---

## 10. Current Implementation Status Roll-up

Derived from `ARCHITECTURE_AND_CODEBASE_AUDIT.md` (Aug 2026):

| State | Count | Items |
|---|---|---|
| ✅ Working | 13 | Timeline editing suite, unified Inspector, Whisper captions, RNNoise denoise, scene detection, quality checker, OCR, MP4 export, MediaRecorder queue, music search, PolyHaven 3D, capability detection, keyboard shortcuts |
| 🟡 Partial | 5 | MediaRecorder pacing, Whisper/OCR first-run download latency, keyframe storage-without-interpolation, mislabeled Reverse toolbar button, pause chip cosmetics |
| ❌ Broken | 6 | **All custom-WebM outputs** (root cause below) |
| Mock-only | 1 | Smart Reframe Director tool falls back to center-crop |

**P0 defect (only true blocker):** WebM encoder writes zeros — `new Uint8Array(chunk.byteLength)` instead of copying chunk data. Fix: `const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes)` in:
`src/engine/export/exportVideo.ts` · `src/engine/avatar/lipsync.ts` · `src/engine/lipsync/*sandbox*` · `src/engine/three/renderGlbToVideo.ts` · `src/engine/stickers/gifToVideo.ts`

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Time-to-first-edit (land→welcome-project interaction) | < 60 s |
| Manual cut: import→export single MP4 | < 5 min incl. encode |
| Director task success (staged plan executes as stated) | ≥ 90% on golden prompt set |
| Crash isolation (editor errors caught by boundary) | 100% |
| Local test suite | green on every push; coverage trending up |
| Privacy invariant (media bytes outbound) | 0 incidents, verifiable via network panel |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| NVIDIA NIM hosted endpoint retirement (Aug 26, 2026) | Loses one LLM/TTS backend | Warning surfaced in card; fallback order continues with OpenRouter/Zen |
| Browser codec variance (H.264 HW support, AV1 encode) | Export failures on some machines | Capability probe + mediabunny codec negotiation + MediaRecorder fallback path |
| Large-file memory pressure (2 GB videos) | Tab crashes | Proxy generation, OPFS streaming, high-res export warning, abortable pipelines |
| ONNX model availability (wav2lip/modnet not bundled) | Features dead until files present | Procedural fallbacks ship; settings surface clear "model missing" states |
| Free-model rate limits/quality drift | Director reliability varies | Multi-provider fallback chain, plan-preview-before-apply keeps user in control |
| Safari/Firefox gaps (WebGPU, WebCodecs) | Reduced audience | BrowserGate messaging; WebGL fallbacks; roadmap tracking |

---

## 13. Roadmap (indicative)

1. **Stabilize** — Fix WebM `copyTo` bug ×5; implement keyframe interpolation in compositor; correct Reverse-button labeling.
2. **Complete partials** — Smart Reframe real face-tracking; auto-ducking one-click action; PDF pipeline polish; MediaRecorder faster-than-realtime investigation.
3. **Delight** — Live duration tooltip while dragging trims; marquee selection; transition gallery expansion; theme-token sweep (dark/light).
4. **Scale** — i18n completion beyond 4 languages; PWA install/offline packaging; optional E2E suite for Director golden paths.

---

## 14. Open Questions

1. Should WebM export be repaired (small fix) or deprecated in favor of MP4-only messaging?
2. Bundle strategy for ONNX models: optional in-app downloader vs. documented manual placement vs. CDN fetch?
3. Minimum mobile ambition: read-only preview vs. full touch editing?
4. Do pipelines warrant dedicated wizard UIs, or remain Director-driven conversations?

---

*This PRD documents the product as implemented; requirement statuses are evidence-based from the Aug 2026 audit and test suite.*
