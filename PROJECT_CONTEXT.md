# Project Context: ClipForge AI Studio

## 1. Executive Summary

**ClipForge AI Studio** is an autonomous, browser-native video editing workstation engineered with a strict **"browser-first, server-never"** media processing architecture. Unlike traditional cloud video editors that require multi-gigabyte video uploads to centralized servers, ClipForge executes all video decoding, compositing, real-time visual effects, audio processing, machine learning transcription, and video encoding directly inside the user's web browser using cutting-edge Web APIs (**WebCodecs**, **WebGPU**, **WebAssembly**, and the **Origin Private File System**).

The application is augmented by an **Autonomous AI Director**—an intelligent agent that operates the editor through typed tool calls, generates scripts and visual scenes, performs research, and stages timeline edits for user approval without replacing human creative control.

---

## 2. Core Mission & Philosophy

1. **Zero Server Video Uploads (Privacy & Sovereignty)**:
   - User video files, audio tracks, and exported renders never touch a remote backend.
   - All media assets reside locally in the browser's Origin Private File System (OPFS) and IndexedDB.
   - Bandwidth is preserved, privacy is guaranteed, and processing latency is minimized.

2. **User-Owned API Keys**:
   - ClipForge does not enforce subscription paywalls for AI features.
   - Users bring their own API keys for LLM providers (NVIDIA NIM, OpenCode Zen, OpenRouter), TTS (ElevenLabs, NVIDIA TTS), stock media (Unsplash, Pexels, Pixabay), and web intelligence (Firecrawl).
   - Sensitive credentials are encrypted at rest using Web Crypto AES-256-GCM with PBKDF2 key derivation.

3. **Autonomous AI Director with Human-in-the-Loop**:
   - The AI Director acts as a tireless pair editor.
   - Actions (clip slicing, transitions, effects, color grading, caption generation) are staged with visual diffs and require user confirmation before committing to the timeline.
   - Destructive or unwanted edits can be undone instantly via full temporal history (undo/redo).

4. **Deterministic & Non-Simulated Engineering**:
   - No mock progress bars or fake processing timers.
   - All rendering, transcription, audio cleaning, and video multiplexing report real frame counts, audio sample rates, and chunk progress.

---

## 3. Target User Personas

| Persona | Primary Needs | ClipForge Solution |
| :--- | :--- | :--- |
| **Content Creators & YouTubers** | Fast cuts, auto-captions, dynamic b-roll, background noise cleanup, vertical 9:16 reformatting. | In-browser Whisper speech-to-text, RNNoise audio cleaning, stock search integration, instant aspect ratio switching. |
| **Educators & Course Creators** | Turning slides and lecture audio into polished lessons, adding lower-thirds, text overlays, and chapter markers. | Marp markdown slide generation, OCR text protection, multi-track timeline, keyframe animations. |
| **3D & Motion Graphic Artists** | Incorporating 3D product models (.glb/.gltf) into marketing videos without heavy 3D suite overhead. | Built-in Three.js GLB renderer with animated camera rigs (Turntable, Orbit, Dolly, Static). |
| **Privacy-Conscious Teams** | Editing confidential internal footage, medical/legal recordings, or proprietary product demos. | 100% offline-capable editing and rendering with zero data exfiltration risks. |

---

## 4. High-Level System Boundaries

- **Client Environment**: Modern desktop and mobile browsers supporting WebCodecs, WebAssembly, and Canvas 2D/WebGPU (Chrome 94+, Edge 94+, Safari 16.4+, Firefox 130+).
- **Backend Role**: Strictly limited to a stateless, zero-storage CORS bypass proxy (`/api/proxy`) for external APIs (e.g. Deezer audio previews, NVIDIA NIM LLM endpoints) that lack browser CORS headers.
- **Data Boundary**: All project state, timeline tracks, undo histories, and binary blobs remain isolated within the origin storage sandbox.
