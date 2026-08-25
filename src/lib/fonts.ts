/**
 * Curated Google Fonts catalog and dynamic font loader.
 * Ensures fonts are dynamically fetched from Google Fonts CDN and loaded into document.fonts
 * so both the UI and Canvas 2D render crisp typography.
 */

export interface FontDefinition {
  family: string
  name: string
  category: 'Sans-Serif' | 'Display' | 'Serif' | 'Monospace' | 'Handwriting'
  weights: number[]
  fallback: string
}

export const GOOGLE_FONTS: FontDefinition[] = [
  // Sans-Serif (Modern, Clean, Viral UI)
  { family: 'Inter', name: 'Inter', category: 'Sans-Serif', weights: [400, 600, 700, 800, 900], fallback: 'sans-serif' },
  { family: 'Roboto', name: 'Roboto', category: 'Sans-Serif', weights: [400, 500, 700, 900], fallback: 'sans-serif' },
  { family: 'Montserrat', name: 'Montserrat', category: 'Sans-Serif', weights: [400, 600, 700, 800, 900], fallback: 'sans-serif' },
  { family: 'Poppins', name: 'Poppins', category: 'Sans-Serif', weights: [400, 600, 700, 800, 900], fallback: 'sans-serif' },
  { family: 'Open Sans', name: 'Open Sans', category: 'Sans-Serif', weights: [400, 600, 700, 800], fallback: 'sans-serif' },
  { family: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', category: 'Sans-Serif', weights: [500, 700, 800], fallback: 'sans-serif' },
  { family: 'DM Sans', name: 'DM Sans', category: 'Sans-Serif', weights: [400, 700, 900], fallback: 'sans-serif' },
  { family: 'Outfit', name: 'Outfit', category: 'Sans-Serif', weights: [400, 600, 700, 800], fallback: 'sans-serif' },

  // Display (Bold, YouTube / TikTok Hooks, Gaming)
  { family: 'Oswald', name: 'Oswald', category: 'Display', weights: [500, 600, 700], fallback: 'Impact, sans-serif' },
  { family: 'Bebas Neue', name: 'Bebas Neue', category: 'Display', weights: [400], fallback: 'Impact, sans-serif' },
  { family: 'Anton', name: 'Anton', category: 'Display', weights: [400], fallback: 'Impact, sans-serif' },
  { family: 'Space Grotesk', name: 'Space Grotesk', category: 'Display', weights: [500, 700], fallback: 'sans-serif' },
  { family: 'Syne', name: 'Syne', category: 'Display', weights: [700, 800], fallback: 'sans-serif' },
  { family: 'Bangers', name: 'Bangers (Comic)', category: 'Display', weights: [400], fallback: 'cursive' },
  { family: 'Permanent Marker', name: 'Permanent Marker', category: 'Display', weights: [400], fallback: 'cursive' },

  // Serif (Luxury, Film, Documentary)
  { family: 'Playfair Display', name: 'Playfair Display', category: 'Serif', weights: [400, 600, 700, 900], fallback: 'Georgia, serif' },
  { family: 'Cinzel', name: 'Cinzel (Cinematic)', category: 'Serif', weights: [600, 700, 900], fallback: 'Georgia, serif' },
  { family: 'Lora', name: 'Lora', category: 'Serif', weights: [400, 600, 700], fallback: 'Georgia, serif' },
  { family: 'Merriweather', name: 'Merriweather', category: 'Serif', weights: [400, 700, 900], fallback: 'serif' },
  { family: 'Bodoni Moda', name: 'Bodoni Moda', category: 'Serif', weights: [600, 800, 900], fallback: 'serif' },

  // Monospace (Tech, Cyberpunk, Code)
  { family: 'JetBrains Mono', name: 'JetBrains Mono', category: 'Monospace', weights: [400, 600, 700, 800], fallback: 'monospace' },
  { family: 'Fira Code', name: 'Fira Code', category: 'Monospace', weights: [400, 600, 700], fallback: 'monospace' },
  { family: 'Orbitron', name: 'Orbitron (Sci-Fi)', category: 'Monospace', weights: [600, 800, 900], fallback: 'monospace' },
  { family: 'Space Mono', name: 'Space Mono', category: 'Monospace', weights: [400, 700], fallback: 'monospace' },

  // Handwriting (Vlog, Playful, Casual)
  { family: 'Pacifico', name: 'Pacifico', category: 'Handwriting', weights: [400], fallback: 'cursive' },
  { family: 'Caveat', name: 'Caveat', category: 'Handwriting', weights: [600, 700], fallback: 'cursive' },
  { family: 'Lobster', name: 'Lobster', category: 'Handwriting', weights: [400], fallback: 'cursive' },
]

export const FONT_CATEGORIES = ['All', 'Sans-Serif', 'Display', 'Serif', 'Monospace', 'Handwriting'] as const

const loadedFonts = new Set<string>()

/**
 * Dynamically loads a Google Font by inserting a <link> tag into the head if not yet loaded.
 */
export function loadGoogleFont(family: string): void {
  if (typeof document === 'undefined') return
  const cleanFamily = family.split(',')[0].replace(/['"]/g, '').trim()
  if (!cleanFamily || loadedFonts.has(cleanFamily)) return

  const SYSTEM_FONTS = [
    'system-ui',
    'sans-serif',
    'serif',
    'monospace',
    'cursive',
    'Impact',
    'Arial',
    'Georgia',
    'Courier New',
    'Helvetica',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
  ]

  if (SYSTEM_FONTS.some((sf) => sf.toLowerCase() === cleanFamily.toLowerCase())) return

  loadedFonts.add(cleanFamily)
  const linkId = `gfont-${cleanFamily.toLowerCase().replace(/\s+/g, '-')}`
  if (document.getElementById(linkId)) return

  const link = document.createElement('link')
  link.id = linkId
  link.rel = 'stylesheet'
  const fontParam = cleanFamily.replace(/\s+/g, '+')
  link.href = `https://fonts.googleapis.com/css2?family=${fontParam}:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`
  document.head.appendChild(link)
}

/** Preload top essential fonts on startup. */
export function preloadEssentialFonts(): void {
  const top = ['Inter', 'Montserrat', 'Oswald', 'Bebas Neue', 'Playfair Display', 'JetBrains Mono', 'Cinzel']
  top.forEach(loadGoogleFont)
}
