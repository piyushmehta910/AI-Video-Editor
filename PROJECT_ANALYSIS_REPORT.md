# ClipForge â€” Complete Project Analysis Report

| | |
|---|---|
| **Product** | ClipForge (repo `ai-video-editor`) â€” browser-native AI video editor |
| **Report date** | Aug 2026 |
| **Scope** | Technical deep-dive Â· UI/UX design audit Â· issues & tech-debt scan |
| **Evidence basis** | Direct code inspection (file:line refs throughout) Â· 187 passing tests Â· clean build/lint gates |
| **Related docs** | `PRD.md` Â· `ARCHITECTURE.md` Â· `ARCHITECTURE_AND_CODEBASE_AUDIT.md` |

---

## 1. Project Snapshot

| Metric | Value |
|---|---|
| Source files (TS/TSX) | **277** |
| Lines of code | **~53,700** (2.19 MB source) |
| Test files | 34 (187 tests, all green) |
| Runtime dependencies | 22 (React 19, Zustand 5, mediabunny, three.js, onnxruntime-web, tesseract.js, @xenova/transformersâ€¦) |
| Dev stack | Vite 8 + Tailwind v4 + oxlint + vitest |
| Deploy | Vercel static SPA + 1 serverless CORS proxy function |
| Backend surface | None beyond proxy â€” no auth, no DB, no storage |

**What it is:** a full NLE-style video editor plus conversational AI Director that runs entirely client-side. Media never leaves the machine; heavy lifting uses browser APIs (WebGPU/WebGL compositing, WebCodecs encoding, OPFS storage, WASM/WASM+ONNX ML).

---

## 2. How It Works â€” End-to-End Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Browser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ React 19 Â· TanStack Router Â· Zustand+zundo (undo) Â· Tailwind v4   â”‚
â”‚                                                                   â”‚
â”‚ pages/      Landing (/) Â· Editor (/editor) Â· Settings (/settings) â”‚
â”‚             BrowserGate â†’ WebGPULoadingScreen â†’ EditorLayout      â”‚
â”‚                                                                   â”‚
â”‚ ui/         timeline (DOM clips) Â· ai/AIDirector (floating)       â”‚
â”‚             export/ExportDialog Â· common/RightToolPanel (17 tools)â”‚
â”‚ components/ media bin Â· inspector sections Â· settings cards Â·     â”‚
â”‚             shortcuts modal Â· onboarding tour                     â”‚
â”‚                                                                   â”‚
â”‚ engine/     composite (WebGPUâ†’WebGL fallback) Â· export (WebCodecs â”‚
â”‚             +mediabunny MP4 / custom WebM muxer) Â· captions       â”‚
â”‚             (Whisper WASM) Â· analysis (scenes+OCR) Â· denoise      â”‚
â”‚             (RNNoise WASM) Â· lipsync (Wav2Lip ONNX) Â· bgremoval   â”‚
â”‚             (MODNet ONNX) Â· motion sandbox (CSP iframe) Â· three/  â”‚
â”‚                                                                   â”‚
â”‚ workers/    whisper Â· image processing Â· engine workers           â”‚
â”‚ stores/     timeline Â· editor Â· ai Â· apiConfig Â· exportQueue      â”‚
â”‚ Storage:    OPFS (media blobs) + IndexedDB (project/assets/cache) â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚ BYO-key fetches (LLM/TTS/stock/research)
        â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”   allowlist-guarded, stateless
        â”‚  CORS proxy    â”‚   dev: vite middleware Â· prod: api/proxy.ts
        â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
   OpenRouter Â· OpenCode Zen Â· NVIDIA NIM Â· ElevenLabs Â· Unsplash/
   MusicBrainz/Deezer Â· Firecrawl
