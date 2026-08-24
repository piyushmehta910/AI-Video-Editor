import { getRecord, putRecord } from '@/engine/storage/db'

export type VideoType =
  | 'educational'
  | 'marketing'
  | 'tutorial'
  | 'storytelling'
  | 'social_short'
  | 'presentation'
  | 'vlog'

export type TargetAudience =
  | 'general_public'
  | 'students'
  | 'professionals'
  | 'tech_enthusiasts'
  | 'creators'
  | 'executives'

export type DesiredTone =
  | 'energetic'
  | 'educational'
  | 'cinematic'
  | 'minimalist'
  | 'urgent'
  | 'playful'
  | 'professional'
  | 'calm'
  | 'dramatic'

export interface UserPreferenceProfile {
  key: 'user_preferences'
  preferredVideoTypes: Record<VideoType, number> // frequency counters
  preferredTones: Record<DesiredTone, number>
  preferredPaletteMood: string
  preferredVoiceProvider: 'elevenlabs' | 'nvidia' | 'browser'
  preferredAspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
  acceptedSuggestionsCount: number
  rejectedSuggestionsCount: number
  acceptedStyleTags: string[]
  rejectedStyleTags: string[]
  updatedAt: number
}

export interface PromptClassificationResult {
  videoType: VideoType
  targetAudience: TargetAudience
  desiredTone: DesiredTone
  estimatedDurationSeconds: number
  visualStrategy: {
    use3D: boolean
    useAvatars: boolean
    useSlides: boolean
    useKineticCaptions: boolean
    pace: 'fast' | 'moderate' | 'calm'
    recommendedAspect: '16:9' | '9:16' | '1:1'
  }
  suggestedColorMood: string
  suggestedMusicMood: string
  requiredApis: string[]
  confidence: number
}

export interface ContextCompressionStats {
  originalTokensEstimate: number
  compressedTokensEstimate: number
  prunedDraftCount: number
  summarizedMilestonesCount: number
}

const DEFAULT_PREFERENCES: UserPreferenceProfile = {
  key: 'user_preferences',
  preferredVideoTypes: {
    educational: 1,
    marketing: 1,
    tutorial: 1,
    storytelling: 0,
    social_short: 2,
    presentation: 1,
    vlog: 0,
  },
  preferredTones: {
    energetic: 2,
    educational: 2,
    cinematic: 1,
    minimalist: 1,
    urgent: 0,
    playful: 1,
    professional: 2,
    calm: 1,
    dramatic: 1,
  },
  preferredPaletteMood: 'professional',
  preferredVoiceProvider: 'elevenlabs',
  preferredAspectRatio: '9:16',
  acceptedSuggestionsCount: 0,
  rejectedSuggestionsCount: 0,
  acceptedStyleTags: ['modern', 'high-contrast', 'glow'],
  rejectedStyleTags: ['retro', 'monochrome'],
  updatedAt: Date.now(),
}

/**
 * AI Context Understanding & Longitudinal User Learning Engine
 */
export class ContextUnderstandingEngine {
  private static instance: ContextUnderstandingEngine

  public static getInstance(): ContextUnderstandingEngine {
    if (!ContextUnderstandingEngine.instance) {
      ContextUnderstandingEngine.instance = new ContextUnderstandingEngine()
    }
    return ContextUnderstandingEngine.instance
  }

  /**
   * Load user preference profile from IndexedDB
   */
  public async getUserPreferences(): Promise<UserPreferenceProfile> {
    try {
      const stored = await getRecord<UserPreferenceProfile>('settings', 'user_preferences')
      if (stored) return stored
    } catch {
      // fallback
    }
    return { ...DEFAULT_PREFERENCES }
  }

