import * as React from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Plus,
  X,
  Repeat,
  Film,
  Music2,
  Image as ImageIcon,
  Box,
} from 'lucide-react'
import type { Asset } from '@/engine/types'
import { formatSeconds } from '@/engine/types'
import { getMediaUrl } from '@/engine/storage/opfs'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MediaSourcePreviewProps {
  asset: Asset
  onClose: () => void
  onAddToTimeline: (asset: Asset) => void
  onPopout?: (asset: Asset) => void
  className?: string
}

export function MediaSourcePreview({
  asset,
  onClose,
  onAddToTimeline,
  onPopout,
  className,
}: MediaSourcePreviewProps) {
  const [url, setUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(asset.duration ?? 0)
  const [isMuted, setIsMuted] = React.useState(false)
  const [volume, setVolume] = React.useState(1)
  const [isLooping, setIsLooping] = React.useState(false)
  const [playbackRate, setPlaybackRate] = React.useState(1)

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  // Fetch blob/object URL for the asset
  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setIsPlaying(false)
    setCurrentTime(0)

    let createdUrl: string | null = null
    void (async () => {
      try {
        const u = await getMediaUrl(asset.filePath)
        if (!active) {
          URL.revokeObjectURL(u)
          return
        }
        createdUrl = u
        setUrl(u)
      } catch (err) {
        if (active) {
          setError('Could not load media preview')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [asset.id, asset.filePath])

  const togglePlay = () => {
    if (asset.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        void videoRef.current.play()
      }
    } else if (asset.type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        void audioRef.current.play()
      }
    }
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
    if (asset.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = time
    } else if (asset.type === 'audio' && audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    if (videoRef.current) videoRef.current.muted = next
    if (audioRef.current) audioRef.current.muted = next
  }

  const handleVolumeChange = (v: number) => {
    setVolume(v)
    setIsMuted(v === 0)
    if (videoRef.current) videoRef.current.volume = v
    if (audioRef.current) audioRef.current.volume = v
  }

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2, 0.5]
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    setPlaybackRate(next)
    if (videoRef.current) videoRef.current.playbackRate = next
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border border-violet-500/30 bg-card shadow-md overflow-hidden transition-all',
        className,
      )}
      data-testid="media-source-preview"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {asset.type === 'video' && <Film className="size-3 text-violet-500 shrink-0" />}
          {asset.type === 'audio' && <Music2 className="size-3 text-amber-500 shrink-0" />}
          {asset.type === 'image' && <ImageIcon className="size-3 text-emerald-500 shrink-0" />}
          {asset.type === 'model' && <Box className="size-3 text-cyan-500 shrink-0" />}
          <span className="truncate font-semibold text-foreground text-[10px]" title={asset.name}>
            {asset.name}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {onPopout && (
            <button
              type="button"
              onClick={() => onPopout(asset)}
              className="size-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Pop out preview"
            >
              <Maximize2 className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
            title="Close preview"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {/* Media Canvas / Stage Viewport */}
      <div className="relative aspect-video w-full bg-black/80 flex items-center justify-center overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground text-xs">
            <span className="inline-block size-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px]">Loading preview…</span>
          </div>
        ) : error ? (
          <div className="p-3 text-center text-destructive text-[11px]">{error}</div>
        ) : url ? (
          <>
            {asset.type === 'video' && (
              <video
                ref={videoRef}
                src={url}
                playsInline
                loop={isLooping}
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                onLoadedMetadata={(e) => {
                  const d = (e.target as HTMLVideoElement).duration
                  if (Number.isFinite(d)) setDuration(d)
                }}
                className="size-full object-contain cursor-pointer"
              />
            )}

            {asset.type === 'audio' && (
              <div className="flex flex-col items-center justify-center gap-2 p-4 w-full h-full bg-gradient-to-br from-amber-500/10 via-card to-violet-500/10">
                <audio
                  ref={audioRef}
                  src={url}
                  loop={isLooping}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                  onLoadedMetadata={(e) => {
                    const d = (e.target as HTMLAudioElement).duration
                    if (Number.isFinite(d)) setDuration(d)
                  }}
                />
                <div className="flex items-center gap-1">
                  {[40, 70, 30, 90, 50, 80, 60, 100, 45, 85, 35, 75].map((h, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1 rounded-full transition-all duration-150',
                        isPlaying ? 'bg-violet-500 animate-pulse' : 'bg-muted-foreground/40',
                      )}
                      style={{
                        height: isPlaying ? `${Math.max(8, Math.round(h * 0.8))}px` : `${Math.round(h * 0.3)}px`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Audio Track</span>
              </div>
            )}

            {asset.type === 'image' && (
              <img src={url} alt={asset.name} className="size-full object-contain" />
            )}

            {asset.type === 'model' && (
              <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center">
                <Box className="size-8 text-cyan-400 animate-bounce" />
                <span className="text-xs font-semibold text-foreground">3D Model Asset</span>
                <span className="text-[10px] text-muted-foreground">Ready for 3D Studio</span>
              </div>
            )}
          </>
        ) : null}

        {/* Center overlay play button for video/audio */}
        {(asset.type === 'video' || asset.type === 'audio') && !isPlaying && !loading && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute size-9 rounded-full bg-violet-600/90 text-white flex items-center justify-center shadow-lg hover:scale-105 hover:bg-violet-500 transition-all"
            title="Play Preview"
          >
            <Play className="size-4 fill-white ml-0.5" />
          </button>
        )}

        {/* Asset metadata badge overlay */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
          {asset.width && asset.height && (
            <span className="rounded bg-black/70 px-1 py-0.5 text-[8px] font-mono text-white/90">
              {asset.width}×{asset.height}
            </span>
          )}
        </div>
      </div>

      {/* Scrub & Timeline Bar */}
      {(asset.type === 'video' || asset.type === 'audio') && (
        <div className="flex flex-col bg-muted/20 px-2 py-1 gap-1 border-t border-border/40">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="h-1 w-full accent-violet-500 cursor-pointer rounded bg-muted"
          />

          <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>
      )}

      {/* Control Buttons Footer */}
      <div className="flex items-center justify-between border-t bg-card p-1.5 gap-1.5">
        {(asset.type === 'video' || asset.type === 'audio') ? (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-foreground hover:bg-violet-500/20"
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
            </Button>

            <div className="flex items-center gap-0.5 group/vol">
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-10 h-1 accent-violet-500 cursor-pointer hidden group-hover/vol:block rounded"
                title={`Volume ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="rounded px-1 py-0.5 font-mono text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title="Cycle playback speed"
            >
              {playbackRate}×
            </button>

            <button
              type="button"
              onClick={() => setIsLooping(!isLooping)}
              className={cn(
                'size-5 rounded flex items-center justify-center transition-colors',
                isLooping ? 'text-violet-500 bg-violet-500/20 font-bold' : 'text-muted-foreground hover:text-foreground',
              )}
              title={isLooping ? 'Looping enabled' : 'Enable loop'}
            >
              <Repeat className="size-3" />
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
            {asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.type.toUpperCase()}
          </div>
        )}

        <Button
          size="sm"
          className="h-6 gap-1 px-2 text-[10px] font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-xs ml-auto"
          onClick={() => onAddToTimeline(asset)}
          title="Add this asset to the timeline at the playhead"
        >
          <Plus className="size-3" />
          <span>Add to Timeline</span>
        </Button>
      </div>
    </div>
  )
}
