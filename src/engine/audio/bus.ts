/**
 * Minimal synthesized audio bus — no audio files required for the test scene.
 * The AudioContext is created lazily and resumed on user gesture; all
 * oscillators are short-lived and bounded.
 */
export type UiSound = 'ui' | 'objective' | 'checkpoint' | 'error' | 'step'

const FREQUENCIES: Record<UiSound, number[]> = {
  ui: [660],
  objective: [523, 659, 784],
  checkpoint: [392, 523],
  error: [196, 147],
  step: [220],
}

export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private volume = 0.8
  private muted = false
  private stepAcc = 0

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.muted ? 0 : this.volume * 0.25, this.ctx.currentTime)
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : this.volume * 0.25, this.ctx.currentTime)
    }
  }

  /** Must be called from a user gesture at least once. Safe to call often. */
  unlock(): void {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const Ctor = window.AudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume * 0.25
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  play(kind: UiSound): void {
    if (this.muted) return
    this.unlock()
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    FREQUENCIES[kind].forEach((freq, i) => {
      if (!this.ctx || !this.master) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = kind === 'error' ? 'sawtooth' : 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.09
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.6, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(start)
      osc.stop(start + 0.3)
    })
  }

  /** Quiet footstep ticks while moving; call every frame with speed. */
  step(moving: boolean, dtSeconds: number): void {
    if (!moving || this.muted || !this.ctx) return
    this.stepAcc += dtSeconds
    if (this.stepAcc > 0.34) {
      this.stepAcc = 0
      this.play('step')
    }
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close().catch(() => undefined)
    this.ctx = null
    this.master = null
  }
}
