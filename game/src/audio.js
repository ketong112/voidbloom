// All sound is synthesised with the Web Audio API — no audio files, no
// network. Every call is safe before the first user gesture (the context
// simply stays suspended) and when muted.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.padNodes = null;
    this._ensureBound = () => this.ensure();
    window.addEventListener('pointerdown', this._ensureBound, { once: true });
    window.addEventListener('keydown', this._ensureBound, { once: true });
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this.startPad();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.42;
  }

  /** A short oscillator blip with an exponential decay envelope. */
  blip({ type = 'sine', from = 440, to = null, dur = 0.12, vol = 0.5, when = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** Filtered noise burst (explosions, hits). */
  noise({ dur = 0.25, vol = 0.5, freq = 1200, when = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t0);
  }

  shoot() { this.blip({ type: 'square', from: 880, to: 520, dur: 0.07, vol: 0.10 }); }
  hit() { this.blip({ type: 'triangle', from: 300, to: 180, dur: 0.06, vol: 0.16 }); }
  explode(big = false) {
    this.noise({ dur: big ? 0.5 : 0.22, vol: big ? 0.55 : 0.3, freq: big ? 900 : 1600 });
    this.blip({ type: 'sine', from: big ? 220 : 320, to: 40, dur: big ? 0.45 : 0.2, vol: 0.4 });
  }
  pickup() {
    this.blip({ type: 'sine', from: 660, to: 990, dur: 0.09, vol: 0.22 });
    this.blip({ type: 'sine', from: 990, to: 1320, dur: 0.1, vol: 0.18, when: 0.06 });
  }
  heal() {
    this.blip({ type: 'sine', from: 523, dur: 0.12, vol: 0.25 });
    this.blip({ type: 'sine', from: 784, dur: 0.16, vol: 0.25, when: 0.09 });
  }
  hurt() {
    this.blip({ type: 'sawtooth', from: 200, to: 60, dur: 0.3, vol: 0.4 });
    this.noise({ dur: 0.2, vol: 0.25, freq: 700 });
  }
  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.blip({ type: 'triangle', from: f, dur: 0.18, vol: 0.22, when: i * 0.08 }));
  }
  bossWarn() {
    this.blip({ type: 'sawtooth', from: 110, to: 220, dur: 0.5, vol: 0.3 });
    this.blip({ type: 'sawtooth', from: 110, to: 220, dur: 0.5, vol: 0.3, when: 0.55 });
  }
  upgrade() {
    [392, 523, 659, 784].forEach((f, i) =>
      this.blip({ type: 'sine', from: f, dur: 0.14, vol: 0.2, when: i * 0.06 }));
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) =>
      this.blip({ type: 'triangle', from: f, dur: 0.3, vol: 0.25, when: i * 0.22 }));
  }
  uiClick() { this.blip({ type: 'sine', from: 700, to: 900, dur: 0.05, vol: 0.15 }); }
  nova() {
    this.blip({ type: 'sine', from: 180, to: 720, dur: 0.35, vol: 0.3 });
    this.noise({ dur: 0.3, vol: 0.2, freq: 2400 });
  }

  /** A quiet two-oscillator ambient pad, started once. */
  startPad() {
    if (!this.ctx || this.padNodes) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    const o1 = this.ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 110;
    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle'; o2.frequency.value = 165.2;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    o1.connect(filter); o2.connect(filter);
    filter.connect(g); g.connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this.padNodes = { o1, o2, lfo, g };
  }
}
