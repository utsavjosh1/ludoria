import * as THREE from 'three'
import type { Mission, SaveData } from '../../contracts/index.js'
import { loadZoneManifest } from '../assets/manifests.js'
import { ZoneManager } from '../assets/zones.js'
import { AudioBus } from '../audio/bus.js'
import { FollowCamera } from '../camera/follow.js'
import { Input, type MoveVector } from '../input/input.js'
import {
  activeObjective,
  createRuntime,
  eligibleObjectives,
  isComplete,
  type MissionRuntime,
  triggerSatisfied,
  tryComplete,
} from '../missions/graph.js'
import { PerfOverlay } from '../perf/overlay.js'
import { PHYSICS_STEP, type PhysicsSnapshot, PhysicsWorld } from '../physics/world.js'
import { buildFixtureInstances, type FixtureRefs } from '../render/fixture.js'
import {
  applyQuality,
  createRenderer,
  type GraphicsQuality,
  QUALITY_SETTINGS,
  resizeRenderer,
} from '../render/renderer.js'
import { decodeSave, encodeSave } from '../save/codec.js'
import { saveStore } from '../save/store.js'
import { createWorldState, type WorldState } from '../world/state.js'
import { FixedStepper } from './loop.js'

export interface GameSettings {
  volume: number
  muted: boolean
  quality: GraphicsQuality
}

export interface HudSnapshot {
  objectiveTitle: string
  objectiveDesc: string
  objectiveIndex: number
  objectiveTotal: number
  prompt: string | null
  missionComplete: boolean
  checkpoint: string | null
}

export interface GameHooks {
  onHud(snapshot: HudSnapshot): void
  onProgress(phase: string, loaded: number, total: number): void
  onError(message: string, recoverable: boolean): void
  onAutoPause(): void
}

export interface GameOptions {
  canvas: HTMLCanvasElement
  manifestUrl: string
  mission: Mission
  settings: GameSettings
  hooks: GameHooks
  /** Development-only frame timing overlay. Off in production. */
  perfOverlay?: boolean
}

const WALK_SPEED = 4.5
const SPRINT_MULTIPLIER = 1.6

/** One active render loop per instance; React owns menus/HUD, this owns simulation. */
export class Game {
  private readonly opts: GameOptions
  private renderer: THREE.WebGLRenderer | null = null
  private sun: THREE.DirectionalLight | null = null
  private scene: THREE.Scene | null = null
  private camera: FollowCamera | null = null
  private physics: PhysicsWorld | null = null
  private readonly input = new Input()
  private readonly audio = new AudioBus()
  private readonly zones = new ZoneManager()
  private runtime: MissionRuntime | null = null
  private state: WorldState | null = null
  private fixture: FixtureRefs | null = null
  private overlay: PerfOverlay | null = null

  private readonly stepper = new FixedStepper(PHYSICS_STEP, 5)
  private readonly move: MoveVector = { x: 0, y: 0 }
  private readonly prevPos: PhysicsSnapshot = { x: 0, y: 0, z: 0 }
  private readonly currPos: PhysicsSnapshot = { x: 0, y: 0, z: 0 }
  private verticalVelocity = 0
  private elapsed = 0
  private playtime = 0

  private rafId = 0
  private lastMs = 0
  private running = false
  private disposed = false
  private initialized = false
  private hudKey = ''
  private hudTimer = 0
  private onResize: (() => void) | null = null
  private onVisibility: (() => void) | null = null
  private onGesture: (() => void) | null = null

  constructor(opts: GameOptions) {
    this.opts = opts
  }

  get isRunning(): boolean {
    return this.running
  }

