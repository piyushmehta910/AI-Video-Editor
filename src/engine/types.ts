export type TrackType = 'video' | 'audio' | 'text'
export type AssetType = 'video' | 'image' | 'audio' | 'model'

export type CameraMode = 'turntable' | 'orbit' | 'dolly' | 'static'

export const CAMERA_MODES: CameraMode[] = ['turntable', 'orbit', 'dolly', 'static']

/**
 * Camera animation rig for a 3D model clip. Angles are degrees, radius is in
 * world units relative to the model's fitted size (see modelRenderer.ts).
 * `pan` (0..1) controls how much of the sweep plays across the clip duration.
 */
export interface CameraRig {
  mode: CameraMode
  azimuthStart: number
  azimuthEnd: number
  elevationStart: number
  elevationEnd: number
  radiusStart: number
  radiusEnd: number
  targetX: number
  targetY: number
  targetZ: number
  fov: number
  pan: number
}

export function defaultCameraRig(): CameraRig {
  return {
    mode: 'turntable',
    azimuthStart: 0,
    azimuthEnd: 360,
    elevationStart: 20,
    elevationEnd: 20,
    radiusStart: 6,
    radiusEnd: 6,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    fov: 40,
    pan: 1,
  }
}

export function clampRig(partial: Partial<CameraRig>): CameraRig {
  const d = defaultCameraRig()
  const rig: CameraRig = { ...d, ...partial }
  rig.mode = CAMERA_MODES.includes(rig.mode) ? rig.mode : d.mode
  rig.pan = Math.min(1, Math.max(0.05, rig.pan))
  rig.radiusStart = Math.max(0.1, rig.radiusStart)
  rig.radiusEnd = Math.max(0.1, rig.radiusEnd)
  rig.fov = Math.min(120, Math.max(10, rig.fov))
  return rig
}

export interface Vec2 {
  x: number
  y: number
}

export type EffectType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'temperature'
  | 'tint'
  | 'blur'
  | 'grayscale'
  | 'vignette'

export interface Effect {
  id: string
  type: EffectType
  value: number
  enabled: boolean
}

export type TransitionType =
  | 'cut'
  | 'dissolve'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'slide'
  | 'zoom'

export interface Transition {
  type: TransitionType
  duration: number
}

export type TextAnimation =
  | 'none'
  | 'fade-in'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'typewriter'
  | 'pop'
  | 'bounce'

export interface TextOverlay {
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  color: string
  backgroundColor: string
  textAlign: 'left' | 'center' | 'right'
  paddingTop: number
  paddingBottom: number
  paddingLeft: number
  paddingRight: number
  borderRadius: number
  shadow: boolean
  /** Entrance animation applied over `animationDuration` seconds at clip start. */
  animation: TextAnimation
  animationDuration: number
}

export const TEXT_ANIMATIONS: TextAnimation[] = [
  'none',
  'fade-in',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-in',
  'zoom-out',
  'typewriter',
  'pop',
  'bounce',
]

export interface Clip {
  id: string
  assetId: string
  trackId: string
  /** Timeline start position in seconds */
  startTime: number
  /** Timeline duration in seconds */
  duration: number
  /** Trim start within the source asset (seconds) */
  sourceStart: number
  /** Trim end within the source asset (seconds) */
  sourceEnd: number
  /** Playback speed multiplier (0.25 – 4) */
  speed: number
  name: string
  position: Vec2
  scale: Vec2
  rotation: number
  opacity: number
  volume: number
  fadeIn: number
  fadeOut: number
  effects: Effect[]
  transitions: { in?: Transition; out?: Transition }
  thumbnailUrl?: string
  /** Text overlay (for text clips or caption overlays) */
  text?: TextOverlay
  /** Camera animation rig for 3D model clips. */
  modelRig?: CameraRig
}

export interface Track {
  id: string
  type: TrackType
  name: string
  index: number
  locked: boolean
  muted: boolean
  hidden: boolean
  clips: Clip[]
}

export interface FilmstripData {
  imageUrl: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  duration: number
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  /** OPFS-relative path */
  filePath: string
  mime: string
  size: number
  width?: number
  height?: number
  /** Source duration in seconds (for video/audio) */
  duration?: number
  thumbnailUrl?: string
  /** OPFS-relative path to low-res proxy video */
  proxyPath?: string
  /** Filmstrip thumbnail strip data */
  filmstrip?: FilmstripData
  /** Peak-amplitude waveform strip data (audio assets) */
  waveform?: FilmstripData
  /** Fitted bounding-sphere radius after normalization (model assets) */
  modelRadius?: number
  importedAt: number
}

export interface Project {
  id: string
  name: string
  width: number
  height: number
  fps: number
  aspectRatio: string
  tracks: Track[]
  createdAt: number
  modifiedAt: number
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov'
  resolution: '720p' | '1080p' | '1440p' | '4k'
  fps: number
  videoCodec: 'h264' | 'vp9' | 'av1'
  audioCodec: 'aac' | 'opus'
  quality: 'low' | 'medium' | 'high'
}

export const TRACK_TYPES: TrackType[] = ['video', 'video', 'video', 'video', 'audio', 'audio', 'audio', 'audio', 'text', 'text']

export function defaultTrackName(type: TrackType, index: number): string {
  const prefix = type === 'video' ? 'V' : type === 'audio' ? 'A' : 'T'
  return `${prefix}${index + 1}`
}

export function aspectToSize(aspect: string, base: number): { width: number; height: number } {
  const [w, h] = aspect.split(':').map(Number)
  const ratio = w / h
  if (ratio >= 1) {
    return { width: base, height: Math.round(base / ratio) }
  }
  return { width: Math.round(base * ratio), height: base }
}

export function resolutionToSize(res: ExportSettings['resolution']): { width: number; height: number } {
  switch (res) {
    case '720p':
      return { width: 1280, height: 720 }
    case '1080p':
      return { width: 1920, height: 1080 }
    case '1440p':
      return { width: 2560, height: 1440 }
    case '4k':
      return { width: 3840, height: 2160 }
  }
}

export function projectDuration(tracks: Track[]): number {
  let max = 0
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration
      if (end > max) max = end
    }
  }
  return max
}

export function createEffect(type: EffectType, value: number): Effect {
  return { id: crypto.randomUUID(), type, value, enabled: true }
}

export function newProject(name = 'Untitled Project'): Project {
  const tracks: Track[] = []
  const types: TrackType[] = [
    'video', 'video', 'video', 'video',
    'audio', 'audio', 'audio', 'audio',
    'text', 'text',
  ]
  types.forEach((type, index) => {
    tracks.push({
      id: crypto.randomUUID(),
      type,
      name: defaultTrackName(type, index),
      index,
      locked: false,
      muted: false,
      hidden: false,
      clips: [],
    })
  })
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name,
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    tracks,
    createdAt: now,
    modifiedAt: now,
  }
}

export function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.round(seconds * fps)
  const f = Math.floor(totalFrames % fps)
  const s = Math.floor(totalFrames / fps) % 60
  const m = Math.floor(totalFrames / (fps * 60)) % 60
  const h = Math.floor(totalFrames / (fps * 3600))
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`
}

export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds % 60))
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}