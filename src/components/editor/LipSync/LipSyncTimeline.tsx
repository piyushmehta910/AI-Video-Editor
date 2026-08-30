import * as React from 'react'
import { Mic, Video, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LipSyncEditor } from './LipSyncEditor'
import type { LipSyncClipData } from './LipSyncEditor'
import { useTimelineStore } from '@/stores/timelineStore'
import type { Clip, Track } from '@/engine/types'

export function LipSyncTimelineIntegration() {
  const { project, addClipToTrack } = useTimelineStore()
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingClip, setEditingClip] = React.useState<LipSyncClipData | null>(null)

  const handleAddLipSync = () => {
    setEditingClip(null)
    setEditorOpen(true)
  }

  const handleSave = (clip: LipSyncClipData) => {
    if (!editingClip) {
      const track = project.tracks.find((t: Track) => t.type === 'video')
      if (!track) return

      const newClip: Clip = {
        id: crypto.randomUUID(),
        assetId: '',
        trackId: track.id,
        startTime: project.tracks[0]?.clips.length
          ? Math.max(...project.tracks[0].clips.map(c => c.startTime + c.duration))
          : 0,
        duration: clip.duration,
        sourceStart: 0,
        sourceEnd: clip.duration,
        speed: 1,
        name: clip.name,
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        opacity: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        effects: [],
        transitions: {},
      }
      addClipToTrack(newClip)
    }
    setEditorOpen(false)
    setEditingClip(null)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddLipSync}
        className="gap-2"
        aria-label="Add Lip Sync"
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">Add Lip Sync</span>
      </Button>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background w-full max-w-3xl max-h-[90vh] rounded-lg shadow-xl overflow-hidden">
            <LipSyncEditor
              clip={editingClip || undefined}
              onSave={handleSave}
              onClose={() => {
                setEditorOpen(false)
                setEditingClip(null)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

export function LipSyncTrackItem({ clip }: { clip: LipSyncClipData }) {
  return (
    <div className="relative h-full bg-muted/50 rounded border p-1 flex flex-col">
      <div className="flex items-center justify-between gap-1 px-1">
        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
          <Mic className="size-3" />
          LipSync
        </span>
        <span className="text-[10px] text-muted-foreground">
          {clip.duration.toFixed(1)}s
        </span>
      </div>
      <div className="flex-1 relative overflow-hidden rounded">
        {clip.outputVideoUrl ? (
          <video
            src={clip.outputVideoUrl}
            className="w-full h-full object-cover"
            muted
            loop
            autoPlay
            playsInline
          />
        ) : clip.avatarVideoUrl ? (
          <video
            src={clip.avatarVideoUrl}
            className="w-full h-full object-cover opacity-50"
            muted
            loop
            autoPlay
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Mic className="size-8" />
          </div>
        )}
        {clip.status === 'processing' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
              <p className="text-xs">Processing...</p>
            </div>
          </div>
        )}
        {clip.status === 'error' && (
          <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
            <p className="text-white text-xs">Error</p>
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{clip.name}</span>
        {clip.outputVideoUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => window.open(clip.outputVideoUrl!, '_blank')}
            title="Open in new tab"
          >
            <Video className="size-3" />
          </Button>
        )}
      </div>
    </div>
  )
}