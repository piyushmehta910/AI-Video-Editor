import type { CameraRig } from '@/engine/types'
import { defaultCameraRig, clampRig } from '@/engine/types'

export type { CameraRig } from '@/engine/types'
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
      break
    case 'orbit':
      az = lerp(rig.azimuthStart, rig.azimuthEnd, progress)
      el = lerp(rig.elevationStart, rig.elevationEnd, progress)
      break
    case 'dolly':
      r = lerp(rig.radiusStart, rig.radiusEnd, progress)
      break
    case 'static':
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