```

### 2.1 Boot flow
1. Router loads; `/editor` wrapped in `EditorErrorBoundary` â†’ `BrowserGate` probes WebGPU/WebCodecs/OPFS **before** downloading the editor chunk (unsupported browsers never pay the cost).
2. `WebGPULoadingScreen` covers engine boot; store hydration overlay ("Loading projectâ€¦") gates first paint.
3. First run: `WelcomeProject.ts` procedurally builds a sample project (canvas-rendered SMPTE bars Ã—3 w/ dissolves, OfflineAudioContext ambient WAV, title/captions/transcript) â€” zero bundled media.
4. Desktop-only: 5-step `OnboardingTour` opens after 600 ms unless dismissed (`clipforge-tour-dismissed`).

### 2.2 Media import pipeline
- Entry points: drag-drop, picker, clipboard paste, screen/webcam recorder (MediaRecorder), mic voiceover recorder, stock/GIF/model online search.
- Validation: extension + MIME allowlist; caps video â‰¤2 GB, audio/model â‰¤500 MB, image â‰¤100 MB (`mediaType.ts`).
- Persist: bytes â†’ OPFS namespace `clipforge-media` (path-traversal-safe), metadata row â†’ IndexedDB.
- Derivatives generated async with granular progress: thumbnail, filmstrip frames (video), waveform peaks (audio), proxies for scrubbing.
- Asset records carry type, duration, dimensions, transcript/scenes/OCR caches (filled lazily by analysis pipeline, invalidated only on asset replace).

### 2.3 Timeline data model & editing ops
- `timelineStore`: project â†’ tracks[] â†’ clips[]; clip = `{id, assetId, trackId, startTime, duration, sourceStart/sourceEnd, speed, transform {position/scale/rotation/opacity}, volume/fades, effects[], transitions{}, keyframes}`.
- Zoom model = px-per-second (default 90); header gutter 78 px.
- Ops: moveClip (auto-groups history), trimClip(id,'start'|'end',delta) clamped to source bounds, splitClip Â±0.05 s guards, ripple delete, copy/paste/duplicate, rate-stretch, markers, snapping (edges+playhead, zoom-aware threshold).
- Every mutation flows through zundo temporal history â†’ undo/redo total coverage; autosave debounced to IndexedDB + Ctrl+S.
- AI plans apply through the same store API inside ONE history group â†’ atomic apply/single undo step.

### 2.4 Playback & compositing
- `usePlayback`: pooled `<video>/<audio>` elements keyed by clip; rAF loop advances playhead; per-frame seek of active videos; speed âˆ’8â€¦+8 shuttle.
- `engine/render/composite.ts`: draws each visible layer per frame â€” video frame blit, images, text chips, GIF sticker frames, three.js GLB render target, caption burn-in â€” honoring transforms, opacity, crop, fades, filters, transitions, and **keyframe interpolation** (opacity/position/scale/rotation/crop interpolated per frame).
- Renderer picks WebGPU (WGSL) with WebGL fallback; preview canvas sits on an always-dark radial stage.

### 2.5 Audio graph
Per-clip volume + fade-in/out envelopes, track mute/solo semantics (solo silences non-soloed tracks), master volume/mute. Waveforms precomputed; RNNoise WASM denoise (48 kHz) per clip; auto-ducking primitives exist (`collectTriggerRanges`, `buildDuckSegments`, tested) though not yet exposed as a one-click action.

### 2.6 AI Director & LLM layer
- Floating draggable/resizable glass window (`ui/ai/AIDirector.tsx`, 1787 lines): chat bubbles, plan approval card, proposals tray (per-item Apply/Discard), quality issues tray, ask-user interrupt card.
- Tool-calling over any OpenAI-compatible endpoint: ~50 tools spanning clip ops, project config, text overlays, stock/music/web search, captions, voiceover, 3D add/animate/camera, video understanding, quality check, scripts (creator styles), slides/marp, motion graphics, avatar roles, smart reframe, bg removal, filters, stickers, denoise.
- Provider chain: preferred first, else OpenRouter â†’ OpenCode Zen â†’ NVIDIA NIM; graceful null when none configured.
- Context builder feeds live project manifest + transcripts + scenes + OCR + health report; system prompt includes an editing manual and already-asked-question memory.
- Confirmation levels gate execution: always / expensive / destructive / none.

### 2.7 On-device ML
| Capability | Engine | Model/runtime | Status |
|---|---|---|---|
| Transcription | worker + Transformers.js | Whisper tinyâ†’large-v3 quantized, word timestamps | Working (first-run model download) |
| Translate task | same | Whisper translate | Working |
| Scene detection | color-signature diff | none (algorithmic) | Working, cached |
| OCR | tesseract.js | eng traineddata | Working |
| Denoise | @shiguredo/rnnoise-wasm | built-in RNNoise | Working |
| Lip-sync | onnxruntime-web | `/models/wav2lip.onnx` | **Dead â€” model file missing** (procedural fallback ships) |
| Background removal | onnxruntime-web | `/models/modnet.onnx` | **Dead â€” model file missing** |

### 2.8 Export pipeline
Two paths:
1. **ExportDialog (primary)** â€” offline encode: composite frame-by-frame â†’ WebCodecs VideoEncoder (H.264) + Opus AudioEncoder â†’ **mediabunny MP4 muxer** (working) or hand-rolled WebM muxer. Profiles: YouTube/TikTok Reel/VP9-60/4K Master quick chips; resolutions to 4K; fps 24â€“60; bitrate presets 2/5/10/35 Mbps; progress + AbortController cancel.
2. **MediaRecorder queue (legacy)** â€” realtime canvas capture, PNG-frames ZIP option, job queue store. Pacing tied to rAF â†’ stalls when tab hidden.

### 2.9 Persistence & keys
- Project/assets/thumbnails/caches: IndexedDB. Media bytes: OPFS.
- Settings incl. provider keys: localStorage under `clipforge-api-config`; AES-256-GCM encrypted via `api/config/crypto.ts` (see Security caveat Â§5-H5).

### 2.10 Network layer
Single proxy surface (vite middleware dev / Vercel fn prod): domain **allowlist**, forwards Authorization untouched, stores nothing. All LLM/TTS/stock/research traffic rides this.


---

## 3. UI/UX â€” How Everything Is Designed

### 3.1 Design foundations
- **Tailwind v4 CSS-config** (`src/index.css`, no tailwind.config file): shadcn-style tokens in **oklch** defined for light `:root` and `.dark` â€” background near-white vs near-black (0.12 L), card/popover, primary, muted, destructive red, border/input/ring.
- Radius scale: `--radius: 0.625rem` (10 px) with derived sm/md/lg/xl. Panels/cards consistently `rounded-xl`.
- Fonts: system stack only (Segoe UI/Roboto); monospace for all timecodes/dimensions; form inputs forced to 16 px to stop iOS zoom.
- Focus: global `:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2 }` + ring on clips (WCAG 2.4.7 noted in code).
- Reduced motion: full CSS kill-switch (`prefers-reduced-motion` â†’ 0.01 ms durations).
- Theme switching: zustand store persisted to localStorage; toggles `.dark` on `<html>`, updates `<meta theme-color>` (#0b0b10 / #ffffff).
- **Accent identity lives in hardcoded Tailwind classes**, not tokens: violetâ†’purpleâ†’indigo gradients for every primary CTA; track colors fixed in `engine/types.ts` â€” video `#3b82f6`, audio `#22c55e`, text `#eab308`, fx `#a855f7`.

