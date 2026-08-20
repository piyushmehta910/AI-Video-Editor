# ClipForge Codebase Audit Report

**Date:** 2026-08-21  
**Scope:** Performance, Security, Caching, Export, Offline, Destructive Actions, Brand Consistency

---

## Executive Summary

ClipForge is a sophisticated browser-based video editor with AI integration. The codebase demonstrates strong engineering practices (WebCodecs, Web Workers, OPFS, CSP-sandboxed iframe). However, several **Critical** and **High** severity issues exist around 4K performance, API key exposure, export queue resilience, and destructive action confirmations.

---

## 1. Performance Under Large Projects (4K/High-Bitrate)

### Findings

| Severity | File:Line | Issue | Recommended Fix |
|----------|-----------|-------|-----------------|
| **Critical** | src/engine/export/exportVideo.ts:149 src/engine/export/exportMp4.ts:102 | Export renders full-resolution frames on main thread using CanvasRenderingContext2D. For 4K (3840x2160) at 30fps, this blocks the main thread for seconds per frame. No WebGL/WebGPU acceleration. | Move frame composition to a Web Worker using OffscreenCanvas + WebGL2/WebGPU. Use the existing render.worker.ts infrastructure. |
| **Critical** | src/engine/media/proxy.ts:3-6 | Proxy generation is hardcoded to 360p VP8 at 1Mbps with 30s max duration (PROXY_HEIGHT=360, PROXY_MAX_DURATION=30). 4K sources >30s get **no proxy**, forcing full-res decoding during scrubbing. | Make proxy resolution/configurable (720p/1080p options). Remove 30s limit or make it configurable. Use WebCodecs for faster proxy encoding. |
| **High** | src/engine/export/exportVideo.ts:183 src/engine/export/exportMp4.ts:165 | Video elements loaded via loadMediaElement() decode full-res frames in-browser. No hardware decoding hint, no frame dropping under load. | Add playsInline, disableRemotePlayback. Consider WebCodecs VideoDecoder in worker for hardware-accelerated decoding. |
| **High** | src/engine/render/composite.ts:215 | compositeFrame() runs entirely on main thread per export frame. No parallelism. | Refactor to use OffscreenCanvas in render.worker.ts. Pass frame data via postMessage with transferable ImageBitmap. |
| **High** | src/engine/storage/thumbnails.ts:37-66 | videoThumbnail() and generateSmartThumbnails() decode full-res video on main thread. Smart thumbnails oversample (15+ frames) blocking UI. | Move thumbnail generation to ai.worker.ts or dedicated worker. Use VideoDecoder for fast frame extraction. |
| **High** | src/engine/analysis/scenes.ts:216 src/engine/analysis/ocr.ts:46 | Scene detection & OCR run on main thread with HTMLVideoElement seeking. Blocks UI for long videos. | Already designed for workers but not wired. Move to ai.worker.ts with OffscreenCanvas frame extraction. |
| **High** | src/engine/captions/whisper-engine.ts:71-92 | Whisper model loads in worker but audio resampling (resampleAudio()) runs in worker synchronously. Large files block worker thread. | Use AudioWorklet for streaming resample or chunked processing with yield. |
| **Medium** | src/engine/export/exportVideo.ts:250 src/engine/export/exportMp4.ts:227 | await new Promise(r => setTimeout(r, 0)) every 8/16 frames yields but doesn't prioritize. | Use scheduler.yield() (when available) or requestIdleCallback for cooperative scheduling. |
| **Medium** | src/engine/media/filmstrip.ts:54-62 | Filmstrip generation at fixed 68px height. For 4K source, still decodes full frames then downsamples. | Use VideoDecoder with output to VideoFrame at target resolution directly. |
| **Low** | src/engine/types.ts:346-357 | Export settings support 4K but no UI warning about performance implications. | Add capability check in EngineCard and warn in ExportDialog when 4K selected without WebGPU/WebCodecs video. |

### Web Worker Usage Status
- Workers exist: decode.worker.ts, render.worker.ts, encode.worker.ts, ai.worker.ts (via engineWorkers.ts)
- Not utilized for: Export frame composition, thumbnail generation, scene detection, OCR, filmstrip, proxy generation
- OffscreenCanvas: Not used anywhere for rendering
- WebGPU: Detected in capabilities but never used for rendering
- WebCodecs VideoDecoder: Not used for hardware-accelerated decode

