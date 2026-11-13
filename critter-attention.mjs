import { motionPose3D } from './critter-motion.mjs';

const rest = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, squash: 1, open: 1, gazeX: 0, gazeY: 0, glow: 1 };
const mix = (a, b, weight) => Object.fromEntries(Object.keys(rest).map(key => [key, a[key] + (b[key] - a[key]) * weight]));

// A local timing model, not a language or emotion classifier. All times are ms.
export class SpeechAttention {
  constructor() { this.reset(); }
  reset() {
    this.lastTime = null;
    this.started = null;
    this.lastVoice = null;
    this.speakingSince = null;
    this.wasSpeaking = false;
    this.turns = 0;
    this.pose = { ...rest };
    this.state = 'off';
  }
  update(time, signal) {
    if (!signal?.enabled) { this.reset(); return null; }
    this.started ??= time;
    const dt = Math.min(100, Math.max(0, time - (this.lastTime ?? time)));
    this.lastTime = time;
    if (signal.speaking) {
      if (!this.wasSpeaking) { this.speakingSince = time; this.turns++; }
      this.lastVoice = time;
    }
    this.wasSpeaking = signal.speaking;
    const quiet = time - (this.lastVoice ?? this.started);
    const speech = time - (this.speakingSince ?? time);
    let target = { ...rest };
    const subtle = (name, seconds, amount) => mix(rest, motionPose3D(name, seconds), amount);
    if (signal.speaking) {
      this.state = signal.steady && speech > 1000 ? 'considering' : 'listening';
      const nod = Math.max(0, Math.sin(speech / 1000 * Math.PI / 2.8)) ** 8;
      target = { ...rest, pitch: -0.12 + 0.13 * nod, z: 0.14,
        roll: this.state === 'considering' ? 0.11 : 0.025 * Math.sin(speech / 1800),
        gazeY: this.state === 'considering' ? 0.2 : 0,
        open: 1 - 0.94 * Math.max(0, 1 - Math.abs((speech % 4700) - 3200) / 100) };
    } else if (this.lastVoice !== null && quiet < 650) {
      this.state = 'holding';
      target = { ...rest, pitch: -0.1, z: 0.14 };
    } else if (this.lastVoice !== null && quiet < 2400) {
      this.state = 'acknowledging';
      target = subtle('nod', (quiet - 650) / 1000, 0.42);
    } else if (this.lastVoice !== null && quiet < 6000) {
      this.state = 'waiting';
      target = { ...rest, roll: (this.turns % 2 ? -1 : 1) * 0.09,
        pitch: -0.06, gazeY: 0.18, y: 0.04 * Math.sin(quiet / 1000) };
    } else {
      this.state = 'resting';
      const elapsed = Math.max(0, quiet - 6000) / 1000;
      // Space out short actions with breathing pauses; alternate the sequence
      // between conversations so quiet doesn't replay the same little routine.
      const actions = ['look', 'blink', 'bob', 'thinking', 'float', 'blink'];
      const slot = Math.floor(elapsed / 7);
      const phase = elapsed % 7;
      const envelope = Math.min(1, phase / 0.6, Math.max(0, (4.5 - phase) / 0.8));
      target = subtle(actions[(slot + this.turns) % actions.length], phase, 0.38 * envelope);
      target.squash *= 1 + 0.012 * Math.sin(elapsed * Math.PI / 2.5);
    }
    // Interrupt rest immediately when speech returns, without snapping the pose.
    this.pose = mix(this.pose, target, 1 - Math.exp(-dt / (signal.speaking ? 130 : 260)));
    return this.pose;
  }
}