  /**
   * Update longitudinal learning profile with user action
   */
  public async recordUserFeedback(event: {
    accepted?: boolean
    styleTag?: string
    videoType?: VideoType
    tone?: DesiredTone
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | '21:9'
  }): Promise<void> {
    const prefs = await this.getUserPreferences()

    if (event.accepted !== undefined) {
      if (event.accepted) prefs.acceptedSuggestionsCount++
      else prefs.rejectedSuggestionsCount++
    }

    if (event.styleTag) {
      if (event.accepted) {
        if (!prefs.acceptedStyleTags.includes(event.styleTag)) prefs.acceptedStyleTags.push(event.styleTag)
      } else {
        if (!prefs.rejectedStyleTags.includes(event.styleTag)) prefs.rejectedStyleTags.push(event.styleTag)
      }
    }

    if (event.videoType) {
      prefs.preferredVideoTypes[event.videoType] = (prefs.preferredVideoTypes[event.videoType] || 0) + 1
    }

    if (event.tone) {
      prefs.preferredTones[event.tone] = (prefs.preferredTones[event.tone] || 0) + 1
    }

    if (event.aspectRatio) {
      prefs.preferredAspectRatio = event.aspectRatio
    }

    prefs.updatedAt = Date.now()
    await putRecord('settings', prefs)
  }

  /**
   * 5.1 Context Understanding: Classify User Prompt Intent
   */
  public analyzePrompt(prompt: string, userPrefs?: UserPreferenceProfile): PromptClassificationResult {
    const text = prompt.toLowerCase()

    // 1. Video Type
    let videoType: VideoType = 'social_short'
    if (text.includes('tutorial') || text.includes('how to') || text.includes('guide') || text.includes('step by step')) {
      videoType = 'tutorial'
    } else if (text.includes('ad') || text.includes('marketing') || text.includes('promo') || text.includes('commercial') || text.includes('product')) {
      videoType = 'marketing'
    } else if (text.includes('teach') || text.includes('explain') || text.includes('science') || text.includes('history') || text.includes('course') || text.includes('lesson')) {
      videoType = 'educational'
    } else if (text.includes('slide') || text.includes('pitch') || text.includes('deck') || text.includes('presentation')) {
      videoType = 'presentation'
    } else if (text.includes('story') || text.includes('documentary') || text.includes('journey')) {
      videoType = 'storytelling'
    }

    // 2. Target Audience
    let targetAudience: TargetAudience = 'general_public'
    if (text.includes('student') || text.includes('beginner') || text.includes('kids') || text.includes('easy')) {
      targetAudience = 'students'
    } else if (text.includes('developer') || text.includes('tech') || text.includes('coder') || text.includes('ai')) {
      targetAudience = 'tech_enthusiasts'
    } else if (text.includes('executive') || text.includes('investor') || text.includes('business') || text.includes('b2b')) {
      targetAudience = 'executives'
    } else if (text.includes('creator') || text.includes('reels') || text.includes('tiktok') || text.includes('shorts')) {
      targetAudience = 'creators'
    }

    // 3. Desired Tone
    let desiredTone: DesiredTone = 'energetic'
    if (text.includes('chill') || text.includes('relax') || text.includes('calm') || text.includes('peaceful')) {
      desiredTone = 'calm'
    } else if (text.includes('cinema') || text.includes('epic') || text.includes('dramatic')) {
      desiredTone = 'dramatic'
    } else if (text.includes('minimal') || text.includes('clean') || text.includes('simple')) {
      desiredTone = 'minimalist'
    } else if (text.includes('professional') || text.includes('corporate') || text.includes('formal')) {
      desiredTone = 'professional'
    } else if (text.includes('funny') || text.includes('fun') || text.includes('meme')) {
      desiredTone = 'playful'
    }

    // 4. Duration
    let estimatedDurationSeconds = 30
    const durationMatch = text.match(/(\d+)\s*(?:second|sec|s\b|min|minute)/i)
    if (durationMatch) {
      const val = parseInt(durationMatch[1], 10)
      if (text.includes('min')) estimatedDurationSeconds = Math.min(300, Math.max(10, val * 60))
      else estimatedDurationSeconds = Math.min(300, Math.max(5, val))
    } else if (videoType === 'social_short') {
      estimatedDurationSeconds = 25
    } else if (videoType === 'presentation' || videoType === 'educational') {
      estimatedDurationSeconds = 60
    }

    // 5. Visual Strategy & Required APIs
    const use3D = text.includes('3d') || text.includes('model') || targetAudience === 'tech_enthusiasts'
    const useAvatars = text.includes('avatar') || text.includes('presenter') || text.includes('wawa') || videoType === 'educational'
    const useSlides = videoType === 'presentation' || text.includes('slide') || text.includes('bullet')
    const defaultAspect = userPrefs?.preferredAspectRatio === '16:9' ? '16:9' : '9:16'
    const recommendedAspect =
      videoType === 'social_short' || text.includes('short') || text.includes('reel') || text.includes('tiktok')
        ? '9:16'
        : (text.includes('16:9') || videoType === 'presentation' || videoType === 'educational' ? '16:9' : defaultAspect)

    const requiredApis: string[] = ['opencode_zen']
    if (useAvatars) requiredApis.push('nvidia_nim', 'elevenlabs')
    if (use3D) requiredApis.push('sketchfab')
    if (text.includes('research') || text.includes('facts')) requiredApis.push('firecrawl')
    requiredApis.push('unsplash', 'pexels')

    const suggestedColorMood =
      userPrefs?.preferredPaletteMood && !text.includes('dramatic') && !text.includes('energetic')
        ? userPrefs.preferredPaletteMood
        : (desiredTone === 'dramatic' ? 'dramatic' : desiredTone === 'professional' ? 'professional' : 'energetic')

    return {
      videoType,
      targetAudience,
      desiredTone,
      estimatedDurationSeconds,
      visualStrategy: {
        use3D,
        useAvatars,
        useSlides,
        useKineticCaptions: true,
        pace: desiredTone === 'energetic' ? 'fast' : desiredTone === 'calm' ? 'calm' : 'moderate',
        recommendedAspect,
      },
      suggestedColorMood,
      suggestedMusicMood: desiredTone === 'calm' ? 'ambient' : desiredTone === 'dramatic' ? 'cinematic' : 'upbeat',
      requiredApis,
      confidence: 0.92,
    }
  }

