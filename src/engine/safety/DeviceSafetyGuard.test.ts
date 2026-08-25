import { describe, it, expect } from 'vitest'
import { DeviceSafetyGuard, deviceSafetyGuard } from './DeviceSafetyGuard'

describe('DeviceSafetyGuard', () => {
  it('instantiates singleton correctly', () => {
    const instance = DeviceSafetyGuard.getInstance()
    expect(instance).toBeDefined()
    expect(deviceSafetyGuard).toBe(instance)
  })

  it('retrieves real-time memory and hardware metrics safely', () => {
    const metrics = deviceSafetyGuard.getMemoryMetrics()
    expect(metrics).toBeDefined()
    expect(typeof metrics.hardwareConcurrency).toBe('number')
    expect(metrics.hardwareConcurrency).toBeGreaterThan(0)
    expect(['normal', 'moderate', 'critical']).toContain(metrics.pressureLevel)
  })

  it('calculates safe encoder queue headroom', () => {
    const queue = deviceSafetyGuard.getMaxEncoderQueue()
    expect(typeof queue).toBe('number')
    expect(queue).toBeGreaterThanOrEqual(1)
    expect(queue).toBeLessThanOrEqual(4)
  })

  it('performs adaptive yield without throwing', async () => {
    await expect(deviceSafetyGuard.adaptiveYield(0)).resolves.toBeUndefined()
    await expect(deviceSafetyGuard.adaptiveYield(10, true)).resolves.toBeUndefined()
  })

  it('evicts unused media elements safely without throwing', () => {
    const map = new Map<string, any>()
    const mockEl = {
      pause: () => {},
      removeAttribute: () => {},
      load: () => {},
    }
    map.set('asset-1', mockEl)
    map.set('asset-2', mockEl)

    const activeSet = new Set(['asset-1'])
    deviceSafetyGuard.evictUnusedMediaElements(map, activeSet)

    expect(map.has('asset-1')).toBe(true)
    expect(map.has('asset-2')).toBe(false)
  })
})
