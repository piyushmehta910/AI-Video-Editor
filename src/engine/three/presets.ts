import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export interface ModelPreset {
  id: string
  name: string
  category: string
  description: string
  color: string
}

export const BUILTIN_3D_PRESETS: ModelPreset[] = [
  {
    id: 'cyber-cube',
    name: 'Cyber Tesseract',
    category: 'Sci-Fi / Abstract',
    description: 'Metallic chrome cube with neon glowing core and bevels',
    color: '#06b6d4',
  },
  {
    id: 'studio-camera',
    name: 'Cinema Camera',
    category: 'Production',
    description: 'Professional movie camera with multi-element lens and matte box',
    color: '#8b5cf6',
  },
  {
    id: 'gold-trophy',
    name: 'Gold Trophy Cup',
    category: 'Awards',
    description: 'Glossy metallic championship trophy on dark marble pedestal',
    color: '#eab308',
  },
  {
    id: 'diamond-gem',
    name: 'Prism Diamond',
    category: 'Luxury',
    description: 'Faceted geometric jewel with high specular reflections',
    color: '#ec4899',
  },
  {
    id: 'retro-mic',
    name: 'Studio Dynamic Mic',
    category: 'Audio',
    description: 'Vintage chrome broadcast microphone with mesh capsule',
    color: '#64748b',
  },
  {
    id: 'drone-quad',
    name: 'Cyber Drone',
    category: 'Tech',
    description: 'Futuristic quadcopter drone with 4 rotor arms and camera gimbal',
    color: '#10b981',
  },
]

