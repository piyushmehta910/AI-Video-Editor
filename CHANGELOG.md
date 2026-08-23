# Changelog: ClipForge AI Studio

All notable changes to ClipForge AI Studio are documented in this file in accordance with [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.0] - 2026-08-24

### Added
- **172 Automated Unit Tests**: Complete test coverage across 22 test suites for timeline operations, keyframe math, quality heuristics, 3D rigs, and transcript parsing.
- **AST Hook Validation Suite**: Custom TypeScript AST analyzer ensuring zero conditional or nested React hook violations (`src/hooks/rulesOfHooks.test.ts`).
- **Comprehensive Technical Documentation**: 14 standard architectural and operational guides covering architecture, database, API, coding rules, UI guidelines, security, and deployment.

### Changed
- Refactored `timelineStore` to batch history snapshots during continuous clip drag and resize operations.
- Upgraded Tailwind CSS to version 4 with modern CSS variables.

### Fixed
- Fixed fast refresh component export warnings across tool panels and settings views.
- Resolved race conditions in OPFS file handle creation during concurrent multi-asset imports.

---

## [0.8.0] - 2026-08-10

### Added
- **Hardware-Accelerated MP4 Export**: Full integration with `mediabunny` multiplexer and WebCodecs `VideoEncoder`/`AudioEncoder` for blazing-fast in-browser MP4 exports.
- **AVC Level Probing**: Automatic detection of supported H.264 profiles and hardware encoder constraints.
- **Batch Export Queue**: Queue multiple render jobs with individual progress bars and cancellation support.

---

## [0.7.0] - 2026-07-28

### Added
- **Autonomous AI Director**: Multi-provider LLM support (NVIDIA NIM, OpenCode Zen, OpenRouter) with 26 typed editor tools.
- **Staged Edit Approval Workflow**: AI edits are presented as visual previews and require explicit user confirmation before modifying the timeline.
- **Script & Slide Generation**: Markdown lesson generator with Marp slide rendering to video tracks.

---

## [0.6.0] - 2026-07-15

### Added
- **3D Model Integration**: Three.js `.glb` and `.gltf` asset loader with custom animated camera rigs (*Turntable*, *Orbit*, *Dolly*, *Static*).
- **Poly Haven Integration**: Direct keyless search and import for CC0 3D models and HDRi environments.
- **Keyframe Interpolation Engine**: Cubic bezier, linear, and ease-in/out math for multi-channel video properties.

---

## [0.5.0] - 2026-06-30

### Added
- **In-Browser Whisper ASR**: Client-side speech-to-text transcription via `@xenova/transformers` WebAssembly.
- **Word-Level Subtitle Timing**: Automated caption generation with customizable font, color, border, and safe-zone positioning.
- **RNNoise Audio Denoise**: Client-side C-WASM background noise suppression for audio tracks.

---

## [0.1.0] - 2026-05-15

### Added
- Initial project scaffolding with React 19, TypeScript strict mode, and Vite 8.
- TanStack Router code-split architecture.
- Web Crypto AES-256-GCM encryption with PBKDF2 for user API keys in IndexedDB.
- Multi-provider settings dashboard with live connection testers.
