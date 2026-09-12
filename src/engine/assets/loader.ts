import type * as THREE from 'three'
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { AssetDef } from '../../contracts/index.js'
import { versionedUrl } from './manifests.js'

export interface AssetLoadError {
  assetId: string
  url: string
  message: string
}

interface CacheEntry {
  gltf: GLTF
  refs: number
}

/**
 * Shared GLB cache with reference counting. Geometry and materials are reused
 * across instances; GPU resources are released only when no zone uses them.
 */
export class AssetCache {
  private readonly loader = new GLTFLoader()
  private readonly entries = new Map<string, CacheEntry>()
  private readonly inflight = new Map<string, Promise<GLTF>>()

  get cachedUrls(): string[] {
    return [...this.entries.keys()]
  }

  /** Already-acquired GLB without changing the refcount (for instancing). */
  peek(def: AssetDef): GLTF | undefined {
    return this.entries.get(versionedUrl(def))?.gltf
  }

  async acquire(def: AssetDef): Promise<GLTF> {
    if (def.fixture) {
      throw new Error(
        `Asset "${def.id}" is a development fixture and has no GLB to load. ` +
          `Replace it with a real Blender export (docs/assets.md).`,
      )
    }
    const url = versionedUrl(def)
    const existing = this.entries.get(url)
    if (existing) {
      existing.refs += 1
      return existing.gltf
    }
    const cached = this.inflight.get(url)
    let pending: Promise<GLTF>
    if (cached) {
      pending = cached
    } else {
      pending = this.loader.loadAsync(url).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown load error'
        throw new Error(
          `Asset "${def.id}" failed to load from ${url}: ${message}. ` +
            `The file may be missing (expected HTML instead of binary is a common cause — check the asset route serves .glb with model/gltf-binary).`,
        )
      })
      this.inflight.set(url, pending)
    }
    try {
      const gltf = await pending
      const entry = this.entries.get(url)
      if (entry) {
        entry.refs += 1
        return entry.gltf
      }
      this.entries.set(url, { gltf, refs: 1 })
      return gltf
    } finally {
      this.inflight.delete(url)
    }
  }

  /** Release one reference; disposes GPU resources at zero. No-op if unknown. */
  release(def: AssetDef): void {
    const url = versionedUrl(def)
    const entry = this.entries.get(url)
    if (!entry) return
    entry.refs -= 1
    if (entry.refs <= 0) {
      this.entries.delete(url)
      disposeGltf(entry.gltf)
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) disposeGltf(entry.gltf)
    this.entries.clear()
    this.inflight.clear()
  }
}

function disposeGltf(gltf: GLTF): void {
  gltf.scene.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined
    if (geometry) geometry.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) {
      for (const m of material) disposeMaterial(m)
    } else if (material) {
      disposeMaterial(material)
    }
  })
}

function disposeMaterial(material: THREE.Material): void {
  const withMaps = material as THREE.Material & Record<string, unknown>
  for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
    const tex = withMaps[key] as THREE.Texture | undefined
    if (tex && typeof tex.dispose === 'function') tex.dispose()
  }
  material.dispose()
}
