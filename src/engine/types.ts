/**
 * Exactly four track types:
 *  - video: video files, images, avatar clips, generated animations (layered V1 < V2 < …)
 *  - audio: audio files, voiceover, music, SFX
 *  - text: captions, titles, lower thirds, stickers, callouts
 *  - fx: transitions, color filters, overlays, motion graphics
 */
export type TrackType = 'video' | 'audio' | 'text' | 'fx'

/** Content subtype for clips on VIDEO tracks. */
export type VideoClipType = 'video' | 'image' | 'avatar' | 'animation'
/** Content subtype for clips on AUDIO tracks. */
export type AudioClipType = 'audio' | 'music' | 'voice' | 'sfx'
/** Content subtype for clips on TEXT tracks. */
export type TextClipType = 'caption' | 'title' | 'lowerThird' | 'sticker' | 'callout'
/** Content subtype for clips on FX tracks. */
export type FxClipType = 'transition' | 'filter' | 'overlay' | 'motion'
/** Any clip content subtype (video + audio variants share `clipType`). */
export type MediaClipType = VideoClipType | AudioClipType
export type AssetType = 'video' | 'image' | 'audio' | 'model'
export type CameraMode =
  | 'turntable'
  | 'orbit'
  | 'dolly'
  | 'dolly_in'
  | 'dolly_out'
  | 'flyby'
  | 'isometric_spin'
  | 'dutch_sweep'
  | 'spiral'
  | 'static'

export const CAMERA_MODES: CameraMode[] = [
  'turntable',
  'orbit',
  'dolly',
  'dolly_in',
  'dolly_out',
  'flyby',
  'isometric_spin',
  'dutch_sweep',
  'spiral',
  'static',
]

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
  | 'vibrance'
  | 'temperature'
  | 'tint'
  | 'hue'
  | 'blur'
  | 'grayscale'
  | 'vignette'
  | 'grain'
  | 'chromatic-aberration'
  | 'glitch'
  | 'morph'

export interface Effect {
  id: string
  type: EffectType
  value: number
  enabled: boolean
  /** For chromatic-aberration: offset in pixels (default 2) */
  aberrationOffset?: number
  /** For glitch: intensity 0-1 */
  glitchIntensity?: number
  /** For glitch: scanline count */
  scanlines?: number
  /** For vignette: inner radius as a fraction of frame min-side (default 0.35) */
  radius?: number
}

/** Canvas globalCompositeOperation values exposed in the inspector. */
export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export const BLEND_MODES: BlendMode[] = [
  'normal',
  'screen',
  'multiply',
  'overlay',
  'soft-light',
  'hard-light',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
]

export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  screen: 'Screen',
  multiply: 'Multiply',
  overlay: 'Overlay',
  'soft-light': 'Soft Light',
  'hard-light': 'Hard Light',
  darken: 'Darken',
  lighten: 'Lighten',
  'color-dodge': 'Color Dodge',
  'color-burn': 'Color Burn',
  difference: 'Difference',
  exclusion: 'Exclusion',
  hue: 'Hue',
  saturation: 'Saturation',
  color: 'Color',
  luminosity: 'Luminosity',
}

/** Manual crop edges as percentages (0–45) trimmed from each source side. */
export interface CropEdges {
  top: number
  right: number
  bottom: number
  left: number
}

/** A single property keyframe captured at a timeline time. Interpolation is a future concern. */
export interface ClipKeyframe {
  id: string
  /** Property path, e.g. 'position', 'scale', 'rotation', 'opacity' */
  prop: string
  /** Timeline time in seconds */
  time: number
  value: number
}

