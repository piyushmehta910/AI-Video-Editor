import { WebMMuxer } from '@/engine/export/webm-muxer'

export interface MotionRenderOptions {
  /** Generated animation code: defines window.__ANIMATE(ctx, t, w, h) and optionally __INIT(ctx, w, h). */
  code: string
  width: number
  height: number
  fps: number
  duration: number
  codec?: 'vp8' | 'vp9' | 'av1'
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface MotionRenderResult {
  blob: Blob
  frames: number
}

const META_CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; frame-src \'none\'; font-src \'none\'; media-src \'none\';">'

/**
 * The fixed sandbox harness. Generated animation code is injected into the
 * `__CODE__` slot below as a second inline <script>. Everything runs inside an
 * opaque-origin iframe (`sandbox="allow-scripts"`, NO allow-same-origin), so
 * the generated JS cannot touch the parent document, localStorage, cookies or
 * any network (CSP additionally forbids connect/frame/font/media sources and
 * only allows data:/blob: images). It can only draw on its own OffscreenCanvas
 * and send ImageBitmaps to the parent via postMessage. The parent never
 * evaluates the generated JS itself.
 *
 * The harness supports async __ANIMATE: if it returns a Promise, the frame is
 * only captured after it resolves (used by slide rendering to wait for an
 * <img> to decode before painting).
 */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">${META_CSP}</head><body><script>
(function () {
  var W = __W__, H = __H__;
  var canvas = null, ctx = null;
  var toParent = function (msg) { parent.postMessage(msg, '*'); };
  function ensure() {
    if (canvas) return;
    canvas = new OffscreenCanvas(W, H);
    ctx = canvas.getContext('2d');
    if (typeof window.__INIT === 'function') {
      try { window.__INIT(ctx, W, H); } catch (e) {
        toParent({ type: 'error', message: String(e && e.stack || e) });
      }
    }
  }
  function capture(t) {
    if (!ctx) return;
    createImageBitmap(canvas).then(function (bmp) {
      toParent({ type: 'frame', t: t, bitmap: bmp });
    }, function (err) {
      toParent({ type: 'error', message: String(err) });
    });
  }
  self.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.type !== 'frame') return;
    try {
      ensure();
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.clearRect(0, 0, W, H);
      if (typeof window.__ANIMATE === 'function') {
        var r = window.__ANIMATE(ctx, d.t, W, H);
        if (r && typeof r.then === 'function') r.then(function () { capture(d.t); }, function (e) {
          toParent({ type: 'error', message: String(e && e.stack || e) });
        });
        else capture(d.t);
      } else {
        capture(d.t);
      }
    } catch (e) {
      toParent({ type: 'error', message: String(e && e.stack || e) });
    }
  });
  toParent({ type: 'ready' });
})();
${'</scr' + 'ipt>'}<script>
__CODE__
${'</scr' + 'ipt>'}</body></html>`

function buildSrcDoc(code: string, width: number, height: number): string {
  // Escape a closing script tag so generated code cannot break out of the
  // srcdoc script element (it can only ever appear in a string literal).
  const safeCode = code.replace(/<\/script/gi, '<\\/script')
  return HARNESS.replace('__W__', String(width)).replace('__H__', String(height)).replace('__CODE__', safeCode)
}

interface FrameSource {
  ready: Promise<void>
  frame: (t: number) => Promise<ImageBitmap>
  dispose: () => void
}

function createFrameSource(iframe: HTMLIFrameElement): FrameSource {
  let readyResolve: () => void
  const ready = new Promise<void>((res) => {
    readyResolve = res
  })
  let pending: { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void } | null = null

  const onMessage = (ev: MessageEvent) => {
    // Opaque-origin frames report origin "null". Never trust any other sender.
    if (ev.origin !== 'null') return
    const d = ev.data as { type?: string; t?: number; bitmap?: ImageBitmap; message?: string } | null
    if (!d || typeof d !== 'object') return
    if (d.type === 'ready') {
      readyResolve()
      return
    }
    if (d.type === 'error') {
      const p = pending
      pending = null
      p?.reject(new Error(d.message ?? 'sandbox render error'))
      return
    }
    if (d.type === 'frame' && pending && d.bitmap) {
      const p = pending
      pending = null
      p.resolve(d.bitmap)
    }
  }

  window.addEventListener('message', onMessage)

  return {
    ready,
    frame(t) {
      if (pending) return Promise.reject(new Error('concurrent sandbox frame request'))
      return new Promise<ImageBitmap>((resolve, reject) => {
        pending = { resolve, reject }
        iframe.contentWindow?.postMessage({ type: 'frame', t }, '*')
      })
    },
    dispose() {
      window.removeEventListener('message', onMessage)
    },
  }
}

async function codecString(): Promise<'vp8' | 'vp9' | 'av1'> {
  for (const codec of ['vp9', 'vp8', 'av1'] as const) {
    try {
      const support = await VideoEncoder.isConfigSupported({ codec: codecConfig(codec), width: 64, height: 64 })
      if (support.supported) return codec
    } catch {
      // try next
    }
  }
  return 'vp8'
}

function codecConfig(codec: 'vp8' | 'vp9' | 'av1'): string {
  switch (codec) {
    case 'vp8':
      return 'vp8'
    case 'vp9':
      return 'vp09.00.10.08'
    case 'av1':
      return 'av01.0.04M.08'
  }
}

/**
 * Boot a fresh sandboxed iframe running `code` and return a frame source that
 * can request deterministic frames. Each call gets its own opaque-origin
 * iframe so successive generations never share state. The returned source
 * owns the iframe: `dispose()` removes both the message listener and the
 * iframe so repeated renders never accumulate hidden frames in the DOM.
 */
async function bootSandbox(code: string, width: number, height: number): Promise<FrameSource> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.srcdoc = buildSrcDoc(code, width, height)
  document.body.appendChild(iframe)

  const source = createFrameSource(iframe)
  await Promise.race([
    source.ready,
    new Promise<void>((_, rej) => setTimeout(() => rej(new Error('Sandbox iframe did not become ready (srcdoc script blocked?)')), 15_000)),
  ])
  const baseDispose = source.dispose.bind(source)
  source.dispose = () => {
    baseDispose()
    iframe.remove()
  }
  return source
}

/**
 * Render a generated animation to a WebM video clip.
 *
 * Security: the `code` string is embedded ONLY into the srcdoc of a sandboxed
 * iframe (opaque origin, `allow-scripts` only, strict CSP). It is never
 * eval'd, never injected into the parent document, and cannot reach the
 * network, storage or the parent window. Each frame is drawn by the generated
 * `__ANIMATE` into an OffscreenCanvas inside that iframe and the resulting
 * ImageBitmap is transferred back to the trusted parent, which encodes it with
 * WebCodecs into a normal WebM clip.
 */
export async function renderMotionClip(opts: MotionRenderOptions): Promise<MotionRenderResult> {
  const { code, width, height, fps, duration, signal } = opts
  if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs VideoEncoder is not supported in this browser')
  if (width <= 0 || height <= 0 || duration <= 0) throw new Error('Invalid render dimensions or duration')

  const source = await bootSandbox(code, width, height)
  let muxer: WebMMuxer | null = null
  let encoder: VideoEncoder | null = null
  try {
    if (signal?.aborted) throw new DOMException('Render aborted', 'AbortError')

    const codec = opts.codec ?? (await codecString())
    muxer = new WebMMuxer({ width, height, duration, codec })
    encoder = new VideoEncoder({
      output: (chunk) => {
        muxer?.addChunk({ data: new Uint8Array(chunk.byteLength), timestamp: chunk.timestamp / 1000, isKey: chunk.type === 'key' })
      },
      error: (e) => {
        throw e
      },
    })
    const encoderConfig: VideoEncoderConfig = {
      codec: codecConfig(codec),
      width,
      height,
      bitrate: 8_000_000,
      framerate: fps,
    }
    const support = await VideoEncoder.isConfigSupported(encoderConfig)
    if (!support.supported) {
      encoderConfig.bitrate = undefined
      encoderConfig.framerate = undefined
      await VideoEncoder.isConfigSupported(encoderConfig)
    }
    encoder.configure(encoderConfig)

    const total = Math.max(1, Math.round(duration * fps))
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('Render aborted', 'AbortError')
      const t = Math.min(i / fps, duration)
      const bitmap = await Promise.race([
        source.frame(t),
        new Promise<ImageBitmap>((_, rej) => setTimeout(() => rej(new Error('Sandbox frame timed out')), 15_000)),
      ])
      const frame = new VideoFrame(bitmap, { timestamp: Math.round(t * 1_000_000) })
      encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(fps * 2)) === 0 })
      frame.close()
      bitmap.close()
      opts.onProgress?.(i + 1, total)
      if (i % 16 === 0) await sleep(0)
    }

    await encoder.flush()
    encoder.close()
    encoder = null
    return { blob: muxer.finalize(), frames: total }
  } finally {
    source.dispose()
    encoder?.close()
  }
}

/**
 * Render a self-contained HTML/CSS string to a single PNG image via the
 * sandbox. Used for static slide frames. The html must be inline-styled and
 * XML-valid (no raw `&`, `<`, `>` in text) and must not reference external
 * resources. It is rasterized through an SVG <foreignObject> <img> inside the
 * sandbox, so scripts/network in the HTML are inert.
 */
export async function renderHtmlToPng(
  html: string,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const xmlSafe = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const code = `
window.__INIT = function (ctx, w, h) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%">' + ${JSON.stringify(xmlSafe)} + '</foreignObject></svg>';
  var img = new Image();
  img.onload = function () { window.__IMG = img; };
  img.onerror = function () { window.__IMG_FAILED = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
window.__ANIMATE = function (ctx, t, w, h) {
  return new Promise(function (res) {
    var tick = function () {
      if (window.__IMG) { ctx.clearRect(0, 0, w, h); ctx.drawImage(window.__IMG, 0, 0, w, h); res(); }
      else if (window.__IMG_FAILED) { ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, w, h); res(); }
      else setTimeout(tick, 25);
    };
    tick();
  });
};`
  const source = await bootSandbox(code, width, height)
  try {
    if (signal?.aborted) throw new DOMException('Render aborted', 'AbortError')
    const bitmap = await Promise.race([
      source.frame(0),
      new Promise<ImageBitmap>((_, rej) => setTimeout(() => rej(new Error('Sandbox frame timed out')), 15_000)),
    ])
    try {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context unavailable')
      ctx.drawImage(bitmap, 0, 0, width, height)
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png')
      })
    } finally {
      bitmap.close()
    }
  } finally {
    source.dispose()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}