import type { AssetDef, ZoneId, ZoneManifest } from '../../contracts/index.js'
import { AssetCache } from './loader.js'

/**
 * Zone-scoped asset ownership. The current zone's assets are acquired first;
 * upcoming zones can be prefetched; assets no active zone uses are released.
 * Fixture (procedural) assets never touch the GLB cache.
 */
export class ZoneManager {
  private readonly manifests = new Map<ZoneId, ZoneManifest>()
  private readonly activeZones = new Set<ZoneId>()
  readonly cache = new AssetCache()

  register(manifest: ZoneManifest): void {
    this.manifests.set(manifest.zone, manifest)
  }

  getManifest(zone: ZoneId): ZoneManifest | undefined {
    return this.manifests.get(zone)
  }

  /** Acquire every real asset of a zone and mark the zone active. */
  async activate(
    zone: ZoneId,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const manifest = this.manifests.get(zone)
    if (!manifest) throw new Error(`No manifest registered for zone ${zone}.`)
    const real = manifest.assets.filter((a) => !a.fixture)
    let loaded = 0
    onProgress?.(0, real.length)
    await Promise.all(
      real.map(async (def: AssetDef) => {
        await this.cache.acquire(def)
        loaded += 1
        onProgress?.(loaded, real.length)
      }),
    )
    this.activeZones.add(zone)
  }

  /** Best-effort background load; failures are swallowed and retried on activate. */
  prefetch(zone: ZoneId): void {
    const manifest = this.manifests.get(zone)
    if (!manifest || this.activeZones.has(zone)) return
    void Promise.all(manifest.assets.filter((a) => !a.fixture).map((a) => this.cache.acquire(a)))
      .then(() => undefined)
      .catch(() => undefined)
  }

  /** Release assets that no remaining active zone references. */
  deactivate(zone: ZoneId): void {
    this.activeZones.delete(zone)
    const stillUsed = new Set<string>()
    for (const active of this.activeZones) {
      const manifest = this.manifests.get(active)
      for (const def of manifest?.assets ?? []) {
        if (!def.fixture) stillUsed.add(def.id)
      }
    }
    const manifest = this.manifests.get(zone)
    for (const def of manifest?.assets ?? []) {
      if (!def.fixture && !stillUsed.has(def.id)) this.cache.release(def)
    }
  }

  dispose(): void {
    this.activeZones.clear()
    this.manifests.clear()
    this.cache.clear()
  }
}
