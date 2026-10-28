import Phaser from 'phaser';
import { audio } from '../audio';
import { H, W } from '../config';
import { hideCreatorField, placeCreatorField } from '../creatorDom';
import { DETECTIVES, detectiveById, type DetectiveId } from '../detectives';
import { TONES, cleanName, cleanTone, type Tone } from '../profile';
import { freshSave, hasContinue, loadSave, writeSave } from '../save';
import { loadSettings, writeSettings, type Settings } from '../settings';
import { paintHero, paintPortrait } from '../tint';

type Mode = 'title' | 'pick' | 'create' | 'settings' | 'credits';
type Hit = { id: string; x: number; y: number; w: number; h: number };

const FONT = 'Cormorant Garamond, Georgia, serif';
const DISPLAY = 'Cinzel, Georgia, serif';

export class TitleScene extends Phaser.Scene {
  private mode: Mode = 'title';
  private hits: Hit[] = [];
  private detective: DetectiveId = 'crowe';
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
    else if (this.mode === 'pick') this.drawPick();
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
    this.add.text(W / 2, 214, 'v0.16', {
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

  private drawPick(): void {
    this.add.text(W / 2, 36, 'Choose a detective', {
      fontFamily: DISPLAY,
      fontSize: '36px',
      color: '#e6c98a',
    }).setOrigin(0.5, 0).setResolution(2);
    DETECTIVES.forEach((row, index) => {
      const x = 28 + index * 250;
      paintPortrait(this, {
        name: row.defaultName,
        detective: row.id,
        coat: 'tan',
        hat: 'brown',
        scarf: 'plaid',
        tone: 'sarcastic',
      }, `bust-${row.id}`);
      const g = this.add.graphics();
      g.fillStyle(0x140e0a, 0.55);
      g.fillRoundedRect(x, 88, 236, 500, 12);
      g.lineStyle(2, 0xc6a15a, 1);
      g.strokeRoundedRect(x, 88, 236, 500, 12);
      this.add.image(x + 118, 430, `bust-${row.id}`).setOrigin(0.5, 1).setScale(0.28);
      this.add.text(x + 118, 448, row.label, {
        fontFamily: DISPLAY,
        fontSize: '18px',
        color: '#f6edd6',
        align: 'center',
        wordWrap: { width: 210 },
      }).setOrigin(0.5, 0).setResolution(2);
      this.add.text(x + 118, 500, row.blurb, {
        fontFamily: FONT,
        fontStyle: 'italic',
        fontSize: '16px',
        color: '#f3e6c8',
        align: 'center',
        wordWrap: { width: 210 },
      }).setOrigin(0.5, 0).setResolution(2);
      this.hits.push({ id: `who:${row.id}`, x, y: 88, w: 236, h: 500 });
    });
    this.button(W / 2 - 140, 620, 280, 52, 'Back', 'back');
  }

  private drawCreate(): void {
    const who = detectiveById(this.detective);
    this.add.text(96, 36, who.label, {
      fontFamily: DISPLAY,
      fontSize: '32px',
      color: '#e6c98a',
    }).setResolution(2);
    this.add.text(500, 78, 'Name', { fontFamily: DISPLAY, fontSize: '20px', color: '#f3e6c8' }).setResolution(2);
    paintHero(this, { name: who.defaultName, detective: this.detective, coat: this.coat, hat: this.hat, scarf: this.scarf, tone: this.tone });
    this.add.image(250, 640, 'hero').setOrigin(0.5, 1).setScale(0.4);
    this.row(500, 200, who.coat, who.coats, this.coat, 'coat');
    this.row(500, 290, who.hat, who.hats, this.hat, 'hat');
    this.row(500, 380, who.scarf, who.scarves, this.scarf, 'scarf');
    this.add.text(500, 460, 'Tone', { fontFamily: DISPLAY, fontSize: '20px', color: '#f3e6c8' }).setResolution(2);
    TONES.forEach((option, index) => {
      this.button(500 + index * 210, 490, 196, 48, option.label, `tone:${option.id}`, true, this.tone === option.id);
    });
    this.button(500, 580, 200, 56, 'Begin', 'begin');
    this.button(740, 580, 200, 56, 'Back', 'back');
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
    this.add.text(W / 2, 480, 'Rain and music are recorded loops. They duck while someone is talking.\nVibration is silent on devices that do not support it. Reduce effects turns off the shake.', {
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
    this.add.text(W / 2, 300, 'Rain by Ylmir, CC0. "Comfortable Mystery" by Kevin MacLeod, CC BY 4.0.\nFootsteps by swuing, via congusbongus, CC BY 3.0.\nEffects by rubberduck, CC0. Dog bark by Brandon Morris, CC0.\n\nCinzel and Cormorant Garamond, via Fontsource.\nRooms, ghosts, and the detectives are original art.\nNames Sara Lind and Skuggi are placeholders in one config file.', {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#f6edd6',
      align: 'center',
      wordWrap: { width: 760 },
    }).setOrigin(0.5).setResolution(2);
    this.button(W / 2 - 140, 560, 280, 56, 'Back', 'back');
  }

  private row(x: number, y: number, label: string, options: readonly { id: string; label: string }[], current: string, prefix: string): void {
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
    if (hit.id === 'new') this.mode = 'pick';
    else if (hit.id === 'continue' && hasContinue()) {
      hideCreatorField();
      this.scene.start('adventure');
      return;
    } else if (hit.id === 'settings') this.mode = 'settings';
    else if (hit.id === 'credits') this.mode = 'credits';
    else if (hit.id === 'back') this.mode = this.mode === 'create' ? 'pick' : 'title';
    else if (hit.id.startsWith('who:')) {
      this.detective = detectiveById(hit.id.slice(4)).id;
      this.coat = 'tan';
      this.hat = 'brown';
      this.scarf = 'plaid';
      const input = document.getElementById('creator-name') as HTMLInputElement | null;
      if (input) input.value = detectiveById(this.detective).defaultName;
      this.mode = 'create';
    }
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
      save.name = cleanName(input?.value || detectiveById(this.detective).defaultName);
      save.detective = this.detective;
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
