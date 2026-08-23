import { describe, expect, it } from 'vitest'
import { defaultCameraRig, clampRig } from '@/engine/types'
import { cameraPositionAt, rigProgress, applyRigToCamera } from './rig'

const R = 6
const EL = 20

function round(n: number, digits = 4): number {
  return Number(n.toFixed(digits))
}

describe('rigProgress', () => {
  it('returns 0 before the clip starts and 1 after it ends', () => {
    expect(rigProgress(0, 5, 10, 1)).toBe(0)
    expect(rigProgress(5, 5, 10, 1)).toBe(0)
    expect(rigProgress(16, 5, 10, 1)).toBe(1)
    expect(rigProgress(100, 5, 10, 1)).toBe(1)
  })

  it('scales progress by pan', () => {
    expect(rigProgress(10, 0, 10, 0.5)).toBe(0.5)
    expect(rigProgress(10, 0, 10, 1)).toBe(1)
  })

  it('guards against zero duration', () => {
    expect(rigProgress(5, 0, 0, 1)).toBe(0)
  })
})

describe('clampRig', () => {
  it('fills defaults and clamps out-of-range values', () => {
    const rig = clampRig({ pan: 5, fov: 999, radiusStart: -3, mode: 'turntable' as const })
    expect(rig.pan).toBe(1)
    expect(rig.fov).toBe(120)
    expect(rig.radiusStart).toBe(0.1)
    expect(rig.mode).toBe('turntable')
  })

  it('rejects unknown modes', () => {
    const rig = clampRig({ mode: 'fly' as never })
    expect(rig.mode).toBe('turntable')
  })
})

describe('cameraPositionAt', () => {
  it('turntable at 0% sits at azimuth 0 elevation 20', () => {
    const rig = defaultCameraRig()
    rig.radiusStart = R
    rig.radiusEnd = R
    const p = cameraPositionAt(rig, 0)
    const cosEl = Math.cos((EL * Math.PI) / 180)
    expect(round(p.x)).toBe(round(R * cosEl))
    expect(round(p.y)).toBe(round(R * Math.sin((EL * Math.PI) / 180)))
    expect(round(p.z)).toBe(0)
  })

  it('turntable at 25% (90°) swings to the side', () => {
    const rig = defaultCameraRig()
    rig.radiusStart = R
    rig.radiusEnd = R
    const p = cameraPositionAt(rig, 0.25)
    const cosEl = Math.cos((EL * Math.PI) / 180)
    expect(round(p.x)).toBe(0)
    expect(round(p.y)).toBe(round(R * Math.sin((EL * Math.PI) / 180)))
    expect(round(p.z)).toBe(round(R * cosEl))
  })

  it('turntable full spin returns to start when azimuthEnd = start + 360', () => {
    const rig = defaultCameraRig()
    const p0 = cameraPositionAt(rig, 0)
    const p1 = cameraPositionAt(rig, 1)
    expect(p1.x).toBeCloseTo(p0.x, 10)
    expect(p1.y).toBeCloseTo(p0.y, 10)
    expect(p1.z).toBeCloseTo(p0.z, 10)
  })

  it('dolly interpolates radius only', () => {
    const rig = defaultCameraRig()
    rig.mode = 'dolly'
    rig.radiusStart = 2
    rig.radiusEnd = 8
    const p0 = cameraPositionAt(rig, 0)
    const p1 = cameraPositionAt(rig, 1)
    const pMid = cameraPositionAt(rig, 0.5)
    const dist = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z)
    expect(round(dist(p0))).toBe(2)
    expect(round(dist(p1))).toBe(8)
    expect(round(dist(pMid))).toBe(5)
    expect(p0.x / p0.z).toBeCloseTo(p1.x / p1.z, 4)
  })

  it('orbit interpolates elevation and azimuth together', () => {
    const rig = defaultCameraRig()
    rig.mode = 'orbit'
    rig.elevationStart = 0
    rig.elevationEnd = 45
    const mid = cameraPositionAt(rig, 0.5)
    const elMid = (0 + 45) / 2
    const cosEl = Math.cos((elMid * Math.PI) / 180)
    expect(round(mid.y)).toBe(round(6 * Math.sin((elMid * Math.PI) / 180)))
    // Azimuth at 50% of a 0→360 sweep is 180° → camera sits on the -X side.
    expect(mid.x).toBeCloseTo(-6 * cosEl, 4)
    expect(mid.z).toBeCloseTo(0, 4)
    expect(round(Math.hypot(mid.x, mid.z), 4)).toBe(round(6 * cosEl, 4))
  })

  it('static keeps the camera fixed', () => {
    const rig = defaultCameraRig()
    rig.mode = 'static'
    const a = cameraPositionAt(rig, 0)
    const b = cameraPositionAt(rig, 0.9)
    expect(a).toEqual(b)
  })

  it('calculates flyby, spiral, and isometric_spin paths properly', () => {
    const rig = defaultCameraRig()
    rig.mode = 'flyby'
    rig.elevationStart = -10
    rig.elevationEnd = 30
    const flyPos0 = cameraPositionAt(rig, 0)
    const flyPos1 = cameraPositionAt(rig, 1)
    expect(flyPos1.y).toBeGreaterThan(flyPos0.y)

    rig.mode = 'isometric_spin'
    const isoPos = cameraPositionAt(rig, 0.5)
    expect(isoPos.y).toBeCloseTo(rig.radiusStart * Math.sin((45 * Math.PI) / 180), 4)

    rig.mode = 'spiral'
    const spiralPos = cameraPositionAt(rig, 0.5)
    expect(typeof spiralPos.x).toBe('number')
  })
})

describe('CAMERA_TRAJECTORY_PRESETS', () => {
  it('contains comprehensive motion and viewport presets', async () => {
    const { CAMERA_TRAJECTORY_PRESETS } = await import('./rig')
    expect(CAMERA_TRAJECTORY_PRESETS.length).toBeGreaterThanOrEqual(10)
    const turntable = CAMERA_TRAJECTORY_PRESETS.find((p) => p.id === 'turntable-360')
    expect(turntable).toBeDefined()
    expect(turntable?.azimuthEnd).toBe(360)

    const flyby = CAMERA_TRAJECTORY_PRESETS.find((p) => p.id === 'hero-flyby')
    expect(flyby).toBeDefined()

    const front = CAMERA_TRAJECTORY_PRESETS.find((p) => p.id === 'viewport-front')
    expect(front).toBeDefined()
  })
})

describe('applyRigToCamera', () => {
  it('positions, aims and updates the projection matrix', () => {
    const calls: string[] = []
    const camera = {
      position: { set: (x: number, y: number, z: number) => calls.push(`pos ${x} ${y} ${z}`) },
      fov: 0,
      aspect: 16 / 9,
      lookAt: (x: number, y: number, z: number) => calls.push(`look ${x} ${y} ${z}`),
      updateProjectionMatrix: () => calls.push('update'),
    }
    const rig = defaultCameraRig()
    applyRigToCamera(camera, rig, 0.5)
    expect(calls).toContain('update')
    expect(calls.some((c) => c.startsWith('pos '))).toBe(true)
    expect(calls.some((c) => c.startsWith('look 0 0 0'))).toBe(true)
    expect(camera.fov).toBe(rig.fov)
  })
})