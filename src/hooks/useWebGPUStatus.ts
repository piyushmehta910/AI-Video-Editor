import { useCallback, useEffect, useContext, createContext, useState } from 'react'

export type WebGPUStatus = 'checking' | 'ready' | 'unsupported' | 'fallback' | 'error'

/** Minimal structural typing for the WebGPU API surface we touch (no @webgpu/types dependency). */
interface MinimalGPUAdapterInfo {
  vendor?: string
  architecture?: string
  device?: string
  description?: string
}

interface MinimalGPUAdapter {
  info?: MinimalGPUAdapterInfo
  requestAdapterInfo?: () => Promise<MinimalGPUAdapterInfo>
}

interface MinimalGPU {
  requestAdapter: () => Promise<MinimalGPUAdapter | null>
}

function gpu(): MinimalGPU | undefined {
  return (navigator as Navigator & { gpu?: MinimalGPU }).gpu
}

async function readAdapterInfo(adapter: MinimalGPUAdapter): Promise<GPUAdapterDetails> {
  const info = adapter.info ?? (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : undefined)
  return {
    vendor: info?.vendor || null,
    architecture: info?.architecture || null,
    device: info?.device || null,
    description: info?.description || null,
  }
}

/** Exported for tests — maps browser GPU state to one of the four terminal statuses. */
export async function detectWebGPU(): Promise<{ status: Exclude<WebGPUStatus, 'checking'>; details: GPUAdapterDetails | null }> {
  // No WebGPU API at all (Firefox stable, most mobile browsers, older Safari).
  if (!gpu()) return { status: 'unsupported', details: null }
  try {
    const adapter = await gpu()!.requestAdapter()
    // API present but no usable adapter (blocked GPU, VMs, software-render lists).
    if (!adapter) return { status: 'fallback', details: null }
    return { status: 'ready', details: await readAdapterInfo(adapter) }
  } catch {
    return { status: 'error', details: null }
  }
}

export interface GPUAdapterDetails {
  vendor: string | null
  architecture: string | null
  device: string | null
  description: string | null
}

/**
 * Lightweight WebGPU compatibility check for the editor entry point.
 * Deliberately touches no editor code — it must be able to run before the
 * heavy editor chunk is imported.
 */
export function useWebGPUStatus() {
  const [status, setStatus] = useState<WebGPUStatus>('checking')
  const [details, setDetails] = useState<GPUAdapterDetails | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('checking')
    void detectWebGPU().then((result) => {
      if (cancelled) return
      setStatus(result.status)
      setDetails(result.details)
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const recheck = useCallback(() => setAttempt((a) => a + 1), [])

  return { status, adapterDetails: details, recheck }
}

/** Adapter identity shared via context for later feature detection (tuning quality, workarounds per vendor). */
export const GPUAdapterContext = createContext<GPUAdapterDetails | null>(null)

export function useGPUAdapterInfo(): GPUAdapterDetails | null {
  return useContext(GPUAdapterContext)
}

/**
 * True when GPU-accelerated effects are safe to enable. The BrowserGate only
 * populates the adapter context in the 'ready' state, so a non-null value is
 * the single source of truth for "GPU compositing available".
 */
export function useGPUEffectsEnabled(): boolean {
  return useContext(GPUAdapterContext) !== null
}
