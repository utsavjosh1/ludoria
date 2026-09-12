import type { Mission } from '../../contracts/index.js'

/**
 * Demo mission "First Light" (zone Z01 test scene): enter an area, interact
 * with an object, reach an exit. Layout constants are shared with the fixture
 * scene builder so triggers and visuals can never drift apart.
 */
export const DEMO_LAYOUT = {
  spawn: { position: [0, 0.6, -10] as [number, number, number], facingY: 0 },
  fieldCenter: [0, 0, 6] as [number, number, number],
  fieldRadius: 4,
  pylonPoint: [3, 0, 12] as [number, number, number],
  pylonRadius: 3,
  exitCenter: [-4, 0, 22] as [number, number, number],
  exitRadius: 2.5,
} as const

export const DEMO_MISSION: Mission = {
  id: 'z01-first-light',
  title: 'First Light',
  zone: 'Z01',
  objectives: [
    {
      id: 'enter-field',
      title: 'Enter the relay field',
      description: 'Walk north into the marked relay field.',
      prerequisites: [],
      trigger: {
        kind: 'area',
        id: 't-field',
        center: DEMO_LAYOUT.fieldCenter,
        radius: DEMO_LAYOUT.fieldRadius,
      },
      checkpoint: 'z01-field',
    },
    {
      id: 'activate-relay',
      title: 'Activate the relay pylon',
      description: 'Approach the pylon and press E to activate it.',
      prerequisites: ['enter-field'],
      trigger: {
        kind: 'interact',
        id: 't-relay',
        point: DEMO_LAYOUT.pylonPoint,
        radius: DEMO_LAYOUT.pylonRadius,
        prompt: 'Activate relay',
      },
      checkpoint: 'z01-relay',
    },
    {
      id: 'reach-exit',
      title: 'Reach the exit gate',
      description: 'Head north-west through the exit gate.',
      prerequisites: ['activate-relay'],
      trigger: {
        kind: 'area',
        id: 't-exit',
        center: DEMO_LAYOUT.exitCenter,
        radius: DEMO_LAYOUT.exitRadius,
      },
      checkpoint: 'z01-exit',
    },
  ],
}
