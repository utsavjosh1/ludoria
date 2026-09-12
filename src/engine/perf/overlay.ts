export interface PerfStats {
  fps: number
  frameMs: number
  physicsSteps: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
}

/**
 * Development-only performance overlay. Created only when the host passes
 * `perfOverlay: true` — never in production bundles by default.
 */
export class PerfOverlay {
  private readonly el: HTMLDivElement
  private emaMs = 16.6
  private last = -1

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div')
    this.el.setAttribute('data-testid', 'perf-overlay')
    this.el.style.cssText =
      'position:absolute;top:8px;left:8px;z-index:30;pointer-events:none;' +
      'font:11px/1.5 monospace;color:#b6ffb6;background:rgba(0,0,0,0.65);' +
      'padding:6px 8px;border-radius:6px;white-space:pre;'
    parent.appendChild(this.el)
    this.render({
      fps: 0,
      frameMs: 0,
      physicsSteps: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
    })
  }

  update(nowMs: number, partial: Omit<PerfStats, 'fps' | 'frameMs'>): void {
    if (this.last >= 0) {
      const dt = nowMs - this.last
      if (dt > 0 && dt < 1000) this.emaMs = this.emaMs * 0.92 + dt * 0.08
    }
    this.last = nowMs
    this.render({ ...partial, fps: 1000 / Math.max(this.emaMs, 0.01), frameMs: this.emaMs })
  }

  private render(stats: PerfStats): void {
    this.el.textContent =
      `fps ${stats.fps.toFixed(0)}  frame ${stats.frameMs.toFixed(1)}ms  phys ${stats.physicsSteps}\n` +
      `calls ${stats.drawCalls}  tris ${stats.triangles}  geo ${stats.geometries}  tex ${stats.textures}`
  }

  destroy(): void {
    this.el.remove()
  }
}
