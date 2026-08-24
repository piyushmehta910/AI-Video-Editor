import type { CameraRig, CameraMode } from '@/engine/types'
import { defaultCameraRig, clampRig } from '@/engine/types'

export type { CameraRig, CameraMode } from '@/engine/types'
export { defaultCameraRig, clampRig }

/** Normalized 0..1 progress through the clip's camera sweep. */
export function rigProgress(time: number, clipStart: number, clipDuration: number, pan: number): number {
  if (clipDuration <= 0) return 0
  const raw = (time - clipStart) / clipDuration
  return Math.min(1, Math.max(0, raw)) * Math.min(1, Math.max(0.05, pan))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180
}

export interface CameraTrajectoryPreset {
  id: string
  name: string
  description: string
  mode: CameraMode
  icon: string
  category: 'motion' | 'cinematic' | 'viewport'
  azimuthStart: number
  azimuthEnd: number
  elevationStart: number
  elevationEnd: number
  radiusMultStart: number
  radiusMultEnd: number
  fov: number
}

export const CAMERA_TRAJECTORY_PRESETS: CameraTrajectoryPreset[] = [
  // ── Dynamic Motion Paths ──
  {
    id: 'turntable-360',
    name: '360° Turntable Orbit',
    description: 'Smooth full 360-degree rotation showcasing all angles',
    mode: 'turntable',
    icon: 'orbit',
    category: 'motion',
    azimuthStart: 0,
    azimuthEnd: 360,
    elevationStart: 20,
    elevationEnd: 20,
    radiusMultStart: 1.0,
    radiusMultEnd: 1.0,
    fov: 40,
  },
  {
    id: 'dolly-push-in',
    name: 'Dramatic Push-In',
    description: 'Smooth forward zoom creeping in toward focal center',
    mode: 'dolly_in',
    icon: 'zoom-in',
    category: 'cinematic',
    azimuthStart: 30,
    azimuthEnd: 30,
    elevationStart: 15,
    elevationEnd: 15,
    radiusMultStart: 1.8,
    radiusMultEnd: 0.65,
    fov: 38,
  },
  {
    id: 'dolly-pull-out',
    name: 'Dramatic Reveal (Pull-Out)',
    description: 'Cinematic backward dolly revealing the full asset & scene',
    mode: 'dolly_out',
    icon: 'zoom-out',
    category: 'cinematic',
    azimuthStart: 30,
    azimuthEnd: 30,
    elevationStart: 15,
    elevationEnd: 25,
    radiusMultStart: 0.65,
    radiusMultEnd: 1.8,
    fov: 42,
  },
  {
    id: 'hero-flyby',
    name: 'Low-Angle Hero Sweep',
    description: 'Dynamic rising crane sweep from low to high elevation',
    mode: 'flyby',
    icon: 'crane',
    category: 'cinematic',
    azimuthStart: -45,
    azimuthEnd: 60,
    elevationStart: -12,
    elevationEnd: 38,
    radiusMultStart: 1.3,
    radiusMultEnd: 1.05,
    fov: 46,
  },
  {
    id: 'isometric-spin',
    name: 'Isometric 45° Spin',
    description: 'Stylized 45-degree top-down architectural spin',
    mode: 'isometric_spin',
    icon: 'compass',
    category: 'motion',
    azimuthStart: 45,
    azimuthEnd: 405,
    elevationStart: 45,
    elevationEnd: 45,
    radiusMultStart: 1.2,
    radiusMultEnd: 1.2,
    fov: 36,
  },
  {
    id: 'spiral-ascend',
    name: 'Spiral Ascending Helix',
    description: 'Corkscrew helix camera orbit ascending upwards',
    mode: 'spiral',
    icon: 'spiral',
    category: 'cinematic',
    azimuthStart: 0,
    azimuthEnd: 720,
    elevationStart: -15,
    elevationEnd: 55,
    radiusMultStart: 1.4,
    radiusMultEnd: 0.95,
    fov: 42,
  },
  {
    id: 'dutch-sweep',
    name: 'Dutch Angle Action Pan',
    description: 'Tilted dynamic action camera sweeping 90 degrees',
    mode: 'dutch_sweep',
    icon: 'film',
    category: 'cinematic',
    azimuthStart: -35,
    azimuthEnd: 65,
    elevationStart: 30,
    elevationEnd: 10,
    radiusMultStart: 1.25,
    radiusMultEnd: 1.0,
    fov: 48,
  },

  // ── Fixed Viewport Angles ──
  {
    id: 'viewport-front',
    name: 'Front View',
    description: 'Direct straight-on front elevation',
    mode: 'static',
    icon: 'focus',
    category: 'viewport',
    azimuthStart: 0,
    azimuthEnd: 0,
    elevationStart: 5,
    elevationEnd: 5,
    radiusMultStart: 1.0,
    radiusMultEnd: 1.0,
    fov: 40,
  },
  {
    id: 'viewport-isometric',
    name: '3/4 Isometric Hero',
    description: 'Classic three-quarter product hero angle',
    mode: 'static',
    icon: 'box',
    category: 'viewport',
    azimuthStart: 45,
    azimuthEnd: 45,
    elevationStart: 25,
    elevationEnd: 25,
    radiusMultStart: 1.1,
    radiusMultEnd: 1.1,
    fov: 38,
  },
  {
    id: 'viewport-top',
    name: "Top-Down (Bird's Eye)",
    description: 'Direct overhead vertical angle',
    mode: 'static',
    icon: 'arrow-down',
    category: 'viewport',
    azimuthStart: 0,
    azimuthEnd: 0,
    elevationStart: 85,
    elevationEnd: 85,
    radiusMultStart: 1.25,
    radiusMultEnd: 1.25,
    fov: 35,
  },
  {
    id: 'viewport-close-up',
    name: 'Macro Detail Close-Up',
    description: 'Tight focal shot highlighting fine surface detail',
    mode: 'static',
    icon: 'search',
    category: 'viewport',
    azimuthStart: 30,
    azimuthEnd: 30,
    elevationStart: 12,
    elevationEnd: 12,
    radiusMultStart: 0.55,
    radiusMultEnd: 0.55,
    fov: 30,
  },
  {
    id: 'viewport-left',
    name: 'Left Profile',
    description: '90-degree left profile camera shot',
    mode: 'static',
    icon: 'arrow-left',
    category: 'viewport',
    azimuthStart: 270,
    azimuthEnd: 270,
    elevationStart: 5,
    elevationEnd: 5,
    radiusMultStart: 1.0,
    radiusMultEnd: 1.0,
    fov: 40,
  },
  {
    id: 'viewport-right',
    name: 'Right Profile',
    description: '90-degree right profile camera shot',
    mode: 'static',
    icon: 'arrow-right',
    category: 'viewport',
    azimuthStart: 90,
    azimuthEnd: 90,
    elevationStart: 5,
    elevationEnd: 5,
    radiusMultStart: 1.0,
    radiusMultEnd: 1.0,
    fov: 40,
  },
]

