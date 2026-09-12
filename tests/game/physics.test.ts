import { describe, expect, it } from 'vitest'
import { PhysicsWorld } from '../../src/engine/physics/world.js'

describe('PhysicsWorld (Rapier)', () => {
  it('keeps the player on the ground and moves with fixed steps', async () => {
    const physics = await PhysicsWorld.create()
    try {
      physics.spawnPlayer(0, 1, 0)
      // Settle onto the ground plane.
      for (let i = 0; i < 120; i++) {
        physics.movePlayer(0, -0.05, 0)
        physics.step()
      }
      const rest = physics.position({ x: 0, y: 0, z: 0 })
      expect(rest.y).toBeGreaterThan(0.3)
      expect(rest.y).toBeLessThan(1.2)

      // Walk forward (+x) for one second of fixed steps.
      for (let i = 0; i < 60; i++) {
        physics.movePlayer(0.075, -0.01, 0)
        physics.step()
      }
      const moved = physics.position({ x: 0, y: 0, z: 0 })
      expect(moved.x).toBeGreaterThan(2)
      expect(moved.y).toBeGreaterThan(0.3)
    } finally {
      physics.dispose()
    }
  })
})