  async init(): Promise<void> {
    if (this.initialized) return
    const { canvas, hooks, settings } = this.opts
    try {
      this.audio.setVolume(settings.volume)
      this.audio.setMuted(settings.muted)
      this.audio.unlock()

      hooks.onProgress('physics', 0, 1)
      this.physics = await PhysicsWorld.create()
      hooks.onProgress('physics', 1, 1)

      this.renderer = createRenderer(canvas, settings.quality)
      resizeRenderer(this.renderer)
      this.scene = new THREE.Scene()
      this.scene.background = new THREE.Color(0x0d1117)
      this.scene.fog = new THREE.Fog(0x0d1117, 30, 90)
      this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2620, 0.9))
      const sun = new THREE.DirectionalLight(0xfff2dd, 1.6)
      sun.position.set(12, 18, 8)
      sun.castShadow = settings.quality !== 'low'
      const shadowRes = QUALITY_SETTINGS[settings.quality].shadowMap
      if (shadowRes > 0) sun.shadow.mapSize.set(shadowRes, shadowRes)
      sun.shadow.camera.left = -30
      sun.shadow.camera.right = 30
      sun.shadow.camera.top = 30
      sun.shadow.camera.bottom = -30
      this.scene.add(sun)
      this.sun = sun

      const aspect = canvas.parentElement
        ? canvas.parentElement.clientWidth / Math.max(1, canvas.parentElement.clientHeight)
        : 16 / 9
      this.camera = new FollowCamera(aspect)

      hooks.onProgress('manifest', 0, 1)
      const { manifest } = await loadZoneManifest(fetch.bind(globalThis), this.opts.manifestUrl)
      hooks.onProgress('manifest', 1, 1)
      this.zones.register(manifest)

      await this.zones.activate(manifest.zone, (loaded, total) =>
        hooks.onProgress('assets', loaded, total),
      )

      // The test scene uses procedural fixtures; model rendering is not wired yet.
      this.fixture = buildFixtureInstances(manifest)
      this.scene.add(this.fixture.group)
      this.scene.add(this.fixture.playerMesh)

      const [sx, sy, sz] = manifest.spawn.position
      this.physics.spawnPlayer(sx, sy + 0.5, sz)
      this.physics.position(this.currPos)
      this.prevPos.x = this.currPos.x
      this.prevPos.y = this.currPos.y
      this.prevPos.z = this.currPos.z
      this.state = createWorldState(manifest.zone, { x: sx, y: sy, z: sz })
      this.state.player.facingY = manifest.spawn.facingY

      this.camera.snapTo(this.fixture.playerMesh.position)

      this.input.attach({ window, canvas })
      this.onResize = () => {
        if (!this.renderer || !this.camera) return
        resizeRenderer(this.renderer)
        const parent = canvas.parentElement
        const w = parent ? parent.clientWidth : window.innerWidth
        const h = parent ? parent.clientHeight : window.innerHeight
        this.camera.setAspect(w / Math.max(1, h))
      }
      window.addEventListener('resize', this.onResize)
      this.onVisibility = () => {
        if (document.hidden && this.running) {
          this.pause()
          hooks.onAutoPause()
        }
      }
      document.addEventListener('visibilitychange', this.onVisibility)
      this.onGesture = () => this.audio.unlock()
      window.addEventListener('pointerdown', this.onGesture)
      window.addEventListener('keydown', this.onGesture)

      if (this.opts.perfOverlay && canvas.parentElement) {
        const host = canvas.parentElement
        const prevPosition = host.style.position
        if (!prevPosition || prevPosition === 'static') host.style.position = 'relative'
        this.overlay = new PerfOverlay(host)
      }