/**
 * Camera position in world space at a given sweep progress. Y is up.
 * Azimuth is measured from +Z towards +X (three.js convention).
 */
export function cameraPositionAt(rig: CameraRig, progress: number): { x: number; y: number; z: number } {
  let az = rig.azimuthStart
  let el = rig.elevationStart
  let r = rig.radiusStart

  switch (rig.mode) {
    case 'turntable':
      az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      el = lerp(rig.elevationStart, rig.elevationEnd, progress)
      break
    case 'orbit':
      az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      el = lerp(rig.elevationStart, rig.elevationEnd, progress)
      break
    case 'dolly':
    case 'dolly_in':
    case 'dolly_out':
      r = lerp(rig.radiusStart, rig.radiusEnd, progress)
      if (rig.mode !== 'dolly' && rig.azimuthStart !== rig.azimuthEnd) {
        az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      }
      if (rig.mode !== 'dolly' && rig.elevationStart !== rig.elevationEnd) {
        el = lerp(rig.elevationStart, rig.elevationEnd, progress)
      }
      break
    case 'flyby':
      az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      el = lerp(rig.elevationStart, rig.elevationEnd, progress)
      r = lerp(rig.radiusStart, rig.radiusEnd, progress)
      break
    case 'isometric_spin':
      az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      el = 45
      r = rig.radiusStart
      break
    case 'spiral':
      az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      el = lerp(rig.elevationStart, rig.elevationEnd, progress)
      r = lerp(rig.radiusStart, rig.radiusEnd, progress)
      break
    case 'dutch_sweep':
      az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      el = lerp(rig.elevationStart, rig.elevationEnd, progress)
      r = lerp(rig.radiusStart, rig.radiusEnd, progress)
      break
    case 'static':
      az = rig.azimuthStart
      el = rig.elevationStart
      r = rig.radiusStart
      break
  }

  const azR = deg2rad(az)
  const elR = deg2rad(el)
  return {
    x: rig.targetX + r * Math.cos(elR) * Math.cos(azR),
    y: rig.targetY + r * Math.sin(elR),
    z: rig.targetZ + r * Math.cos(elR) * Math.sin(azR),
  }
}

/** Apply a rig pose to a THREE.PerspectiveCamera. */
export function applyRigToCamera(
  camera: {
    position: { set(x: number, y: number, z: number): void }
    fov: number
    aspect: number
    lookAt(x: number, y: number, z: number): void
    updateProjectionMatrix(): void
  },
  rig: CameraRig,
  progress: number,
): void {
  const pos = cameraPositionAt(rig, progress)
  camera.position.set(pos.x, pos.y, pos.z)
  camera.fov = rig.fov
  camera.lookAt(rig.targetX, rig.targetY, rig.targetZ)
  camera.updateProjectionMatrix()
}