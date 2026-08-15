import * as React from 'react'
import { getCapabilities } from '@/engine/capabilities'
import type { EngineCapabilities } from '@/engine/capabilities'

export interface UseCapabilitiesResult {
  caps: EngineCapabilities | null
  loading: boolean
}

/** Load engine capabilities once, memoized at module level. */
export function useCapabilities(): UseCapabilitiesResult {
  const [caps, setCaps] = React.useState<EngineCapabilities | null>(null)

  React.useEffect(() => {
    let alive = true
    void getCapabilities().then((c) => {
      if (alive) setCaps(c)
    })
    return () => {
      alive = false
    }
  }, [])

  return { caps, loading: caps === null }
}