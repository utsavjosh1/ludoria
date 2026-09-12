import { describe, expect, it } from 'vitest'
import { assetDefSchema, zoneIdSchema, zoneManifestSchema } from '../../src/contracts/assets.js'

function asset(overrides = {}) {
  return {
    id: 'relay-pylon',
    url: '/models/z01/relay-pylon.glb',
    contentVersion: 'a1b2c3',
    type: 'glb',
    zones: ['Z01'],
    ...overrides,
  }
}

describe('zone ids', () => {
  it('supports Z01–Z09 and nothing else', () => {
    expect(zoneIdSchema.safeParse('Z01').success).toBe(true)
    expect(zoneIdSchema.safeParse('Z09').success).toBe(true)
    expect(zoneIdSchema.safeParse('Z10').success).toBe(false)
    expect(zoneIdSchema.safeParse('z01').success).toBe(false)
  })
})

describe('assetDefSchema', () => {
  it('accepts a minimal asset definition', () => {
    expect(assetDefSchema.safeParse(asset()).success).toBe(true)
  })

  it('defaults animations, sockets and fixture flags', () => {
    const parsed = assetDefSchema.parse(asset())
    expect(parsed.animations).toEqual([])
    expect(parsed.sockets).toEqual([])
    expect(parsed.fixture).toBe(false)
  })

  it('rejects unstable ids', () => {
    expect(assetDefSchema.safeParse(asset({ id: 'Relay Pylon!' })).success).toBe(false)
  })
})

describe('zoneManifestSchema', () => {
  it('accepts a zone with placements', () => {
    const parsed = zoneManifestSchema.safeParse({
      manifestVersion: 1,
      zone: 'Z01',
      name: 'Test Zone',
      spawn: { position: [0, 0, 0], facingY: 0 },
      assets: [asset()],
      placements: [{ asset: 'relay-pylon', position: [4, 0, 0], rotationY: 0, scale: 1 }],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects manifests with no assets', () => {
    const parsed = zoneManifestSchema.safeParse({
      manifestVersion: 1,
      zone: 'Z01',
      name: 'Empty',
      spawn: { position: [0, 0, 0], facingY: 0 },
      assets: [],
    })
    expect(parsed.success).toBe(false)
  })
})