---

## 2. Security Posture

### Findings

| Severity | File:Line | Issue | Recommended Fix |
|----------|-----------|-------|-----------------|
| **Critical** | src/api/config/store.ts:49-56 src/api/config/types.ts:135-302 | API keys stored in **localStorage** in plaintext. Accessible to any XSS, exported in project files if serialized. | Encrypt keys with Web Crypto API (AES-GCM) using a key derived from user password or device-bound key. Never include keys in project export. |
| **Critical** | src/engine/motion/sandbox.ts:20-21 | CSP allows 'unsafe-inline' for scripts: script-src 'unsafe-inline'. While code is injected via srcdoc, this weakens defense-in-depth. | Use nonce-based CSP: generate random nonce per render, add to meta and script nonce=... Remove 'unsafe-inline'. |
| **High** | src/engine/storage/opfs.ts:26-28 | writeMediaFile() sanitizes filename with regex but **no path traversal protection** on id parameter. id comes from crypto.randomUUID() in timelineStore.ts:184 but could be manipulated if passed externally. | Validate id is UUID v4 format. Reject any .. or / in fileName. |
| **High** | src/stores/timelineStore.ts:174-244 | importFiles() accepts any File from user. No MIME validation beyond detectMediaType(). No size limits. No malware scanning. | Add max file size (configurable). Validate MIME matches extension. Consider ClamAV WASM or server-side scan for shared deployments. |
| **High** | src/api/models/polyhaven.ts:93-119 | downloadModelAsGlb() fetches arbitrary GLTF URL from Poly Haven, parses with gltf-transform, writes binary GLB to OPFS. **No validation of GLB structure** before storage. | Validate GLB header (glTF magic), parse in sandboxed worker, sanitize buffers before OPFS write. |
| **High** | src/api/llm/tools.ts:1007-1011 src/api/llm/tools.ts:1167-1193 | search_stock_image/search_music download external URLs via fetch()/proxyFetch() and write to OPFS. **No content-type validation**, **no size limits**, SSRF risk via proxyFetch. | Validate Content-Type header matches expected. Enforce max download size (e.g., 50MB). Block private IP ranges in needsProxy(). |
| **Medium** | src/engine/motion/sandbox.ts:176-186 | Sandbox iframe uses srcdoc with allow-scripts only. Good. But postMessage target is '*' (line 41, 136). | Use parent origin explicitly or validate event.origin === 'null' (already done line 108). Change targetOrigin to location.origin. |
| **Medium** | src/api/config/validation.ts (not read but referenced) | API validation functions likely expose keys in network requests. Ensure keys never logged. | Audit validation.ts for key leakage in logs/errors. |
| **Medium** | src/api/tts/elevenlabs.ts src/api/tts/nvidia.ts | TTS providers send API keys in request headers. If proxyFetch is used, keys could leak to proxy. | Ensure needsProxy() returns false for TTS endpoints. Add allowlist. |
| **Low** | src/engine/motion/sandbox.ts:89 | Code escape prevention: code.replace(/<\/script/gi, '<\\/script') -- only handles </script>. Could break with </scr+ipt>. | Use proper HTML escaping: code.replace(/</g, '<').replace(/>/g, '>') since code is in script context. |

### Project File Import Validation
- timelineStore.ts:246-258 deleteAsset() removes from OPFS and IndexedDB but no validation on imported project JSON
- No schema validation on project load (hydrate() at line 128-162)
- **Fix**: Add JSON Schema validation for Project/Asset types in hydrate()

---

## 3. Caching & Offline Capabilities

### Findings

