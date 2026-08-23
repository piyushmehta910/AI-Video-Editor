import * as React from 'react'
import { Eye, EyeOff, Headphones, Lock, LockOpen, Volume2, VolumeX } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Track } from '@/engine/types'
import { TRACK_COLORS } from '@/engine/types'
import { cn } from '@/lib/utils'

/**
 * Timeline track header: color-coded short label (V1/A1/T1/FX1…), editable
 * name on double-click, and per-type controls — mute + solo on audio tracks
 * only, lock and hide on every track.
 */
export function TrackHeader({ track, shortLabel }: { track: Track; shortLabel: string }) {
  const renameTrack = useTimelineStore((s) => s.renameTrack)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(track.name)
  const color = TRACK_COLORS[track.type]

  const commit = () => {
    renameTrack(track.id, draft)
    setEditing(false)
  }

  return (
    <div
      data-header-gutter
      className="bg-card sticky left-0 z-10 flex w-[78px] shrink-0 items-center gap-0.5 border-r px-1.5"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(track.name)
              setEditing(false)
            }
          }}
          className="h-5 w-11 shrink-0 rounded border bg-muted/60 px-1 text-center font-mono text-[10px] outline-none"
          aria-label="Track name"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => {
            setDraft(track.name)
            setEditing(true)
          }}
          title={`${track.name} — double-click to rename`}
          className={cn('w-6 shrink-0 cursor-text rounded text-center font-mono text-[11px] font-semibold')}
          style={{ color }}
        >
          {shortLabel}
        </button>
      )}

      <HeaderButton
        active={track.locked}
        onClick={() => useTimelineStore.getState().toggleTrackLock(track.id)}
        title="Lock track"
      >
        {track.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
      </HeaderButton>

      {track.type === 'audio' && (
        <>
          <HeaderButton
            active={track.muted}
            onClick={() => useTimelineStore.getState().toggleTrackMute(track.id)}
            title="Mute track"
          >
            {track.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
          </HeaderButton>
          <HeaderButton
            active={Boolean(track.soloed)}
            onClick={() => useTimelineStore.getState().toggleTrackSolo(track.id)}
            title="Solo track (silences other audio tracks)"
          >
            <Headphones className="size-3" />
          </HeaderButton>
        </>
      )}

      <HeaderButton
        active={track.hidden}
        onClick={() => useTimelineStore.getState().toggleTrackHidden(track.id)}
        title="Hide track in preview"
      >
        {track.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      </HeaderButton>
    </div>
  )
}

function HeaderButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      aria-pressed={active}
      className={cn(
        'text-muted-foreground relative flex size-5 items-center justify-center rounded hover:bg-muted hover:text-foreground',
        active && 'bg-violet-500/20 text-violet-500 ring-violet-500/50 ring-2 dark:bg-violet-500/30 dark:text-violet-400',
      )}
      aria-label={active ? `${title} (enabled)` : title}
    >
      {children}
      {active && <span className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-violet-500" aria-hidden="true" />}
    </button>
  )
}
