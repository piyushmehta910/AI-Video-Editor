export interface WebCodecsSupport {
  videoEncoder: boolean
  videoDecoder: boolean
  audioEncoder: boolean
  audioDecoder: boolean
}

export interface EngineCapabilities {
  /** WebCodecs presence. Video encode+decode are the hard requirement for full functionality. */
  webCodecs: WebCodecsSupport
  /** True when both video encoder and decoder are present. */
  webCodecsVideo: boolean
  /** WebGPU adapter request succeeded. Missing → preview falls back to Canvas2D / WebGL2. */
  webgpu: boolean
  /** GPU adapter description, when available. */
  webgpuRenderer: string | null
  /** Origin Private File System (fast local media storage). */
  opfs: boolean
  /** EditContext (Chromium-only; polyfill covers other browsers). */
  editContext: boolean
  /** Web Audio API for mixing. */
  webAudio: boolean
  /** Dedicated workers available (needed for decode/render/encode/AI off main thread). */
  webWorkers: boolean
  hardwareConcurrency: number
  userAgent: string
}

function readWebCodecs(): WebCodecsSupport {
  return {
    videoEncoder: typeof globalThis.VideoEncoder !== 'undefined',
    videoDecoder: typeof globalThis.VideoDecoder !== 'undefined',
    audioEncoder: typeof globalThis.AudioEncoder !== 'undefined',
    audioDecoder: typeof globalThis.AudioDecoder !== 'undefined',
  }
}

async function readWebgpu(): Promise<{ supported: boolean; renderer: string | null }> {
  const gpu = globalThis.navigator?.gpu
  if (!gpu) return { supported: false, renderer: null }
  try {
    const adapter = await gpu.requestAdapter()
    if (!adapter) return { supported: false, renderer: null }
    const info = adapter.info
    return {
      supported: true,
      renderer: info?.description || info?.vendor || null,
    }
  } catch {
    return { supported: false, renderer: null }
  }
}

function readSync(): Omit<EngineCapabilities, 'webgpu' | 'webgpuRenderer'> {
  const storage = globalThis.navigator?.storage
  return {
    webCodecs: readWebCodecs(),
    webCodecsVideo:
      typeof globalThis.VideoEncoder !== 'undefined' && typeof globalThis.VideoDecoder !== 'undefined',
    opfs: typeof storage?.getDirectory === 'function',
    editContext: 'EditContext' in (globalThis as Record<string, unknown>),
    webAudio:
      typeof globalThis.AudioContext !== 'undefined' ||
      typeof (globalThis as Record<string, unknown>)['webkitAudioContext'] !== 'undefined',
    webWorkers: typeof globalThis.Worker !== 'undefined',
    hardwareConcurrency: globalThis.navigator?.hardwareConcurrency ?? 0,
    userAgent: globalThis.navigator?.userAgent ?? '',
  }
}

/**
 * Detect engine capabilities. Never throws — every capability is optional and
 * the app must degrade gracefully when any of them are missing.
 */
export async function detectCapabilities(): Promise<EngineCapabilities> {
  const sync = readSync()
  const gpu = await readWebgpu()
  return { ...sync, webgpu: gpu.supported, webgpuRenderer: gpu.renderer }
}

let cached: EngineCapabilities | null = null
let pending: Promise<EngineCapabilities> | null = null

/** Memoized detection, shared across callers. */
export function getCapabilities(): Promise<EngineCapabilities> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = detectCapabilities().then((caps) => {
      cached = caps
      return caps
    })
  }
  return pending
}