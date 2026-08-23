# Engineering Roadmap & Task Tracker: ClipForge AI Studio

## 1. High-Priority Engineering Tasks

### [ ] Task 1: Fix WebM VideoEncoder Chunk Copy Bug
- **Location**: `src/engine/export/exportVideo.ts`, `src/engine/avatar/lipsync.ts`, `src/engine/motion/sandbox.ts`, `src/engine/three/renderGlbToVideo.ts`, `src/engine/stickers/gifToVideo.ts`
- **Issue**: Encoded video frames currently pass zero-filled `Uint8Array` buffers to the WebM muxer instead of copying the encoded chunk data via `chunk.copyTo(bytes)`.
- **Action**: Add `chunk.copyTo(bytes)` immediately after allocating the typed array buffer in all 5 files.

---

### [ ] Task 2: Wire Property Keyframe Interpolation in Compositor
- **Location**: `src/engine/render/composite.ts`, `src/lib/keyframes.ts`
- **Issue**: Clip property keyframes (`x`, `y`, `scale`, `rotation`, `opacity`) are stored in `clip.keyframes` but currently only crop keyframes are interpolated during composite rendering.
- **Action**: Call `interpolateKeyframes(clip.keyframes, clipTime)` inside `compositeFrame()` to apply dynamic animations to video and text clips in real time.

---

### [ ] Task 3: Bundle & Verify ONNX Weights for Wav2Lip & MODNet
- **Location**: `src/engine/lipsync/wav2lip-engine.ts`, `src/engine/background-removal/bgremoval-engine.ts`
- **Issue**: Client-side lip-sync and background removal engines require quantized ONNX model weights (`wav2lip.onnx` and `modnet.onnx`).
- **Action**: Host lightweight quantized ONNX models on public CDN or HuggingFace hub and configure streaming cache in IndexedDB.

---

## 2. Feature Roadmap & Enhancements

### [ ] Task 4: MediaPipe Face Mesh Integration for Smart Reframe
- **Target**: `src/engine/reframing/reframing.ts`
- **Goal**: Replace current center-crop fallback with real-time browser-based face and subject bounding-box tracking for intelligent 9:16 vertical reframing.

---

### [ ] Task 5: Timeline Clip Reverse Playback
- **Target**: `src/ui/tools/SpeedPanel.tsx`, `src/engine/render/composite.ts`
- **Goal**: Implement negative playback rates and frame reverse indexing for video and audio clips on the timeline.

---

### [ ] Task 6: `.clipforge` Project Archive Bundle Export/Import
- **Target**: `src/lib/exportZip.ts`, `src/engine/storage/db.ts`
- **Goal**: Export complete project JSON together with all raw OPFS media binaries into a single portable `.clipforge` ZIP file for cross-device backup and project sharing.

---

### [ ] Task 7: Stock Video Search Integration
- **Target**: `src/api/stock/search.ts`
- **Goal**: Add Pexels Video Search API to enable searching and importing stock B-roll clips directly into the Media Bin.

---

## 3. Polish & Code Health

- [ ] Add End-to-End Playwright tests for WebCodecs recording and timeline drag-and-drop.
- [ ] Implement multi-resolution Level of Detail (LOD) caching for audio waveforms on long timelines.
- [ ] Add customizable keyboard shortcut binding editor in Settings.