export function buildPresetScene(presetId: string): THREE.Group {
  const group = new THREE.Group()

  switch (presetId) {
    case 'cyber-cube': {
      // Outer glass/metallic wireframe cube
      const outerGeo = new THREE.BoxGeometry(2, 2, 2)
      const outerMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.9,
        roughness: 0.1,
      })
      const outerMesh = new THREE.Mesh(outerGeo, outerMat)
      group.add(outerMesh)

      // Inner glowing core
      const coreGeo = new THREE.OctahedronGeometry(1.1, 0)
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.8,
        metalness: 0.2,
        roughness: 0.2,
      })
      const coreMesh = new THREE.Mesh(coreGeo, coreMat)
      group.add(coreMesh)

      // Accent torus rings
      const ringGeo = new THREE.TorusGeometry(1.6, 0.05, 16, 64)
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xec4899,
        emissiveIntensity: 0.6,
      })
      const ring1 = new THREE.Mesh(ringGeo, ringMat)
      ring1.rotation.x = Math.PI / 4
      group.add(ring1)
      break
    }

    case 'studio-camera': {
      // Camera main body
      const bodyGeo = new THREE.BoxGeometry(1.8, 1.4, 2.2)
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 })
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.set(0, 0, 0)
      group.add(body)

      // Lens barrel
      const lensGeo = new THREE.CylinderGeometry(0.6, 0.65, 1.4, 32)
      const lensMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9, roughness: 0.2 })
      const lens = new THREE.Mesh(lensGeo, lensMat)
      lens.rotation.x = Math.PI / 2
      lens.position.set(0, 0, 1.7)
      group.add(lens)

      // Gold lens ring accent
      const goldRingGeo = new THREE.TorusGeometry(0.62, 0.04, 16, 32)
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 1.0, roughness: 0.15 })
      const goldRing = new THREE.Mesh(goldRingGeo, goldMat)
      goldRing.position.set(0, 0, 2.1)
      group.add(goldRing)

      // Top handle
      const handleGeo = new THREE.BoxGeometry(0.3, 0.2, 1.6)
      const handle = new THREE.Mesh(handleGeo, bodyMat)
      handle.position.set(0, 0.9, 0)
      group.add(handle)
      break
    }

    case 'gold-trophy': {
      // Pedestal base
      const baseGeo = new THREE.BoxGeometry(1.6, 0.6, 1.6)
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 })
      const base = new THREE.Mesh(baseGeo, baseMat)
      base.position.set(0, -1.2, 0)
      group.add(base)

      // Gold Cup Body
      const cupGeo = new THREE.CylinderGeometry(1.0, 0.3, 1.6, 32, 1, true)
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.12 })
      const cup = new THREE.Mesh(cupGeo, goldMat)
      cup.position.set(0, 0.2, 0)
      group.add(cup)

      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.8, 24)
      const stem = new THREE.Mesh(stemGeo, goldMat)
      stem.position.set(0, -0.6, 0)
      group.add(stem)

      // Handles
      const handleGeo = new THREE.TorusGeometry(0.5, 0.08, 16, 32, Math.PI)
      const hLeft = new THREE.Mesh(handleGeo, goldMat)
      hLeft.rotation.z = -Math.PI / 2
      hLeft.position.set(-0.9, 0.3, 0)
      group.add(hLeft)

      const hRight = new THREE.Mesh(handleGeo, goldMat)
      hRight.rotation.z = Math.PI / 2
      hRight.position.set(0.9, 0.3, 0)
      group.add(hRight)
      break
    }

    case 'diamond-gem': {
      const gemGeo = new THREE.OctahedronGeometry(1.6, 1)
      const gemMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.1,
        roughness: 0.05,
        emissive: 0x0284c7,
        emissiveIntensity: 0.3,
      })
      const gem = new THREE.Mesh(gemGeo, gemMat)
      group.add(gem)
      break
    }

    case 'retro-mic': {
      // Stand base
      const standBaseGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.2, 32)
      const standMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 })
      const standBase = new THREE.Mesh(standBaseGeo, standMat)
      standBase.position.set(0, -1.4, 0)
      group.add(standBase)

      // Stand shaft
      const shaftGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 24)
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 })
      const shaft = new THREE.Mesh(shaftGeo, chromeMat)
      shaft.position.set(0, -0.6, 0)
      group.add(shaft)

      // Mic capsule body
      const capsuleGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 32)
      const capsule = new THREE.Mesh(capsuleGeo, chromeMat)
      capsule.position.set(0, 0.6, 0)
      group.add(capsule)

      // Top grille dome
      const domeGeo = new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
      const dome = new THREE.Mesh(domeGeo, chromeMat)
      dome.position.set(0, 1.15, 0)
      group.add(dome)
      break
    }

    case 'drone-quad':
    default: {
      // Central drone body
      const bodyGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2)
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      group.add(body)

      // 4 Arms
      const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 16)
      const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 })

      const arm1 = new THREE.Mesh(armGeo, armMat)
      arm1.rotation.z = Math.PI / 2
      arm1.rotation.y = Math.PI / 4
      group.add(arm1)

      const arm2 = new THREE.Mesh(armGeo, armMat)
      arm2.rotation.z = Math.PI / 2
      arm2.rotation.y = -Math.PI / 4
      group.add(arm2)

      // 4 Rotors
      const rotorGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24)
      const rotorMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.5 })

      const positions = [
        [0.9, 0.25, 0.9],
        [-0.9, 0.25, 0.9],
        [0.9, 0.25, -0.9],
        [-0.9, 0.25, -0.9],
      ]
      for (const [px, py, pz] of positions) {
        const rotor = new THREE.Mesh(rotorGeo, rotorMat)
        rotor.position.set(px, py, pz)
        group.add(rotor)
      }
      break
    }
  }

  return group
}

/**
 * Builds a 3D procedural preset scene, exports it to binary GLB format, and returns a Blob.
 */
export async function exportPresetToGlb(presetId: string): Promise<Blob> {
  const scene = new THREE.Scene()
  const group = buildPresetScene(presetId)
  scene.add(group)

  const exporter = new GLTFExporter()
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer
  return new Blob([arrayBuffer], { type: 'model/gltf-binary' })
}