| Severity | File:Line | Issue | Recommended Fix |
|----------|-----------|-------|-----------------|
| **High** | src/engine/storage/opfs.ts | OPFS used for media files but **no IndexedDB cache layer** for metadata/thumbnails. Every thumbnail re-generates on load. | Add IndexedDB cache for thumbnails, filmstrips, waveforms, probe results. Use db.ts stores. |
| **High** | src/engine/storage/thumbnails.ts | Thumbnails stored as **data URLs in Asset object** (in IndexedDB). Data URLs are ~33% larger than binary. No LRU eviction. | Store thumbnails as Blobs in OPFS or IndexedDB blob store. Add LRU with max cache size (e.g., 500MB). |
| **High** | src/api/stock/search.ts src/api/music/search.ts | **No caching of search results**. Every search hits network. | Add in-memory + IndexedDB cache with TTL (e.g., 1 hour for stock, 24h for music). Key by query+provider. |
| **Medium** | src/stores/timelineStore.ts:128-162 | hydrate() loads all assets and runs getStoredTranscript/scenes/ocr for each. Sequential in Promise.all but no progress. | Add loading states. Prioritize visible assets. Background load rest. |
| **Medium** | src/engine/analysis/types.ts (referenced) | Analysis results (transcript, scenes, OCR) stored in IndexedDB settings store with keys like transcript:. No TTL, no size management. | Add updatedAt and max-age. Implement cache eviction in store.ts. |
| **Low** | src/hooks/useCapabilities.ts | Capabilities cached at module level but no persistence across sessions. | Cache capabilities in IndexedDB with version check. |
| **Low** | Service Worker | **No Service Worker** registered for offline caching of static assets. | Add Vite PWA plugin or custom SW to cache app shell, models, WASM. |

### Offline Mode Status
| Feature | Works Offline | Notes |
|---------|---------------|-------|
| Timeline editing | Yes | Pure local state |
| Media playback | Yes | From OPFS |
| Proxy/filmstrip/waveform | Yes | Generated locally |
| Transcription (Whisper) | Yes | Model cached in browser via transformers.js |
| Scene detection | Yes | Local analysis |
| OCR (Tesseract) | Yes | Model cached |
| AI Director (LLM) | No | Requires API key + network |
| TTS (ElevenLabs/NVIDIA) | No | Requires API key + network |
| Stock media search | No | Requires API key + network |
| Music search | No | Requires network |
| 3D model download | No | Requires network |
| Export (WebCodecs) | Yes | Fully local |
| Project save/load | Yes | IndexedDB + OPFS |

---

## 4. Export Queue (Pause/Resume/Retry)

### Findings

| Severity | File:Line | Issue | Recommended Fix |
|----------|-----------|-------|-----------------|
| **Critical** | src/engine/export/exportVideo.ts src/engine/export/exportMp4.ts | **No export queue exists**. ExportDialog calls export function directly. No pause, resume, retry, or background queue. Browser tab close = lost export. | Implement ExportQueue class with: persistent queue in IndexedDB, AbortController per job, checkpointing (save frame index), resume from checkpoint, retry with backoff. |
| **Critical** | src/ui/export/ExportDialog.tsx:76-112 | Export runs inline in component. No way to minimize dialog and continue editing. | Move export to background worker (encode.worker.ts). Show progress in toast/notification. Allow multiple queued exports. |
| **High** | src/engine/export/exportVideo.ts:139-262 | exportProject() is a single async function. If it throws at frame 500/1000, all work lost. | Checkpoint every N frames: save frameIndex, muxer state (WebM cluster), encoder state to OPFS. On resume, seek to checkpoint. |
| **High** | src/engine/export/audioMix.ts:44 | mixProjectAudio() uses OfflineAudioContext which cannot be paused/resumed. | Split audio mixing into chunks. Or accept that audio mix is fast enough to redo on resume. |
| **Medium** | src/engine/export/webm-muxer.ts | WebMMuxer likely doesn't support incremental finalization. | Verify WebMMuxer can append clusters. If not, use mediabunny for MP4 (supports segmented write). |
| **Low** | src/ui/export/ExportDialog.tsx:114-118 | Cancel only aborts current export. No pause button. | Add pause: signal.abort() but save checkpoint. Resume continues from checkpoint. |

---

## 5. Offline Mode

### Findings

| Severity | File:Line | Issue | Recommended Fix |
|----------|-----------|-------|-----------------|
| **High** | src/stores/timelineStore.ts:164-172 | save() writes to IndexedDB only. No OPFS backup. If storage quota exceeded, save fails silently. | Add try/catch with user notification. Implement OPFS backup for critical project data. |
| **High** | src/engine/storage/opfs.ts:56-59 | getMediaUrl() creates objectURL which revokes on unload. No persistent URL scheme for offline sharing. | For offline export, use OPFS file handles directly with FileSystemFileHandle.createSyncAccessHandle() (where supported). |
| **Medium** | src/pages/SettingsPage.tsx:51-57 | Settings show All keys are stored locally but don't explain offline implications. | Add offline status indicator. Show which features need network. |
| **Low** | N/A | No Export for Offline feature (bundle project + assets + proxy). | Add Package Project export: ZIP with project.json + all media + proxies + thumbnails. |

