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
  topic: '',
  audience: 'general audience',
  platform: 'Short / Reel',
  durationSeconds: 30,
  aspectRatio: '9:16',
  style: 'energetic',
  pace: 'fast',
  language: 'English',
  narration: 'voiceover',
  music: 'upbeat',
  sourceStrategy: 'mixed',
  useResearch: false,
}

/**
 * Extracts a clean, semantic topic string from a conversational command prompt.
 * e.g. "Create a 30 second video about solar energy savings" -> "solar energy savings"
 */
export function extractCleanTopic(text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned.replace(
    /^(?:please\s+)?(?:can you\s+)?(?:make|create|generate|produce|build|turn|compose)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:\d+\s*(?:sec|seconds?|s|min|minutes?)\s+)?(?:video|reel|short|youtube(?:\s+short)?|film|clip|presentation)\s+(?:about|on|explaining|for|regarding|showcasing)\s+/i,
    '',
  )
  cleaned = cleaned.replace(
    /^(?:i\s+want\s+(?:a\s+|an\s+)?(?:video|reel|short|film)\s+(?:about|on|explaining|for|regarding|showcasing)\s+)/i,
    '',
  )
  cleaned = cleaned.replace(
    /^(?:video|reel|short|film|clip|presentation)\s+(?:about|on|explaining|for|regarding|showcasing)\s+/i,
    '',
  )
  return cleaned.trim()
}

/**
 * Recognizes topic-to-video creation requests without capturing regular timeline edit commands.
 */
export function isVideoCreationPrompt(text: string): boolean {
  const trimmed = text.trim()
  if (/^(trim|cut|split|delete|remove|speed up|slow down|mute|join|duplicate|grade|color grade|transcribe|reframe)\b/i.test(trimmed)) {
    return false
  }
  if (/\b(make|create|generate|produce|build|turn|want|compose)\b[\s\S]{0,80}\b(video|reel|short|youtube|film|clip|presentation)\b/i.test(trimmed)) {
    return true
  }
  if (/^(?:a\s+)?(?:video|reel|short|film|clip|presentation)\s+(?:about|on|explaining|for|regarding)\b/i.test(trimmed)) {
    return true
  }
  return false
}

/**
 * Applies a question answer (preset pipe-delimited or natural language write-in) to a VideoBrief.
 */
