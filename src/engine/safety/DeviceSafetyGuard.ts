/**
 * Device Safety & Resource Guard
 * Protects user devices against 100% CPU lockup, memory exhaustion,
 * thermal throttling, and browser tab freezes during heavy operations
 * (video export, motion rendering, lipsync synthesis, canvas composition).
 */

export interface DeviceMemoryMetrics {
  usedJSHeapMb?: number
  totalJSHeapMb?: number
  jsHeapLimitMb?: number
  deviceMemoryGb?: number
  hardwareConcurrency: number
  pressureLevel: 'normal' | 'moderate' | 'critical'
}

export class DeviceSafetyGuard {
  private static instance: DeviceSafetyGuard | null = null
  private lastYieldTime = 0

  public static getInstance(): DeviceSafetyGuard {
    if (!DeviceSafetyGuard.instance) {
      DeviceSafetyGuard.instance = new DeviceSafetyGuard()
    }
    return DeviceSafetyGuard.instance
  }

  /**
   * Reads real-time hardware capacity and JS heap metrics.
   */
  public getMemoryMetrics(): DeviceMemoryMetrics {
    const nav = typeof navigator !== 'undefined' ? navigator : null
    const perf = typeof performance !== 'undefined' ? performance : null
    const memory = (perf as any)?.memory

    const usedJSHeapMb = memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : undefined
    const totalJSHeapMb = memory?.totalJSHeapSize ? Math.round(memory.totalJSHeapSize / (1024 * 1024)) : undefined
    const jsHeapLimitMb = memory?.jsHeapSizeLimit ? Math.round(memory.jsHeapSizeLimit / (1024 * 1024)) : undefined

    const deviceMemoryGb = (nav as any)?.deviceMemory
    const hardwareConcurrency = nav?.hardwareConcurrency || 4

    let pressureLevel: 'normal' | 'moderate' | 'critical' = 'normal'

    if (usedJSHeapMb && jsHeapLimitMb) {
      const ratio = usedJSHeapMb / jsHeapLimitMb
      if (ratio > 0.85) {
        pressureLevel = 'critical'
      } else if (ratio > 0.65) {
        pressureLevel = 'moderate'
      }
    } else if (deviceMemoryGb && deviceMemoryGb <= 2) {
      pressureLevel = 'moderate'
    }

    return {
      usedJSHeapMb,
      totalJSHeapMb,
      jsHeapLimitMb,
      deviceMemoryGb,
      hardwareConcurrency,
      pressureLevel,
    }
  }

  /**
   * Calculates dynamic queue headroom for hardware video encoders.
   * Under high memory pressure, drops the in-flight frame queue to prevent RAM bloat.
   */
  public getMaxEncoderQueue(): number {
    const metrics = this.getMemoryMetrics()
    if (metrics.pressureLevel === 'critical') return 1
    if (metrics.pressureLevel === 'moderate' || metrics.hardwareConcurrency <= 4) return 2
    return 4
  }

  /**
   * Cooperative adaptive CPU breather:
   * Prevents browser UI thread freeze, thermal fan spike, and CPU lockups.
   * Dynamically yields control to the browser microtask/macrotask queue.
   */
  public async adaptiveYield(frameIndex: number, forcedBreather = false): Promise<void> {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const metrics = this.getMemoryMetrics()

    // Determine interval based on device capabilities
    const cadence =
      metrics.pressureLevel === 'critical' ? 4 : metrics.pressureLevel === 'moderate' || metrics.hardwareConcurrency <= 4 ? 6 : 10

    const isCadence = frameIndex > 0 && frameIndex % cadence === 0
    const isElapsed = this.lastYieldTime > 0 && now - this.lastYieldTime > 100 // Never block event loop > 100ms

    if (forcedBreather || isCadence || isElapsed) {
      // Breather duration: 4ms to 16ms under pressure to allow GC & compositor to catch up
      const delayMs = metrics.pressureLevel === 'critical' ? 16 : metrics.pressureLevel === 'moderate' ? 8 : 4
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
      this.lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
    } else {
      // Fast zero-delay macro-yield
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  /**
   * Safely evicts and releases HTMLVideoElements that are no longer needed
   * during long export loops to prevent VRAM / RAM leaks.
   */
  public evictUnusedMediaElements(
    mediaElements: Map<string, HTMLVideoElement>,
    activeAssetIds: Set<string>,
  ): void {
    for (const [assetId, el] of mediaElements.entries()) {
      if (!activeAssetIds.has(assetId)) {
        try {
          el.pause()
          el.removeAttribute('src')
          el.load()
        } catch {
          /* ignore element teardown */
        }
        mediaElements.delete(assetId)
      }
    }
  }
}

export const deviceSafetyGuard = DeviceSafetyGuard.getInstance()
