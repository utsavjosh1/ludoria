/** Keyboard + injectable-touch input. No per-frame allocations on read. */
export interface MoveVector {
  x: number
  y: number
}

const KEYMAP: Record<string, 'up' | 'down' | 'left' | 'right' | 'interact' | 'sprint'> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyE: 'interact',
  Space: 'interact',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

export class Input {
  private held = new Set<'up' | 'down' | 'left' | 'right' | 'sprint'>()
  private interactEdge = false
  private touchMove: MoveVector = { x: 0, y: 0 }
  private detachFns: Array<() => void> = []
  private attachedTo: (Window | HTMLElement)[] = []

  attach(targets: { window: Window; canvas: HTMLElement }): void {
    this.detach()
    const onKeyDown = (e: KeyboardEvent) => {
      const action = KEYMAP[e.code]
      if (!action) return
      if (action === 'interact') {
        if (!e.repeat) this.interactEdge = true
      } else {
        this.held.add(action)
      }
      if (action !== 'sprint') e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const action = KEYMAP[e.code]
      if (action && action !== 'interact') this.held.delete(action)
    }

    // Touch devices have no shift key; sprint is injected via setSprint().
    const onBlur = () => this.clear()
    targets.window.addEventListener('keydown', onKeyDown)
    targets.window.addEventListener('keyup', onKeyUp)
    targets.window.addEventListener('blur', onBlur)
    targets.canvas.tabIndex = 0
    this.attachedTo = [targets.window]
    this.detachFns = [
      () => targets.window.removeEventListener('keydown', onKeyDown),
      () => targets.window.removeEventListener('keyup', onKeyUp),
      () => targets.window.removeEventListener('blur', onBlur),
    ]
  }

  detach(): void {
    for (const fn of this.detachFns) fn()
    this.detachFns = []
    this.attachedTo = []
    this.clear()
  }

  get listenerCount(): number {
    return this.attachedTo.length === 0 ? 0 : this.detachFns.length
  }

  clear(): void {
    this.held.clear()
    this.interactEdge = false
    this.touchMove = { x: 0, y: 0 }
  }

  /** Touch/virtual-joystick injection point (no external joystick dependency). */
  setTouchMove(v: MoveVector): void {
    this.touchMove = v
  }

  pressInteract(): void {
    this.interactEdge = true
  }

  /** Normalized 2D move vector; reused `out` avoids allocation. */
  readMove(out: MoveVector): MoveVector {
    let x = this.touchMove.x
    let y = this.touchMove.y
    if (this.held.has('left')) x -= 1
    if (this.held.has('right')) x += 1
    if (this.held.has('up')) y += 1
    if (this.held.has('down')) y -= 1
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    out.x = x
    out.y = y
    return out
  }

  /** Edge-triggered interact; reading consumes the press exactly once. */
  consumeInteract(): boolean {
    const pressed = this.interactEdge
    this.interactEdge = false
    return pressed
  }

  peekInteract(): boolean {
    return this.interactEdge
  }

  get sprinting(): boolean {
    return this.held.has('sprint')
  }

  /** Touch sprint injection (e.g. double-tap joystick). */
  setSprint(on: boolean): void {
    if (on) this.held.add('sprint')
    else this.held.delete('sprint')
  }
}
