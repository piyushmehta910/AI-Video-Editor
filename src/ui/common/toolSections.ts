import type * as React from 'react'
import {
  Type,
  BarChart3,
  Sparkles,
  Music,
  Mic,
  FileText,
  ArrowLeftRight,
  Smile,
  Gauge,
  Diamond,
  Crop,
  Presentation,
  Clapperboard,
  Code,
  ScrollText,
  ImagePlus,
} from 'lucide-react'

export type ToolSection =
  | 'text'
  | 'insights'
  | 'effects'
  | 'audio'
  | 'captions'
  | 'transitions'
  | 'stickers'
  | 'speed'
  | 'keyframe'
  | 'crop'
  | 'slide'
  | 'avatar'
  | 'design'
  | 'script'
  | 'images'
  | 'voiceover'

export const TOOL_SECTIONS: { id: ToolSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'text', label: 'Text Presets', icon: Type },
  { id: 'captions', label: 'Captions', icon: FileText },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'voiceover', label: 'Voiceover', icon: Mic },
  { id: 'avatar', label: 'Avatar', icon: Clapperboard },
  { id: 'slide', label: 'Slides', icon: Presentation },
  { id: 'script', label: 'Script', icon: ScrollText },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'images', label: 'Stock Media', icon: ImagePlus },
  { id: 'speed', label: 'Speed', icon: Gauge },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'keyframe', label: 'Keyframe', icon: Diamond },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'design', label: 'Design', icon: Code },
]

export function getToolMeta(section: string | null) {
  if (!section) return TOOL_SECTIONS[0]
  return TOOL_SECTIONS.find((s) => s.id === section) || TOOL_SECTIONS[0]
}

export const SECTION_DESCRIPTIONS: Record<ToolSection, string> = {
  text: 'Add titles, headings, lower thirds and styled text presets',
  insights: 'Project health, coverage and quality diagnostics',
  effects: 'Color grades, light filters, and stylized looks',
  audio: 'Music, audio enhancements, and audio cleanup',
  voiceover: 'AI text-to-speech with natural voices & audio cloning',
  captions: 'Automated speech subtitles and animated captions',
  transitions: 'Smooth cuts, wipes, and transitions between clips',
  stickers: 'Giphy animated GIF stickers and overlay graphics',
  speed: 'Clip playback rate presets and speed ramps',
  keyframe: 'Smooth position, scale, and opacity keyframe animations',
  crop: 'Framing, panning, and aspect ratio adjustments',
  slide: 'Interactive AI presentation slides and keynotes',
  avatar: 'Lip-synced AI presenters and avatar generation',
  design: 'HTML/CSS motion graphics and kinetic typography',
  script: 'AI teleprompter and structured script generator',
  images: 'Free stock photos and royalty-free media search',
}

export type ToolCategory = 'all' | 'visual' | 'audio' | 'titles' | 'ai' | 'transform'

export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'all', label: 'All Tools' },
  { id: 'visual', label: 'Visual & FX' },
  { id: 'audio', label: 'Audio & Voice' },
  { id: 'titles', label: 'Text & Titles' },
  { id: 'ai', label: 'AI Studios' },
  { id: 'transform', label: 'Motion & Speed' },
]

export const TOOL_SECTION_CATEGORY: Record<ToolSection, ToolCategory> = {
  text: 'titles',
  captions: 'titles',
  stickers: 'titles',
  images: 'titles',
  effects: 'visual',
  transitions: 'visual',
  crop: 'visual',
  audio: 'audio',
  voiceover: 'audio',
  avatar: 'ai',
  slide: 'ai',
  script: 'ai',
  design: 'ai',
  speed: 'transform',
  keyframe: 'transform',
  insights: 'all',
}