---

## 6. Destructive Action Confirmations

### Findings

| Severity | File:Line | Issue | Recommended Fix |
|----------|-----------|-------|-----------------|
| **Critical** | src/api/llm/tools.ts:82-91 src/api/llm/tools.ts:1096-1100 | delete_clip tool **staged for review** (good) but **no UI confirmation** beyond the proposal list. User clicks Apply once. | Add secondary confirmation modal for destructive tools: This will permanently delete clip X. Undo available for 30s. |
| **Critical** | src/api/llm/tools.ts:174-192 src/api/llm/tools.ts:730 | delete_clip and trim_clip (with negative delta = extend beyond source) can lose data. No destructive flag in tool schema. | Add destructive: true to tool schema. UI shows red warning for destructive proposals. |
| **High** | src/ui/media/MediaBrowser.tsx:295-344 | MediaItem delete button: **single-click confirms** after 1.5s timeout (confirm state). No modal, no undo hint. | Replace with confirmation dialog: Delete 'asset.mp4'? This removes it from timeline and storage. [Cancel] [Delete] |
| **High** | src/api/llm/tools.ts:716-751 | STAGED_TOOLS includes delete_clip, trim_clip, move_clip, split_clip, join_clips, deleteClips (ripple), set_project_ratio (changes all clips). Good they're staged. | Ensure all staged tools show clear Proposed -- not applied badge. Add Discard All prominently. |
| **Medium** | src/api/llm/tools.ts:1205-1230 | generate_captions transcribes audio (expensive, minutes). Staged but no cost warning. | Add costEstimate to tool result: { ok: true, message, cost: { timeMs: 120000, compute: 'high' } }. UI shows warning for expensive ops. |
| **Medium** | src/components/settings/cards/PreferencesCard.tsx:134-152 | confirmationLevel setting exists ('always'|'expensive'|'destructive'|'none') but **not enforced in applyTool()**. | In applyTool(), check preferences.confirmationLevel and auto-apply only if level permits. |
| **Low** | src/api/llm/tools.ts:754-763 | NON_MUTATING_TOOLS includes render_preview which **writes a file to disk** (downloads). Not purely read-only. | Move render_preview to staged or add sideEffect: 'download' flag. |

---

## 7. Brand Consistency

### Findings

