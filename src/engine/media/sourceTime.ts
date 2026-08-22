/**
 * Resolve a clip's source time into the media's own timeline.
 *
 * Clips may extend beyond their source duration (sticker/GIF clips are
 * typically 1–3s but users stretch them). Instead of freezing on the last
 * frame, short sources LOOP: the time wraps modulo the media duration.
 * Shared by the live preview and the export pipeline so both stay in sync.
 */
export function wrapSourceTime(srcTime: number, duration: number | undefined): number {
  if (!duration || !isFinite(duration) || duration <= 0.05) return Math.max(0, srcTime)
  const max = duration - 0.02 // keep seeks inside the decodable range
  if (srcTime <= max) return Math.max(0, srcTime)
  const wrapped = ((srcTime % max) + max) % max
  return Math.min(wrapped, max)
}
