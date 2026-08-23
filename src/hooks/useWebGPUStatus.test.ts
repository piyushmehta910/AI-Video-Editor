import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectWebGPU } from './useWebGPUStatus'

type AdapterOverrides = {
  info?: Record<string, string>
  requestAdapterInfo?: () => Promise<Record<string, string>>
  fail?: boolean
  returnNull?: boolean
}

function stubGpu(overrides: AdapterOverrides | null) {
  const adapter = overrides
    ? {
        info: overrides.info,
        requestAdapterInfo: overrides.requestAdapterInfo,
        requestDevice: async () => {
          if (overrides.fail) throw new Error('device lost')
          return {}
        },
      }
    : undefined
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    gpu: overrides
      ? {
          requestAdapter: async () => {
            if (overrides.fail) throw new Error('adapter probe failed')
            if (overrides.returnNull) return null
            return adapter
          },
        }
      : undefined,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectWebGPU', () => {
  it('reports unsupported when navigator.gpu is missing (Firefox/mobile)', async () => {
    stubGpu(null)
    const result = await detectWebGPU()
    expect(result.status).toBe('unsupported')
    expect(result.details).toBeNull()
  })

  it('reports fallback when the API exists but no adapter is granted', async () => {
    stubGpu({ returnNull: true })
    const result = await detectWebGPU()
    expect(result.status).toBe('fallback')
    expect(result.details).toBeNull()
  })

  it('reports ready with adapter details when a GPU is granted', async () => {
    stubGpu({
      info: { vendor: 'nvidia', architecture: 'ampere', device: '4070', description: 'NVIDIA RTX 4070' },
    })
    const result = await detectWebGPU()
    expect(result.status).toBe('ready')
    expect(result.details).toEqual({
      vendor: 'nvidia',
      architecture: 'ampere',
      device: '4070',
      description: 'NVIDIA RTX 4070',
    })
  })

  it('falls back to requestAdapterInfo() when adapter.info is absent', async () => {
    stubGpu({ requestAdapterInfo: async () => ({ vendor: 'intel' }) })
    const result = await detectWebGPU()
    expect(result.status).toBe('ready')
    expect(result.details?.vendor).toBe('intel')
  })

  it('reports error when the adapter request throws', async () => {
    stubGpu({ fail: true })
    const result = await detectWebGPU()
    expect(result.status).toBe('error')
    expect(result.details).toBeNull()
  })
})
