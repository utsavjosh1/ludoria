import { describe, expect, it } from 'vitest'
import { missionSchema } from '../../src/contracts/zones.js'

describe('missionSchema', () => {
  it('accepts a sequenced mission', () => {
    const parsed = missionSchema.safeParse({
      id: 'z01-first-light',
      title: 'First Light',
      zone: 'Z01',
      objectives: [
        {
          id: 'enter-field',
          title: 'Enter the relay field',
          description: 'Walk into the marked field.',
          prerequisites: [],
          trigger: { kind: 'area', id: 't-field', center: [0, 0, 8], radius: 3 },
          checkpoint: 'z01-field',
        },
        {
          id: 'activate-relay',
          title: 'Activate the relay',
          description: 'Press E at the pylon.',
          prerequisites: ['enter-field'],
          trigger: {
            kind: 'interact',
            id: 't-relay',
            point: [0, 1, 0],
            radius: 2.5,
            prompt: 'Activate',
          },
          checkpoint: 'z01-relay',
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects missions with no objectives', () => {
    expect(
      missionSchema.safeParse({ id: 'x', title: 'X', zone: 'Z01', objectives: [] }).success,
    ).toBe(false)
  })
})
