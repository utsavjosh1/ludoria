import { describe, expect, it } from 'vitest'
import {
  byteSizeOf,
  MIN_SUPPORTED_SAVE_VERSION,
  SAVE_VERSION,
  saveDataSchema,
} from '../../src/contracts/saves.js'

function validSave() {
  return {
    version: SAVE_VERSION,
    missionId: 'z01-first-light',
    completedObjectives: ['enter-field'],
    checkpoints: ['z01-field'],
    activeObjective: 'activate-relay',
    playerPosition: { x: 1, y: 0, z: 2 },
    playerZone: 'Z01',
    playtimeSeconds: 61,
    updatedAt: new Date().toISOString(),
  }
}

describe('saveDataSchema', () => {
  it('accepts a well-formed save', () => {
    expect(saveDataSchema.safeParse(validSave()).success).toBe(true)
  })

  it('rejects saves newer than the runtime understands', () => {
    const parsed = saveDataSchema.safeParse({ ...validSave(), version: SAVE_VERSION + 1 })
    expect(parsed.success).toBe(false)
  })

  it('rejects saves older than the minimum supported version', () => {
    const parsed = saveDataSchema.safeParse({
      ...validSave(),
      version: MIN_SUPPORTED_SAVE_VERSION - 1,
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects non-finite coordinates', () => {
    const parsed = saveDataSchema.safeParse({
      ...validSave(),
      playerPosition: { x: Number.NaN, y: 0, z: 0 },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects malformed checkpoint ids', () => {
    const parsed = saveDataSchema.safeParse({ ...validSave(), checkpoints: ['Z01 Relay!!'] })
    expect(parsed.success).toBe(false)
  })

  it('rejects corrupted payloads', () => {
    expect(saveDataSchema.safeParse(null).success).toBe(false)
    expect(saveDataSchema.safeParse('{}').success).toBe(false)
    expect(saveDataSchema.safeParse({ ...validSave(), completedObjectives: 'done' }).success).toBe(
      false,
    )
  })
})

describe('byteSizeOf', () => {
  it('measures payload size for limit enforcement', () => {
    expect(byteSizeOf(validSave())).toBeGreaterThan(0)
    expect(byteSizeOf(validSave())).toBeLessThan(256 * 1024)
  })
})
