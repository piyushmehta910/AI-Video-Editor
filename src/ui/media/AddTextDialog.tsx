import * as React from 'react'
import { Type, X } from 'lucide-react'
import { useTimelineStore } from '@/stores/timelineStore'
import type { TextAnimation, TextOverlay } from '@/engine/types'
import { TEXT_ANIMATIONS } from '@/engine/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
}

interface Preset {
  name: string
  emoji: string
  overlay: Partial<TextOverlay>
}

const PRESETS: Preset[] = [
  {
    name: 'Title',
    emoji: '🔤',
    overlay: { fontSize: 64, fontWeight: 'bold', color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', shadow: true, fontFamily: 'sans-serif' },
  },
  {
    name: 'Subtitle',
    emoji: '📝',
    overlay: { fontSize: 34, fontWeight: 'normal', color: '#e2e8f0', backgroundColor: 'rgba(0,0,0,0.55)', textAlign: 'center', borderRadius: 10, shadow: false, fontFamily: 'sans-serif' },
  },
  {
    name: 'Neon',
    emoji: '💡',
    overlay: { fontSize: 56, fontWeight: 'bold', color: '#22d3ee', backgroundColor: 'transparent', textAlign: 'center', shadow: true, fontFamily: 'monospace' },
  },
  {
    name: 'Quote',
    emoji: '💬',
    overlay: { fontSize: 40, fontWeight: 'normal', fontStyle: 'italic', color: '#f1f5f9', backgroundColor: 'transparent', textAlign: 'center', shadow: true, fontFamily: 'serif' },
  },
  {
    name: 'Highlight',
    emoji: '🖍️',
    overlay: { fontSize: 44, fontWeight: 'bold', color: '#1e293b', backgroundColor: '#fde047', textAlign: 'center', borderRadius: 6, shadow: false, fontFamily: 'sans-serif' },
  },
  {
    name: 'Clean',
    emoji: '✨',
    overlay: { fontSize: 48, fontWeight: 'bold', color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', shadow: false, fontFamily: 'sans-serif' },
  },
]

const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'] as const

export function AddTextDialog({ open, onClose }: Props) {
  const project = useTimelineStore((s) => s.project)
  const addTextClip = useTimelineStore((s) => s.addTextClip)

  const [text, setText] = React.useState('')
  const [presetIndex, setPresetIndex] = React.useState(0)
  const [fontSize, setFontSize] = React.useState(48)
  const [fontFamily, setFontFamily] = React.useState<string>('sans-serif')
  const [color, setColor] = React.useState('#ffffff')
  const [backgroundColor, setBackgroundColor] = React.useState('transparent')
  const [animation, setAnimation] = React.useState<TextAnimation>('slide-up')
  const [animationDuration, setAnimationDuration] = React.useState(1)
  const [duration, setDuration] = React.useState(4)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setText('')
    setPresetIndex(0)
    applyPreset(0)
    setAnimation('slide-up')
    setAnimationDuration(1)
    setDuration(4)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const applyPreset = (index: number) => {
    setPresetIndex(index)
    const p = PRESETS[index]
    setFontSize(p.overlay.fontSize ?? 48)
    setFontFamily(p.overlay.fontFamily ?? 'sans-serif')
    setColor(p.overlay.color ?? '#ffffff')
    setBackgroundColor(p.overlay.backgroundColor ?? 'transparent')
  }

  if (!open) return null

  const addText = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Enter some text first.')
      return
    }
    const overlay: TextOverlay = {
      text: trimmed,
      fontSize,
      fontFamily,
      fontWeight: 'bold',
      fontStyle: 'normal',
      color,
      backgroundColor,
      textAlign: 'center',
      paddingTop: 12,
      paddingBottom: 12,
      paddingLeft: 20,
      paddingRight: 20,
      borderRadius: 0,
      shadow: true,
      animation,
      animationDuration,
    }
    const track = project.tracks.find((t) => t.type === 'text') ?? project.tracks.find((t) => t.type === 'video')
    if (!track) {
      setError('No text or video track available.')
      return
    }
    const clip = addTextClip(trimmed, track.id)
    if (!clip) {
      setError('Could not create the text clip.')
      return
    }
    useTimelineStore.getState().updateClip(clip.id, {
      duration,
      sourceEnd: duration,
      text: { ...overlay },
    })
    onClose()
  }

  const textTrack = project.tracks.find((t) => t.type === 'text')
  const targetName = textTrack ? `text track (${textTrack.name})` : 'a video track'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-400">
            <Type className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Add Text</h3>
            <p className="text-muted-foreground text-[11px]">Styled text with entrance animation on {targetName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addtext-content">Text</Label>
            <textarea
              id="addtext-content"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your text here…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Style preset</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(i)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] transition-colors',
                    presetIndex === i
                      ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                      : 'hover:border-violet-500/40',
                  )}
                >
                  <span className="text-base leading-none">{p.emoji}</span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addtext-size">Font size</Label>
              <Input
                id="addtext-size"
                type="number"
                min={10}
                max={300}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Font family</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Text color</Label>
              <input type="color" value={color === 'transparent' ? '#ffffff' : color} className="h-9 w-full cursor-pointer rounded-md border bg-background p-1" onChange={(e) => setColor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Background</Label>
              <div className="flex gap-1">
                <input type="color" value={backgroundColor === 'transparent' ? '#000000' : backgroundColor} className="h-9 flex-1 cursor-pointer rounded-md border bg-background p-1" onChange={(e) => setBackgroundColor(e.target.value)} />
                <Button type="button" variant="outline" size="sm" className="h-9 px-2 text-xs" onClick={() => setBackgroundColor('transparent')}>
                  None
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Entrance animation</Label>
              <Select value={animation} onValueChange={(v) => setAnimation(v as TextAnimation)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_ANIMATIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a.charAt(0).toUpperCase() + a.slice(1).replace(/-/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {animation !== 'none' && (
              <div className="flex flex-col gap-1.5">
                <Label>Animation duration: {animationDuration.toFixed(1)}s</Label>
                <Slider min={0.2} max={3} step={0.1} value={[animationDuration]} onValueChange={([v]) => setAnimationDuration(v)} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>Clip duration: {duration}s</Label>
              <Slider min={0.5} max={30} step={0.5} value={[duration]} onValueChange={([v]) => setDuration(v)} />
            </div>
          </div>

          {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" className="ml-auto" onClick={addText}>
            <Type />
            Add to timeline
          </Button>
        </div>
      </div>
    </div>
  )
}