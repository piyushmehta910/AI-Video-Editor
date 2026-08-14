import * as React from 'react'
import { Maximize, Pause, Play, SkipBack, SkipForward, StepBack, StepForward, Volume2, VolumeX } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { PlaybackApi } from '@/hooks/usePlayback'
import { formatSeconds } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export function Preview({ playback }: { playback: PlaybackApi }) {
  const project = useTimelineStore((s) => s.project)
  const playhead = useTimelineStore((s) => s.playhead)
  const duration = useTimelineStore((s) => s.duration())
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void containerRef.current?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      void document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  const scrub = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    playback.seek(ratio * (duration || 1))
  }

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-col bg-black" style={{ background: 'linear-gradient(180deg, #0b0b10 0%, #14141b 100%)' }}>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        <div className="relative" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
          <canvas
            ref={playback.canvasRef}
            className={cn(
              'max-h-full rounded-lg shadow-2xl shadow-black/50',
              fullscreen && 'max-h-none',
            )}
            style={{ width: 'min(100%, calc(100vh - 220px))', height: 'auto' }}
          />
        </div>

        {duration === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm text-white/80">
              Add media to your timeline to see the preview
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-4 pb-3">
        <div
          className="relative h-4 cursor-pointer"
          onPointerDown={(e) => {
            setDragging(true)
            scrub(e.clientX)
          }}
          onPointerMove={(e) => {
            if (dragging) scrub(e.clientX)
          }}
          onPointerUp={() => setDragging(false)}
          onPointerLeave={() => setDragging(false)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-violet-500"
            style={{ width: `${(playhead / (duration || 1)) * 100}%` }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `${(playhead / (duration || 1)) * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.seek(0)} title="Go to start">
            <SkipBack className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.frameStep(-1)} title="Previous frame">
            <StepBack className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 text-white hover:bg-white/10 hover:text-white"
            onClick={playback.toggle}
            title="Play / pause (Space)"
          >
            {playback.isPlaying ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.frameStep(1)} title="Next frame">
            <StepForward className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => playback.seek(duration)} title="Go to end">
            <SkipForward className="size-4" />
          </Button>

          <span className="ml-2 font-mono text-xs text-white/80">
            {formatSeconds(playhead)} / {formatSeconds(duration)}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={playback.toggleMuted}
              title="Mute"
            >
              {playback.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Slider
              className="w-24"
              min={0}
              max={1}
              step={0.01}
              value={[playback.masterVolume]}
              onValueChange={([v]) => playback.setMasterVolume(v)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={toggleFullscreen}
              title="Fullscreen (F)"
            >
              <Maximize className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}