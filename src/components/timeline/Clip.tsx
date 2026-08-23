import * as React from 'react'
import { Film, Image as ImageIcon, Music, Sparkles, Sticker, Type, User, Volume2, Wand2, Eye } from 'lucide-react'
import type { Asset, Clip as ClipModel, FxClipType, TextClipType, Track } from '@/engine/types'
import { TRACK_COLORS } from '@/engine/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MIN_CLIP_PX = 6

export type DragMode = 'move' | 'trim-start' | 'trim-end'

const TEXT_TYPE_ICON: Record<TextClipType, React.ReactNode> = {
  caption: <Type className="size-3" />,
  title: <Type className="size-3" />,
  lowerThird: <Type className="size-3" />,
  sticker: <Sticker className="size-3" />,
  callout: <Sparkles className="size-3" />,
}

const FX_TYPE_ICON: Record<FxClipType, React.ReactNode> = {
  transition: <Film className="size-3" />,
  filter: <Wand2 className="size-3" />,
  overlay: <ImageIcon className="size-3" />,
  motion: <Sparkles className="size-3" />,
}

const CLIP_TYPE_BADGE: Partial<Record<NonNullable<ClipModel['clipType']>, React.ReactNode>> = {
  image: <ImageIcon className="size-3" />,
  avatar: <User className="size-3" />,
  animation: <Sparkles className="size-3" />,
  music: <Music className="size-3" />,
  voice: <Type className="size-3" />,
  sfx: <Volume2 className="size-3" />,
}

/**
 * Unified timeline clip. Rendering adapts to the parent track type:
 *  - video tracks: filmstrip / thumbnail tiles (subtype badge for image/avatar/animation)
 *  - audio tracks: waveform strip + fade envelope
 *  - text tracks: text preview with subtype icon
 *  - fx tracks: subtype icon + label marker
 */
