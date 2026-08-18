import {
  AudioWaveform,
  Boxes,
  Brain,
  Cpu,
  Database,
  HardDrive,
  ImagePlay,
  Workflow,
} from 'lucide-react'
import { Section } from './Section'

const TECH = [
  {
    icon: Cpu,
    name: 'WebGPU + WGSL',
    role: 'GPU compositing',
    note: '60fps preview, shader effects, zero-copy textures',
  },
  {
    icon: ImagePlay,
    name: 'WebCodecs',
    role: 'Hardware encode/decode',
    note: 'H.264 · H.265 · VP9 · AV1, ~10× faster than wasm',
  },
  {
    icon: Boxes,
    name: 'Mediabunny',
    role: 'Container muxing',
    note: 'Pure TS MP4 / WebM / MOV — no FFmpeg bundle',
  },
  {
    icon: Database,
    name: 'OPFS',
    role: 'Large-file storage',
    note: 'Multi-gigabyte media stored in-browser',
  },
  {
    icon: AudioWaveform,
    name: 'Web Audio + AudioWorklet',
    role: 'Audio engine',
    note: 'Mixing, ducking, EQ and VAD off the main thread',
  },
  {
    icon: Brain,
    name: 'Transformers.js + ONNX',
    role: 'Local AI',
    note: 'Whisper transcription and vision models in-tab',
  },
  {
    icon: AudioWaveform,
    name: 'Wav2Lip (ONNX Runtime)',
    role: 'Neural lip-sync',
    note: 'onnxruntime-web on WebGL/WebGPU + mel spectrogram, on-device',
  },
  {
    icon: AudioWaveform,
    name: 'RNNoise (WASM)',
    role: 'Noise cancellation',
    note: 'RNNoise C compiled to WASM via @shiguredo/rnnoise-wasm',
  },
  {
    icon: Workflow,
    name: 'Web Workers',
    role: 'Background processing',
    note: 'Export, transcription and vision never block UI',
  },
  {
    icon: HardDrive,
    name: 'IndexedDB + AES-GCM',
    role: 'Encrypted project data',
    note: 'Projects, undo history and vaulted API keys',
  },
]

export function Tech() {
  return (
    <Section
      id="tech"
      eyebrow="Under the hood"
      title="The fastest stack the browser has to offer"
      subtitle="Every heavy job runs on GPU or in a worker. FFmpeg.wasm exists only as a lazy last-resort fallback."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TECH.map((item) => (
          <div key={item.name} className="rounded-xl border bg-card p-4 transition-colors hover:border-violet-500/40">
            <div className="flex items-center gap-2.5">
              <item.icon className="size-4.5 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-semibold">{item.name}</h3>
            </div>
            <p className="text-muted-foreground mt-2 text-xs font-medium">{item.role}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed opacity-80">{item.note}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}