  /**
   * 11.2 & 11.3 Context Compression & Hygiene
   * Prunes unwanted drafts, compresses verbose logs into milestones.
   */
  public compressContext(
    conversationSteps: Array<{ role: string; content: string; timestamp?: number }>,
    maxTokens: number = 8000,
  ): {
    compressedSteps: Array<{ role: string; content: string }>
    stats: ContextCompressionStats
  } {
    let rawTokenCount = 0
    for (const step of conversationSteps) {
      rawTokenCount += Math.ceil(step.content.length / 4)
    }

    if (rawTokenCount <= maxTokens) {
      return {
        compressedSteps: conversationSteps.map((s) => ({ role: s.role, content: s.content })),
        stats: {
          originalTokensEstimate: rawTokenCount,
          compressedTokensEstimate: rawTokenCount,
          prunedDraftCount: 0,
          summarizedMilestonesCount: 0,
        },
      }
    }

    // Keep the first step (original intent), summary of middle, and last 4 recent steps
    const first = conversationSteps[0]
    const recent = conversationSteps.slice(-4)
    const middle = conversationSteps.slice(1, -4)

    const keyDecisions: string[] = []
    let prunedDrafts = 0

    for (const step of middle) {
      if (step.content.includes('intermediate draft') || step.content.includes('search candidates')) {
        prunedDrafts++
        continue
      }
      if (step.content.includes('Decision:') || step.content.includes('Plan:') || step.role === 'user') {
        keyDecisions.push(`- [${step.role}]: ${step.content.slice(0, 140)}...`)
      }
    }

    const compressedSummary = {
      role: 'system',
      content: `[Longitudinal Context Summary - ${middle.length} earlier steps compacted]\nKey Decisions:\n${keyDecisions.join('\n') || 'Completed prior scene drafting and asset curation.'}`,
    }

    const result = [
      { role: first.role, content: first.content },
      compressedSummary,
      ...recent.map((s) => ({ role: s.role, content: s.content })),
    ]

    let compressedTokens = 0
    for (const s of result) compressedTokens += Math.ceil(s.content.length / 4)

    return {
      compressedSteps: result,
      stats: {
        originalTokensEstimate: rawTokenCount,
        compressedTokensEstimate: compressedTokens,
        prunedDraftCount: prunedDrafts,
        summarizedMilestonesCount: middle.length,
      },
    }
  }
}

export const contextUnderstandingEngine = ContextUnderstandingEngine.getInstance()
