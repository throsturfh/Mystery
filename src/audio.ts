import type { RoomId } from './save';
import { loadSettings, type Settings } from './settings';

export type SfxName = 'foot' | 'bell' | 'pickup' | 'ok' | 'fail' | 'door' | 'lantern' | 'ghost' | 'blip' | 'closed';

type Area = 'office' | 'shop' | 'stock';

export class AudioBus {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private rain: GainNode | null = null;
  private shop: GainNode | null = null;
  private stock: GainNode | null = null;
  private started = false;
  private area: Area | null = null;
  settings: Settings = loadSettings();

  unlock(): void {
    const ctx = this.ac();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.ensureGraph();
    this.applySettings();
    if (this.area) this.setAmbientGains();
  }

  applySettings(next?: Settings): void {
    if (next) this.settings = next;
    this.ensureGraph();
    const music = this.settings.mute ? 0 : this.settings.music;
    const sfx = this.settings.mute ? 0 : this.settings.sfx;
    const now = this.ctx?.currentTime ?? 0;
    this.musicGain?.gain.setTargetAtTime(music * 0.22, now, 0.05);
    this.sfxGain?.gain.setTargetAtTime(sfx, now, 0.05);
  }

  ambient(room: RoomId): void {
    this.area = room === 'stock' ? 'stock' : room === 'office' ? 'office' : 'shop';
    this.ensureGraph();
    this.setAmbientGains();
  }

  play(name: SfxName): void {
    const ctx = this.ac();
    if (!ctx || !this.sfxGain || this.settings.mute || this.settings.sfx <= 0.001) return;
    this.ensureGraph();
    if (name === 'blip') this.tone(610, 0.05, 'triangle', 0.05);
    else if (name === 'foot') this.noise(0.045, 180, 0.08);
    else if (name === 'bell') this.chime([880, 1320, 1760], 0.35, 0.07);
    else if (name === 'pickup') this.chime([520, 780], 0.18, 0.06);
    else if (name === 'ok') this.chime([440, 660, 880], 0.28, 0.07);
    else if (name === 'fail') this.tone(180, 0.16, 'sawtooth', 0.04);
    else if (name === 'door') this.noise(0.18, 90, 0.12);
    else if (name === 'lantern') {
      this.noise(0.22, 400, 0.1);
      this.tone(320, 0.3, 'triangle', 0.04);
    } else if (name === 'ghost') this.chime([660, 990, 1320], 0.7, 0.05);
    else if (name === 'closed') this.chime([392, 494, 587, 784], 0.9, 0.06);
  }

  blip(freq = 540, dur = 0.06, gain = 0.04): void {
    if (this.settings.mute) return;
    this.tone(freq, dur, 'triangle', gain * this.settings.sfx);
  }

  private setAmbientGains(): void {
    if (!this.ctx || !this.rain || !this.shop || !this.stock) return;
    const now = this.ctx.currentTime;
    const on = (node: GainNode, value: number) => node.gain.setTargetAtTime(value, now, 0.4);
    on(this.rain, this.area === 'office' ? 1 : 0);
    on(this.shop, this.area === 'shop' ? 1 : 0);
    on(this.stock, this.area === 'stock' ? 1 : 0);
  }

  private ensureGraph(): void {
    const ctx = this.ac();
    if (!ctx || this.started) return;
    this.started = true;
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(ctx.destination);
    this.sfxGain.connect(ctx.destination);
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.5;
    }
    const loop = () => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      return src;
    };
    const rainSrc = loop();
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1200;
    rainFilter.Q.value = 0.7;
    this.rain = ctx.createGain();
    this.rain.gain.value = 0;
    rainSrc.connect(rainFilter).connect(this.rain).connect(this.musicGain);
    rainSrc.start();

    const shopSrc = loop();
    const shopFilter = ctx.createBiquadFilter();
    shopFilter.type = 'lowpass';
    shopFilter.frequency.value = 420;
    this.shop = ctx.createGain();
    this.shop.gain.value = 0;
    shopSrc.connect(shopFilter).connect(this.shop).connect(this.musicGain);
    shopSrc.start();
    window.setInterval(() => {
      if (this.area === 'shop' && !this.settings.mute) this.tone(70 + Math.random() * 40, 0.2, 'sine', 0.03 * this.settings.music, this.musicGain);
    }, 4200);

    this.stock = ctx.createGain();
    this.stock.gain.value = 0;
    this.stock.connect(this.musicGain);
    for (const freq of [98, 147, 196]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      osc.connect(g).connect(this.stock);
      osc.start();
    }
    this.applySettings();
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, dest?: AudioNode | null): void {
    const ctx = this.ac();
    const out = dest ?? this.sfxGain;
    if (!ctx || !out || gain <= 0) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp).connect(out);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, freq: number, gain: number): void {
    const ctx = this.ac();
    if (!ctx || !this.sfxGain) return;
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter).connect(amp).connect(this.sfxGain);
    src.start();
  }

  private chime(freqs: number[], dur: number, gain: number): void {
    freqs.forEach((freq, index) => this.tone(freq, dur, 'sine', gain / (index + 1)));
  }

  private ac(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }
}

export const audio = new AudioBus();
