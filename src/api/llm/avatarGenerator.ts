import { getActiveTtsProvider } from '@/api/tts'
import { generateScript, type ProjectScript, type ScriptScene } from './scripts'
import { generateLipsyncVideo, type LipsyncOptions } from '@/engine/avatar'
import { useApiConfigStore } from '@/api/config/store'

export type AvatarRole = 'intro' | 'outro' | 'presenter' | 'narrator'

export interface GenerateAvatarOptions {
  role: AvatarRole
  topic: string
  durationSeconds?: number
  language?: string
  avatarImage?: Blob
}

export interface GenerateAvatarResult {
  videoBlob: Blob
  duration: number
  script: ProjectScript
  role: AvatarRole
}

const ROLE_PROMPTS: Record<AvatarRole, string> = {
  intro: 'Write a compelling opening hook that grabs attention in the first 3 seconds. Introduce the topic with energy and curiosity. 1-2 sentences max.',
  outro: 'Write a clear, memorable closing with a single call-to-action. Summarize the key takeaway in one sentence, then give one specific next step. 2-3 sentences max.',
  presenter: 'Write a presenter-style segment explaining the topic in a conversational, engaging way. Use "I" and "you" language. Break into 3-5 clear steps.',
  narrator: 'Write a documentary-style narration explaining the topic objectively. Third-person, authoritative but accessible. 4-6 sentences covering the key facts.'
}

function scriptToText(script: ProjectScript): string {
  return [script.hook, ...script.scenes.map((s: ScriptScene) => s.text), script.cta].filter(Boolean).join(' ')
}

async function createPlaceholderAvatar(w: number, h: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * 0.35
  // Background gradient
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h))
  grad.addColorStop(0, '#3b82f6')
  grad.addColorStop(1, '#1e40af')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  // Face circle
  ctx.fillStyle = '#fef3c7'
  ctx.beginPath()
  ctx.arc(cx, cy * 0.9, r, 0, Math.PI * 2)
  ctx.fill()
  // Eyes
  ctx.fillStyle = '#1e40af'
  const eyeY = cy * 0.9 - r * 0.25
  ctx.beginPath()
  ctx.arc(cx - r * 0.3, eyeY, r * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + r * 0.3, eyeY, r * 0.12, 0, Math.PI * 2)
  ctx.fill()
  // Mouth (neutral)
  ctx.strokeStyle = '#1e40af'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.25, cy * 0.9 + r * 0.25)
  ctx.quadraticCurveTo(cx, cy * 0.9 + r * 0.45, cx + r * 0.25, cy * 0.9 + r * 0.25)
  ctx.stroke()
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
}

export async function generateAvatarVideo(options: GenerateAvatarOptions): Promise<GenerateAvatarResult> {
  const { role, topic, durationSeconds, language, avatarImage } = options

  const provider = getActiveTtsProvider()
  if (!provider) throw new Error('No voice provider configured. Add an ElevenLabs or NVIDIA NIM TTS API key in Settings → Voice.')

  const cfg = useApiConfigStore.getState().config
  const avatarCfg = cfg.avatar

  // Generate role-appropriate script
  const script = await generateScript({
    topic: `${ROLE_PROMPTS[role]} Topic: "${topic}"`,
    durationSeconds,
    language,
  })

  const fullText = scriptToText(script)

  const ttsResult = await provider.synthesize({ text: fullText })
  if (!ttsResult?.blob) throw new Error('TTS synthesis failed')

  const audioBlob = ttsResult.blob

  const [w, h] = avatarCfg.resolution.split('x').map(Number)
  const mouth: LipsyncOptions['mouth'] = {
    x: avatarCfg.mouthX,
    y: avatarCfg.mouthY,
    width: avatarCfg.mouthWidth,
    maxOpen: avatarCfg.mouthMaxOpen,
  }

  // Use provided avatar image or create placeholder
  const imgBlob = avatarImage ?? await createPlaceholderAvatar(w, h)

  const lipsyncOpts: LipsyncOptions = {
    imageFile: imgBlob,
    audioFile: new File([audioBlob], 'voiceover.mp3', { type: 'audio/mpeg' }),
    width: w,
    height: h,
    fps: avatarCfg.fps,
    bitrate: 8_000_000,
    mouth,
    background: avatarCfg.background as LipsyncOptions['background'],
    codec: 'vp9',
  }

  const result = await generateLipsyncVideo(lipsyncOpts)
  return { videoBlob: result.blob, duration: result.duration, script, role }
}