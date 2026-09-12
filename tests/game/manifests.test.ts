import { describe, expect, it } from 'vitest'
import { loadZoneManifest } from '../../src/engine/assets/manifests.js'

const manifestJson = {
  manifestVersion: 1,
  zone: 'Z01',
  name: 'Test Zone',
  spawn: { position: [0, 0, -10], facingY: 0 },
  assets: [
    {
      id: 'relay-pylon',
      url: '/models/z01/relay-pylon.glb',
      contentVersion: 'abc',
      type: 'glb',
      zones: ['Z01'],
      fixture: true,
    },
  ],
  placements: [{ asset: 'relay-pylon', position: [3, 0, 12], rotationY: 0, scale: 1 }],
}

function fetchOk(json: unknown, status = 200): typeof fetch {
  return async () => Response.json(json, { status })
}

describe('loadZoneManifest', () => {
  it('loads and validates a manifest', async () => {
    const { manifest } = await loadZoneManifest(fetchOk(manifestJson), '/manifests/zone.json')
    expect(manifest.zone).toBe('Z01')
    expect(manifest.assets).toHaveLength(1)
  })

  it('reports HTTP failures as missing-asset errors', async () => {
    await expect(loadZoneManifest(fetchOk({}, 404), '/manifests/missing.json')).rejects.toThrow(
      /missing or unreadable/,
    )
  })

  it('reports network failures', async () => {
    const failing: typeof fetch = () => Promise.reject(new Error('boom'))
    await expect(loadZoneManifest(failing, '/manifests/x.json')).rejects.toThrow(/Could not fetch/)
  })

  it('reports invalid JSON bodies', async () => {
    const bad: typeof fetch = async () => new Response('not json')
    await expect(loadZoneManifest(bad, '/manifests/x.json')).rejects.toThrow(/not valid JSON/)
  })

  it('reports invalid metadata', async () => {
    await expect(loadZoneManifest(fetchOk({ nope: true }), '/manifests/x.json')).rejects.toThrow(
      /invalid metadata/,
    )
  })

  it('reports duplicate asset ids', async () => {
    const dupe = {
      ...manifestJson,
      assets: [manifestJson.assets[0], manifestJson.assets[0]],
    }
    await expect(loadZoneManifest(fetchOk(dupe), '/manifests/x.json')).rejects.toThrow(
      /duplicate asset ids/,
    )
  })

  it('reports broken placement references', async () => {
    const broken = {
      ...manifestJson,
      placements: [{ asset: 'ghost', position: [0, 0, 0], rotationY: 0, scale: 1 }],
    }
    await expect(loadZoneManifest(fetchOk(broken), '/manifests/x.json')).rejects.toThrow(
      /unknown assets/,
    )
  })
})
