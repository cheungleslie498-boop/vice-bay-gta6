// Procedural WebAudio sounds for Vice Bay — no audio assets, everything synthesized.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // engine: sawtooth through a lowpass, pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    return this.muted;
  }

  engine(speed01) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.1);
  }

  blip(freq = 880, dur = 0.12, type = 'square', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  noise(dur = 0.25, vol = 0.25, low = 400) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = low;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  siren(quiet = false) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this.sirenTimer < 900) return;
    this.sirenTimer = now;
    const t = this.ctx.currentTime;
    const vol = quiet ? 0.03 : 0.06;
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(i === 0 ? 720 : 960, t + i * 0.42);
      o.frequency.setValueAtTime(i === 0 ? 960 : 720, t + i * 0.42 + 0.4);
      g.gain.setValueAtTime(0.0001, t + i * 0.42);
      g.gain.linearRampToValueAtTime(vol, t + i * 0.42 + 0.05);
      g.gain.linearRampToValueAtTime(0.0001, t + i * 0.42 + 0.42);
      o.connect(g).connect(this.ctx.destination);
      o.start(t + i * 0.42); o.stop(t + i * 0.42 + 0.45);
    }
  }

  play(name, opt = {}) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'engine': this.engine(opt.speed || 0); break;
      case 'punch': this.noise(0.12, 0.2, 900); break;
      case 'thud': this.noise(0.2, 0.28, 300); break;
      case 'crash': this.noise(0.35, 0.35, 700); this.blip(90, 0.3, 'sawtooth', 0.2); break;
      case 'explosion': this.noise(0.9, 0.5, 500); this.blip(55, 0.8, 'sawtooth', 0.25); break;
      case 'door': this.blip(220, 0.08, 'square', 0.08); this.noise(0.08, 0.1, 1200); break;
      case 'siren': this.siren(false); break;
      case 'mission':
        this.blip(523, 0.14, 'square', 0.1);
        setTimeout(() => this.blip(659, 0.14, 'square', 0.1), 140);
        setTimeout(() => this.blip(784, 0.22, 'square', 0.12), 280);
        break;
      case 'click': this.blip(660, 0.06, 'square', 0.08); break;
      default: break;
    }
  }
}
