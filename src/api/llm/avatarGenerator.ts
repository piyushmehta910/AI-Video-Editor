import { getActiveTtsProvider } from '@/api/tts'
import { generateScript, type ProjectScript, type ScriptScene } from './scripts'
import { generateLipsyncVideo, type LipsyncOptions, type LipsyncStyle } from '@/engine/avatar'
import { AVATAR_FACE_PRESETS, renderPresetFaceToBlob } from '@/engine/avatar/faces'
import { useApiConfigStore } from '@/api/config/store'

export type AvatarRole = 'intro' | 'outro' | 'presenter' | 'narrator'

export interface GenerateAvatarOptions {
  role: AvatarRole
  topic: string
  scriptText?: string
  durationSeconds?: number
  language?: string
  presetId?: string
  avatarImage?: Blob
  style?: LipsyncStyle
  audioBlob?: Blob
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
  narrator: 'Write a documentary-style narration explaining the topic objectively. Third-person, authoritative but accessible. 4-6 sentences covering the key facts.',
}

function scriptToText(script: ProjectScript): string {
  return [script.hook, ...script.scenes.map((s: ScriptScene) => s.text), script.cta].filter(Boolean).join(' ')
}

/**
 * Creates an audio buffer with formant-modulated speech cadence and encodes to a WAV Blob.
 * Used when no cloud TTS API key is configured.
 */
function synthesizeProceduralSpeech(text: string): Promise<Blob> {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const duration = Math.max(2, Math.min(60, words.length * 0.38))
  const sampleRate = 44100
  const numSamples = Math.floor(duration * sampleRate)
  const ctx = new AudioContext({ sampleRate })
  const buffer = ctx.createBuffer(1, numSamples, sampleRate)
  const data = buffer.getChannelData(0)

  const wordsPerSec = words.length / duration
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const wordPhase = (t * wordsPerSec) % 1
    const syllableEnv = Math.sin(wordPhase * Math.PI)
    const baseFreq = 130 + Math.sin(t * 3) * 20
    const f1 = 600 + Math.sin(t * 8) * 200
    const f2 = 1800 + Math.cos(t * 6) * 300

    const wave =
      Math.sin(2 * Math.PI * baseFreq * t) * 0.4 +
      Math.sin(2 * Math.PI * f1 * t) * 0.25 +
      Math.sin(2 * Math.PI * f2 * t) * 0.15 +
      (Math.random() * 2 - 1) * 0.05

    data[i] = wave * Math.max(0, syllableEnv) * 0.6
  }
  void ctx.close()

  // Convert AudioBuffer to 16-bit PCM WAV Blob
  const wavBuffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(wavBuffer)

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return Promise.resolve(new Blob([wavBuffer], { type: 'audio/wav' }))
}

export async function generateAvatarVideo(options: GenerateAvatarOptions): Promise<GenerateAvatarResult> {
  const { role, topic, scriptText, durationSeconds, language, presetId, avatarImage, style, audioBlob: customAudioBlob } = options

  const cfg = useApiConfigStore.getState().config
  const avatarCfg = cfg.avatar

  // 1. Generate or format script
  let script: ProjectScript
  if (scriptText && scriptText.trim()) {
    script = {
      topic: topic || 'Custom Avatar Narration',
      title: 'Avatar Script',
      hook: scriptText.trim(),
      scenes: [],
      cta: '',
      targetDurationSeconds: durationSeconds || 10,
    }
  } else {
    script = await generateScript({
      topic: `${ROLE_PROMPTS[role]} Topic: "${topic}"`,
      durationSeconds,
      language,
    })
  }

  const fullText = scriptToText(script)

  // 2. Resolve audio source (use custom audioBlob or synthesize via TTS / procedural voice)
  let audioBlob: Blob
  if (customAudioBlob) {
    audioBlob = customAudioBlob
  } else {
    const provider = getActiveTtsProvider()
    if (provider) {
      const ttsResult = await provider.synthesize({ text: fullText })
      if (ttsResult?.blob) {
        audioBlob = ttsResult.blob
      } else {
        audioBlob = await synthesizeProceduralSpeech(fullText)
      }
    } else {
      audioBlob = await synthesizeProceduralSpeech(fullText)
    }
  }

  // 3. Resolve face image & mouth coordinates
  const [w, h] = avatarCfg.resolution.split('x').map(Number)
  let imgBlob: Blob
  let mouth: LipsyncOptions['mouth'] = {
    x: avatarCfg.mouthX,
    y: avatarCfg.mouthY,
    width: avatarCfg.mouthWidth,
    maxOpen: avatarCfg.mouthMaxOpen,
  }
  let lipsyncStyle: LipsyncStyle = style ?? 'realistic'

  const matchedPreset = AVATAR_FACE_PRESETS.find((p) => p.id === (presetId || 'sarah-presenter'))
  if (avatarImage) {
    imgBlob = avatarImage
  } else if (matchedPreset) {
    imgBlob = await renderPresetFaceToBlob(matchedPreset, w, h)
    mouth = matchedPreset.mouth
    lipsyncStyle = style ?? matchedPreset.style
  } else {
    const defaultPreset = AVATAR_FACE_PRESETS[0]
    imgBlob = await renderPresetFaceToBlob(defaultPreset, w, h)
    mouth = defaultPreset.mouth
  }

  const lipsyncOpts: LipsyncOptions = {
    imageFile: imgBlob,
    audioFile: new File([audioBlob], 'voiceover.wav', { type: audioBlob.type || 'audio/wav' }),
    width: w,
    height: h,
    fps: avatarCfg.fps || 30,
    bitrate: 4_000_000,
    mouth,
    style: lipsyncStyle,
    background: (avatarCfg.background as LipsyncOptions['background']) || 'solid',
    codec: 'vp8',
  }

  const result = await generateLipsyncVideo(lipsyncOpts)
  return { videoBlob: result.blob, duration: result.duration, script, role }
}