import Phaser from 'phaser';
import { audio } from '../audio';
import { H, W } from '../config';
import { hideCreatorField, placeCreatorField } from '../creatorDom';
import { COATS, HATS, SCARVES, TONES, cleanName, cleanTone, type Tone } from '../profile';
import { freshSave, hasContinue, loadSave, writeSave } from '../save';
import { loadSettings, writeSettings, type Settings } from '../settings';
import { paintHero } from '../tint';

type Mode = 'title' | 'create' | 'settings' | 'credits';
type Hit = { id: string; x: number; y: number; w: number; h: number };

const FONT = 'Cormorant Garamond, Georgia, serif';
const DISPLAY = 'Cinzel, Georgia, serif';

export class TitleScene extends Phaser.Scene {
  private mode: Mode = 'title';
  private hits: Hit[] = [];
  private coat = 'tan';
  private hat = 'brown';
  private scarf = 'plaid';
  private tone: Tone = 'sarcastic';
  private settings: Settings = loadSettings();
  private drag: 'music' | 'sfx' | null = null;
  private onResize = (): void => this.placeName();

  constructor() {
    super('title');
  }

  create(): void {
    this.mode = 'title';
    this.settings = loadSettings();
    this.tone = this.settings.tone;
    audio.unlock();
    audio.ambient('office');
    hideCreatorField();
    document.getElementById('loading')?.remove();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize);
      hideCreatorField();
    });
    this.draw();
  }

  private draw(): void {
    this.children.removeAll();
    this.hits = [];
    this.add.image(0, 0, 'office').setOrigin(0, 0).setTint(0x9a8a74);
    this.add.rectangle(W / 2, H / 2, W, H, 0x140e0a, 0.45);
    if (this.mode === 'title') this.drawTitle();
    else if (this.mode === 'create') this.drawCreate();
    else if (this.mode === 'settings') this.drawSettings();
    else this.drawCredits();
    this.placeName();
  }

  private drawTitle(): void {
    this.add.text(W / 2, 150, 'Hollowmere Dispatch', {
      fontFamily: DISPLAY,
      fontSize: '64px',
      color: '#e6c98a',
      stroke: '#140e0a',
      strokeThickness: 8,
    }).setOrigin(0.5).setResolution(2);
    this.add.text(W / 2, 214, 'v0.12', {
      fontFamily: FONT,
      fontStyle: 'italic',
      fontSize: '28px',
      color: '#f3e6c8',
    }).setOrigin(0.5).setResolution(2);
    this.add.text(W / 2, 258, 'A ghostly point-and-click. Case 0: The Bellweather Bookshop.', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#f6edd6',
    }).setOrigin(0.5).setResolution(2);
    this.button(W / 2 - 180, 340, 360, 64, 'New Game', 'new');
    this.button(W / 2 - 180, 420, 360, 64, 'Continue', 'continue', hasContinue());
    this.button(W / 2 - 180, 500, 360, 64, 'Settings', 'settings');
    this.button(W / 2 - 180, 580, 360, 56, 'Credits', 'credits');
  }

  private drawCreate(): void {
    this.add.text(96, 48, 'The new detective', {
      fontFamily: DISPLAY,
      fontSize: '36px',
      color: '#e6c98a',
    }).setResolution(2);
    this.add.text(500, 78, 'Name', { fontFamily: DISPLAY, fontSize: '20px', color: '#f3e6c8' }).setResolution(2);
    paintHero(this, { name: 'Detective', coat: this.coat, hat: this.hat, scarf: this.scarf, tone: this.tone });
    this.add.image(250, 640, 'hero').setOrigin(0.5, 1).setScale(0.42);
    this.row(500, 210, 'Coat', COATS, this.coat, 'coat');
    this.row(500, 300, 'Hat', HATS, this.hat, 'hat');
    this.row(500, 390, 'Scarf', SCARVES, this.scarf, 'scarf');
    this.add.text(500, 470, 'Tone', { fontFamily: DISPLAY, fontSize: '20px', color: '#f3e6c8' }).setResolution(2);
    TONES.forEach((option, index) => {
      this.button(500 + index * 210, 500, 196, 48, option.label, `tone:${option.id}`, true, this.tone === option.id);
    });
    this.button(500, 590, 200, 56, 'Begin', 'begin');
    this.button(740, 590, 200, 56, 'Back', 'back');
  }

  private drawSettings(): void {
    this.add.text(W / 2, 70, 'Settings', { fontFamily: DISPLAY, fontSize: '42px', color: '#e6c98a' }).setOrigin(0.5).setResolution(2);
    this.slider(220, 140, 'Music', this.settings.music, 'music');
    this.slider(220, 220, 'Effects', this.settings.sfx, 'sfx');
    this.button(220, 270, 280, 52, this.settings.mute ? 'Sound: muted' : 'Sound: on', 'mute');
    this.button(520, 270, 280, 52, this.settings.vibration ? 'Vibration: on' : 'Vibration: off', 'vibration');
    this.button(820, 270, 280, 52, this.settings.reduceEffects ? 'Effects: reduced' : 'Effects: full', 'reduce');
    this.add.text(220, 350, 'Tone', { fontFamily: DISPLAY, fontSize: '20px', color: '#f3e6c8' }).setResolution(2);
    TONES.forEach((option, index) => {
      this.button(220 + index * 220, 380, 200, 48, option.label, `tone:${option.id}`, true, this.settings.tone === option.id);
    });
    this.add.text(W / 2, 480, 'Sound is synthesised in the browser. Vibration is silent on devices that do not support it.\nReduce effects turns off the shake and the lamp flicker.', {
      fontFamily: FONT,
      fontStyle: 'italic',
      fontSize: '22px',
      color: '#f3e6c8',
      align: 'center',
      wordWrap: { width: 860 },
    }).setOrigin(0.5).setResolution(2);
    this.button(W / 2 - 140, 580, 280, 56, 'Back', 'back');
  }

  private drawCredits(): void {
    this.add.text(W / 2, 140, 'Credits', { fontFamily: DISPLAY, fontSize: '48px', color: '#e6c98a' }).setOrigin(0.5).setResolution(2);
    this.add.text(W / 2, 280, 'Music and effects are synthesised with the Web Audio API.\nNo recordings were borrowed.\n\nCinzel and Cormorant Garamond, via Fontsource.\n\nRooms, ghosts, and the detective are original art.', {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#f6edd6',
      align: 'center',
      wordWrap: { width: 760 },
    }).setOrigin(0.5).setResolution(2);
    this.button(W / 2 - 140, 560, 280, 56, 'Back', 'back');
  }

  private row(x: number, y: number, label: string, options: readonly { id: string; label: string; color: string }[], current: string, prefix: string): void {
    this.add.text(x, y - 28, label, { fontFamily: DISPLAY, fontSize: '20px', color: '#f3e6c8' }).setResolution(2);
    options.forEach((option, index) => {
      this.button(x + (index % 4) * 180, y, 168, 48, option.label, `${prefix}:${option.id}`, true, option.id === current);
    });
  }

  private button(x: number, y: number, w: number, h: number, label: string, id: string, enabled = true, hot = false): void {
    const g = this.add.graphics();
    g.fillStyle(hot ? 0x5c4324 : 0x24180f, enabled ? 0.94 : 0.45);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, enabled ? 0xc6a15a : 0x5c4a38, 1);
    g.strokeRoundedRect(x, y, w, h, 10);
    this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: DISPLAY,
      fontSize: '22px',
      color: enabled ? '#f6edd6' : '#8a7b68',
    }).setOrigin(0.5).setResolution(2);
    if (enabled) this.hits.push({ id, x, y, w, h });
  }

  private slider(x: number, y: number, label: string, value: number, id: 'music' | 'sfx'): void {
    this.add.text(x, y - 36, label, { fontFamily: DISPLAY, fontSize: '22px', color: '#f3e6c8' }).setResolution(2);
    const g = this.add.graphics();
    g.fillStyle(0x1a120c, 1);
    g.fillRoundedRect(x, y, 440, 18, 8);
    g.fillStyle(0xc6a15a, 1);
    g.fillRoundedRect(x, y, 24 + 416 * value, 18, 8);
    this.hits.push({ id, x, y: y - 10, w: 440, h: 38 });
  }

  private onDown(p: Phaser.Input.Pointer): void {
    audio.unlock();
    const w = this.world(p);
    const hit = this.hits.find((box) => w.x >= box.x && w.y >= box.y && w.x <= box.x + box.w && w.y <= box.y + box.h);
    if (hit?.id === 'music' || hit?.id === 'sfx') this.drag = hit.id;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const w = this.world(p);
    const hit = this.hits.find((box) => box.id === this.drag);
    if (!hit) return;
    const value = Math.max(0, Math.min(1, (w.x - hit.x) / hit.w));
    this.settings = { ...this.settings, [this.drag]: value };
    writeSettings(this.settings);
    audio.applySettings(this.settings);
    this.draw();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.drag) {
      this.drag = null;
      return;
    }
    const w = this.world(p);
    const hit = this.hits.find((box) => w.x >= box.x && w.y >= box.y && w.x <= box.x + box.w && w.y <= box.y + box.h);
    if (!hit) return;
    if (hit.id === 'new') this.mode = 'create';
    else if (hit.id === 'continue' && hasContinue()) {
      hideCreatorField();
      this.scene.start('adventure');
      return;
    } else if (hit.id === 'settings') this.mode = 'settings';
    else if (hit.id === 'credits') this.mode = 'credits';
    else if (hit.id === 'back') this.mode = 'title';
    else if (hit.id === 'mute') {
      this.settings = { ...this.settings, mute: !this.settings.mute };
      writeSettings(this.settings);
      audio.applySettings(this.settings);
    } else if (hit.id === 'vibration') {
      this.settings = { ...this.settings, vibration: !this.settings.vibration };
      writeSettings(this.settings);
    } else if (hit.id === 'reduce') {
      this.settings = { ...this.settings, reduceEffects: !this.settings.reduceEffects };
      writeSettings(this.settings);
    } else if (hit.id.startsWith('coat:')) this.coat = hit.id.slice(5);
    else if (hit.id.startsWith('hat:')) this.hat = hit.id.slice(4);
    else if (hit.id.startsWith('scarf:')) this.scarf = hit.id.slice(6);
    else if (hit.id.startsWith('tone:')) {
      this.tone = cleanTone(hit.id.slice(5));
      this.settings = { ...this.settings, tone: this.tone };
      writeSettings(this.settings);
      if (hasContinue()) {
        const save = loadSave();
        save.tone = this.tone;
        writeSave(save);
      }
    } else if (hit.id === 'begin') {
      const input = document.getElementById('creator-name') as HTMLInputElement | null;
      const save = freshSave();
      save.started = true;
      save.name = cleanName(input?.value ?? '');
      save.coat = this.coat;
      save.hat = this.hat;
      save.scarf = this.scarf;
      save.tone = this.tone;
      writeSave(save);
      hideCreatorField();
      this.scene.start('adventure');
      return;
    } else return;
    this.draw();
  }

  private world(p: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: p.worldX, y: p.worldY };
  }

  private placeName(): void {
    if (this.mode !== 'create' || !this.scene.isActive()) {
      hideCreatorField();
      return;
    }
    const canvas = this.game.canvas.getBoundingClientRect();
    placeCreatorField(canvas, W, H);
  }
}
