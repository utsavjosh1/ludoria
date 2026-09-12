import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave, freshSave } from '../../src/engine/save/codec.js'

describe('save codec', () => {
  it('round-trips a fresh save', () => {
    const save = freshSave({
      missionId: 'z01-first-light',
      playerZone: 'Z01',
      playerPosition: { x: 0, y: 0, z: -10 },
    })
    const decoded = decodeSave(encodeSave(save))
    expect(decoded.ok).toBe(true)
    if (decoded.ok) expect(decoded.save.missionId).toBe('z01-first-light')
  })

  it('reports missing saves', () => {
    expect(decodeSave(null)).toMatchObject({ ok: false, issue: 'missing' })
    expect(decodeSave(undefined)).toMatchObject({ ok: false, issue: 'missing' })
  })

  it('reports corrupted saves with a recovery hint', () => {
    expect(decodeSave('not-json{{{')).toMatchObject({ ok: false, issue: 'corrupt' })
    expect(decodeSave({ version: 2 })).toMatchObject({ ok: false, issue: 'corrupt' })
  })

  it('reports incompatible versions instead of crashing', () => {
    const save = freshSave({
      missionId: 'z01-first-light',
      playerZone: 'Z01',
      playerPosition: { x: 0, y: 0, z: 0 },
    })
    const future = { ...save, version: 99 }
    expect(decodeSave(JSON.stringify(future))).toMatchObject({ ok: false, issue: 'incompatible' })
  })
})
