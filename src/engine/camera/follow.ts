import * as THREE from 'three'

/** Smooth third-person follow camera with a fixed yaw (test scene). */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera
  private readonly offset = new THREE.Vector3(0, 6.5, 8.5)
  private readonly lookAhead = new THREE.Vector3()
  private current = new THREE.Vector3()
  private initialized = false

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 300)
  }

  snapTo(target: THREE.Vector3): void {
    this.current.copy(target).add(this.offset)
    this.camera.position.copy(this.current)
    this.camera.lookAt(target.x, target.y + 1, target.z)
    this.initialized = true
  }

  /** Frame-rate independent smoothing; no allocation after construction. */
  update(target: THREE.Vector3, dtSeconds: number): void {
    if (!this.initialized) {
      this.snapTo(target)
      return
    }
    const t = 1 - Math.exp(-dtSeconds * 5)
    this.lookAhead.copy(target).add(this.offset)
    this.current.lerp(this.lookAhead, t)
    this.camera.position.copy(this.current)
    this.camera.lookAt(target.x, target.y + 1, target.z)
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }
}
