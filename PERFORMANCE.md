# Performance Engineering & Optimization Guide: ClipForge AI Studio

## 1. Core Performance Objectives

1. **60 FPS Timeline Scrubbing**: Frame rendering latency under 16.6ms during playhead scrubbing.
2. **Sub-500 KB Initial Bundle**: Fast initial load via aggressive code-splitting and dynamic `lazy()` imports.
3. **Zero-RAM Exhaustion on 4K Footage**: Stream media chunks directly via OPFS without loading multi-gigabyte video files into JavaScript heap memory.
4. **Deterministic Hardware Export**: Maximum throughput video encoding leveraging WebCodecs GPU hardware encoders.

---

## 2. WebCodecs Hardware Acceleration Pipeline

```
[ Canvas / Raw Frames ]
          │
          ▼
[ VideoEncoder.configure() ]
    • codec: 'avc1.640028' (H.264 High Profile Level 4.0)
    • hardwareAcceleration: 'prefer-hardware'
    • bitrateMode: 'variable'
          │
          ▼
[ WebCodecs GPU Encoding Pipeline ] ──► [ Mediabunny MP4 Muxer ]
```

- **AVC Level Probing**: Automatically queries `VideoEncoder.isConfigSupported()` to select the optimal H.264 profile and hardware encoder supported by the user's GPU.
- **Backpressure Management**: Monitors `encoder.encodeQueueSize` to throttle frame ingestion and prevent browser tab memory exhaustion during high-bitrate exports.

---

## 3. Memory Lifecycle & Leak Prevention

### 3.1 Object URL Revocation
Object URLs created from memory Blobs (`URL.createObjectURL(blob)`) must be tracked and explicitly revoked when components unmount or media is discarded:
```typescript
// Memory-safe asset preview hook pattern
useEffect(() => {
  const url = URL.createObjectURL(blob)
  setUrl(url)
  return () => {
    URL.revokeObjectURL(url) // Guarantees garbage collection
  }
}, [blob])
```

### 3.2 OPFS Streaming vs In-Memory Buffers
Large media files (video clips, 3D GLB models) are never buffered entirely in JS RAM:
- Reads use `FileSystemFileHandle.getFile()` and slice streaming `ReadableStream`.
- Writes stream directly through `FileSystemWritableFileStream`.

---

## 4. Lazy Loading & Bundle Splitting Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     Vite Bundle Topology                    │
├──────────────────────────┬──────────────┬───────────────────┤
│ Chunk                    │ Size (Gzip)  │ Loading Strategy  │
├──────────────────────────┼──────────────┼───────────────────┤
│ `index.js` (Entry Shell) │ ~140 KB      │ Initial Page Load │
│ `editor.js`              │ ~220 KB      │ Lazy (Route Gate) │
│ `three.js` (3D Engine)   │ ~180 KB      │ Isolated Chunk    │
│ `whisper.wasm`           │ ~42 MB       │ On-Demand Worker  │
│ `rnnoise.wasm`           │ ~180 KB      │ On-Demand Worker  │
└──────────────────────────┴──────────────┴───────────────────┘
```

- **Three.js Isolation**: Configured in `vite.config.ts` manualChunks to prevent 3D rendering libraries from leaking into the landing page entry chunk.
- **WASM Models on Demand**: Whisper and RNNoise WASM binaries are only downloaded when the user first triggers Auto-Captions or Denoise actions.

---

## 5. Timeline Scrubbing & Canvas Optimization

- **`requestAnimationFrame` Throttling**: Timeline scrub events batch updates to `requestAnimationFrame`, ensuring redundant intermediate mouse coordinates do not trigger unnecessary frame redraws.
- **Layer Visibility Culling**: `compositeFrame()` checks time boundaries (`clip.startTime <= t && t <= clip.startTime + clip.duration`) and skips processing inactive tracks and offscreen visual layers.
- **Waveform Downsampling**: Audio waveform peaks are computed once on asset import at 100 points/sec and cached in IndexedDB, avoiding real-time audio buffer decoding during zoom/pan.
