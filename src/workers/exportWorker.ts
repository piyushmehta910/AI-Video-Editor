/// <reference lib="webworker" />
import { buildZip, frameFileName } from '@/lib/exportZip'

/**
 * Export worker: offloads PNG frame encoding (OffscreenCanvas.convertToBlob)
 * and ZIP assembly from the main thread so the UI stays responsive while
 * large frame sequences render.
 *
 * Protocol (postMessage):
 *   { id, type: 'png', index, bitmap: ImageBitmap | ImageData-like, width, height }
 *   { id, type: 'finish' }
 * Responses:
 *   { id, type: 'png-done', index }
 *   { id, type: 'zip', buffer: ArrayBuffer }   (transferred)
 *   { id, type: 'error', message }
 */

interface PngMessage {
  id: string
  type: 'png'
  index: number
  bitmap?: ImageBitmap
  imageData?: ImageData
  width: number
  height: number
}

interface FinishMessage {
  id: string
  type: 'finish'
}

type WorkerMessage = PngMessage | FinishMessage

const pending = new Map<number, Uint8Array>()

async function encodePng(msg: PngMessage): Promise<void> {
  const canvas = new OffscreenCanvas(msg.width, msg.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2D unavailable')
  if (msg.bitmap) {
    ctx.drawImage(msg.bitmap, 0, 0)
    msg.bitmap.close()
  } else if (msg.imageData) {
    ctx.putImageData(msg.imageData, 0, 0)
  } else {
    throw new Error('No frame payload')
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  pending.set(msg.index, bytes)
  self.postMessage({ id: msg.id, type: 'png-done', index: msg.index })
}

function finishZip(msg: FinishMessage): void {
  const entries = [...pending.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, data]) => ({ name: frameFileName(index), data }))
  const zip = buildZip(entries)
  pending.clear()
  const buffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength)
  self.postMessage({ id: msg.id, type: 'zip', buffer }, [buffer])
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data
  try {
    if (msg.type === 'png') {
      await encodePng(msg)
    } else if (msg.type === 'finish') {
      finishZip(msg)
    }
  } catch (err) {
    self.postMessage({
      id: msg.id,
      type: 'error',
      message: err instanceof Error ? err.message : 'Frame encoding failed',
    })
  }
}
