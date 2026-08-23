# Coding Standards & Engineering Rules: ClipForge AI Studio

## 1. TypeScript & Type Safety Principles

1. **Zero `any` Policy**:
   - The use of `any` is strictly prohibited in the codebase.
   - Use `unknown` with runtime type narrowing or generic type variables (`<T>`).
2. **Strict Null Checks & Union Exhaustiveness**:
   - Always handle `null` and `undefined` explicitly.
   - In `switch` statements over union types (e.g. `TrackType`, `EffectType`), include an exhaustive `default` check using `never`:
     ```typescript
     function handleTrack(type: TrackType): void {
       switch (type) {
         case 'video': return handleVideo()
         case 'audio': return handleAudio()
         case 'text':  return handleText()
         case 'fx':    return handleFx()
         default: {
           const _exhaustiveCheck: never = type
           throw new Error(`Unhandled track type: ${_exhaustiveCheck}`)
         }
       }
     }
     ```
3. **Explicit Interface Contracts**:
   - Shared data models across engines and stores must reside in `src/engine/types.ts`.

---

## 2. React 19 Standards & Hook Rules

1. **Strict Rules of Hooks**:
   - Hooks must never be called conditionally, inside loops, or nested inside callbacks.
   - All components are verified via automated AST test (`src/hooks/rulesOfHooks.test.ts`).
2. **Fast Refresh Cleanliness**:
   - Component files must export only React components.
   - Utility functions, constants, or types must be placed in separate helper files to preserve Vite Fast Refresh HMR state.
3. **Memoization & Dependency Arrays**:
   - Custom hooks must have complete, accurate `useMemo` and `useCallback` dependency arrays.
   - Avoid creating new object references in Zustand selectors. Use selector granularity:
     ```typescript
     // GOOD: Subscribes only to playhead time changes
     const currentTime = useTimelineStore((s) => s.currentTime)

     // BAD: Re-renders on any store state change
     const store = useTimelineStore()
     ```

---

## 3. State Management & Temporal History Rules

1. **Zustand with Immer**:
   - Complex nested state updates must use Immer recipes to guarantee immutability.
2. **History Grouping for Continuous Interactions**:
   - Continuous user actions (e.g., scrubbing sliders, dragging timeline clips, resizing handles) must be wrapped in `beginHistoryGroup()` at `onPointerDown` and `endHistoryGroup()` at `onPointerUp`.
   - This ensures that a single user gesture corresponds to exactly one entry on the undo stack.
3. **Action Atomicity**:
   - Do not perform side effects (such as direct DOM mutation or network calls) inside store reducer actions. Store actions should remain pure state mutations.

---

## 4. Deterministic Progress & Async Execution

1. **No Fake Progress Bars**:
   - Never use `setInterval` with artificial incremental progress counters or simulated loading delays.
   - Progress indicators must reflect real frame counts, decoded chunks, or actual bytes processed:
     ```typescript
     // GOOD: Real frame progress
     onProgress?.(currentFrame / totalFrames)

     // FORBIDDEN: Fake percentage ticker
     // setInterval(() => setProgress(p => p + 5), 200)
     ```
2. **Cancellation & Abort Signals**:
   - Long-running async processes (e.g. video rendering, Whisper transcription, network searches) must accept an `AbortSignal` to allow instant cancellation.

---

## 5. File Structure & Path Aliasing

- Always use the `@/` path alias pointing to `src/`:
  - `import { useTimelineStore } from '@/stores/timelineStore'`
  - `import { compositeFrame } from '@/engine/render/composite'`
- Group by architectural role:
  - `src/engine/`: Pure media processing engines, encoders, workers, and algorithms (zero UI dependencies).
  - `src/stores/`: Zustand state stores and business logic.
  - `src/components/`: Reusable, modular UI components and inspector sections.
  - `src/ui/`: Major workspace panels (Timeline, Preview, MediaBrowser, AIDirector).
  - `src/hooks/`: React lifecycle hooks connecting stores to the DOM/APIs.
