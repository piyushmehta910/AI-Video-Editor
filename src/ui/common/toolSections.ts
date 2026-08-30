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
  { id: 'text', label: 'Text & Titles', icon: Type },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'voiceover', label: 'Voiceover', icon: Mic },
  { id: 'captions', label: 'Captions', icon: FileText },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'speed', label: 'Speed', icon: Gauge },
  { id: 'keyframe', label: 'Keyframe', icon: Diamond },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'slide', label: 'Slides', icon: Presentation },
  { id: 'avatar', label: 'Avatar', icon: Clapperboard },
  { id: 'design', label: 'Design', icon: Code },
  { id: 'script', label: 'Script', icon: ScrollText },
  { id: 'images', label: 'Images', icon: ImagePlus },
]

