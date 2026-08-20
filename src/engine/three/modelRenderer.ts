import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { WebGPURenderer } from 'three/webgpu'
import type { CameraRig } from './rig'
import { applyRigToCamera, clampRig, rigProgress } from './rig'
import { readMediaFile } from '@/engine/storage/opfs'
import type { Asset } from '@/engine/types'

interface LoadedModel {
  group: THREE.Group
  radius: number
}

const modelCache = new Map<string, Promise<LoadedModel>>()

let rendererPromise: Promise<{ renderer: THREE.WebGLRenderer | WebGPURenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; dispose: () => void }> | null = null

function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as unknown as { gpu?: unknown }).gpu)
}

async function createRenderer() {
  const canvas = document.createElement('canvas')
  let wgpu: WebGPURenderer | null = null
  if (isWebGPUAvailable()) {
    try {
      const candidate = new WebGPURenderer({ canvas, antialias: true, alpha: true })
      await candidate.init()
      wgpu = candidate
    } catch {
      wgpu = null
    }
  }

  const renderer: THREE.WebGLRenderer | WebGPURenderer =
    wgpu ?? new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })

  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const dir = new THREE.DirectionalLight(0xffffff, 1.4)
  dir.position.set(5, 10, 7)
  scene.add(dir)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 0.6))

  try {
    const pmrem = new THREE.PMREMGenerator(renderer as THREE.WebGLRenderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap
    envMap.dispose()
    pmrem.dispose()
  } catch {
    // environment lighting is optional
  }

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 1000)

  return {
    renderer,
    scene,
    camera,
    dispose: () => {
      renderer.dispose()
      for (const p of modelCache.values()) {
        p.then((m) => {
          m.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh
            if (mesh.geometry) mesh.geometry.dispose()
            const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
            if (Array.isArray(mat)) mat.forEach((m2) => m2.dispose())
            else mat?.dispose()
          })
        }).catch(() => undefined)
      }
      modelCache.clear()
    },
  }
}

function getRenderer() {
  if (!rendererPromise) {
    rendererPromise = createRenderer().catch((err) => {
      rendererPromise = null
      throw err
    })
  }
  return rendererPromise
}

async function loadModel(asset: Asset): Promise<LoadedModel> {
  const cached = modelCache.get(asset.id)
  if (cached) return cached

  const promise = (async () => {
    const file = await readMediaFile(asset.filePath)
    const url = URL.createObjectURL(file)
    try {
      const gltf = await new GLTFLoader().loadAsync(url)
      const raw = gltf.scene
      const box = new THREE.Box3().setFromObject(raw)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = maxDim > 0 ? 2 / maxDim : 1

      const wrapper = new THREE.Group()
      raw.position.sub(center)
      raw.scale.multiplyScalar(scale)
      wrapper.add(raw)

      const sphere = new THREE.Box3().setFromObject(wrapper).getBoundingSphere(new THREE.Sphere())
      return { group: wrapper, radius: sphere.radius }
    } finally {
      URL.revokeObjectURL(url)
    }
  })()

  modelCache.set(asset.id, promise)
  try {
    await promise
  } catch (err) {
    modelCache.delete(asset.id)
    throw err
  }
  return promise
}

export interface ModelFrameOptions {
  asset: Asset
  rig: CameraRig
  time: number
  clipStart: number
  clipDuration: number
  width: number
  height: number
  signal?: AbortSignal
}

async function readBackFrame(renderer: THREE.WebGLRenderer | WebGPURenderer): Promise<CanvasImageSource | null> {
  const dom = renderer.domElement
  if (dom.width === 0 || dom.height === 0) return null
  // A WebGL canvas is a stable drawImage source. A WebGPU canvas only presents
  // its swapchain asynchronously, so drawImage often reads a blank/not-yet-
  // presented surface; an explicit ImageBitmap readback is reliable for both.
  if (renderer instanceof THREE.WebGLRenderer) return dom
  try {
    return await createImageBitmap(dom)
  } catch {
    return dom
  }
}

/**
 * Render one frame of a model asset's camera animation to an offscreen canvas
 * sized to the requested output resolution. Returns null on failure so callers
 * can degrade gracefully (the composite frame simply skips the draw).
 */
export async function renderModelFrame(opts: ModelFrameOptions): Promise<CanvasImageSource | null> {
  const { asset, rig, time, clipStart, clipDuration, width, height, signal } = opts
  try {
    const { renderer, scene, camera } = await getRenderer()
    const model = await loadModel(asset)
    if (signal?.aborted) return null

    const r = clampRig(rig)
    const progress = rigProgress(time, clipStart, clipDuration, r.pan)

    // Swap the model into the shared scene.
    while (scene.children.length) {
      const child = scene.children[0]
      if (child.type === 'AmbientLight' || child.type === 'DirectionalLight' || child.type === 'HemisphereLight') break
      scene.remove(child)
    }
    scene.add(model.group)

    camera.aspect = width / height
    applyRigToCamera(camera, r, progress)

    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.render(scene, camera)

    return await readBackFrame(renderer)
  } catch {
    return null
  }
}

/**
 * Probe a GLB/GLTF file: normalize it the same way the renderer does and return
 * the fitted bounding-sphere radius (used to pick a sane default camera radius).
 */
export async function probeModel(file: Blob): Promise<{ radius: number }> {
  const url = URL.createObjectURL(file)
  try {
    const gltf = await new GLTFLoader().loadAsync(url)
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = maxDim > 0 ? 2 / maxDim : 1
    gltf.scene.position.sub(center)
    gltf.scene.scale.multiplyScalar(scale)
    const sphere = new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere())
    return { radius: sphere.radius }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Render a single frame of a raw GLB/GLTF blob (not yet stored in OPFS) at the
 * given resolution. Used for import-time thumbnails. Returns null on failure.
 */
export async function renderBlobFrame(
  file: Blob,
  rig: CameraRig,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<CanvasImageSource | null> {
  try {
    const { renderer, scene, camera } = await getRenderer()
    const url = URL.createObjectURL(file)
    let group: THREE.Group
    try {
      const gltf = await new GLTFLoader().loadAsync(url)
      group = gltf.scene
      const box = new THREE.Box3().setFromObject(group)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = maxDim > 0 ? 2 / maxDim : 1
      group.position.sub(center)
      group.scale.multiplyScalar(scale)
    } finally {
      URL.revokeObjectURL(url)
    }
    if (signal?.aborted) return null

    while (scene.children.length) {
      const child = scene.children[0]
      if (child.type === 'AmbientLight' || child.type === 'DirectionalLight' || child.type === 'HemisphereLight') break
      scene.remove(child)
    }
    scene.add(group)

    const r = clampRig(rig)
    camera.aspect = width / height
    applyRigToCamera(camera, r, 0.1)
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.render(scene, camera)
    return await readBackFrame(renderer)
  } catch {
    return null
  }
}

export function disposeModelRenderer(): void {
  if (rendererPromise) {
    void rendererPromise.then((r) => r.dispose())
    rendererPromise = null
  }
}