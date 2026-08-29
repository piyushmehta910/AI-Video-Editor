/**
 * Global signal marking an export render in progress.
 *
 * The preview playback loop checks this and pauses itself so the compositor,
 * video decoders and hardware encoder are not competing for CPU/GPU while a
 * frame-accurate export is running (a major contributor to 100% CPU usage
 * and out-of-memory crashes during export).
 *
 * Reference-counted so overlapping exports (user + LLM render_preview) keep
 * the preview paused until the LAST one finishes.
 */

let refCount = 0

export function isExportActive(): boolean {
  return refCount > 0
}

/** Begin an export session. Returns a release function — call it exactly once. */
export function beginExportSession(): () => void {
  refCount++
  let released = false
  return () => {
    if (released) return
    released = true
    refCount = Math.max(0, refCount - 1)
  }
}

/** Legacy imperative toggle — prefer beginExportSession() for new code. */
export function setExportActive(value: boolean): void {
  refCount = value ? Math.max(1, refCount) : 0
}
