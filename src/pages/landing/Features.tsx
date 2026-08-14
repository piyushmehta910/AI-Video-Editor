import {
  AudioLines,
  Bot,
  Film,
  Gauge,
  Layers,
  Lock,
  Mic,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Section } from './Section'

const FEATURES = [
  {
    icon: Gauge,
    title: 'WebGPU compositor',
    description:
      'GPU-accelerated preview at 60fps with WGSL shaders, zero-copy texture imports and 25+ blend modes.',
  },
  {
    icon: Wand2,
    title: 'AI Director',
    description:
      'Type an instruction and a structured agent plans, executes and verifies edits — with your approval.',
  },
  {
    icon: Mic,
    title: 'Local transcription',
    description:
      'Whisper runs in-browser via Transformers.js for automatic captions. No audio ever uploaded.',
  },
  {
    icon: Film,
    title: 'WebCodecs export',
    description:
      'Hardware-accelerated H.264 / H.265 / VP9 / AV1 encoding muxed to MP4, WebM or MOV with Mediabunny.',
  },
  {
    icon: Layers,
    title: 'Multi-track timeline',
    description:
      'Unlimited video, audio and text tracks with trimming, splitting, keyframes and transitions.',
  },
  {
    icon: Sparkles,
    title: 'One-click pipelines',
    description:
      'Turn a long video into a Reel, a PDF into a narrated lesson, or an article into a video.',
  },
  {
    icon: Bot,
    title: 'In-browser AI vision',
    description:
      'ONNX Runtime on WebGPU detects scenes, objects and blur — powering auto-reframe and highlights.',
  },
  {
    icon: AudioLines,
    title: 'Pro audio tools',
    description:
      'Web Audio graph with multi-track mixing, ducking, EQ, compression and waveform analysis.',
  },
  {
    icon: Lock,
    title: 'Keys stay yours',
    description:
      'Optional external APIs are encrypted with your master password — AES-256-GCM, never in plaintext.',
  },
]

export function Features() {
  return (
    <Section
      id="features"
      eyebrow="Capabilities"
      title="A complete editor, inside a tab"
      subtitle="Built on the fastest browser primitives available — no server, no app install, no export queue."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5"
          >
            <div className="text-violet-600 mb-3 flex size-10 items-center justify-center rounded-lg bg-violet-500/10 transition-colors group-hover:bg-violet-500/15">
              <feature.icon className="size-5" />
            </div>
            <h3 className="text-sm font-semibold">{feature.title}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}