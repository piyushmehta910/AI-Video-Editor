/// <reference lib="webworker" />

/**
 * Sandboxed motion-graphics preview renderer.
 *
 * AI-generated / user-typed motion code (`__INIT` / `__ANIMATE`) is compiled
 * and executed INSIDE this Web Worker — never on the main thread. Workers have
 * no DOM, no localStorage, no cookies and no window access, so untrusted code
 * cannot touch page data or hijack the app (unlike `new Function` on the main
 * thread).
 *
 * Protocol (ping-pong ownership of one OffscreenCanvas):
 *   main → worker : { canvas, code, t, width, height, needInit }  (canvas transferred)
 *   worker → main : { ok, canvas, message? }                      (canvas transferred back)
 */

interface MotionFns {
  init: ((ctx: OffscreenCanvasRenderingContext2D, w: number, h: number) => void) | null
  animate: ((ctx: OffscreenCanvasRenderingContext2D, t: number, w: number, h: number) => void) | null
}

let cachedCode: string | null = null
let cachedFns: MotionFns = { init: null, animate: null }

function compile(code: string): MotionFns {
  if (cachedCode === code) return cachedFns
  cachedCode = code
  const scope = new Function('window', code) as (w: unknown) => Record<string, unknown>
  const fakeWindow: Record<string, unknown> = {}
  scope(fakeWindow)
  cachedFns = {
    init: typeof fakeWindow.__INIT === 'function' ? (fakeWindow.__INIT as MotionFns['init']) : null,
    animate:
      typeof fakeWindow.__ANIMATE === 'function'
        ? (fakeWindow.__ANIMATE as MotionFns['animate'])
        : null,
  }
  return cachedFns
}

self.onmessage = (ev: MessageEvent) => {
  const { canvas, code, t, width, height, needInit } = ev.data as {
    canvas: OffscreenCanvas
    code: string
    t: number
    width: number
    height: number
    needInit: boolean
  }
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null
  if (!ctx) {
    ;(self as unknown as Worker).postMessage({ ok: false, canvas, message: '2D context unavailable' }, [canvas])
    return
  }
  try {
    const fns = compile(code)
    if (needInit && fns.init) fns.init(ctx, width, height)
    ctx.clearRect(0, 0, width, height)
    if (fns.animate) fns.animate(ctx, t, width, height)
    ;(self as unknown as Worker).postMessage({ ok: true, canvas }, [canvas])
  } catch (err) {
    // Compile/runtime errors are reported back; the canvas still returns so
    // the ping-pong ownership chain is never broken.
    ;(self as unknown as Worker).postMessage({ ok: false, canvas, message: String(err) }, [canvas])
  }
}
