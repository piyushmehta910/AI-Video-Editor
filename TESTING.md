# Testing Strategy & Verification Guide: ClipForge AI Studio

## 1. Testing Philosophy

ClipForge AI Studio adheres to **Deterministic, High-Speed Unit & Regression Testing**. 

- **No Artificial Mocks**: Mathematical algorithms (keyframes, timeline slicing, scene differences, aspect ratio calculations, camera rigs) are tested against real deterministic inputs.
- **Fast Execution**: The complete test suite of **172 unit tests across 22 test files** executes in under **2.5 seconds** via [Vitest](https://vitest.dev/).
- **Automated AST Hook Verification**: An automated AST parser scans all TSX components to guarantee zero conditional or nested React hook violations.

---

## 2. Test Suite Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vitest Test Matrix (22 Suites)           │
├─────────────────────┬────────────┬──────────────────────────┤
│ Category            │ Test Files │ Key Capabilities Tested  │
├─────────────────────┼────────────┼──────────────────────────┤
│ **Timeline Engine** │ 3 files    │ Clip splitting, trim in/ │
│                     │            │ out deltas, ripple delete│
│ **AI Quality Rules**│ 2 files    │ 12 deterministic timeline│
│                     │            │ rules, pacing heuristics │
│ **Keyframes & Math**│ 2 files    │ Cubic bezier, ease-in/out│
│                     │            │ multi-channel keyframing │
│ **3D Rigging**      │ 1 file     │ Turntable/orbit azimuth, │
│                     │            │ dolly distance, FOV clamp│
│ **ASR & Captions**  │ 3 files    │ Whisper cue segmentation,│
│                     │            │ SRT/VTT parsing, styling │
│ **LLM & Tooling**   │ 5 files    │ Plan generation, context │
│                     │            │ assembly, asked questions│
│ **React Hook AST**  │ 1 file     │ Rules of Hooks AST scan  │
│ **Export Formats**  │ 2 files    │ Bitrate profiles, aspect │
│                     │            │ presets, ZIP frame export│
└─────────────────────┴────────────┴──────────────────────────┘
```

---

## 3. Key Test Suites & Coverage

### 3.1 Timeline Store (`src/stores/timelineStore.test.ts`)
- Tests track addition, deletion, and reordering.
- Tests multi-clip razor splitting at playhead boundaries.
- Tests timecode snapping, ripple deletions, and marker toggling.
- Tests temporal undo/redo state restoration.

### 3.2 AI Quality Checker (`src/ai/quality/checker.test.ts`)
Validates 12 deterministic rules for video quality:
1. Detects empty timelines.
2. Identifies accidental clip overlaps on the same track.
3. Flags unintentional dead-air gaps between clips.
4. Identifies static shots exceeding 15 seconds without cuts/motion.
5. Verifies presence of audio voiceover on video tracks.
6. Evaluates hook effectiveness (first 3 seconds).
7. Validates outro / CTA presence.

### 3.3 React AST Hook Verification (`src/hooks/rulesOfHooks.test.ts`)
- Parses all `.tsx` and `.ts` files in `src/` using the TypeScript AST parser.
- Asserts that no `use*` React hooks are invoked inside `if` statements, `for`/`while` loops, or nested callback closures.

---

## 4. Test Execution Commands

```bash
# Run all unit tests once
npm test

# Run tests in watch mode during development
npx vitest

# Run a specific test suite
npx vitest src/stores/timelineStore.test.ts

# Run AST hook validation script directly
npm run check:hooks
```

---

## 5. CI / CD Pipeline Integration

In GitHub Actions or CI runners:
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```
