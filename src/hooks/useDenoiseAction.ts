import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Clip, Track } from '@/engine/types'
import { useTimelineStore } from '@/stores/timelineStore'
import { useDenoise } from '@/hooks/useDenoise'
import { readMediaFile } from '@/engine/storage/opfs'
import { float32ToWav } from '@/engine/audio/wav'

export function useDenoiseAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const denoise = useDenoise(
    useMemo(() => ({ onError: (e: string) => setError(e) }), []),
  )

  useEffect(() => () => denoise.terminate(), [denoise])

  const run = useCallback(
    async (clipId: string) => {
      if (busy) return
      const store = useTimelineStore.getState()
      let found: { clip: Clip; track: Track } | null = null
      for (const t of store.project.tracks) {
        const c = t.clips.find((cc) => cc.id === clipId)
        if (c) {
          found = { clip: c, track: t }
          break
        }
      }
      if (!found) return
      const asset = store.assets.find((a) => a.id === found!.clip.assetId)
      if (!asset || asset.type !== 'audio') return

      setBusy(true)
      setError(null)
      try {
        const file = await readMediaFile(asset.filePath)
        const result = await denoise.denoiseFromFile(file)
        const wav = float32ToWav(result.denoisedAudio, result.sampleRate)
        const outFile = new File([wav], `${asset.name}-denoised.wav`, { type: 'audio/wav' })
        const { imported, errors } = await useTimelineStore.getState().importFiles([outFile])
        if (imported.length) {
          const s = useTimelineStore.getState()
          const audioTrack = s.project.tracks.find((t) => t.type === 'audio')
          const targetStart = found.clip.startTime + found.clip.duration
          const newClip = audioTrack
            ? s.addClip(imported[0].id, audioTrack.id, Math.round(targetStart * 10) / 10)
            : undefined
          if (newClip && audioTrack) s.select([newClip.id], audioTrack.id)
        } else {
          setError(errors[0] ?? 'Could not import denoised audio')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [busy, denoise],
  )

  return { busy, error, run }
}