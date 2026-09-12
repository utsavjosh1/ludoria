import RAPIER from '@dimforge/rapier3d-compat'

export const PHYSICS_STEP = 1 / 60

export interface PhysicsSnapshot {
  x: number
  y: number
  z: number
}

/**
 * Rapier world for the test scene: static ground + one kinematic
 * character-controller player body. Single-threaded compat build — no
 * COOP/COEP headers required.
 */
export class PhysicsWorld {
  private world: RAPIER.World | null = null
  private body: RAPIER.RigidBody | null = null
  private collider: RAPIER.Collider | null = null
  private controller: RAPIER.KinematicCharacterController | null = null
  private readonly gravityY = -20

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init()
    return new PhysicsWorld()
  }

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: this.gravityY, z: 0 })
    this.world.timestep = PHYSICS_STEP
    // Static ground slab, top surface at y = 0.
    const groundBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
      groundBody,
    )
  }

  spawnPlayer(x: number, y: number, z: number): void {
    if (!this.world) throw new Error('PhysicsWorld used before creation')
    this.controller?.free()
    if (this.body) {
      this.world.removeRigidBody(this.body)
      this.body = null
      this.collider = null
    }
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
    )
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.4, 0.3), this.body)
    this.controller = this.world.createCharacterController(0.02)
    this.controller.enableAutostep(0.4, 0.2, true)
    this.controller.enableSnapToGround(0.4)
    this.controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
    this.controller.setMinSlopeSlideAngle((50 * Math.PI) / 180)
  }

  private lastGrounded = false

  /** Move the player by a world-space offset for one fixed step. */
  movePlayer(dx: number, dy: number, dz: number): void {
    if (!this.world || !this.body || !this.collider || !this.controller) return
    this.controller.computeColliderMovement(this.collider, { x: dx, y: dy, z: dz })
    this.lastGrounded = this.controller.computedGrounded()
    const m = this.controller.computedMovement()
    const p = this.body.translation()
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z })
  }

  step(): void {
    this.world?.step()
  }

  isGrounded(): boolean {
    return this.lastGrounded
  }

  position(out: PhysicsSnapshot): PhysicsSnapshot {
    const p = this.body?.translation()
    out.x = p?.x ?? 0
    out.y = p?.y ?? 0
    out.z = p?.z ?? 0
    return out
  }

  teleport(x: number, y: number, z: number): void {
    this.body?.setNextKinematicTranslation({ x, y, z })
  }

  dispose(): void {
    this.controller?.free()
    this.controller = null
    this.world?.free()
    this.world = null
    this.body = null
    this.collider = null
  }
}
