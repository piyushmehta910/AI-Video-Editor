export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
export type VideoStyle = 'energetic' | 'educational' | 'cinematic' | 'minimalist' | 'tech'
export type SourceStrategy = 'stock' | 'slides' | 'motion' | 'user_media' | 'mixed'

export interface VideoBrief {
  topic: string
  audience: string
  platform: string
  durationSeconds: number
  aspectRatio: VideoAspectRatio
  style: VideoStyle
  pace: 'fast' | 'moderate' | 'calm'
  language: string
  narration: 'voiceover' | 'silent'
  music: 'upbeat' | 'cinematic' | 'ambient' | 'none'
  sourceStrategy: SourceStrategy
  useResearch: boolean
}

export interface BriefQuestion {
  id: keyof VideoBrief | 'format'
  title: string
  prompt: string
  options: Array<{ label: string; value: string }>
}

export const VIDEO_BRIEF_QUESTIONS: BriefQuestion[] = [
  { id: 'topic', title: 'Topic & message', prompt: 'What should the video say or achieve?', options: [] },
  { id: 'audience', title: 'Audience', prompt: 'Who is this video for?', options: [{ label: 'General audience', value: 'general audience' }, { label: 'Beginners / students', value: 'beginners and students' }, { label: 'Professionals', value: 'professionals' }, { label: 'Creators / social audience', value: 'creators and social audience' }] },
  { id: 'format', title: 'Platform & length', prompt: 'Where will it be published?', options: [{ label: 'Short / Reel — 30 sec', value: 'Short / Reel|30|9:16' }, { label: 'YouTube — 60 sec', value: 'YouTube|60|16:9' }, { label: 'Square post — 30 sec', value: 'Square social post|30|1:1' }, { label: 'Presentation — 90 sec', value: 'Presentation|90|16:9' }] },
  { id: 'style', title: 'Style & pacing', prompt: 'What creative direction should I use?', options: [{ label: 'Energetic & fast', value: 'energetic|fast' }, { label: 'Educational & clear', value: 'educational|moderate' }, { label: 'Cinematic & polished', value: 'cinematic|moderate' }, { label: 'Minimal & calm', value: 'minimalist|calm' }] },
  { id: 'narration', title: 'Narration & music', prompt: 'How should the video sound?', options: [{ label: 'English voice + upbeat music', value: 'English|voiceover|upbeat' }, { label: 'English voice + cinematic music', value: 'English|voiceover|cinematic' }, { label: 'Hindi voice + upbeat music', value: 'Hindi|voiceover|upbeat' }, { label: 'Silent visual video', value: 'English|silent|none' }] },
  { id: 'sourceStrategy', title: 'Visual sources', prompt: 'What should I create the visuals from?', options: [{ label: 'Stock visuals', value: 'stock|false' }, { label: 'Slides & stock', value: 'mixed|true' }, { label: 'Motion graphics', value: 'motion|false' }, { label: 'My uploaded media', value: 'user_media|false' }] },
]

export const DEFAULT_VIDEO_BRIEF: VideoBrief = {
  topic: '', audience: 'general audience', platform: 'Short / Reel', durationSeconds: 30,
  aspectRatio: '9:16', style: 'energetic', pace: 'fast', language: 'English',
  narration: 'voiceover', music: 'upbeat', sourceStrategy: 'mixed', useResearch: false,
}

export function isVideoCreationPrompt(text: string): boolean {
  return /\b(make|create|generate|produce|build)\b[\s\S]{0,80}\b(video|reel|short|youtube|film|clip|presentation)\b/i.test(text)
}

export function applyBriefAnswer(brief: VideoBrief, step: number, answer: string): VideoBrief {
  const next = { ...brief }
  if (step === 0) next.topic = answer
  if (step === 1) next.audience = answer
  if (step === 2) { const [platform, duration, aspect] = answer.split('|'); next.platform = platform || answer; next.durationSeconds = Number(duration) || next.durationSeconds; if (aspect) next.aspectRatio = aspect as VideoAspectRatio }
  if (step === 3) { const [style, pace] = answer.split('|'); next.style = (style || next.style) as VideoStyle; next.pace = (pace || next.pace) as VideoBrief['pace'] }
  if (step === 4) { const [language, narration, music] = answer.split('|'); next.language = language || next.language; next.narration = (narration || next.narration) as VideoBrief['narration']; next.music = (music || next.music) as VideoBrief['music'] }
  if (step === 5) { const [sourceStrategy, research] = answer.split('|'); next.sourceStrategy = (sourceStrategy || next.sourceStrategy) as SourceStrategy; next.useResearch = research === 'true' }
  return next
}
