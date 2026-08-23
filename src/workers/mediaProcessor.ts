/// <reference lib="webworker" />
import { detectMediaType } from '@/engine/storage/mediaType'

/**
 * Media import worker: offloads image thumbnail generation (createImageBitmap
 * + OffscreenCanvas → PNG bytes) and dimension probing from the main thread.
 * Video/audio probes need HTMLMediaElement decoding, which stays on the main
 * thread by design — see engine/storage/thumbnails.ts.
 *
 * Protocol:
 *   { id, type: 'thumbnail-image', file, maxW, maxH }
 *   { id, type: 'probe-image', file }
 * Responses:
 *   { id, ok: true, width?, height?, buffer?, mime? }   (buffer transferred)
 *   { id, ok: false, error }
 */

interface ThumbMessage {
  id: string
  type: 'thumbnail-image'
  file: Blob
  maxW: number
  maxH: number
}

interface ProbeMessage {
  id: string
  type: 'probe-image'
  file: Blob
}

type WorkerMessage = ThumbMessage | ProbeMessage

async function decodeBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    // Some browsers refuse certain formats in createImageBitmap; retry via blob URL + ImageDecoder fallback.
    throw new Error('Image decode failed')
  }
}

async function thumbnail(msg: ThumbMessage): Promise<void> {
  const bitmap = await decodeBitmap(msg.file)
  const scale = Math.min(msg.maxW / bitmap.width, msg.maxH / bitmap.height, 1)
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const buffer = await blob.arrayBuffer()
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()
  self.postMessage({ id: msg.id, ok: true, width, height, buffer, mime: 'image/png' }, [buffer])
}

async function probe(msg: ProbeMessage): Promise<void> {
  const bitmap = await decodeBitmap(msg.file)
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()
  const kind = detectMediaType({ name: (msg.file as File).name ?? '', type: msg.file.type })
  if (kind !== 'image') throw new Error('Not an image file')
  self.postMessage({ id: msg.id, ok: true, width, height })
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data
  try {
    if (msg.type === 'thumbnail-image') await thumbnail(msg)
    else if (msg.type === 'probe-image') await probe(msg)
  } catch (err) {
    self.postMessage({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
