export class AudioBus {
  private ctx: AudioContext | null = null;
  private muted = false;
  private hum: { nodes: OscillatorNode[]; gain: GainNode } | null = null;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.humStop();
  }

  unlock(): void {
    const ctx = this.ac();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  private ac(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  blip(freq = 620, dur = 0.07, type: OscillatorType = 'sine', gain = 0.04): void {
    const ctx = this.ac();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.7), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  chime(): void {
    this.blip(740, 0.09, 'triangle', 0.045);
    window.setTimeout(() => this.blip(990, 0.12, 'sine', 0.04), 70);
  }

  string(): void {
    this.blip(196, 0.14, 'triangle', 0.05);
  }

  pour(): void {
    this.noise(0.18, 900, 0.03);
  }

  doorbell(): void {
    this.blip(880, 0.18, 'sine', 0.05);
    window.setTimeout(() => this.blip(660, 0.28, 'sine', 0.04), 160);
  }

  stamp(): void {
    this.noise(0.16, 240, 0.08);
  }

  flutter(): void {
    this.noise(0.22, 2400, 0.025);
  }

  humStart(): void {
    if (this.muted || this.hum) return;
    const ctx = this.ac();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.012;
    const nodes: OscillatorNode[] = [];
    for (const [freq, type] of [
      [96, 'sine'],
      [192, 'triangle'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(gain);
      o.start();
      nodes.push(o);
    }
    gain.connect(ctx.destination);
    this.hum = { nodes, gain };
  }

  humStop(): void {
    if (!this.hum) return;
    for (const o of this.hum.nodes) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    this.hum = null;
  }

  private noise(duration: number, freq: number, gainValue: number): void {
    const ctx = this.ac();
    if (!ctx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gainValue;
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
  }
}

export const audio = new AudioBus();
