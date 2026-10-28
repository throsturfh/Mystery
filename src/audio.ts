import type Phaser from 'phaser';
import type { RoomId } from './save';
import { loadSettings, type Settings } from './settings';

export type SfxName =
  | 'foot'
  | 'bell'
  | 'pickup'
  | 'ok'
  | 'fail'
  | 'door'
  | 'lantern'
  | 'ghost'
  | 'blip'
  | 'closed'
  | 'whisper'
  | 'lanternToggle'
  | 'bark';

const FILES: Record<string, string> = {
  rain: 'rain.ogg',
  music: 'music.ogg',
  'foot-wood': 'foot-wood.ogg',
  'foot-rug': 'foot-rug.ogg',
  'foot-stone': 'foot-stone.ogg',
  door: 'door.ogg',
  bell: 'bell.ogg',
  pickup: 'pickup.ogg',
  ui: 'ui.ogg',
  use: 'use.ogg',
  ghost: 'ghost.ogg',
  whisper: 'whisper.ogg',
  bark: 'bark.ogg',
};

/** Recorded beds and effects. Volumes follow the settings sliders. */
export class AudioBus {
  private sound: Phaser.Sound.BaseSoundManager | null = null;
  private rain: Phaser.Sound.BaseSound | null = null;
  private music: Phaser.Sound.BaseSound | null = null;
  private started = false;
  settings: Settings = loadSettings();
  private ducked = false;
  room: RoomId | 'street' = 'office';

  unlock(): void {
    const ctx = this.sound as { context?: AudioContext } | null;
    const audioCtx = ctx?.context;
    if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume();
    this.pushBed();
  }

  bind(scene: Phaser.Scene): void {
    this.sound = scene.sound;
    if (this.started) return;
    this.started = true;
    this.rain = scene.sound.add('rain', { loop: true, volume: this.bedVolume(0.34) });
    this.music = scene.sound.add('music', { loop: true, volume: this.bedVolume(0.22) });
    if (!this.settings.mute && this.settings.music > 0.01) {
      this.rain.play();
      this.music.play();
    }
  }

  applySettings(next?: Settings): void {
    if (next) this.settings = next;
    this.pushBed();
  }

  ambient(room: RoomId | 'street'): void {
    this.room = room;
  }

  duck(on: boolean): void {
    this.ducked = on;
    this.pushBed();
  }

  play(name: SfxName, pan = 0): void {
    if (!this.sound || this.settings.mute || this.settings.sfx <= 0.001) return;
    const key = this.keyFor(name);
    const vol = this.settings.sfx * (name === 'blip' || name === 'whisper' ? 0.28 : 0.55);
    this.sound.play(key, { volume: vol, detune: (pan || 0) * 80, rate: name === 'foot' ? 0.92 + Math.random() * 0.16 : 1 });
  }

  blip(_freq = 540, _dur = 0.06, _gain = 0.04): void {
    this.play('blip');
  }

  private keyFor(name: SfxName): string {
    if (name === 'foot') {
      if (this.room === 'street') return 'foot-stone';
      if (this.room === 'nook') return 'foot-rug';
      return 'foot-wood';
    }
    if (name === 'bell') return 'bell';
    if (name === 'pickup' || name === 'ok') return 'pickup';
    if (name === 'fail' || name === 'lanternToggle' || name === 'blip' || name === 'closed') return 'ui';
    if (name === 'door') return 'door';
    if (name === 'lantern') return 'use';
    if (name === 'bark') return 'bark';
    if (name === 'ghost') return 'ghost';
    return 'whisper';
  }

  /** A short recorded murmur under a line of dialogue. */
  murmur(female: boolean): void {
    if (!this.sound || this.settings.mute || this.settings.sfx <= 0.001) return;
    const key = this.has('bark') && female ? 'whisper' : 'whisper';
    this.sound.play(key, { volume: this.settings.sfx * 0.16, rate: female ? 1.18 : 0.86, detune: female ? 40 : -30 });
  }

  private has(key: string): boolean {
    return this.sound?.game.cache.audio.exists(key) === true;
  }

  private bedVolume(base: number): number {
    if (this.settings.mute) return 0;
    const ducked = this.ducked ? 0.28 : 1;
    return base * this.settings.music * ducked;
  }

  private pushBed(): void {
    const rain = this.bedVolume(0.34);
    const music = this.bedVolume(0.22);
    const set = (sound: Phaser.Sound.BaseSound | null, volume: number) => {
      if (!sound) return;
      (sound as Phaser.Sound.WebAudioSound).setVolume?.(volume);
      if (volume <= 0.001 && sound.isPlaying) sound.pause();
      if (volume > 0.001 && !sound.isPlaying) sound.play();
    };
    set(this.rain, rain);
    set(this.music, music);
  }
}

export const audio = new AudioBus();

export const AUDIO_FILES = FILES;
