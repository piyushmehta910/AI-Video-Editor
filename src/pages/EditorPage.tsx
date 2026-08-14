import { AudioLines, Bot, Clapperboard, Image, Share2, Settings, Wand2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'

const MODULES = [
  {
    icon: Clapperboard,
    title: 'Timeline',
    description: 'Multi-track timeline with trimming, splitting and keyframes',
  },
  {
    icon: Wand2,
    title: 'AI Director',
    description: 'Natural-language editing with a structured tool-calling agent',
  },
  {
    icon: Image,
    title: 'WebGPU Compositor',
    description: 'GPU-accelerated preview with WGSL shaders and 25+ blend modes',
  },
  {
    icon: AudioLines,
    title: 'Audio Engine',
    description: 'Web Audio graph, mixing, waveforms and voice activity detection',
  },
  {
    icon: Share2,
    title: 'Export',
    description: 'WebCodecs encoding with Mediabunny muxing — MP4, WebM, MOV',
  },
  {
    icon: Bot,
    title: 'Local AI',
    description: 'Whisper transcription and ONNX vision running entirely in-browser',
  },
]

export function EditorPage() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Untitled Project</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            1920×1080 · 30 fps · 16:9 · 0:00 / 0:00
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/settings">
              <Settings /> Configure APIs
            </Link>
          </Button>
          <Button disabled title="Export pipeline lands in a later phase">
            <Share2 /> Export
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <Card key={mod.title} className="gap-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-foreground/80 flex size-9 items-center justify-center rounded-md bg-muted">
                  <mod.icon className="size-4.5" />
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <CardTitle className="mt-2">{mod.title}</CardTitle>
              <CardDescription>{mod.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" disabled>
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}