export type TransitionEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export const TRANSITION_EASINGS: TransitionEasing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out']

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
  /** Progression curve applied to the transition alpha (default ease-in-out). */
  easing?: TransitionEasing
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
  /** Optional outline drawn behind the glyphs. */
  stroke?: { width: number; color: string }
  /** Shadow customization (defaults: rgba(0,0,0,0.7), blur 6, offset 2/2). */
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
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
  /** Transform anchor point, 0..1 within the drawn layer (default center). */
  anchor?: Vec2
  /** Canvas blend mode against layers beneath (default 'normal'). */
  blendMode?: BlendMode
  /** Manual crop percentages trimmed from each source side (0–45). */
  crop?: CropEdges
  /** Decorative border drawn around the layer. */
  border?: { width: number; color: string; radius: number }
  /** Drop shadow cast by the media layer onto layers beneath. */
  dropShadow?: { offsetX: number; offsetY: number; blur: number; color: string }
  /** Silence this clip's audio contribution. */
  muted?: boolean
  /** Three-band EQ gains in dB (-12..12); applied in the export mix. */
  eq?: { low: number; mid: number; high: number }
  /** Duck this clip while clips on the given audio track are sounding. */
  duckUnderTrackId?: string
  /** Keep pitch when playing at non-1x speed (default true). */
  preservePitch?: boolean
  /** Property keyframes captured from the inspector (display/toggle only for now). */
  keyframes?: ClipKeyframe[]
  /** Text overlay (for text clips or caption overlays) */
  text?: TextOverlay
  /** Camera animation rig for 3D model clips. */
  modelRig?: CameraRig
  /** Role of avatar clip for automated placement and styling. */
  avatarRole?: 'intro' | 'outro' | 'presenter' | 'narrator'
  /** Content subtype on video/audio tracks (video, image, avatar, animation / audio, music, voice, sfx). */
  clipType?: MediaClipType
  /** Content subtype on text tracks. */
  textType?: TextClipType
  /** Content subtype on fx tracks. */
  fxType?: FxClipType
  /** Avatar clips: auto-lipsync against the attached audio clip when set. */
  autoLipsync?: boolean
  /** Smart reframing configuration for aspect-ratio changes. */
  reframing?: {
    enabled: boolean
    targetAspect: string
    followStrength?: number
    margin?: number
    smoothing?: number
    /** Computed crop keyframes for dynamic reframing. */
    keyframes?: Array<{ time: number; crop: { x: number; y: number; width: number; height: number } }>
  }
}

export interface Track {
  id: string
  type: TrackType
  name: string
  index: number
  locked: boolean
  muted: boolean
  hidden: boolean
  /** Audio solo: when any audio track is soloed, non-soloed audio tracks are silent in preview/mix. */
  soloed?: boolean
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
  /** Timeline ruler markers in seconds (sorted). Part of document history. */
  markers?: number[]
  /** Auto-caption layer settings (transcript-driven, project-wide). */
  captions?: CaptionsConfig
  /** Track-system schema version. 2 = four-track system (video/audio/text/fx). */
  schemaVersion?: number
  createdAt: number
  modifiedAt: number
}

/** A single timed caption. Timestamps are asset-relative seconds. */
export interface CaptionWord {
  word: string
  start: number
  end: number
}

export interface CaptionCue {
  start: number
  end: number
  text: string
  words?: CaptionWord[]
}

export type CaptionMode = 'sentence' | 'word'
export type CaptionPositionMode = 'bottom' | 'top' | 'auto'

export interface CaptionStyle {
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  color: string
  backgroundColor: string
  /** 0..1 */
  backgroundOpacity: number
  borderRadius: number
  shadow: boolean
  uppercase: boolean
}

export interface CaptionPosition {
  mode: CaptionPositionMode
  /** Normalized (0..1) horizontal inset from the frame edge. */
  marginX: number
  /** Normalized (0..1) vertical inset from the top/bottom edge. */
  marginY: number
  /** Max caption width as a fraction of frame width. */
  maxWidthPct: number
}

export interface CaptionsConfig {
  enabled: boolean
  mode: CaptionMode
  style: CaptionStyle
  position: CaptionPosition
  /** Move captions to avoid OCR-detected protected regions. */
  avoidProtectedRegions: boolean
  /** Preview-only overlay that draws the detected protected regions. */
  showProtectedRegions: boolean
}