      this.initialized = true
    } catch (error) {
      this.dispose()
      throw error instanceof Error ? error : new Error('Game initialization failed.')
    }
  }

  /** Begin (or resume) the loop, optionally restoring a validated save. */
  start(restored: SaveData | null): void {
    if (!this.initialized || this.disposed) throw new Error('Game is not initialized.')
    if (restored) {
      const decoded = decodeSave(restored)
      if (!decoded.ok) throw new Error(`Cannot restore save: ${decoded.detail}`)
      this.runtime = createRuntime(this.opts.mission, {
        missionId: decoded.save.missionId,
        completed: [...decoded.save.completedObjectives],
        checkpoints: [...decoded.save.checkpoints],
        activeId: decoded.save.activeObjective,
      })
      this.physics?.teleport(
        decoded.save.playerPosition.x,
        decoded.save.playerPosition.y + 0.5,
        decoded.save.playerPosition.z,
      )
      this.playtime = decoded.save.playtimeSeconds
    } else {
      this.runtime = createRuntime(this.opts.mission)
      this.playtime = 0
    }
    this.pushHud(true)
    this.resume()
  }

  pause(): void {
    if (!this.running) return
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.input.clear()
  }

  resume(): void {
    if (this.disposed || !this.initialized || this.running) return
    this.running = true
    this.stepper.reset()
    this.lastMs = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  setQuality(quality: GraphicsQuality): void {
    if (this.renderer) {
      applyQuality(this.renderer, quality)
      resizeRenderer(this.renderer)
    }
    if (this.sun) {
      const shadowRes = QUALITY_SETTINGS[quality].shadowMap
      this.sun.castShadow = shadowRes > 0
      if (shadowRes > 0) {
        this.sun.shadow.mapSize.set(shadowRes, shadowRes)
        // Force reallocation at the new resolution on the next shadow render.
        if (this.sun.shadow.map) {
          this.sun.shadow.map.dispose()
          this.sun.shadow.map = null
        }
      }
    }
  }

  setVolume(volume: number): void {
    this.audio.setVolume(volume)
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted)
  }

  playUiSound(): void {
    this.audio.play('ui')
  }

  saveNow(): SaveData {
    if (!this.runtime || !this.state) throw new Error('Game has not started.')
    this.physics?.position(this.currPos)
    return {
      version: 2,
      missionId: this.runtime.mission.id,
      completedObjectives: [...this.runtime.progress.completed],
      checkpoints: [...this.runtime.progress.checkpoints],
      activeObjective: this.runtime.progress.activeId,
      playerPosition: {
        x: this.currPos.x,
        y: Math.max(0, this.currPos.y - 0.5),
        z: this.currPos.z,
      },
      playerZone: this.state.zone,
      playtimeSeconds: Math.floor(this.playtime),
      updatedAt: new Date().toISOString(),
    }
  }

  async checkpointSave(): Promise<void> {
    try {
      await saveStore.writeRaw(encodeSave(this.saveNow()))
    } catch {
      // Local saves must never interrupt play; the HUD already shows progress.
    }
  }

  private readonly tick = (nowMs: number): void => {
    if (!this.running || this.disposed) return
    this.rafId = requestAnimationFrame(this.tick)
    const dt = Math.min(Math.max((nowMs - this.lastMs) / 1000, 0), 0.25)
    this.lastMs = nowMs
    const { steps, alpha } = this.stepper.advance(dt, (fixed) => this.fixedStep(fixed))

    const mesh = this.fixture?.playerMesh
    if (mesh) {
      mesh.position.set(
        this.prevPos.x + (this.currPos.x - this.prevPos.x) * alpha,
        this.prevPos.y + (this.currPos.y - this.prevPos.y) * alpha,
        this.prevPos.z + (this.currPos.z - this.prevPos.z) * alpha,
      )
      this.camera?.update(mesh.position, dt)
    }

    if (this.fixture?.beacon) {
      this.elapsed += dt
      this.fixture.beacon.emissiveIntensity = 1 + Math.sin(this.elapsed * 3) * 0.5
    }

    this.pollTriggers()
    this.hudTimer += dt
    if (this.hudTimer > 0.5) {
      this.hudTimer = 0
      this.pushHud(false)
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera.camera)
      if (this.overlay) {
        const info = this.renderer.info
        this.overlay.update(nowMs, {
          physicsSteps: steps,
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures,
        })
      }
    }
  }

  private fixedStep(dt: number): void {
    if (!this.physics || !this.state) return
    this.input.readMove(this.move)
    const speed = this.input.sprinting ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED
    const dx = this.move.x * speed * dt
    const dz = -this.move.y * speed * dt
    const moving = dx !== 0 || dz !== 0

    this.verticalVelocity += -20 * dt
    if (this.verticalVelocity < -12) this.verticalVelocity = -12
    if (this.physics.isGrounded() && this.verticalVelocity < 0) this.verticalVelocity = 0
    this.physics.movePlayer(dx, this.verticalVelocity * dt, dz)

    this.prevPos.x = this.currPos.x
    this.prevPos.y = this.currPos.y
    this.prevPos.z = this.currPos.z
    this.physics.step()
    this.physics.position(this.currPos)

    this.state.player.x = this.currPos.x
    this.state.player.y = this.currPos.y
    this.state.player.z = this.currPos.z
    this.state.moving = moving
    this.state.speed = moving ? speed : 0
    if (moving) {
      this.state.player.facingY = Math.atan2(dx, dz)
      const mesh = this.fixture?.playerMesh
      if (mesh) mesh.rotation.y = this.state.player.facingY
    }
    this.audio.step(moving, dt)
    this.playtime += dt
  }

  private pollTriggers(): void {
    if (!this.runtime || !this.state) return
    const interactPressed = this.input.consumeInteract()
    let changed = false
    for (const objective of eligibleObjectives(this.runtime)) {
      const satisfied = triggerSatisfied(objective.trigger, {
        player: this.state.player,
        interactPressed,
      })
      if (satisfied && tryComplete(this.runtime, objective.id)) {
        changed = true
        this.audio.play(isComplete(this.runtime) ? 'checkpoint' : 'objective')
        void this.checkpointSave()
      }
    }
    if (changed || interactPressed) this.pushHud(true)
    else this.pushHud(false)
  }

  private currentPrompt(): string | null {
    if (!this.runtime || !this.state) return null
    for (const objective of eligibleObjectives(this.runtime)) {
      if (objective.trigger.kind !== 'interact') continue
      const dx = this.state.player.x - objective.trigger.point[0]
      const dz = this.state.player.z - objective.trigger.point[2]
      if (Math.hypot(dx, dz) <= objective.trigger.radius) {
        return `E — ${objective.trigger.prompt}`
      }
    }
    return null
  }

  private pushHud(force: boolean): void {
    if (!this.runtime) return
    const active = activeObjective(this.runtime)
    const complete = isComplete(this.runtime)
    const prompt = complete ? null : this.currentPrompt()
    const snapshot: HudSnapshot = {
      objectiveTitle: complete ? 'Mission complete' : (active?.title ?? 'No objective'),
      objectiveDesc: complete
        ? 'Checkpoint saved. Return to the menu or keep exploring.'
        : (active?.description ?? ''),
      objectiveIndex: this.runtime.progress.completed.length,
      objectiveTotal: this.runtime.mission.objectives.length,
      prompt,
      missionComplete: complete,
      checkpoint:
        this.runtime.progress.checkpoints[this.runtime.progress.checkpoints.length - 1] ?? null,
    }
    const key = JSON.stringify(snapshot)
    if (force || key !== this.hudKey) {
      this.hudKey = key
      this.opts.hooks.onHud(snapshot)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    if (this.onResize) window.removeEventListener('resize', this.onResize)
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.onGesture) {
      window.removeEventListener('pointerdown', this.onGesture)
      window.removeEventListener('keydown', this.onGesture)
    }
    this.input.detach()
    this.overlay?.destroy()
    this.overlay = null
    if (this.fixture) {
      this.scene?.remove(this.fixture.group)
      this.scene?.remove(this.fixture.playerMesh)
      for (const d of this.fixture.disposables) d.dispose()
      this.fixture = null
    }
    this.zones.dispose()
    this.scene?.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh
      const geometry = mesh.geometry as THREE.BufferGeometry | undefined
      geometry?.dispose()
    })
    this.scene = null
    this.sun = null
    this.camera = null
    this.physics?.dispose()
    this.physics = null
    this.audio.dispose()
    this.renderer?.dispose()
    this.renderer = null
    this.runtime = null
    this.state = null
    this.initialized = false
  }
}