export function applyBriefAnswer(brief: VideoBrief, step: number, answer: string): VideoBrief {
  const next = { ...brief }
  const trimmed = answer.trim()
  if (!trimmed) return next

  if (step === 0) {
    next.topic = extractCleanTopic(trimmed) || trimmed
    return next
  }

  if (step === 1) {
    next.audience = trimmed
    return next
  }

  // Preset split if pipe delimiter exists
  if (trimmed.includes('|')) {
    if (step === 2) {
      const [platform, duration, aspect] = trimmed.split('|')
      next.platform = platform || next.platform
      next.durationSeconds = Number(duration) || next.durationSeconds
      if (aspect) next.aspectRatio = aspect as VideoAspectRatio
    }
    if (step === 3) {
      const [style, pace] = trimmed.split('|')
      next.style = (style || next.style) as VideoStyle
      next.pace = (pace || next.pace) as VideoBrief['pace']
    }
    if (step === 4) {
      const [language, narration, music] = trimmed.split('|')
      next.language = language || next.language
      next.narration = (narration || next.narration) as VideoBrief['narration']
      next.music = (music || next.music) as VideoBrief['music']
    }
    if (step === 5) {
      const [sourceStrategy, research] = trimmed.split('|')
      next.sourceStrategy = (sourceStrategy || next.sourceStrategy) as SourceStrategy
      next.useResearch = research === 'true'
    }
    return next
  }

  // Natural language custom answer extraction
  if (step === 2) {
    // Aspect ratio
    const aspectMatch = trimmed.match(/\b(16:9|9:16|1:1|4:5|21:9)\b/i)
    if (aspectMatch) {
      next.aspectRatio = aspectMatch[1] as VideoAspectRatio
    } else if (/\b(vertical|portrait|tiktok|shorts?|reels?)\b/i.test(trimmed)) {
      next.aspectRatio = '9:16'
    } else if (/\b(horizontal|landscape|youtube|widescreen)\b/i.test(trimmed)) {
      next.aspectRatio = '16:9'
    } else if (/\bsquare\b/i.test(trimmed)) {
      next.aspectRatio = '1:1'
    }

    // Duration in seconds or minutes
    const secMatch = trimmed.match(/(\d+)\s*(?:s|sec|seconds?)\b/i)
    const minMatch = trimmed.match(/(\d+)\s*(?:m|min|minutes?)\b/i)
    if (minMatch) {
      next.durationSeconds = Number(minMatch[1]) * 60
    } else if (secMatch) {
      next.durationSeconds = Number(secMatch[1])
    } else {
      const numMatch = trimmed.match(/\b(\d+)\b/)
      if (numMatch) next.durationSeconds = Number(numMatch[1])
    }
    next.platform = trimmed
  }

  if (step === 3) {
    if (/\b(energetic|fast|hype|punchy)\b/i.test(trimmed)) next.style = 'energetic'
    else if (/\b(educational|explainer|tutorial|lesson)\b/i.test(trimmed)) next.style = 'educational'
    else if (/\b(cinematic|film|polished|dramatic)\b/i.test(trimmed)) next.style = 'cinematic'
    else if (/\b(minimal|minimalist|clean|calm)\b/i.test(trimmed)) next.style = 'minimalist'
    else if (/\b(tech|technology|futuristic|modern)\b/i.test(trimmed)) next.style = 'tech'

    if (/\b(fast|quick)\b/i.test(trimmed)) next.pace = 'fast'
    else if (/\b(calm|slow|relaxed)\b/i.test(trimmed)) next.pace = 'calm'
    else if (/\b(moderate|medium|steady)\b/i.test(trimmed)) next.pace = 'moderate'
  }

  if (step === 4) {
    const langMatch = trimmed.match(/\b(Hindi|Spanish|French|German|Japanese|Chinese|Italian|Portuguese|Russian|Arabic|Korean|English)\b/i)
    if (langMatch) next.language = langMatch[1]

    if (/\b(silent|no voice|text only|no speech)\b/i.test(trimmed)) next.narration = 'silent'
    else if (/\b(voice|voiceover|spoken|narrator|narration|tts)\b/i.test(trimmed)) next.narration = 'voiceover'

    if (/\b(no music|none|silent music|without music)\b/i.test(trimmed)) next.music = 'none'
    else if (/\b(cinematic|epic|orchestral)\b/i.test(trimmed)) next.music = 'cinematic'
    else if (/\b(ambient|chill|lofi|calm|soft)\b/i.test(trimmed)) next.music = 'ambient'
    else if (/\b(upbeat|happy|energetic|pop)\b/i.test(trimmed)) next.music = 'upbeat'
  }

  if (step === 5) {
    if (/\b(stock|b-roll|photos?|images?)\b/i.test(trimmed)) next.sourceStrategy = 'stock'
    else if (/\b(slide|deck|presentation)\b/i.test(trimmed)) next.sourceStrategy = 'slides'
    else if (/\b(motion|graphics?|animation)\b/i.test(trimmed)) next.sourceStrategy = 'motion'
    else if (/\b(user|my media|my footage|uploaded)\b/i.test(trimmed)) next.sourceStrategy = 'user_media'
    else if (/\b(mixed|combination|both|all)\b/i.test(trimmed)) next.sourceStrategy = 'mixed'

    if (/\b(research|facts?|web|firecrawl|sources?)\b/i.test(trimmed)) {
      next.useResearch = !/\b(no research|without research|false)\b/i.test(trimmed)
    }
  }

  return next
}
