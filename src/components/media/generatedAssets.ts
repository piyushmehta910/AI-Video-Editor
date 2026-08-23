import type { Asset } from '@/engine/types'
import type { GeneratedSubTab } from '@/stores/editorStore'

/** Assets produced by in-app AI tools carry these markers in their names. */
const GENERATED_MARKERS = [
  'denoised',
  'lipsync',
  'avatar',
  'generated',
  'slide',
  'sticker',
  'upscale',
  'reframe',
  'bg-removed',
  'nobg',
]

export function isGenerated(asset: Asset): boolean {
  const name = asset.name.toLowerCase()
  return GENERATED_MARKERS.some((marker) => name.includes(marker))
}

export type GeneratedKind = Exclude<GeneratedSubTab, 'all'>

export function generatedCategory(asset: Asset): GeneratedKind {
  const n = asset.name.toLowerCase()
  if (n.includes('avatar') || n.includes('lipsync')) return 'avatars'
  if (asset.type === 'audio' || n.includes('voice') || n.includes('voiceover')) return 'voice'
  if (n.includes('slide') || n.includes('sticker') || n.includes('motion') || n.includes('animation')) return 'animations'
  return 'images'
}
