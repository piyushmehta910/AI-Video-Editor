# Database & Storage Specification: ClipForge AI Studio

## 1. Storage Architecture Overview

ClipForge AI Studio adopts a **Local-First, Zero-Server Storage Model**. All structured project data, media binaries, undo snapshots, and API credentials are stored within the browser's origin sandbox across three primary persistence layers:

1. **IndexedDB (`clipforge-app`)**: Structured metadata, project graphs, asset descriptors, analysis results, and history snapshots.
2. **Origin Private File System (OPFS, `clipforge-media`)**: High-throughput binary storage for multi-gigabyte video, audio, image, and 3D model files.
3. **Encrypted Key Store**: AES-256-GCM encrypted sensitive API tokens persisted in IndexedDB and protected by PBKDF2 key derivation.

---

## 2. IndexedDB Schema Specification

- **Database Name**: `clipforge-app`
- **Database Version**: `3`

```
┌─────────────────────────────────────────────────────────────┐
│                    IndexedDB: clipforge-app                 │
├─────────────────┬───────────┬───────────────────────────────┤
│ Store Name      │ Key Path  │ Description                   │
├─────────────────┼───────────┼───────────────────────────────┤
│ `projects`      │ `id`      │ Serialized timeline graphs    │
│ `assets`        │ `id`      │ Media metadata & ML caches    │
│ `settings`      │ `key`     │ Encrypted configuration       │
│ `history`       │ `id`      │ Undo/redo temporal snapshots  │
└─────────────────┴───────────┴───────────────────────────────┘
```

### 2.1 Object Stores & Data Schemas

#### 1. `projects` Store
Stores complete project state graphs.
```typescript
interface ProjectRecord {
  id: string                    // UUID v4
  name: string                  // Human-readable project name
  createdAt: number             // Epoch timestamp (ms)
  updatedAt: number             // Epoch timestamp (ms)
  width: number                 // Canvas width (e.g. 1920, 1080)
  height: number                // Canvas height (e.g. 1080, 1920)
  fps: number                   // Target frame rate (e.g. 30, 60)
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
  tracks: Track[]               // Array of Video, Audio, Text, FX tracks
  duration: number              // Total timeline duration in seconds
  markers: Marker[]             // Timeline timestamp markers
}
```

#### 2. `assets` Store
Stores media descriptors and expensive machine learning analysis results.
```typescript
interface AssetRecord {
  id: string                    // Unique asset ID
  name: string                  // Original filename
  type: 'video' | 'audio' | 'image' | 'model'
  mimeType: string              // e.g. "video/mp4", "model/gltf-binary"
  size: number                  // File size in bytes
  opfsPath: string              // Relative path within OPFS
  duration?: number             // Video/audio duration in seconds
  width?: number                // Video/image frame width
  height?: number               // Video/image frame height
  thumbnailUrl?: string         // Base64 or Blob URL preview
  analysis?: {
    scenes?: SceneBoundary[]    // Frame-difference cut points
    ocrRegions?: OcrRegion[]    // Bounding boxes containing text
    transcript?: TranscriptCue[]// Whisper ASR word/cue segments
  }
}
```

#### 3. `settings` Store
Stores application settings and encrypted API configurations.
```typescript
interface SettingsRecord {
  key: string                   // Configuration key (e.g. "api-config")
  value: Record<string, unknown>// Encrypted payload
  updatedAt: number
}
```

#### 4. `history` Store
Persists temporal undo/redo state stacks between browser reloads.

---

## 3. Origin Private File System (OPFS)

The Origin Private File System provides direct, private filesystem access optimized for high-performance sequential and random read/write access.

### 3.1 Directory Structure
```
[OPFS Root]
 └── clipforge-media/
      ├── {asset-id-1}/
      │    └── {hash}-{sanitized-filename}.mp4
      ├── {asset-id-2}/
      │    └── {hash}-{sanitized-filename}.glb
      └── {asset-id-3}/
           └── {hash}-{sanitized-filename}.wav
```

### 3.2 Security & Path Sanitization
To prevent path traversal vulnerabilities:
- `validatePathSegment()` rejects segments containing `/`, `\`, `.`, or `..`.
- Segment length is capped at 255 characters.
- File names are sanitized with regex: `fileName.replace(/[^\w.\- ]/g, '_')`.

---

## 4. Encrypted Key Storage

API keys for external providers are never stored in plaintext.

```
[ Plaintext Key ]
        │
        ▼
[ PBKDF2 Key Derivation ] ◄── [ Master Password + 16-byte Random Salt ]
  (100,000 Iterations, SHA-256)
        │
        ▼
[ AES-256-GCM Cipher ]   ◄── [ 12-byte Random IV ]
        │
        ▼
[ Encrypted Hex Payload ] (Salt + IV + Ciphertext) ──► Stored in IndexedDB
```

---

## 5. Storage Quota & Lifecycle Management

- **Quota Querying**: Monitored using `navigator.storage.estimate()`.
- **Automatic Cleanup**: When an asset is deleted in the Media Bin, `deleteMediaFile(id)` purges its OPFS directory and clears its IndexedDB asset record.
- **Persistence Request**: Automatically requests `navigator.storage.persist()` on supported browsers to prevent eviction during low-disk situations.