| Severity | File:Line | Issue | Recommended Fix |
|----------|-----------|-------|-----------------|
| **High** | src/ui/ai/AIDirector.tsx:541-549 | Hardcoded brand colors: bg-violet-600, text-violet-600, border-violet-500/40, shadow-violet-600/30. Not using CSS variables/design tokens. | Extract to theme.ts or CSS custom properties: --brand-primary, --brand-primary-hover, --brand-ring. Use var(--brand-primary) in components. |
| **High** | src/engine/render/composite.ts:348-361 | Caption rendering hardcodes: fontFamily: 'Inter, system-ui, sans-serif', color: '#ffffff', backgroundColor: '#000000', shadow: 'rgba(0,0,0,0.7)'. Not configurable per brand. | Use CaptionsConfig.style from project (already exists at types.ts:266-298). Pass through compositeFrame media.captions provider. |
| **Medium** | src/engine/avatar/lipsync.ts:113-125 src/engine/avatar/lipsync.ts:136-144 | Avatar background gradient hardcoded: #3a2f4a to #171321. Mouth colors hardcoded: #4a161b, #b56a6e. | Move to AvatarConfig in types.ts (exists at line 95-103). Use config values in lipsync.ts. |
| **Medium** | src/components/settings/cards/*.tsx | Each card reimplements similar layout (ProviderCard, FieldRow, ApiKeyInput). Inconsistent spacing, labels, error states. | Create unified SettingsSection and SettingField components. Enforce design system. |
| **Low** | src/ui/ai/AIDirector.tsx:50-56 | Suggestions hardcoded in English only. No i18n. | Move to config or i18n system. |
| **Low** | src/components/ui/button.tsx:7-32 | Button variants use hardcoded color classes (bg-primary, bg-destructive). Good -- uses CSS variables. | Ensure all components use the same design token approach. |

---

## Summary by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Performance (4K) | 2 | 5 | 2 | 1 | 10 |
| Security | 2 | 4 | 3 | 1 | 10 |
| Caching/Offline | 0 | 3 | 2 | 2 | 7 |
| Export Queue | 2 | 1 | 1 | 1 | 5 |
| Offline Mode | 0 | 2 | 1 | 1 | 4 |
| Destructive Actions | 2 | 2 | 2 | 1 | 7 |
| Brand Consistency | 0 | 2 | 2 | 2 | 6 |
| **TOTAL** | **8** | **19** | **13** | **9** | **49** |

---

## Priority Fix Roadmap

### Phase 1: Critical Security & Data Loss (Week 1-2)
1. **Encrypt API keys** in localStorage (Web Crypto AES-GCM)
2. **Fix CSP** in sandbox iframe (nonce-based, remove 'unsafe-inline')
3. **Add path traversal protection** in OPFS write
4. **Add file upload validation** (size, MIME, type)
5. **Add secondary confirmation** for delete_clip and destructive tools

### Phase 2: 4K Performance & Export Resilience (Week 2-4)
1. **Implement ExportQueue** with IndexedDB persistence, pause/resume/retry
2. **Move export composition to OffscreenCanvas + Web Worker** (render.worker.ts)
3. **Make proxy generation configurable** (resolution, duration limit, codec)
4. **Use WebCodecs VideoDecoder** for hardware-accelerated decode in worker
5. **Add WebGPU render path** for composition when available

### Phase 3: Caching & Offline Polish (Week 4-5)
1. **Add IndexedDB cache layer** for thumbnails, filmstrips, search results
2. **Implement LRU eviction** with configurable max size
3. **Add Service Worker** for app shell + model caching
4. **Project packaging** for offline transfer

### Phase 4: UX & Brand Polish (Week 5-6)
1. **Extract design tokens** (CSS custom properties) for brand colors
2. **Unify settings card components** with consistent layout
3. **Wire caption/avatar styling** to project config
4. **Enforce confirmationLevel** setting in AI Director

---

## File Reference Index

Key files audited:
- src/engine/motion/sandbox.ts -- CSP, iframe sandbox
- src/engine/storage/opfs.ts -- OPFS media storage
- src/engine/storage/thumbnails.ts -- Thumbnail generation & caching
- src/engine/storage/db.ts -- IndexedDB wrapper
- src/engine/export/exportVideo.ts -- WebM export pipeline
- src/engine/export/exportMp4.ts -- MP4 export pipeline
- src/engine/export/audioMix.ts -- OfflineAudioContext mixing
- src/engine/export/webm-muxer.ts -- WebM muxing
- src/engine/render/composite.ts -- Frame composition
- src/engine/media/proxy.ts -- Proxy generation
- src/engine/media/filmstrip.ts -- Filmstrip generation
- src/engine/media/waveform.ts -- Audio waveform
- src/engine/analysis/scenes.ts -- Scene detection
- src/engine/analysis/ocr.ts -- OCR text detection
- src/engine/captions/whisper-engine.ts -- Whisper transcription
- src/engine/avatar/lipsync.ts -- Avatar lip-sync
- src/engine/engineWorkers.ts -- Worker lifecycle
- src/workers/*.ts -- Worker stubs
- src/stores/timelineStore.ts -- Timeline state + import/export
- src/api/config/store.ts -- API config state (localStorage)
- src/api/config/types.ts -- Config types + defaults
- src/api/llm/tools.ts -- AI Director tools (50+ tools)
- src/api/models/polyhaven.ts -- 3D model import
- src/api/stock/search.ts -- Stock image search
- src/api/music/search.ts -- Music search
- src/ui/ai/AIDirector.tsx -- AI Director UI
- src/ui/export/ExportDialog.tsx -- Export UI
- src/ui/media/MediaBrowser.tsx -- Media browser + delete
- src/components/settings/*.tsx -- Settings UI
- src/hooks/useCapabilities.ts -- Capability detection
- src/engine/capabilities.ts -- Browser capability detection
