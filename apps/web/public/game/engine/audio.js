/** Tiny procedural sound bank; no audio downloads and no sound before a gesture. */
export class AudioSystem {
  constructor() { this.context = null; this.enabled = false; this.lastAmbient = 0; }
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { this.enabled = false; return false; }
      try { this.context ||= new Audio(); await this.context.resume(); this.play('beacon'); } catch { this.enabled = false; }
    } else if (this.context?.state === 'running') await this.context.suspend();
    return this.enabled;
  }
  tone(frequency, start = 0, duration = .12, volume = .035, type = 'sine') {
    if (!this.enabled || this.context?.state !== 'running') return;
    const c = this.context, oscillator = c.createOscillator(), gain = c.createGain(), at = c.currentTime + start;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .01); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain); gain.connect(c.destination); oscillator.start(at); oscillator.stop(at + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  play(type) {
    if (['beacon', 'win'].includes(type)) [392, 494, 587, 784].forEach((note, i) => this.tone(note, i * .11, .7, .028, 'triangle'));
    else if (['gather', 'chest', 'heal'].includes(type)) { this.tone(523, 0, .12, .025, 'triangle'); this.tone(784, .07, .2, .022, 'triangle'); }
    else if (type === 'hit') { this.tone(147, 0, .1, .027, 'square'); this.tone(98, .02, .12, .018, 'triangle'); }
    else if (type === 'hurt') this.tone(93, 0, .2, .04, 'sawtooth');
    else if (type === 'swing') this.tone(210, 0, .06, .012, 'triangle');
  }
  ambient(time) {
    if (time - this.lastAmbient < 9) return;
    this.lastAmbient = time;
    const notes = [196, 246.94, 293.66, 369.99];
    this.tone(notes[Math.floor(time / 9) % notes.length], 0, 3, .009);
    this.tone(notes[Math.floor(time / 9) % notes.length] * 2, .2, 2, .006);
  }
  suspend() { if (this.context?.state === 'running') this.context.suspend().catch(() => {}); }
  resume() { if (this.enabled && this.context?.state === 'suspended') this.context.resume().catch(() => {}); }
}
