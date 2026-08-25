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
    id: 'smartphone',
    name: 'Titanium Smartphone',
    category: 'Tech / Product',
    description: 'Modern flagship smartphone with glass screen and triple camera array',
    color: '#3b82f6',
  },
  {
    id: 'golden-coin',
    name: 'Golden Crypto Coin',
    category: 'Finance',
    description: 'Embossed glossy gold medallion with milled edges and crypto crest',
    color: '#eab308',
  },
  {
    id: 'vr-headset',
    name: 'Spatial VR Headset',
    category: 'Tech / Gaming',
    description: 'Futuristic virtual reality visor with curved glass front and straps',
    color: '#8b5cf6',
  },
  {
    id: 'music-speaker',
    name: 'Studio Hi-Fi Monitor',
    category: 'Audio',
    description: 'Professional active acoustic studio monitor with dual subwoofers',
    color: '#f97316',
  },
  {
    id: 'rocket',
    name: 'Space Orbit Rocket',
    category: 'Aero',
    description: 'Multi-stage aerodynamic launch rocket with booster thrusters',
    color: '#ef4444',
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
  {
    id: 'ai-presenter-bot',
    name: 'AI Presenter Bot',
    category: 'Characters / Presenters',
    description: 'Futuristic 3D host avatar with metallic torso, expressive visor eyes, and defined mouth lips',
    color: '#8b5cf6',
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

    case 'smartphone': {
      // Phone Body
      const bodyGeo = new THREE.BoxGeometry(1.5, 3.1, 0.16)
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.15 })
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      group.add(body)

      // Front Glass Screen
      const screenGeo = new THREE.PlaneGeometry(1.4, 2.95)
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.6,
        roughness: 0.05,
      })
      const screen = new THREE.Mesh(screenGeo, screenMat)
      screen.position.set(0, 0, 0.09)
      group.add(screen)

      // Camera Island on Back
      const islandGeo = new THREE.BoxGeometry(0.65, 0.65, 0.08)
      const islandMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 })
      const island = new THREE.Mesh(islandGeo, islandMat)
      island.position.set(-0.35, 1.1, -0.1)
      group.add(island)

      // 3 Camera Lenses
      const lensGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 24)
      const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1 })
      const lensPositions: [number, number, number][] = [
        [-0.45, 1.25, -0.13],
        [-0.25, 1.25, -0.13],
        [-0.35, 0.95, -0.13],
      ]
      for (const [lx, ly, lz] of lensPositions) {
        const lens = new THREE.Mesh(lensGeo, lensMat)
        lens.rotation.x = Math.PI / 2
        lens.position.set(lx, ly, lz)
        group.add(lens)
      }
      break
    }

    case 'golden-coin': {
      // Main Coin Cylinder
      const coinGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.22, 64)
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.98,
        roughness: 0.12,
        emissive: 0xb45309,
        emissiveIntensity: 0.2,
      })
      const coin = new THREE.Mesh(coinGeo, goldMat)
      coin.rotation.x = Math.PI / 2
      group.add(coin)

      // Raised Outer Rim
      const rimGeo = new THREE.TorusGeometry(1.32, 0.08, 16, 64)
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 1.0, roughness: 0.1 })
      const rimFront = new THREE.Mesh(rimGeo, rimMat)
      rimFront.position.set(0, 0, 0.11)
      group.add(rimFront)

      const rimBack = new THREE.Mesh(rimGeo, rimMat)
      rimBack.position.set(0, 0, -0.11)
      group.add(rimBack)

      // Central Crypto Symbol Star / Hex
      const crestGeo = new THREE.OctahedronGeometry(0.65, 0)
      const crestMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 1.0, roughness: 0.08 })
      const crest = new THREE.Mesh(crestGeo, crestMat)
      crest.position.set(0, 0, 0.14)
      crest.scale.set(1, 1, 0.2)
      group.add(crest)
      break
    }

    case 'vr-headset': {
      // Main Visor Curved Body
      const visorGeo = new THREE.BoxGeometry(2.2, 1.2, 1.2)
      const visorMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.85, roughness: 0.25 })
      const visor = new THREE.Mesh(visorGeo, visorMat)
      group.add(visor)

      // Front Curved Glass Shield
      const glassGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.9, 32, 1, false, 0, Math.PI)
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x8b5cf6,
        emissive: 0x6d28d9,
        emissiveIntensity: 0.5,
        roughness: 0.05,
      })
      const glass = new THREE.Mesh(glassGeo, glassMat)
      glass.rotation.z = Math.PI / 2
      glass.rotation.y = Math.PI / 2
      glass.position.set(0, 0, 0.6)
      group.add(glass)

      // Head Straps
      const strapGeo = new THREE.TorusGeometry(1.2, 0.08, 16, 48, Math.PI)
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.8 })
      const strap = new THREE.Mesh(strapGeo, strapMat)
      strap.rotation.x = Math.PI / 2
      strap.position.set(0, 0, -0.6)
      group.add(strap)
      break
    }

    case 'music-speaker': {
      // Speaker Cabinet
      const cabGeo = new THREE.BoxGeometry(1.6, 2.6, 1.5)
      const cabMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35 })
      const cab = new THREE.Mesh(cabGeo, cabMat)
      group.add(cab)

      // Top Tweeter Cone
      const tweetGeo = new THREE.SphereGeometry(0.28, 32, 16)
      const tweetMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xc2410c, emissiveIntensity: 0.4 })
      const tweet = new THREE.Mesh(tweetGeo, tweetMat)
      tweet.position.set(0, 0.65, 0.76)
      group.add(tweet)

      // Bottom Subwoofer Cone
      const subGeo = new THREE.CylinderGeometry(0.52, 0.15, 0.2, 32)
      const subMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.7, roughness: 0.2 })
      const sub = new THREE.Mesh(subGeo, subMat)
      sub.rotation.x = Math.PI / 2
      sub.position.set(0, -0.45, 0.75)
      group.add(sub)

      // Subwoofer Dust Cap
      const capGeo = new THREE.SphereGeometry(0.2, 24, 12)
      const capMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5 })
      const cap = new THREE.Mesh(capGeo, capMat)
      cap.position.set(0, -0.45, 0.82)
      group.add(cap)
      break
    }

    case 'rocket': {
      // Main Rocket Fuselage
      const fuseGeo = new THREE.CylinderGeometry(0.4, 0.45, 2.8, 32)
      const fuseMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6, roughness: 0.2 })
      const fuse = new THREE.Mesh(fuseGeo, fuseMat)
      group.add(fuse)

      // Nose Cone
      const noseGeo = new THREE.ConeGeometry(0.4, 0.9, 32)
      const noseMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.15 })
      const nose = new THREE.Mesh(noseGeo, noseMat)
      nose.position.set(0, 1.85, 0)
      group.add(nose)

      // 4 Fins at base
      const finMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
      for (let i = 0; i < 4; i++) {
        const finGeo = new THREE.BoxGeometry(0.06, 0.8, 0.5)
        const fin = new THREE.Mesh(finGeo, finMat)
        const angle = (i * Math.PI) / 2
        fin.position.set(Math.cos(angle) * 0.55, -1.1, Math.sin(angle) * 0.55)
        fin.rotation.y = -angle
        group.add(fin)
      }

      // Thruster Nozzle
      const nozGeo = new THREE.ConeGeometry(0.3, 0.4, 24, 1, true)
      const nozMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xe11d48,
        emissiveIntensity: 0.8,
      })
      const noz = new THREE.Mesh(nozGeo, nozMat)
      noz.rotation.x = Math.PI
      noz.position.set(0, -1.5, 0)
      group.add(noz)
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

    case 'ai-presenter-bot': {
      // 3D Host / Presenter Bot with metallic torso, head, visor eyes, and defined mouth lips
      // Torso / Suit
      const torsoGeo = new THREE.CylinderGeometry(0.7, 0.9, 1.4, 32)
      const torsoMat = new THREE.MeshStandardMaterial({
        color: 0x1e1b4b,
        metalness: 0.8,
        roughness: 0.2,
      })
      const torso = new THREE.Mesh(torsoGeo, torsoMat)
      torso.position.y = -0.7
      group.add(torso)

      // Neck
      const neckGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.3, 24)
      const neckMat = new THREE.MeshStandardMaterial({ color: 0x312e81, metalness: 0.9, roughness: 0.2 })
      const neck = new THREE.Mesh(neckGeo, neckMat)
      neck.position.y = 0.1
      group.add(neck)

      // Head
      const headGeo = new THREE.SphereGeometry(0.65, 32, 32)
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        metalness: 0.5,
        roughness: 0.3,
      })
      const head = new THREE.Mesh(headGeo, headMat)
      head.position.y = 0.8
      group.add(head)

      // Visor / Eyes
      const visorGeo = new THREE.BoxGeometry(0.75, 0.22, 0.3)
      const visorMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.8,
        metalness: 0.1,
        roughness: 0.1,
      })
      const visor = new THREE.Mesh(visorGeo, visorMat)
      visor.position.set(0, 0.9, 0.52)
      group.add(visor)

      // Defined Mouth / Speaker Lips
      const mouthGeo = new THREE.BoxGeometry(0.4, 0.1, 0.15)
      const mouthMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.6,
        metalness: 0.3,
        roughness: 0.2,
      })
      const mouth = new THREE.Mesh(mouthGeo, mouthMat)
      mouth.position.set(0, 0.62, 0.58)
      group.add(mouth)

      // Upper & Lower Lip Accents
      const upperLipGeo = new THREE.BoxGeometry(0.36, 0.03, 0.16)
      const lowerLipGeo = new THREE.BoxGeometry(0.34, 0.035, 0.16)
      const lipMat = new THREE.MeshStandardMaterial({ color: 0xbe123c, metalness: 0.4, roughness: 0.3 })
      const upperLip = new THREE.Mesh(upperLipGeo, lipMat)
      upperLip.position.set(0, 0.68, 0.58)
      group.add(upperLip)

      const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat)
      lowerLip.position.set(0, 0.56, 0.58)
      group.add(lowerLip)
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
