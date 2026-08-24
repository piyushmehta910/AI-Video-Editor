import React from 'react'
import { createPortal } from 'react-dom'
import { useTimelineStore } from '@/stores/timelineStore'
import { useExportQueueStore, runExportJob } from '@/stores/exportQueueStore'
import { projectDuration } from '@/engine/types'
import {
  FPS_OPTIONS,
  RESOLUTIONS,
  defaultExportName,
  frameCountFor,
  getFormatAvailability,
  sanitizeFilename,
  type ExportFormatId,
  type QualityId,
} from '@/lib/exportFormats'
import { X } from 'lucide-react'

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

const QUALITY_LABELS: Array<{ id: QualityId; label: string }> = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export function ExportModal({ open, onClose }: ExportModalProps) {
  const assets = useTimelineStore((s) => s.assets)
  const [formatId, setFormatId] = React.useState<ExportFormatId>('webm')
  const [resolutionId, setResolutionId] = React.useState('720p')
  const [fps, setFps] = React.useState(30)
  const [quality, setQuality] = React.useState<QualityId>('medium')
  const [filename, setFilename] = React.useState(defaultExportName)

  const availability = React.useMemo(() => getFormatAvailability(), [])
  const activeJobs = useExportQueueStore(
    (s) => s.jobs.filter((j) => j.status === 'queued' || j.status === 'rendering' || j.status === 'encoding').length,
  )

  if (!open) return null

  const resolution = RESOLUTIONS.find((r) => r.id === resolutionId) ?? RESOLUTIONS[0]
  const duration = projectDuration(useTimelineStore.getState().project.tracks)
  const totalFrames = frameCountFor(duration, fps)

  const startExport = () => {
    const id = useExportQueueStore.getState().enqueue({
      name: sanitizeFilename(filename),
      format: formatId,
      width: resolution.width,
      height: resolution.height,
      fps,
      quality,
      includeAudio: true,
    })
    runExportJob(id, useTimelineStore.getState().project, assets)
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      data-testid="export-modal"
      onClick={onClose}
    >
      <div
        className="w-[94vw] max-w-[500px] max-h-[92svh] overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-6 text-neutral-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Export video</h2>
          <button
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            <X size={18} />
          </button>
        </div>

        {!availability.mediaRecorderSupported && (
          <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/40 p-3 text-sm text-amber-300">
            Your browser doesn&apos;t support in-browser video export. Use the Frame export option.
          </div>
        )}

        {/* Format */}
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">Format</label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {availability.list.map(({ format, available }) => (
            <button
              key={format.id}
              disabled={!available}
              onClick={() => setFormatId(format.id)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                formatId === format.id
                  ? 'border-blue-500 bg-blue-500/15 text-white'
                  : available
                    ? 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                    : 'cursor-not-allowed border-neutral-800 bg-neutral-900 text-neutral-600'
              }`}
            >
              {format.label}
              {!available && ' (N/A)'}
            </button>
          ))}
        </div>

        {/* Resolution */}
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">Resolution</label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setResolutionId(r.id)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                resolutionId === r.id
                  ? 'border-blue-500 bg-blue-500/15 text-white'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* FPS */}
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">Framerate</label>
        <div className="mb-4 flex gap-2">
          {FPS_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => setFps(f)}
              className={`flex-1 rounded-lg border py-1.5 text-sm transition ${
                fps === f
                  ? 'border-blue-500 bg-blue-500/15 text-white'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              {f} fps
            </button>
          ))}
        </div>

        {/* Quality */}
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">Quality</label>
        <div className="mb-4 flex gap-2">
          {QUALITY_LABELS.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuality(q.id)}
              className={`flex-1 rounded-lg border py-1.5 text-sm transition ${
                quality === q.id
                  ? 'border-blue-500 bg-blue-500/15 text-white'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Filename */}
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">Filename</label>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          spellCheck={false}
          className="mb-4 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
        />

        {duration <= 0 && (
          <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/40 p-3 text-sm text-amber-300">
            Timeline is empty — import media and add clips to the timeline before exporting.
          </div>
        )}

        <p className="mb-5 text-xs text-neutral-500">
          {totalFrames} frames · {duration.toFixed(1)}s
          {formatId !== 'frames' && ' · renders in real time'}
        </p>

        <button
          onClick={startExport}
          disabled={duration <= 0}
          data-testid="export-start-button"
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {duration <= 0 ? 'Timeline is empty' : `Start export${activeJobs > 0 ? ` (queue: ${activeJobs})` : ''}`}
        </button>
      </div>
    </div>,
    document.body,
  )
}
