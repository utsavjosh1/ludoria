import * as THREE from 'three'
import type { ZoneManifest } from '../../contracts/index.js'

export interface FixtureRefs {
  group: THREE.Group
  playerMesh: THREE.Group
  /** Pulsing beacon on the pylon (emissive material). */
  beacon: THREE.MeshStandardMaterial | null
  disposables: Array<{ dispose(): void }>
}

/**
 * Clearly-labeled temporary geometry for the Z01 test scene. Every mesh is
 * named TEMP_* and every point of interest carries a floating TEMP label.
 * Replace with real Blender exports per docs/assets.md — see the fixture
 * asset ids in public/manifests/zone-z01.json.
 */
export function buildFixtureInstances(manifest: ZoneManifest): FixtureRefs {
  const disposables: Array<{ dispose(): void }> = []
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d)
    return d
  }

  const group = new THREE.Group()
  group.name = 'TEMP_fixtureScene'

  const groundMat = track(
    new THREE.MeshStandardMaterial({ color: 0x2e3b2f, roughness: 1, metalness: 0 }),
  )
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(120, 120)), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.name = 'TEMP_ground'
  group.add(ground)

  const grid = new THREE.GridHelper(120, 60, 0x556655, 0x3a4a3d)
  grid.position.y = 0.02
  grid.name = 'TEMP_grid'
  group.add(grid)

  const label = (text: string, position: [number, number, number]) => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.75)'
      ctx.fillRect(0, 0, 512, 128)
      ctx.strokeStyle = '#ffb020'
      ctx.lineWidth = 6
      ctx.strokeRect(4, 4, 504, 120)
      ctx.fillStyle = '#ffb020'
      ctx.font = 'bold 44px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 256, 66)
    }
    const texture = track(new THREE.CanvasTexture(canvas))
    texture.colorSpace = THREE.SRGBColorSpace
    const material = track(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    )
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(4.4, 1.1, 1)
    sprite.position.set(...position)
    sprite.name = `TEMP_label:${text}`
    group.add(sprite)
  }

  let beacon: THREE.MeshStandardMaterial | null = null

  const ringMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x38e08c,
      emissive: 0x1d7a4c,
      emissiveIntensity: 0.7,
      roughness: 0.6,
    }),
  )
  const pylonMat = track(
    new THREE.MeshStandardMaterial({ color: 0x8a93a6, roughness: 0.4, metalness: 0.7 }),
  )
  const gateMat = track(
    new THREE.MeshStandardMaterial({ color: 0x4d6fa5, roughness: 0.5, metalness: 0.3 }),
  )
  const markerMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0x7a4d00, emissiveIntensity: 0.6 }),
  )

  for (const placement of manifest.placements) {
    const [px, py, pz] = placement.position
    switch (placement.asset) {
      case 'relay-field-ring': {
        const ring = new THREE.Mesh(track(new THREE.RingGeometry(3.2, 4, 48)), ringMat)
        ring.rotation.x = -Math.PI / 2
        ring.position.set(px, py + 0.03, pz)
        ring.name = 'TEMP_relayFieldRing'
        group.add(ring)
        label('TEMP relay field', [px, py + 2.2, pz])
        break
      }
      case 'relay-pylon': {
        const pylon = new THREE.Group()
        pylon.name = 'TEMP_relayPylon'
        const base = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 12)), pylonMat)
        base.position.y = 1.1
        base.castShadow = true
        pylon.add(base)
        beacon = track(
          new THREE.MeshStandardMaterial({
            color: 0x38e08c,
            emissive: 0x38e08c,
            emissiveIntensity: 1.2,
          }),
        )
        const top = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.45)), beacon)
        top.position.y = 2.7
        pylon.add(top)
        pylon.position.set(px, py, pz)
        pylon.rotation.y = placement.rotationY
        group.add(pylon)
        label('TEMP pylon (E)', [px, py + 3.6, pz])
        break
      }
      case 'exit-gate': {
        const gate = new THREE.Group()
        gate.name = 'TEMP_exitGate'
        for (const side of [-1.4, 1.4]) {
          const pillar = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 3.4, 0.5)), gateMat)
          pillar.position.set(side, 1.7, 0)
          pillar.castShadow = true
          gate.add(pillar)
        }
        const beam = new THREE.Mesh(track(new THREE.BoxGeometry(3.6, 0.4, 0.6)), gateMat)
        beam.position.y = 3.5
        gate.add(beam)
        gate.position.set(px, py, pz)
        gate.rotation.y = placement.rotationY
        group.add(gate)
        label('TEMP exit', [px, py + 4.4, pz])
        break
      }
      case 'spawn-marker': {
        const marker = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 24)),
          markerMat,
        )
        marker.position.set(px, py + 0.05, pz)
        marker.name = 'TEMP_spawnMarker'
        group.add(marker)
        label('TEMP spawn', [px, py + 2, pz])
        break
      }
      default:
        break
    }
  }

  const playerMesh = buildPlayerMesh(<T extends { dispose(): void }>(d: T): T => {
    disposables.push(d)
    return d
  })

  return { group, playerMesh, beacon, disposables }
}

// Generic alias (not a generic function): T is inferred independently per call.
type Tracker = <T extends { dispose(): void }>(disposable: T) => T

function buildPlayerMesh(track: Tracker): THREE.Group {
  const player = new THREE.Group()
  player.name = 'TEMP_playerProxy'
  const bodyMat = track(
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5, metalness: 0.1 }),
  )
  const body = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.3, 0.8, 6, 14)), bodyMat)
  body.position.y = 0.7
  body.castShadow = true
  player.add(body)
  const visorMat = track(
    new THREE.MeshStandardMaterial({ color: 0x111318, emissive: 0x38e08c, emissiveIntensity: 0.9 }),
  )
  const visor = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.12, 0.1)), visorMat)
  visor.position.set(0, 1.05, 0.24)
  player.add(visor)
  return player
}