export function defaultCaptionsConfig(): CaptionsConfig {
  return {
    enabled: false,
    mode: 'sentence',
    style: {
      fontSize: 56,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 'bold',
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.7,
      borderRadius: 8,
      shadow: true,
      uppercase: false,
    },
    position: { mode: 'bottom', marginX: 0.08, marginY: 0.08, maxWidthPct: 0.84 },
    avoidProtectedRegions: true,
    showProtectedRegions: false,
  }
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov'
  resolution: '720p' | '1080p' | '1440p' | '4k'
  fps: number
  videoCodec: 'h264' | 'vp9' | 'av1'
  audioCodec: 'aac' | 'opus'
  quality: 'low' | 'medium' | 'high'
}

/** Per-type accent colors used across the timeline UI. */
export const TRACK_COLORS: Record<TrackType, string> = {
  video: '#3b82f6',
  audio: '#22c55e',
  text: '#eab308',
  fx: '#a855f7',
}

/** Short header label: V1, A2, T1, FX1… `ordinal` is 1-based within the track type. */
export function trackShortLabel(type: TrackType, ordinal: number): string {
  const prefix = type === 'video' ? 'V' : type === 'audio' ? 'A' : type === 'text' ? 'T' : 'FX'
  return `${prefix}${ordinal}`
}

export const TRACK_TYPES: TrackType[] = ['video', 'video', 'video', 'audio', 'audio', 'audio', 'text', 'fx']

export function defaultTrackName(type: TrackType, ordinal: number): string {
  return trackShortLabel(type, ordinal + 1)
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
  const types: TrackType[] = ['video', 'video', 'video', 'audio', 'audio', 'audio', 'text', 'fx']
  const perType: Record<TrackType, number> = { video: 0, audio: 0, text: 0, fx: 0 }
  types.forEach((type, index) => {
    const ordinal = ++perType[type]
    tracks.push({
      id: crypto.randomUUID(),
      type,
      name: defaultTrackName(type, ordinal - 1),
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
    captions: defaultCaptionsConfig(),
    schemaVersion: 2,
    createdAt: now,
    modifiedAt: now,
  }
}

/** FX track appended by migration when a legacy project has none. */
function newFxTrack(index: number): Track {
  return {
    id: crypto.randomUUID(),
    type: 'fx',
    name: trackShortLabel('fx', 1),
    index,
    locked: false,
    muted: false,
    hidden: false,
    soloed: false,
    clips: [],
  }
}

/**
 * Convert any pre-4-track project data to the current system on load.
 * Old schema only ever stored video/audio/text tracks; unknown or legacy
 * type strings are bucketed into their nearest valid type, and an FX track
 * is appended so fx workflows are reachable. Idempotent via schemaVersion.
 */
export function migrateProjectTracks(project: Project): Project {
  if (project.schemaVersion === 2) return project
  const valid: TrackType[] = ['video', 'audio', 'text', 'fx']
  let tracks: Track[] = project.tracks.map((track) => {
    if (valid.includes(track.type)) return { ...track, soloed: track.soloed ?? false }
    const name = track.name.toLowerCase()
    const guessed: TrackType = name.startsWith('a') || name.includes('audio')
      ? 'audio'
      : name.startsWith('t') || name.includes('text')
        ? 'text'
        : name.startsWith('fx') || name.includes('effect')
          ? 'fx'
          : 'video'
    return { ...track, type: guessed, soloed: false }
  })
  // Re-derive within-type names so headers read V1…/A1…/T1…/FX1…
  const seen: Record<TrackType, number> = { video: 0, audio: 0, text: 0, fx: 0 }
  tracks = tracks.map((track, index) => {
    const ordinal = ++seen[track.type]
    return { ...track, index, name: track.name || defaultTrackName(track.type, ordinal - 1) }
  })
  if (!tracks.some((t) => t.type === 'fx')) tracks.push(newFxTrack(tracks.length))
  return { ...project, tracks, schemaVersion: 2 }
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