**Foundation gaps:** `animate-in fade-in slide-in-from-* zoom-in-95` used ~15 places but no animate plugin installed â†’ those entrance animations silently do nothing. `no-scrollbar` class referenced (EditorPage:86) but never defined.

### 3.2 Layout anatomy
**Desktop editor** (`EditorLayout.tsx`):
```
â”Œ TopToolbar 44px Â· bg-background/80 backdrop-blur-xl â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ brand â”‚ panel toggles â”‚ editable project name â”‚ aspect/fps/res   â”‚
â”‚        history/save/settings/theme â”‚ gradient Export CTA           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ MediaBinâ”‚ PreviewCanvas (dark radial stage)   â”‚ Inspector 300px   â”‚
â”‚ 270px   â”œâ”€â”€â”€â”€ resizer h-2 (violet hover halo)â”€â”‚ (250â€“580, â‰¥lg)    â”‚
â”‚ (200â€“480â”‚ Timeline default 224px (80â€“800)     â”‚                   â”‚
â”‚  hidden â”‚                                     â”‚ [HistoryPanel     â”‚
â”‚  <md]   â”‚                                     â”‚  240px optional]  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
- Custom pointer-event resizers (no lib); widths persisted per panel (`clipforge-left-width`, `-right-width`, `-timeline-height`).
- Collapsed panels become 32 px rails with chevron reopen buttons; open/close state persisted.
- AI tools drawer overlays from right at 420â€“480 px with backdrop blur.
- Glassmorphism tier: transport capsule `bg-black/40 backdrop-blur-xl`; AIDirector window heavy blur + layered shadow; toolbar blur.

**Mobile (<768 px):** ProjectHeader â†’ capability banner â†’ segmented view switcher (Preview | Timeline + Media/Inspector/AI toggles) â†’ single fill area; panels open as bottom sheets (max-h 82svh, rounded-t-2xl, backdrop). View choice persisted.

### 3.3 Component inventory (two generations coexist)
| Layer | Contents |
|---|---|
| `components/ui` | shadcn primitives: Button(cva)/Badge(+success/warning)/Card/Radix SelectÂ·SliderÂ·SwitchÂ·TabsÂ·CheckboxÂ·CollapsibleÂ·LabelÂ·Tooltip(delay 0,inverted)/Input/Textarea/Skeleton. **Fake ScrollArea = plain div.** No Dialog/DropdownMenu/Toast primitives exist |
| `components/timeline` | Track (lane+drop logic+clip keyboard model), TrackHeader (78px, color bar, V1/A1/T1/FX1 mono label, inline rename, lock/mute/solo/hide), Clip (filmstrip/waveform/fade-envelope/text/icon renderers, trim handles w-2.5â†’3.5, selection glow, under-playhead red tint) |
| `components/inspector` | Section/Row/NumInput/LabeledSlider design atoms (14px uppercase tracking-widest headers, 11px labels), Transform/Appearance/Text/Audio/Effects/Transitions sections, KeyframeButton |
| `components/media` | MediaBin (4-tab pill group, search/grid-list/filter pills, drag overlay, import progress cards, recording bar w/ pulsing red dot, popout preview), MediaItem (grid/list, custom context menu, two-click delete confirm, PropertiesDialog), OnlineAssetSearch, DragPreview layer |
| `ui/common/RightToolPanel.tsx` | **6,186-line monolith hosting ~17 tool studios** (Design, TTS, stickers, stock, insightsâ€¦) â€” the app's biggest maintainability risk |
| `ui/ai/AIDirector.tsx` | The real floating director (1787 lines) |
| `components/settings` | ProviderCard pattern (Collapsible+Switch), ApiKeyInput masked, ApiTester, ConnectionOverview, 14 provider cards |
| legacy/unused | `components/ai/*`, `components/export/ExportModal` (superseded by ui/export/ExportDialog), empty `components/account/` |

### 3.4 Interaction patterns
- **Two DnD systems:** Binâ†’timeline uses native HTML5 DnD with module-level `dragState.ts` carrying the Asset (custom MIME `application/x-clipforge-asset`), off-screen custom ghost via setDragImage, type-compat dropEffect, cyan drop line + lane tint, snap-unless-Shift on drop. Timeline clip move/trim uses **pointer capture** with originals Map + one history group per gesture (>2 px threshold before save).
- Razor/rate tools act on pointer-down; ruler scrubbing also pointer-captured.
- Tooltips: Radix everywhere on toolbars/clips (inverted bubble + arrow); many secondary controls fall back to plain `title`.
- Modals: all hand-rolled portals (ExportDialog z-9999, ShortcutsModal proper role=dialog+aria-modal+Esc, PropertiesDialog, studio modals, AIDirector confirm). **No focus trapping/restoration anywhere.**
- Toasts: bespoke trio â€” HistoryToast undo/redo pill (2 s auto-dismiss), inline success/error banners, keystroke overlay hint.
- Loading/progress: skeletons on settings hydration, Loader2 spinners, bouncing-dot AI typing, violet import progress bars, gradient export progress with cancel.

### 3.5 Visual language
- Icons exclusively lucide-react ^1.31.0 (verified legitimate in lockfile), size-3â†’size-7.
- Buttons: cva variants exist but chrome mostly overrides inline; active toggle signature = `bg-violet-500/20 text-violet-400`; CTA = gradient + shadow-violet + `active:scale-95`.
- Typography extremely compressed: chrome 8â€“11 px, standard xs/sm, hero 4xlâ€“6xl extrabold, `font-mono text-[9px]` readouts, uppercase tracking-widest micro-labels.
- Empty states follow one recipe: tinted icon tile â†’ bold xs heading â†’ muted [11px] description â†’ optional CTA (used in bin tabs, timeline drop zone, preview, inspector).
- Working micro-interactions: clip hover brightness, play-button scale, resizer halos, pulsing record dot, emerald ping badges.

### 3.6 Key screens
- **Landing:** scroll-reactive nav (blur after 8 px), hero with ambient blobs + gradient headline + pure-CSS editor mockup (traffic lights, fake task rail, gradient lanes), 9 feature cards, Modes triptych (AI featured), 4 workflow pipeline cards that seed `sessionStorage['clipforge-pipeline']` deep-links into the editor prompt, tech grid, integrations, security section, final CTA/footer.
- **Editor:** hierarchy pushes everything except the black preview stage into translucency and 8â€“11 px type; dense 24â€“32 px timeline toolbars (Cut/Split/Duplicate/Delete/Add Text/Audio/3D/Slides/Avatar/Denoise/Insightsâ€¦).
- **Settings:** max-w-4xl single column, "Local Storage" badge, Connections overview grid then grouped sections (AI & Reasoning, Voice, Stock, Stickers, 3D, Research, Music, Preferences, Engine diagnostics, static Shortcuts reference table).
- **ExportDialog staged UX:** quick profile chips â†’ filename with live suffix â†’ resolution/fps/format-quality grids (formatâ†”codec interlock) â†’ summary card with estimated MB â†’ contextual 4K GPU warning â†’ running/done/error states.
- **AIDirector window:** draggable FAB (56 px glass gradient square, position persisted, click-vs-drag discrimination), 8-direction resize handles with presets (Compactâ†’Full Expand), header status pill (Thinkingâ€¦/Active), Auto/Review mode toggle, chat bubbles with avatar circles, numbered plan approval card, proposals tray with status-colored borders, amber quality-issues tray with Fix-all, ask-user interrupt card, 5 quick actions empty state.

### 3.7 Accessibility status
**Strengths:** global visible focus ring; reduced-motion kill-switch; clips are focusable buttons with rich labels ("name, Video clip, N seconds, starting at M seconds") + aria-pressed + full roving keyboard model (Tab/arrows/Enter/Delete incl. ripple variant); PlayheadAnnouncer throttled aria-live; aria-expanded disclosures; aria-pressed track toggles; sr-only live regions on AI busy states.

**Gaps:** zero focus traps/restoration in modals; ExportDialog/PropertiesDialog lack dialog semantics; backdrop-click targets sometimes not keyboard reachable; contrast risks (`text-neutral-500` metadata on light theme, white/40â€“70 on dark surfaces); 24 px hover-reveal touch targets below guidance and invisible until hover; mouse-only context menus; mixed native select vs Radix Select; JS-driven smooth-scroll ignores reduced motion.

### 3.8 Onboarding UX mechanics
- Cutout tour: positioned div inflated 8 px around target rect, `box-shadow: 0 0 0 9999px rgba(5,5,10,.72)` veil + 2 px violet border, transition-eased repositioning, resize/scroll re-measure, lazy retry loop (150 ms Ã— up to 4 s), anchored step card w/ flip + clamp, dot progress, don't-show-again checkbox.
- Welcome project keys: `clipforge-welcome-attempted/-created`; SMPTE bars exact palette (#ffffff #e6e600 #00dcd8 #00c800 #d500d5 #d50000 #0000d5).


---

## 4. Issues & Technical Debt (evidence-based, prioritized)

> Note: a fresh line-level scan **corrects three items** from the earlier audit doc â€” see Â§4.5.

### 4.1 CRITICAL
| # | Issue | Evidence |
|---|---|---|
| C1 | **Motion-code "sandbox" is not sandboxed in live preview.** `new Function('window', motionCode)` runs AI-generated/user JS with full page privileges; the `fakeWindow` arg only shadows the name. The real CSP-iframe sandbox (`engine/motion/sandbox.ts`, nonce + opaque-origin checks) exists but is used only for final render. No CSP meta in index.html to compensate. Comment at RightToolPanel.tsx:4753 falsely claims safety. | RightToolPanel.tsx:4754, 4804 |
| C2 | **ONNX features dead on arrival:** `public/models/` doesn't exist â†’ `/models/wav2lip.onnx` and `/models/modnet.onnx` 404; `Wav2LipEngine.initialize()` throws on fetch fail. Lip-sync & background removal unusable until models ship or features gate on capability check. | wav2lip-engine.ts:33,60 Â· bgremoval-engine.ts:28 Â· LipSyncEditor.tsx:190,606 |
| C3 | **Frame-extraction memory explosion:** `extractVideoFrames` stores every frame as full ImageData @25 fps â€” 1080p â‰ˆ 8.3 MB/frame â‡’ 10 s clip â‰ˆ 2 GB, 30 s â‰ˆ 6 GB â†’ guaranteed tab crash. No downscale/stream/cap. | useLipSync.ts:150-173 |

### 4.2 HIGH
| # | Issue | Evidence |
|---|---|---|
| H1 | **usePlayback systemic leaks:** pool-host div appended to document.body never removed; pooled media elements never detached; 5 listeners per video never removed; objectURL cache grows unbounded (0 revokes); fire-and-forget `.then()` without `.catch()` â†’ OPFS read failure = unhandled rejection and `loadImage` promise that never settles. | usePlayback.ts:43-51,93-119,133-137,138-177 |
| H2 | **AudioContext leaks** (browser caps ~6 concurrent): created but never closed in useDenoise (Ã—2), useLipSync, useCaptions.transcribeFromFile â€” repeated runs exhaust contexts. Sibling function closes correctly, proving intent. | useDenoise.ts:130,144 Â· useLipSync.ts:177 Â· useCaptions.ts:108 |
| H3 | **Export abort path skips cleanup:** abort throws mid-loop without try/finally â†’ encoder.close() and element teardown skipped; image blob URLs created per export never revoked (`img.src=''` â‰  revoke). | exportVideo.ts:197,210,259-262 |
| H4 | **Smart Reframe is a stub:** `detectPrimaryFace()` returns a fixed center box regardless of pixels ("In productionâ€¦ MediaPipe"); followStrength/marginPx computed then discarded. Every reframe = center-crop. | reframing.ts:39-51,95,171 |
| H5 | **Key encryption is security theater:** AES-GCM master password stored plaintext in localStorage beside the ciphertext it decrypts â€” equivalent to obfuscation against local access; only mitigates casual snooping of config file alone. | api/config/crypto.ts:91-103 |

### 4.3 MEDIUM
| # | Issue | Evidence |
|---|---|---|
| M1 | Timeline re-renders every rAF during playback: whole-component playhead subscription while children unmemoized; redundant since DOM-direct playhead move already exists. | Timeline.tsx:137 vs 219-226; Clip.tsx not memo'd |
| M2 | Object-URL hygiene: 38 create sites vs ~24 revokes (CaptionsEditor preview, exportQueue resultUrl on dismiss/clearFinished, useCanvasRecorder images). | multiple |
| M3 | Export stalls when tab hidden â€” realtime path paced by rAF, throttled/paused by browser; no watchdog. | useCanvasRecorder.ts:254 |
| M4 | Orphan components shipped: legacy AIDirectorPanel (231 L) + ExportModal (181 L) imported nowhere. | components/ai, components/export |
| M5 | Test gaps: zero tests for composite renderer, entire export pipeline (exportVideo/exportMp4/webm-muxer/useCanvasRecorder), storage layer (opfs/db/thumbnails), playback hook, shortcuts dispatch, reframing, editorStore/historyStore. | see Â§6 map |
| M6 | Monolith: RightToolPanel.tsx 6,186 lines / ~17 sections â€” merge-conflict + regression hotspot; also hosts C1. | ui/common/RightToolPanel.tsx |
| M7 | Timer/listener stragglers: tour retry interval not cleared on unmount; viseme-test setInterval no cleanup. | OnboardingTour.tsx:57 Â· RightToolPanel.tsx:1347 |

### 4.4 LOW / hygiene census
- TODO/FIXME/HACK: **0** Â· ts-ignore: **0** Â· eslint-disable: 10 (mostly exhaustive-deps) Â· console.*: 28 (5 leftover logs in engine files) Â· `any`: 20 uses (worst cluster RightToolPanel Pexels/Pixabay parsing).
- One true empty catch (api/config/store.ts:108); ~70 commented swallow-catches mostly benign storage probes.
- Open proxy is allowlist-guarded but unauthenticated â†’ Vercel quota abuse vector (low).
- No CSP meta (defense-in-depth absent alongside C1). dangerouslySetInnerHTML Ã—3 feed static built-in SVG presets only (acceptable).
- postMessage handling otherwise sound; workers use requestId correlation.
- lucide-react ^1.31.0 verified legitimate via lockfile integrity hash (not phantom).

### 4.5 Corrections to previous audit (verified this pass)
| Earlier claim | Verified reality |
|---|---|
| "WebM exports broken â€” zero-filled buffers" | **FIXED**: all 8 `new Uint8Array(chunk.byteLength)` sites now followed by `chunk.copyTo(bytes)` (exportVideo.ts:81,159 Â· avatar/lipsync.ts:281,378 Â· motion/sandbox.ts:275 Â· gifToVideo.ts:214 Â· renderGlbToVideo.ts:51 Â· LipSyncEditor.tsx:274) |
| "Keyframes stored but not interpolated" | **IMPLEMENTED**: composite.ts:307-312,479-484 interpolate opacity/position/scale/rotation; crop keyframes at 72-90,375. Stale comments claiming otherwise need deletion (types.ts:323, keyframes.ts:5) |
| "Mislabeled Reverse toolbar button" | **NOT PRESENT**: current timeline toolbar has no Reverse button; engine supports negative speed but no UI exposes it |

### 4.6 Design-system debt
- Dead animation classes (~15 sites) + undefined `no-scrollbar` (see Â§3.1).
- Accent identity hardcoded in utilities instead of tokens â†’ theme-wide accent changes require mass find/replace.
- Two component generations + empty dirs add bundle weight and confusion (M4).

---

## 5. Security Assessment

| Area | Finding | Rating |
|---|---|---|
| Motion preview eval | Full-privilege `new Function` (C1) | **Critical** |
| API keys at rest | AES-GCM but key alongside ciphertext (H5); masked inputs UI-side | Weak-but-better-than-nothing |
| Media privacy | Never uploaded; OPFS+IndexedDB local; proxy stateless allowlist | Strong |
| XSS surface | dangerouslySetInnerHTML only w/ static presets; markdown render paths reviewed OK | OK |
| postMessage | origin-checked ('null' opaque) in sandbox; requestId correlation in workers | OK |
| Transport | All third-party calls over HTTPS via proxy; keys forwarded only to configured provider | OK |
| Missing hardening | No CSP meta; open proxy quota abuse; no SRI for CDN assets (none used) | Low |

---

## 6. Test Coverage Map

34 test files / 187 tests green. **Covered well:** timelineStore ops, keyframes math (11), captions/transcript, scenes, audioMix ducking primitives, exportZip, exportFormats, worker protocol, aiStore, quality checker, director provider selection, scripts/slides/plan/context LLM logic, gifToVideo, capabilities, WebGPU status, rules-of-hooks, askedQuestions.

**Zero coverage (priority order):**
1. `engine/render/composite.ts` â€” the heart of the app
2. Export pipeline end-to-end (`exportVideo.ts`, `exportMp4.ts`, `webm-muxer.ts`, `useCanvasRecorder.ts`)
3. Storage (`opfs.ts`, `db.ts`, `thumbnails.ts`)
4. `usePlayback` lifecycle (leak class H1 would've been caught)
5. Shortcut registryâ†’dispatch wiring, `useMediaImport`, reframing, editorStore/historyStore

---

## 7. Dependency Review

22 runtime deps, all single-purpose; notable pairings: mediabunny (MP4 mux) + hand-rolled webm-muxer (different containers, justified); gifuct-js as ImageDecoder fallback; three ecosystem (@gltf-transform) for GLB pipeline. Dev tooling modern (Vite 8, TS 6, oxlint, vitest 4, Tailwind v4). No duplicates found; no deprecated cores. Risk watch: NVIDIA NIM hosted endpoint retirement Aug 26 2026 (warning already surfaced in its settings card).

---

## 8. Prioritized Fix Roadmap

| Phase | Items | Why first |
|---|---|---|
| **P0 â€” security & crashes** | C1 route motion preview through existing iframe sandbox (or delete Function path) + add CSP meta; C2 ship-or-gate ONNX models behind capability check; C3 downscale/stream frame extraction (cap ~200 MB) | Exploitability + guaranteed crashers |
| **P1 â€” leak lifecycle** | H1 disposal for playback pool/host/listeners/objectURLs; H2 close AudioContexts (mirror transcribeFromVideo pattern); H3 try/finally around export loop + revoke URLs | Reliability under real usage |
| **P2 â€” honesty & perf** | H4 implement face tracking or de-scope/reframe messaging; H5 move master key to non-extractable WebCrypto/Credentialless or drop encryption claim; M1 memoize clips + decouple playhead selector; M3 watchdog/background-tab strategy | Trust + smoothness |
| **P3 â€” hygiene** | Delete orphan components; split RightToolPanel into modules; define missing CSS utilities/install animate lib; update stale keyframe comments; console.log cleanup; focus traps + dialog semantics sweep; test coverage for Â§6 list | Maintainability |

---

## 9. Overall Scorecard

| Dimension | Grade | Rationale |
|---|---|---|
| Architecture & separation | **Aâˆ’** | Clean engine/ui/stores layering; two DnD systems and two component generations are the warts |
| Feature breadth | **A** | NLE editing + AI Director + on-device ML + pipelines in one local app is rare |
| Correctness (current behavior) | **B+** | Core loops solid, 187 green tests; C2/C3 dead/crashy features drag it down |
| Performance | **B** | Workerized heavy jobs, proxies, GPU compositing; M1 re-render storm + memory classes hold it back |
| Security | **C+** | Excellent privacy posture undermined by C1 eval and H5 theater |
| UI/UX design coherence | **B+** | Distinctive glass/violet identity, consistent recipes; token drift + missing animations + a11y gaps |
| Accessibility | **Bâˆ’** | Rare-for-canvas-apps keyboard model & announcer; modal focus management absent |
| Test coverage | **Bâˆ’** | Good unit breadth on logic; blindspot on renderer/export/storage/playback |
| Maintainability | **B** | Zero TODO debt & clean lint; monolith file + orphans counter it |
| **Overall** | **B+/Aâˆ’ trajectory** | With P0â€“P1 fixed this is a genuinely differentiated product |

*Report generated from direct code inspection; all file:line references verified Aug 2026.*

