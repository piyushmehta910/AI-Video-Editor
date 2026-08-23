import * as React from 'react'
import type { Project } from '@/engine/types'
import { projectDuration } from '@/engine/types'
import { describeTool } from '@/api/llm/tools'
import type { EditPlan } from '@/api/llm/plan'
import { simulateProject, TRACK_COLORS, type SimClipBlock } from '@/lib/planSimulation'
import { AlertTriangle, Check, X } from 'lucide-react'

/**
 * Structured action preview: the change list plus a visual before/after
 * timeline comparison. The "after" map is simulated on a clone of the
 * before-snapshot — nothing here touches the real timeline until Confirm.
 */

function TrackMap({ project, extraBlocks, title }: { project: Project; extraBlocks?: SimClipBlock[]; title: string }) {
  const duration = Math.max(1, projectDuration(project.tracks))
  const visibleTracks = project.tracks.filter((t) => t.type !== 'fx')
  const trackIndexOf = new Map(project.tracks.map((t, i) => [t.id, i]))

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      <div className="space-y-1 rounded-lg border border-neutral-800 bg-neutral-950 p-1.5">
        {visibleTracks.map((track) => (
          <div key={track.id} className="relative h-4 overflow-hidden rounded bg-neutral-900" style={{ opacity: track.hidden ? 0.35 : 1 }}>
            {duration > 0 &&
              track.clips.map((clip) => (
                <div
                  key={clip.id}
                  className="absolute top-0 h-full overflow-hidden rounded-sm px-1 text-[7px] leading-4 text-white/90"
                  style={{
                    left: `${(clip.startTime / duration) * 100}%`,
                    width: `${Math.max(2, (clip.duration / duration) * 100)}%`,
                    background: TRACK_COLORS[track.type],
                  }}
                  title={clip.name}
                >
                  {clip.name}
                </div>
              ))}
            {(extraBlocks ?? [])
              .filter((b) => b.trackIndex === trackIndexOf.get(track.id))
              .map((b, bi) => (
                <div
                  key={`sim-${bi}`}
                  className="absolute top-0 h-full overflow-hidden rounded-sm px-1 text-[7px] leading-4"
                  style={{
                    left: `${(b.start / duration) * 100}%`,
                    width: `${Math.max(3, (b.duration / duration) * 100)}%`,
                    background: b.removed
                      ? 'repeating-linear-gradient(45deg,#f87171,#f87171 4px,transparent 4px,transparent 8px)'
                      : b.added
                        ? '#22d3ee'
                        : b.moved
                          ? '#eab308'
                          : TRACK_COLORS[project.tracks[b.trackIndex]?.type ?? 'video'],
                    color: '#111',
                    border: b.removed ? '1px dashed #f87171' : 'none',
                  }}
                  title={b.label}
                >
                  {b.removed ? '' : b.label}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ActionPreview({
  plan,
  before,
  onConfirm,
  onRevise,
  onDiscard,
}: {
  plan: EditPlan
  before: Project
  onConfirm: () => void
  onRevise: (revision?: string) => void
  onDiscard: () => void
}) {
  const [reviseMode, setReviseMode] = React.useState(false)
  const [revision, setRevision] = React.useState('')
  const { after, blocks } = React.useMemo(() => simulateProject(before, plan), [before, plan])

  const hasInvalid = plan.actions.some((a) => describeTool(a.tool, a.arguments) === null)

  return (
    <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-3" data-testid="action-preview">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-3.5 shrink-0 text-violet-400" />
        <p className="text-xs font-semibold text-violet-300">Proposed plan — nothing applied yet</p>
      </div>
      <p className="mb-2 text-sm font-medium text-neutral-100">{plan.goal}</p>

      {/* Change list */}
      <ol className="mb-3 space-y-1">
        {plan.actions.map((a, i) => {
          const label = describeTool(a.tool, a.arguments)
          return (
            <li key={i} className="flex items-start gap-2 rounded-md bg-neutral-900/70 px-2 py-1.5 text-xs">
              <span className="mt-px size-4 shrink-0 rounded-full bg-violet-600/25 text-center text-[9px] leading-4 text-violet-300">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-neutral-200">{label ?? `${a.tool} (invalid)`}</span>
                {a.reason && <span className="block text-[11px] text-neutral-500">Why: {a.reason}</span>}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Before / after comparison */}
      <div className="mb-3 grid grid-cols-1 gap-2">
        <TrackMap project={before} title="Before" />
        <TrackMap project={after} extraBlocks={blocks} title="After (preview)" />
      </div>

      {hasInvalid && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] text-red-400">
          <X className="size-3" /> Some actions are no longer valid — they will be skipped.
        </p>
      )}

      {reviseMode ? (
        <div className="space-y-1.5">
          <input
            autoFocus
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRevise(revision)
            }}
            placeholder="What should change? (e.g. 'instead, trim the start')"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-violet-500"
          />
          <div className="flex gap-1.5">
            <button
              className="h-7 flex-1 rounded-lg bg-blue-600 text-xs font-medium text-white hover:bg-blue-500"
              onClick={() => onRevise(revision)}
            >
              Send revision
            </button>
            <button
              className="h-7 rounded-lg border border-neutral-700 px-3 text-xs text-neutral-300 hover:bg-neutral-800"
              onClick={() => setReviseMode(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button
            data-testid="confirm-plan-button"
            onClick={onConfirm}
            className="h-7 flex-1 rounded-lg bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <Check className="mr-1 inline size-3" />
            Confirm
          </button>
          <button
            onClick={() => setReviseMode(true)}
            className="h-7 rounded-lg border border-neutral-700 px-3 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Modify
          </button>
          <button
            onClick={onDiscard}
            className="h-7 rounded-lg border border-neutral-700 px-3 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  )
}
