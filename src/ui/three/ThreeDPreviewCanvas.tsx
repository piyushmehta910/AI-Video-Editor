import * as React from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildPresetScene } from '@/engine/three/presets'
import { readMediaFile } from '@/engine/storage/opfs'
import type { Asset } from '@/engine/types'
import { Loader2 } from 'lucide-react'

interface ThreeDPreviewCanvasProps {
  asset?: Asset | null
  presetId?: string
  autoRotate?: boolean
  className?: string
  showGrid?: boolean
  lighting?: 'studio' | 'neon' | 'sunset' | 'spotlight' | 'ambient'
}

export function ThreeDPreviewCanvas({
  asset,
  presetId,
  autoRotate = true,
  className = 'w-full h-44',
  showGrid = false,
  lighting = 'studio',
}: ThreeDPreviewCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isMounted = true
    setLoading(true)
    setError(null)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 100)
    camera.position.set(0, 1.5, 4.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    container.replaceChildren(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = autoRotate
    controls.autoRotateSpeed = 2.0
    controls.maxDistance = 20
    controls.minDistance = 0.5

    // Lighting setup
    const lightsGroup = new THREE.Group()
    if (lighting === 'neon') {
      lightsGroup.add(new THREE.AmbientLight(0x0f172a, 1.5))
      const cyan = new THREE.DirectionalLight(0x06b6d4, 3)
      cyan.position.set(3, 4, 3)
      lightsGroup.add(cyan)
      const magenta = new THREE.DirectionalLight(0xec4899, 3)
      magenta.position.set(-3, -2, -3)
      lightsGroup.add(magenta)
    } else if (lighting === 'sunset') {
      lightsGroup.add(new THREE.AmbientLight(0x451a03, 1.2))
      const sun = new THREE.DirectionalLight(0xf59e0b, 3)
      sun.position.set(4, 5, 2)
      lightsGroup.add(sun)
      const fill = new THREE.DirectionalLight(0x9333ea, 1.5)
      fill.position.set(-4, 2, -2)
      lightsGroup.add(fill)
    } else {
      // Default Studio
      lightsGroup.add(new THREE.AmbientLight(0xffffff, 1.0))
      const key = new THREE.DirectionalLight(0xffffff, 2.0)
      key.position.set(4, 6, 4)
      lightsGroup.add(key)
      const fill = new THREE.DirectionalLight(0x94a3b8, 1.0)
      fill.position.set(-4, 3, -3)
      lightsGroup.add(fill)
    }
    scene.add(lightsGroup)

    if (showGrid) {
      const grid = new THREE.GridHelper(10, 10, 0x4f46e5, 0x334155)
      grid.position.y = -1.2
      scene.add(grid)
    }

    let modelGroup: THREE.Group | null = null

    const loadContent = async () => {
      try {
        if (presetId) {
          modelGroup = buildPresetScene(presetId)
          scene.add(modelGroup)
          if (isMounted) setLoading(false)
        } else if (asset) {
          const file = await readMediaFile(asset.filePath)
          const buffer = await file.arrayBuffer()
          const loader = new GLTFLoader()
          const gltf = await loader.parseAsync(buffer, '')
          modelGroup = gltf.scene
          // Center & scale model to fit normalized radius ~1.5
          const box = new THREE.Box3().setFromObject(modelGroup)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z, 0.001)
          const scale = 2.4 / maxDim
          modelGroup.position.sub(center.multiplyScalar(scale))
          modelGroup.scale.setScalar(scale)
          scene.add(modelGroup)
          if (isMounted) setLoading(false)
        } else {
          // Fallback demo shape
          modelGroup = buildPresetScene('cyber-cube')
          scene.add(modelGroup)
          if (isMounted) setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not load 3D model')
          setLoading(false)
        }
      }
    }

    void loadContent()

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight)
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      isMounted = false
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      renderer.dispose()
      if (modelGroup) {
        modelGroup.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (mesh.geometry) mesh.geometry.dispose()
          const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat?.dispose()
        })
      }
      container.replaceChildren()
    }
  }, [asset, presetId, autoRotate, showGrid, lighting])

  return (
    <div className={`relative overflow-hidden rounded-lg border border-border/70 bg-gradient-to-b from-slate-900 to-zinc-950 ${className}`}>
      <div ref={containerRef} className="size-full cursor-grab active:cursor-grabbing" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <Loader2 className="size-5 animate-spin text-violet-400" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] text-red-400 bg-black/60">
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-mono text-white/70">
        WebGL Orbit View
      </div>
    </div>
  )
}
