import type { AvatarMouth } from './lipsync'

export interface AvatarFacePreset {
  id: string
  name: string
  role: 'presenter' | 'narrator' | 'intro' | 'outro'
  tagline: string
  mouth: AvatarMouth
  style: 'realistic' | 'cartoon' | 'robotic' | 'circle'
  previewGradient: string
  svg: string
}

export const AVATAR_FACE_PRESETS: AvatarFacePreset[] = [
  {
    id: 'sarah-presenter',
    name: 'Sarah · Studio Host',
    role: 'presenter',
    tagline: 'Professional presentation & tutorial host',
    mouth: { x: 0.5, y: 0.72, width: 0.22, maxOpen: 0.12 },
    style: 'realistic',
    previewGradient: 'from-violet-600 to-indigo-800',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <defs>
        <radialGradient id="bg_sarah" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#3b2d54"/>
          <stop offset="100%" stop-color="#181324"/>
        </radialGradient>
        <linearGradient id="skin_sarah" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffdfba"/>
          <stop offset="100%" stop-color="#e8b88a"/>
        </linearGradient>
        <linearGradient id="hair_sarah" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#4a2e18"/>
          <stop offset="100%" stop-color="#2a180b"/>
        </linearGradient>
        <linearGradient id="suit_sarah" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#4f46e5"/>
          <stop offset="100%" stop-color="#312e81"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg_sarah)"/>
      <path d="M128 512 C128 400, 200 370, 256 370 C312 370, 384 400, 384 512 Z" fill="url(#suit_sarah)"/>
      <path d="M220 370 L256 430 L292 370 Z" fill="#ffffff"/>
      <path d="M236 310 L236 380 L276 380 L276 310 Z" fill="url(#skin_sarah)"/>
      <path d="M160 210 C160 110, 352 110, 352 210 C352 320, 160 320, 160 210 Z" fill="url(#hair_sarah)"/>
      <ellipse cx="256" cy="240" rx="90" ry="110" fill="url(#skin_sarah)"/>
      <ellipse cx="220" cy="225" rx="12" ry="10" fill="#2b1b17"/>
      <ellipse cx="292" cy="225" rx="12" ry="10" fill="#2b1b17"/>
      <circle cx="224" cy="222" r="4" fill="#ffffff"/>
      <circle cx="296" cy="222" r="4" fill="#ffffff"/>
      <path d="M205 205 Q220 198 235 205" stroke="#2b1b17" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M277 205 Q292 198 307 205" stroke="#2b1b17" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M256 240 Q253 260 248 268 Q256 270 264 268" stroke="#d99b70" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M165 170 C165 120, 210 100, 256 100 C302 100, 347 120, 347 170 C347 210, 335 280, 335 280 C310 230, 290 160, 256 160 C222 160, 202 230, 177 280 Z" fill="url(#hair_sarah)"/>
    </svg>`,
  },
  {
    id: 'marcus-anchor',
    name: 'Marcus · News Anchor',
    role: 'narrator',
    tagline: 'Authoritative documentary & broadcast presenter',
    mouth: { x: 0.5, y: 0.71, width: 0.21, maxOpen: 0.12 },
    style: 'realistic',
    previewGradient: 'from-amber-700 to-stone-900',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <defs>
        <radialGradient id="bg_marcus" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#27272a"/>
          <stop offset="100%" stop-color="#09090b"/>
        </radialGradient>
        <linearGradient id="skin_marcus" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#8d5524"/>
          <stop offset="100%" stop-color="#5c3818"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg_marcus)"/>
      <path d="M120 512 C120 395, 195 365, 256 365 C317 365, 392 395, 392 512 Z" fill="#18181b"/>
      <path d="M230 365 L256 425 L282 365 Z" fill="#fafafa"/>
      <path d="M250 365 L256 440 L262 365 Z" fill="#dc2626"/>
      <ellipse cx="256" cy="240" rx="92" ry="110" fill="url(#skin_marcus)"/>
      <path d="M170 190 C170 125, 215 105, 256 105 C297 105, 342 125, 342 190 Z" fill="#18181b"/>
      <ellipse cx="218" cy="225" rx="11" ry="10" fill="#18181b"/>
      <ellipse cx="294" cy="225" rx="11" ry="10" fill="#18181b"/>
      <circle cx="221" cy="222" r="3" fill="#ffffff"/>
      <circle cx="297" cy="222" r="3" fill="#ffffff"/>
      <path d="M202 205 Q218 198 234 205" stroke="#18181b" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M278 205 Q294 198 310 205" stroke="#18181b" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M256 242 Q251 262 246 270 Q256 273 266 270" stroke="#3d2410" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'alex-tech',
    name: 'Alex · Tech Reviewer',
    role: 'intro',
    tagline: 'High-energy tech reviewer with modern style',
    mouth: { x: 0.5, y: 0.74, width: 0.2, maxOpen: 0.11 },
    style: 'cartoon',
    previewGradient: 'from-cyan-600 to-blue-900',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <defs>
        <radialGradient id="bg_alex" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </radialGradient>
        <linearGradient id="skin_alex" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fed7aa"/>
          <stop offset="100%" stop-color="#fba068"/>
        </linearGradient>
        <linearGradient id="hoodie_alex" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg_alex)"/>
      <path d="M120 512 C120 390, 190 360, 256 360 C322 360, 392 390, 392 512 Z" fill="url(#hoodie_alex)"/>
      <ellipse cx="256" cy="245" rx="88" ry="105" fill="url(#skin_alex)"/>
      <path d="M168 200 C168 130, 210 110, 256 110 C302 110, 344 130, 344 200 C344 220, 335 240, 335 240 C320 180, 295 150, 256 150 C217 150, 192 180, 177 240 Z" fill="#334155"/>
      <rect x="200" y="210" width="46" height="32" rx="8" fill="none" stroke="#0284c7" stroke-width="4"/>
      <rect x="266" y="210" width="46" height="32" rx="8" fill="none" stroke="#0284c7" stroke-width="4"/>
      <line x1="246" y1="226" x2="266" y2="226" stroke="#0284c7" stroke-width="4"/>
      <ellipse cx="223" cy="226" rx="8" ry="8" fill="#1e293b"/>
      <ellipse cx="289" cy="226" rx="8" ry="8" fill="#1e293b"/>
      <circle cx="226" cy="224" r="2.5" fill="#ffffff"/>
      <circle cx="292" cy="224" r="2.5" fill="#ffffff"/>
      <path d="M256 248 Q252 265 248 274 Q256 276 264 274" stroke="#d97706" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'elena-exec',
    name: 'Elena · Keynote Host',
    role: 'presenter',
    tagline: 'Sleek corporate keynote speaker with platinum styling',
    mouth: { x: 0.5, y: 0.72, width: 0.22, maxOpen: 0.12 },
    style: 'realistic',
    previewGradient: 'from-slate-600 to-sky-950',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <defs>
        <radialGradient id="bg_elena" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
        <linearGradient id="hair_elena" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f1f5f9"/>
          <stop offset="100%" stop-color="#94a3b8"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg_elena)"/>
      <path d="M125 512 C125 400, 195 370, 256 370 C317 370, 387 400, 387 512 Z" fill="#0f172a"/>
      <path d="M210 370 L256 440 L302 370 Z" fill="#0284c7"/>
      <ellipse cx="256" cy="235" rx="88" ry="108" fill="#fdf2f8"/>
      <path d="M160 170 C160 90, 352 90, 352 170 C352 260, 330 280, 330 280 C310 210, 290 140, 256 140 C222 140, 202 210, 182 280 Z" fill="url(#hair_elena)"/>
      <ellipse cx="218" cy="220" rx="10" ry="10" fill="#0369a1"/>
      <ellipse cx="294" cy="220" rx="10" ry="10" fill="#0369a1"/>
      <circle cx="221" cy="217" r="3" fill="#ffffff"/>
      <circle cx="297" cy="217" r="3" fill="#ffffff"/>
      <path d="M202 200 Q218 194 234 200" stroke="#475569" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M278 200 Q294 194 310 200" stroke="#475569" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M256 235 Q252 255 248 262 Q256 265 264 262" stroke="#f472b6" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'david-podcaster',
    name: 'David · Podcast Host',
    role: 'narrator',
    tagline: 'Warm conversational podcaster with studio headphones',
    mouth: { x: 0.5, y: 0.74, width: 0.22, maxOpen: 0.13 },
    style: 'realistic',
    previewGradient: 'from-amber-600 to-stone-900',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <defs>
        <radialGradient id="bg_david" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#451a03"/>
          <stop offset="100%" stop-color="#1c0a00"/>
        </radialGradient>
        <linearGradient id="skin_david" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffedd5"/>
          <stop offset="100%" stop-color="#fdba74"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg_david)"/>
      <path d="M125 512 C125 390, 195 360, 256 360 C317 360, 387 390, 387 512 Z" fill="#292524"/>
      <ellipse cx="256" cy="245" rx="88" ry="105" fill="url(#skin_david)"/>
      <path d="M170 195 C170 130, 210 110, 256 110 C302 110, 342 130, 342 195 Z" fill="#451a03"/>
      <path d="M185 270 C185 340, 327 340, 327 270 C327 310, 300 350, 256 350 C212 350, 185 310, 185 270 Z" fill="#451a03"/>
      <path d="M150 230 C150 110, 362 110, 362 230" stroke="#f59e0b" stroke-width="12" fill="none" stroke-linecap="round"/>
      <rect x="140" y="210" width="28" height="55" rx="10" fill="#1c1917" stroke="#f59e0b" stroke-width="3"/>
      <rect x="344" y="210" width="28" height="55" rx="10" fill="#1c1917" stroke="#f59e0b" stroke-width="3"/>
      <ellipse cx="220" cy="225" rx="10" ry="10" fill="#292524"/>
      <ellipse cx="292" cy="225" rx="10" ry="10" fill="#292524"/>
      <circle cx="223" cy="222" r="3" fill="#ffffff"/>
      <circle cx="295" cy="222" r="3" fill="#ffffff"/>
      <path d="M256 245 Q252 265 248 272 Q256 275 264 272" stroke="#ea580c" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'hikari-anime',
    name: 'Hikari · Anime Presenter',
    role: 'outro',
    tagline: 'Expressive anime aesthetic with dynamic chibi lip-sync',
    mouth: { x: 0.5, y: 0.76, width: 0.25, maxOpen: 0.15 },
    style: 'cartoon',
    previewGradient: 'from-pink-600 to-purple-950',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <defs>
        <radialGradient id="bg_anime" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#4a044e"/>
          <stop offset="100%" stop-color="#1f0221"/>
        </radialGradient>
        <linearGradient id="hair_anime" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ec4899"/>
          <stop offset="100%" stop-color="#be185d"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg_anime)"/>
      <path d="M140 512 C140 410, 200 380, 256 380 C312 380, 372 410, 372 512 Z" fill="#db2777"/>
      <path d="M150 220 C150 100, 362 100, 362 220 C362 340, 150 340, 150 220 Z" fill="url(#hair_anime)"/>
      <ellipse cx="256" cy="245" rx="85" ry="100" fill="#fff1f2"/>
      <ellipse cx="215" cy="225" rx="16" ry="20" fill="#be185d"/>
      <ellipse cx="297" cy="225" rx="16" ry="20" fill="#be185d"/>
      <circle cx="212" cy="216" r="6" fill="#ffffff"/>
      <circle cx="294" cy="216" r="6" fill="#ffffff"/>
      <ellipse cx="195" cy="260" rx="12" ry="7" fill="#fbcfe8"/>
      <ellipse cx="317" cy="260" rx="12" ry="7" fill="#fbcfe8"/>
      <path d="M155 160 C155 110, 200 90, 256 90 C312 90, 357 110, 357 160 C357 200, 340 270, 340 270 C315 210, 290 140, 256 140 C222 140, 197 210, 172 270 Z" fill="url(#hair_anime)"/>
    </svg>`,
  },
]

/**
 * Renders an SVG avatar preset onto an in-memory canvas and returns a high-res PNG Blob.
 */
export async function renderPresetFaceToBlob(
  preset: AvatarFacePreset,
  width = 768,
  height = 768,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2d canvas context')

  let cleanSvg = preset.svg.trim()
  if (!cleanSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    cleanSvg = cleanSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'

  const svgBlob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      // Fallback to data URI if blob URL has strict CSP restrictions
      const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cleanSvg)
      const fallbackImg = new Image()
      fallbackImg.crossOrigin = 'anonymous'
      fallbackImg.onload = () => {
        ctx.drawImage(fallbackImg, 0, 0, width, height)
        resolve()
      }
      fallbackImg.onerror = () => {
        reject(new Error('Failed to load avatar SVG'))
      }
      fallbackImg.src = dataUri
    }
    img.src = url
  })

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to convert canvas to blob'))
    }, 'image/png')
  })
}
