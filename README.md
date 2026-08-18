# ClipForge AI Studio

Browser-native video editor with an autonomous AI Director. All video processing happens client-side — no video ever uploads to a server.

## Tech Stack

- **React 19 + TypeScript** (strict, zero `any`)
- **Vite 8** with code splitting (initial bundle < 500 KB)
- **Tailwind CSS 4** + **shadcn/ui**-style primitives (Radix)
- **TanStack Router** (type-safe routing)
- **Zustand** (state) — Zundo undo/redo planned for timeline state

## Status

Phase 1 (Foundation) is implemented:

- [x] Vite + React + TS + Tailwind + shadcn-style UI
- [x] Settings page with all API provider cards:
  - NVIDIA NIM, OpenCode Zen, ElevenLabs, Avatar, Wav2Lip
  - Stock Images (Unsplash / Pexels / Pixabay with priority ordering)
  - Firecrawl, Music & Audio (MusicBrainz / Deezer)
  - Security (master password), AI Director preferences
- [x] Web Crypto AES-256-GCM + PBKDF2 (100k iterations) key encryption
- [x] IndexedDB persistence of API config (encrypted at rest when password set)
- [x] Real "Test Connection" checks for every provider (no fake functionality)
- [ ] Video engine (WebGPU compositor, timeline) — upcoming phase
- [ ] Export pipeline (WebCodecs + Mediabunny) — upcoming phase
- [ ] AI Director agent (planner/executor) — upcoming phase

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `npm run dev`    | Start Vite dev server            |
| `npm run build`  | Type-check + production build    |
| `npm run lint`   | Run oxlint                       |
| `npm run preview`| Preview production build         |

## Design Principles

1. **No fake functionality** — every button works or shows "Coming Soon".
2. **AI operates the editor, never replaces it** — AI results stay editable.
3. **Browser-first, server-never** — all processing client-side.
4. **Lazy-load everything** — AI models and FFmpeg.wasm load on demand.
5. **API keys are user-owned** — zero hard-coded keys, all optional.
