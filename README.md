# ClipForge AI Studio

> **Browser-native video editor with an autonomous AI Director.**  
> 100% client-side video processing — zero video uploads, user-owned API keys, and deterministic WebCodecs + WebGPU performance.

[![Tests](https://img.shields.io/badge/tests-172%20passed-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%20Strict-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8.svg)](https://tailwindcss.com/)

---

## Key Features

- **Multi-Track Non-Linear Timeline**: 4 specialized track types (`video`, `audio`, `text`, `fx`), ripple deletion, razor split, snap-to-grid, and keyframing.
- **Autonomous AI Director**: Multi-provider LLM pair editor (NVIDIA NIM, OpenCode Zen, OpenRouter) with structured planning, script writing, and staged tool approval.
- **Client-Side Speech & Captions**: Automatic speech recognition powered by in-browser Whisper WASM/Transformers.js with word-level timestamps and animated subtitles.
- **AI Audio Denoising**: Real-time voice isolation and background noise suppression via RNNoise WebAssembly.
- **3D Model Integration**: Import `.glb` and `.gltf` 3D assets, apply animated camera rigs (*Turntable*, *Orbit*, *Dolly*, *Static*), and composite directly into video tracks.
- **Client-Side Hardware Export**: Ultra-fast MP4/WebM encoding using WebCodecs and Mediabunny muxer with custom resolutions (1080p, 4K, 9:16 Shorts/Reels).
- **Integrated Stock & Media**: Keyless search and import for Music (Deezer, MusicBrainz), 3D assets (Poly Haven), Stickers (Giphy), and Stock Photography (Unsplash, Pexels, Pixabay).
- **Local-First Security**: API keys encrypted with Web Crypto AES-256-GCM + PBKDF2 (100,000 iterations) stored in IndexedDB.

---

## Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Framework & UI** | React 19, TypeScript, Tailwind CSS 4, Radix UI Primitives, Lucide Icons |
| **Routing** | TanStack Router (Code-split routes: `/`, `/editor`, `/settings`) |
| **State & Temporal** | Zustand + Zundo (Undo/Redo history) + Immer |
| **Video & Media Processing** | WebCodecs, Mediabunny, Web Audio API, Canvas 2D / WebGPU fallback |
| **Client-Side Machine Learning** | `@xenova/transformers` (Whisper), `@shiguredo/rnnoise-wasm`, `tesseract.js` |
| **3D Graphics** | Three.js (`three`), `@gltf-transform/core`, `@gltf-transform/extensions` |
| **Storage Sandbox** | Origin Private File System (OPFS), IndexedDB (`clipforge-app`) |
| **Security & Crypto** | Web Crypto API (SubtleCrypto AES-GCM + PBKDF2) |

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm 10+
- A modern browser with WebCodecs and WebAssembly support (Chrome 94+, Edge 94+, Safari 16.4+, Firefox 130+)

### Installation
```bash
# Clone the repository
git clone https://github.com/piyushmehta910/AI-Video-Editor.git
cd "AI-Video-Editor"

# Install dependencies
npm install

# Start the local development server (includes /api/proxy middleware)
npm run dev
```

Visit `http://localhost:5173` to launch ClipForge AI Studio.

---

## Development Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server with local proxy middleware |
| `npm run build` | Runs TypeScript compilation (`tsc -b`) and Vite production bundle |
| `npm test` | Runs the test suite via Vitest (172 unit tests) |
| `npm run lint` | Runs oxlint over the codebase |
| `npm run check:hooks` | Validates React hook rules across all source components |
| `npm run preview` | Previews the production build locally |

---

## Project Structure

```
├── src/
│   ├── ai/               # AI quality validation and heuristics
│   ├── api/              # LLM, TTS, Stock, 3D, Music, and proxy clients
│   │   ├── config/       # Crypto key derivation and config store
│   │   └── llm/          # AI Director, prompt engineering, and tool execution
│   ├── components/       # UI components (Timeline, Inspector, Media Bin, Shortcuts)
│   ├── engine/           # Core media processing engines
│   │   ├── captions/     # Whisper ASR transcript & subtitle rendering
│   │   ├── denoise/      # RNNoise WASM audio cleanup
│   │   ├── export/       # WebCodecs MP4/WebM video export
│   │   ├── storage/      # IndexedDB and OPFS filesystem managers
│   │   └── three/        # 3D model loaders, camera rigs, and renderers
│   ├── hooks/            # Custom React hooks (playback, capabilities, shortcuts)
│   ├── pages/            # LandingPage, EditorPage, SettingsPage
│   ├── stores/           # Zustand stores (timeline, editor, AI, export queue)
│   └── workers/          # Web Workers for encoding, decoding, and background tasks
├── server/               # Dev server CORS proxy forwarder
└── public/               # Static assets
```

---

## Documentation Index

- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — Mission, principles, and user personas
- [ARCHITECTURE.md](./ARCHITECTURE.md) — End-to-end client-side system architecture
- [DATABASE.md](./DATABASE.md) — IndexedDB schema and OPFS storage lifecycle
- [API.md](./API.md) — External provider integrations and proxy specifications
- [CODING_RULES.md](./CODING_RULES.md) — TypeScript, React 19, and architectural rules
- [UI_GUIDELINES.md](./UI_GUIDELINES.md) — Design system, layout, and interaction patterns
- [PERFORMANCE.md](./PERFORMANCE.md) — WebCodecs tuning, memory budgets, and lazy loading
- [SECURITY.md](./SECURITY.md) — Web Crypto AES-256-GCM encryption and threat model
- [SEO.md](./SEO.md) — Metadata, structured data, and OpenGraph configuration
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel serverless deployment and COOP/COEP headers
- [TESTING.md](./TESTING.md) — Test suites, quality checks, and verification plans
- [CHANGELOG.md](./CHANGELOG.md) — Version history and release notes
- [TASK.md](./TASK.md) — Roadmap and pending engineering tasks

---

## License

MIT © Piyush Mehta.
