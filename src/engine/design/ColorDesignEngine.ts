export interface ColorPalette {
  id: string
  name: string
  mood: 'professional' | 'energetic' | 'calm' | 'dramatic' | 'playful' | 'luxurious' | 'cyberpunk' | 'nature'
  industry: 'technology' | 'healthcare' | 'education' | 'finance' | 'creative' | 'marketing' | 'general'
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  textPrimary: string
  textSecondary: string
  gradient: string
  fontFamily: string
}

export const PALETTE_LIBRARY: ColorPalette[] = [
  {
    id: 'tech_neon',
    name: 'Cyberpunk Neon',
    mood: 'cyberpunk',
    industry: 'technology',
    primary: '#8b5cf6',
    secondary: '#06b6d4',
    accent: '#f43f5e',
    background: '#09090b',
    surface: '#18181b',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'corporate_blue',
    name: 'Executive Trust',
    mood: 'professional',
    industry: 'finance',
    primary: '#2563eb',
    secondary: '#0284c7',
    accent: '#f59e0b',
    background: '#0f172a',
    surface: '#1e293b',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'energetic_amber',
    name: 'Viral Energy',
    mood: 'energetic',
    industry: 'marketing',
    primary: '#f97316',
    secondary: '#ec4899',
    accent: '#eab308',
    background: '#0c0a09',
    surface: '#1c1917',
    textPrimary: '#fafaf9',
    textSecondary: '#a8a29e',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'calm_emerald',
    name: 'Eco Serenity',
    mood: 'calm',
    industry: 'healthcare',
    primary: '#10b981',
    secondary: '#14b8a6',
    accent: '#84cc16',
    background: '#022c22',
    surface: '#064e3b',
    textPrimary: '#ecfdf5',
    textSecondary: '#a7f3d0',
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    fontFamily: 'Inter, sans-serif',
  },
  {
    id: 'dramatic_crimson',
    name: 'Cinematic Noir',
    mood: 'dramatic',
    industry: 'creative',
    primary: '#e11d48',
    secondary: '#7c3aed',
    accent: '#fbbf24',
    background: '#030712',
    surface: '#111827',
    textPrimary: '#f9fafb',
    textSecondary: '#9ca3af',
    gradient: 'linear-gradient(135deg, #991b1b 0%, #e11d48 100%)',
    fontFamily: 'Inter, serif',
  },
  {
    id: 'playful_violet',
    name: 'Playful Pop',
    mood: 'playful',
    industry: 'creative',
    primary: '#d946ef',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    background: '#18022e',
    surface: '#2e0854',
    textPrimary: '#fae8ff',
    textSecondary: '#e9d5ff',
    gradient: 'linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%)',
    fontFamily: 'system-ui, sans-serif',
  },
]

/**
 * Calculate Relative Luminance according to WCAG 2.1 specifications
 */
export function getRelativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length < 6) return 0.5

  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

/**
 * Calculate Contrast Ratio between two hex colors (1:1 to 21:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1)
  const l2 = getRelativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 9.1 & 9.2 Color and Design Intelligence Engine
 */
export class ColorDesignEngine {
  private static instance: ColorDesignEngine

  public static getInstance(): ColorDesignEngine {
    if (!ColorDesignEngine.instance) {
      ColorDesignEngine.instance = new ColorDesignEngine()
    }
    return ColorDesignEngine.instance
  }

  /**
   * Select the most fitting color palette based on mood and optional industry
   */
  public selectPalette(mood: string, industry?: string): ColorPalette {
    const match = PALETTE_LIBRARY.find((p) => p.mood === mood && (!industry || p.industry === industry))
    if (match) return match

    const moodMatch = PALETTE_LIBRARY.find((p) => p.mood === mood)
    if (moodMatch) return moodMatch

    return PALETTE_LIBRARY[0]
  }

  /**
   * Validate WCAG AA accessibility compliance (minimum 4.5:1 for normal text, 3:1 for large text)
   */
  public validateTextReadability(
    textColor: string,
    backgroundColor: string,
    isLargeText: boolean = false,
  ): {
    contrastRatio: number
    passesAA: boolean
    passesAAA: boolean
    recommendedCompensation?: 'add_drop_shadow' | 'add_background_capsule' | 'invert_text'
  } {
    const ratio = getContrastRatio(textColor, backgroundColor)
    const thresholdAA = isLargeText ? 3.0 : 4.5
    const thresholdAAA = isLargeText ? 4.5 : 7.0

    const passesAA = ratio >= thresholdAA
    const passesAAA = ratio >= thresholdAAA

    let recommendedCompensation: 'add_drop_shadow' | 'add_background_capsule' | 'invert_text' | undefined

    if (!passesAA) {
      if (ratio < 2.0) {
        recommendedCompensation = 'add_background_capsule'
      } else {
        recommendedCompensation = 'add_drop_shadow'
      }
    }

    return {
      contrastRatio: Math.round(ratio * 100) / 100,
      passesAA,
      passesAAA,
      recommendedCompensation,
    }
  }

  /**
   * Generate CSS typography & color variable styles for overlays
   */
  public generateStyleVariables(palette: ColorPalette): Record<string, string> {
    return {
      '--video-primary': palette.primary,
      '--video-secondary': palette.secondary,
      '--video-accent': palette.accent,
      '--video-bg': palette.background,
      '--video-surface': palette.surface,
      '--video-text': palette.textPrimary,
      '--video-text-sub': palette.textSecondary,
      '--video-gradient': palette.gradient,
      '--video-font': palette.fontFamily,
    }
  }
}

export const colorDesignEngine = ColorDesignEngine.getInstance()
