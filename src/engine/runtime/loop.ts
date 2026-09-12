/** Fixed-step accumulator with capped catch-up and long-gap protection. */
export class FixedStepper {
  private acc = 0

  constructor(
    readonly stepSeconds: number,
    readonly maxStepsPerFrame = 5,
  ) {}

  reset(): void {
    this.acc = 0
  }

  /**
   * Advance the simulation. Returns the number of physics steps taken and the
   * render interpolation factor in [0, 1).
   */
  advance(frameSeconds: number, step: (dt: number) => void): { steps: number; alpha: number } {
    // Long frame gaps (tab switch, debugger) must not cause a spiral of
    // catch-up work: clamp to a small multiple of one step.
    const clamped = Math.min(Math.max(frameSeconds, 0), this.stepSeconds * this.maxStepsPerFrame)
    this.acc += clamped
    let steps = 0
    while (this.acc >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      step(this.stepSeconds)
      this.acc -= this.stepSeconds
      steps += 1
    }
    if (steps === this.maxStepsPerFrame) this.acc = 0
    return { steps, alpha: this.acc / this.stepSeconds }
  }
}
