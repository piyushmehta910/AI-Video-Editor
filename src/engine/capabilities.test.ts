import { afterEach, describe, expect, it } from 'vitest'
import { detectCapabilities } from './capabilities'

interface StubNavigator {
  gpu?: { requestAdapter: () => Promise<{ info?: { description?: string; vendor?: string } } | null> }
  storage?: { getDirectory: () => Promise<unknown> }
  hardwareConcurrency?: number
  userAgent?: string
}

const originalGlobals = new Map<string, PropertyDescriptor>()

function stubGlobal(name: string, value: unknown) {
  if (!originalGlobals.has(name)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name) ?? {})
  }
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

function stubNavigator(nav: StubNavigator) {
  stubGlobal(
    'navigator',
    new Proxy(nav as object, {
      get(target, prop) {
        if (prop === 'hardwareConcurrency' && !('hardwareConcurrency' in target)) return 8
        if (prop === 'userAgent' && !('userAgent' in target)) return 'stub-browser'
        return Reflect.get(target, prop)
      },
    }),
  )
}

afterEach(() => {
  for (const [name, desc] of originalGlobals) {
    if (desc) Object.defineProperty(globalThis, name, desc)
    else delete (globalThis as Record<string, unknown>)[name]
  }
  originalGlobals.clear()
})

describe('detectCapabilities', () => {
  it('reports no capabilities when the globals are absent', async () => {
    stubNavigator({})
    const caps = await detectCapabilities()
    expect(caps.webCodecsVideo).toBe(false)
    expect(caps.webCodecs.audioEncoder).toBe(false)
    expect(caps.webgpu).toBe(false)
    expect(caps.opfs).toBe(false)
    expect(caps.editContext).toBe(false)
    expect(caps.webAudio).toBe(false)
    expect(caps.webWorkers).toBe(false)
  })

  it('detects WebCodecs from global constructors', async () => {
    class VideoEncoder {}
    class VideoDecoder {}
    class AudioEncoder {}
    stubGlobal('VideoEncoder', VideoEncoder)
    stubGlobal('VideoDecoder', VideoDecoder)
    stubGlobal('AudioEncoder', AudioEncoder)
    stubNavigator({})
    const caps = await detectCapabilities()
    expect(caps.webCodecsVideo).toBe(true)
    expect(caps.webCodecs.audioEncoder).toBe(true)
    expect(caps.webCodecs.audioDecoder).toBe(false)
  })

  it('detects WebGPU via a successful adapter request and reads the renderer', async () => {
    stubNavigator({
      gpu: {
        requestAdapter: async () => ({ info: { description: 'SwiftShader', vendor: 'Google' } }),
      },
    })
    const caps = await detectCapabilities()
    expect(caps.webgpu).toBe(true)
    expect(caps.webgpuRenderer).toBe('SwiftShader')
  })

  it('handles a rejected adapter request without throwing', async () => {
    stubNavigator({
      gpu: {
        requestAdapter: async () => {
          throw new Error('boom')
        },
      },
    })
    const caps = await detectCapabilities()
    expect(caps.webgpu).toBe(false)
    expect(caps.webgpuRenderer).toBeNull()
  })

  it('detects OPFS and EditContext', async () => {
    stubNavigator({ storage: { getDirectory: async () => ({}) } })
    stubGlobal('EditContext', class EditContext {})
    const caps = await detectCapabilities()
    expect(caps.opfs).toBe(true)
    expect(caps.editContext).toBe(true)
  })

  it('detects Web Audio and reports hardware concurrency', async () => {
    stubGlobal('AudioContext', class AudioContext {})
    stubNavigator({ hardwareConcurrency: 12, userAgent: 'test-agent' })
    const caps = await detectCapabilities()
    expect(caps.webAudio).toBe(true)
    expect(caps.hardwareConcurrency).toBe(12)
    expect(caps.userAgent).toBe('test-agent')
  })
})