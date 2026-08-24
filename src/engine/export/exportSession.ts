/**
 * Global signal marking an export render in progress.
 *
 * The preview playback loop checks this and pauses itself so the compositor,
 * video decoders and hardware encoder are not competing for CPU/GPU while a
 * frame-accurate export is running (a major contributor to 100% CPU usage
 * and out-of-memory crashes during export).
 */

let active = false

export function isExportActive(): boolean {
  return active
}

export function setExportActive(value: boolean): void {
  active = value
}
