import * as React from 'react'
import {
  deleteMediaFile,
  getMediaUrl,
  listMediaFiles,
  readMediaFile,
  writeMediaFile,
} from '@/engine/storage/opfs'

/**
 * Thin React wrapper over the engine OPFS layer (navigator.storage.getDirectory).
 * Exposes live quota/usage numbers so the Media Bin can warn before imports
 * fail, plus pass-through helpers for callers that want hook-shaped access.
 */
export function useOPFS() {
  const [quota, setQuota] = React.useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = React.useState<boolean | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      if (navigator.storage?.estimate) {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate()
        setQuota({ usage, quota })
      }
      if (navigator.storage?.persisted) {
        setPersisted(await navigator.storage.persisted())
      }
    } catch {
      // estimate() unavailable — leave nulls
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    quota,
    persisted,
    refresh,
    writeFile: writeMediaFile,
    readFile: readMediaFile,
    getUrl: getMediaUrl,
    deleteFile: deleteMediaFile,
    listFiles: listMediaFiles,
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : Number(value.toFixed(1))} ${units[unit]}`
}