export function Clip({
  clip,
  track,
  asset,
  selected,
  isUnderPlayhead,
  trimMode,
  zoom,
  onPointerDownClip,
  onKeyDown,
}: {
  clip: ClipModel
  track: Track
  asset: Asset | undefined
  selected: boolean
  isUnderPlayhead: boolean
  trimMode: boolean
  zoom: number
  onPointerDownClip: (e: React.PointerEvent, clip: ClipModel, mode: DragMode) => void
  onKeyDown: (e: React.KeyboardEvent, clip: ClipModel, track: Track) => void
}) {
  const color = TRACK_COLORS[track.type]
  const left = clip.startTime * zoom
  const width = Math.max(MIN_CLIP_PX, clip.duration * zoom)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-clip-id={clip.id}
          tabIndex={0}
          aria-label={`${clip.name}, ${clip.duration.toFixed(1)} seconds, starts at ${clip.startTime.toFixed(1)} seconds`}
          className={cn(
            'absolute top-1 bottom-1 overflow-hidden rounded-md border transition-shadow focus-visible:outline-none',
            selected
              ? 'z-10 border-white ring-2 ring-white/60 shadow-[0_0_12px_rgba(255,255,255,0.35)]'
              : isUnderPlayhead
                ? 'border-red-400/60 shadow-sm hover:brightness-110'
                : 'border-black/40 shadow-sm hover:brightness-110',
          )}
          style={{
            left,
            width,
            borderColor: selected ? '#ffffff' : `${color}cc`,
            background: `linear-gradient(180deg, ${color}26, ${color}0d)`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (trimMode && selected) return
            onPointerDownClip(e, clip, 'move')
          }}
          onKeyDown={(e) => onKeyDown(e, clip, track)}
        >
          <ClipBody clip={clip} track={track} asset={asset} />
          <div
            className={cn(
              'absolute top-0 bottom-0 left-0 cursor-ew-resize',
              trimMode && selected ? 'w-2 bg-white/50' : 'w-1.5 hover:bg-white/30',
            )}
            onPointerDown={(e) => {
              e.stopPropagation()
              onPointerDownClip(e, clip, 'trim-start')
            }}
          />
          <div
            className={cn(
              'absolute top-0 right-0 bottom-0 cursor-ew-resize',
              trimMode && selected ? 'w-2 bg-white/50' : 'w-1.5 hover:bg-white/30',
            )}
            onPointerDown={(e) => {
              e.stopPropagation()
              onPointerDownClip(e, clip, 'trim-end')
            }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs font-medium">{clip.name}</p>
        <p className="text-muted-foreground text-[10px] font-mono">
          {clip.duration.toFixed(2)}s · start {clip.startTime.toFixed(2)}s
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

function ClipBody({ clip, track, asset }: { clip: ClipModel; track: Track; asset: Asset | undefined }) {
  // Video-track media layers
  if (track.type === 'video') {
    return (
      <>
        {asset?.filmstrip ? (
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url(${asset.filmstrip.imageUrl})`,
              backgroundSize: `${asset.filmstrip.frameCount * asset.filmstrip.frameWidth}px 100%`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: `${-clip.sourceStart * (asset.filmstrip.frameCount / asset.filmstrip.duration) * asset.filmstrip.frameWidth}px 0`,
            }}
          />
        ) : asset?.thumbnailUrl ? (
          <div
            className="absolute inset-0 opacity-40"
            style={{ backgroundImage: `url(${asset.thumbnailUrl})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x', backgroundPosition: 'center' }}
          />
        ) : null}
        <div className="relative z-10 flex h-full items-center gap-1 px-1.5">
          {clip.clipType && CLIP_TYPE_BADGE[clip.clipType]}
          {clip.opacity < 1 && <Eye className="size-3 text-white/70" />}
          <span className="truncate text-[11px] font-medium text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            {clip.name}
            {clip.speed !== 1 ? ` ×${clip.speed}` : ''}
          </span>
        </div>
      </>
    )
  }

  // Audio-track: waveform + fade envelope
  if (track.type === 'audio') {
    return (
      <>
        {asset?.waveform ? (
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `url(${asset.waveform.imageUrl})`,
              backgroundSize: `${asset.waveform.frameCount * asset.waveform.frameWidth}px 100%`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: `${-clip.sourceStart * (asset.waveform.frameCount / asset.waveform.duration) * asset.waveform.frameWidth}px 0`,
            }}
          />
        ) : null}
        {(clip.fadeIn > 0 || clip.fadeOut > 0) && <FadeEnvelope clip={clip} />}
        <div className="relative z-10 flex h-full items-center gap-1 px-1.5">
          {clip.volume < 1 && <Volume2 className="size-3 text-white/70" />}
          {clip.clipType && clip.clipType !== 'audio' && CLIP_TYPE_BADGE[clip.clipType]}
          <span className="truncate text-[11px] font-medium text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            {clip.name}
            {clip.speed !== 1 ? ` ×${clip.speed}` : ''}
          </span>
        </div>
      </>
    )
  }

  // Text-track: subtype icon + text preview box
  if (track.type === 'text') {
    const icon = clip.textType ? TEXT_TYPE_ICON[clip.textType] : <Type className="size-3" />
    return (
      <div className="relative z-10 flex h-full items-center gap-1.5 px-1.5">
        <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-black/30 text-white/80">{icon}</span>
        <span className="truncate rounded bg-black/25 px-1 text-[11px] font-medium text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {clip.text?.text ?? clip.name}
        </span>
      </div>
    )
  }

  // FX-track: icon + label marker
  const icon = clip.fxType ? FX_TYPE_ICON[clip.fxType] : <Sparkles className="size-3" />
  return (
    <div className="relative z-10 flex h-full items-center gap-1.5 px-1.5">
      <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-black/30 text-white/80">{icon}</span>
      <span className="truncate text-[11px] font-semibold tracking-wide text-white/90 uppercase [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
        {clip.fxType ?? clip.name}
      </span>
    </div>
  )
}

/** Simple linear fade-in/out envelope rendered over audio clips. */
function FadeEnvelope({ clip }: { clip: ClipModel }) {
  const inPct = Math.min(100, (clip.fadeIn / Math.max(clip.duration, 0.001)) * 100)
  const outPct = Math.min(100, (clip.fadeOut / Math.max(clip.duration, 0.001)) * 100)
  return (
    <svg className="absolute inset-x-0 bottom-0 z-[5] h-3 w-full" preserveAspectRatio="none" viewBox="0 0 100 10">
      {clip.fadeIn > 0 && <polyline points={`0,10 ${inPct},0`} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.8" />}
      {clip.fadeOut > 0 && <polyline points={`${100 - outPct},0 100,10`} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.8" />}
    </svg>
  )
}
