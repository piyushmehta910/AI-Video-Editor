import React from 'react'
import {
  useExportQueueStore,
  triggerDownload,
  type ExportJob,
} from '@/stores/exportQueueStore'
import { estimateRemainingMs, humanFileSize } from '@/lib/exportFormats'
import { CheckCircle2, ChevronDown, ChevronUp, Download, RotateCw, X, XCircle } from 'lucide-react'

function JobRow({ job }: { job: ExportJob }) {
  const cancel = useExportQueueStore((s) => s.cancel)
  const retry = useExportQueueStore((s) => s.retry)
  const dismiss = useExportQueueStore((s) => s.dismiss)

  const active = job.status === 'rendering' || job.status === 'encoding'
  const pct = job.total > 0 ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0
  const [startedAt] = React.useState(() => Date.now())
  const [, forceTick] = React.useReducer((n) => n + 1, 0)

  React.useEffect(() => {
    if (!active) return
    const timer = window.setInterval(forceTick, 1000)
    return () => window.clearInterval(timer)
  }, [active])

  const eta =
    active && job.done > 0 ? estimateRemainingMs(job.done, job.total, Date.now() - startedAt) : 0

  const extension = job.format === 'frames' ? 'zip' : job.format

  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm"
      data-testid="export-job"
      data-status={job.status}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-neutral-200" title={`${job.name}.${extension}`}>
            {job.name}.{extension}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {job.width}×{job.height} · {job.fps} fps
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {job.status === 'done' && (
            <button
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Download again"
              onClick={() => job.resultUrl && triggerDownload(job.resultUrl, `${job.name}.${extension}`)}
            >
              <Download size={15} />
            </button>
          )}
          {job.status === 'error' && (
            <button
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Retry export"
              onClick={() => retry(job.id)}
            >
              <RotateCw size={15} />
            </button>
          )}
          {(active || job.status === 'queued') && (
            <button
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Cancel export"
              data-testid="export-cancel"
              onClick={() => cancel(job.id)}
            >
              <X size={15} />
            </button>
          )}
          {!active && job.status !== 'queued' && (
            <button
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Remove from list"
              onClick={() => dismiss(job.id)}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {active && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 flex justify-between text-xs text-neutral-500">
            <span>
              Rendering frame {job.done}/{job.total || '?'}…
            </span>
            {eta > 0 && <span>{eta >= 60000 ? `${Math.floor(eta / 60000)}m ${Math.round((eta % 60000) / 1000)}s left` : `${Math.round(eta / 1000)}s left`}</span>}
          </p>
        </div>
      )}

      {job.status === 'done' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 size={14} /> Exported{job.size != null ? ` · ${humanFileSize(job.size)}` : ''}
        </p>
      )}
      {job.status === 'error' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <XCircle size={14} /> {job.error ?? 'Export failed'}
        </p>
      )}
      {job.status === 'cancelled' && <p className="mt-2 text-xs text-neutral-500">Cancelled</p>}
      {job.status === 'queued' && <p className="mt-2 text-xs text-neutral-500">Queued…</p>}
    </div>
  )
}

/** Floating export queue panel — appears when jobs exist, collapsible. */
export function ExportQueue() {
  const jobs = useExportQueueStore((s) => s.jobs)
  const [collapsed, setCollapsed] = React.useState(false)

  if (jobs.length === 0) return null

  const activeCount = jobs.filter(
    (j) => j.status === 'rendering' || j.status === 'encoding' || j.status === 'queued',
  ).length

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/95 shadow-2xl backdrop-blur"
      data-testid="export-queue"
    >
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-neutral-300 hover:bg-neutral-900"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>
          Exports{activeCount > 0 ? ` (${activeCount} active)` : ''}
        </span>
        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {!collapsed && (
        <div className="max-h-72 space-y-2 overflow-y-auto px-3 pb-3">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
