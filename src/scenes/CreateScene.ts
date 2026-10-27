import Phaser from 'phaser';
import { audio } from '../audio';
import { brassPlaque, parchment, portraitFrame, woodPanel } from '../chrome';
import { CSS, H, HEX, W } from '../config';
import { getCase } from '../data/cases';
import { notePointer, publish, type Rect } from '../debug';
import { hideNameplate, placeNameplate, setNameError, showNameplate } from '../nameplate';
import { bindCanvasPointer, type Point } from '../pointer';
import { beginCase, currentStep, getSave, persist, setDetectiveName } from '../state';
import type { CaseDef, CoatId, HatId, SaveData } from '../types';
import { write } from '../ui';

const PLATE: Rect = { x: 430, y: 268, w: 420, h: 150 };
const COATS: { id: CoatId; label: string; color: number }[] = [
  { id: 'charcoal', label: 'Charcoal wool', color: 0x2c3138 },
  { id: 'tweed', label: 'Rust tweed', color: 0x8a4b32 },
  { id: 'navy', label: 'Midnight navy', color: 0x1d2c4a },
];
const HATS: { id: HatId; label: string }[] = [
  { id: 'fedora', label: 'Felt fedora' },
  { id: 'newsboy', label: 'Newsboy cap' },
  { id: 'beret', label: 'Wool beret' },
];

interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onClick?: () => void;
}

export class CreateScene extends Phaser.Scene {
  private save!: SaveData;
  private def!: CaseDef;
  private world!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Graphics;
  private zones: Zone[] = [];
  private rects: Record<string, Rect> = {};
  private down: { id: string; x: number; y: number } | null = null;

  constructor() {
    super('create');
  }

  create(): void {
    this.save = getSave();
    this.def = getCase(this.save.caseId);
    this.world = this.add.container(0, 0);
    this.fx = this.add.graphics().setDepth(20);
    this.cameras.main.setBackgroundColor('#140e0a');
    bindCanvasPointer(this, {
      down: (p) => this.onDown(p),
      move: () => undefined,
      up: (p) => this.onUp(p),
    });
    const reposition = () => {
      if (currentStep(this.save, this.def).kind === 'name') placeNameplate(this.game.canvas, PLATE);
    };
    this.scale.on('resize', reposition);
    this.events.once('shutdown', () => {
      this.scale.off('resize', reposition);
      hideNameplate();
    });
    this.draw();
  }

  update(): void {
    const id = currentStep(this.save, this.def).kind === 'name' ? 'plate' : 'wardrobe';
    const rect = this.rects[id];
    this.fx.clear();
    if (!rect) return;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const rx = rect.w / 2;
    const ry = rect.h / 2;
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 220);
    for (let i = 3; i >= 1; i--) {
      const scale = 1 + i * 0.06;
      this.fx.fillStyle(0xffe7b0, 0.05 * (4 - i) * pulse);
      this.fx.fillEllipse(cx, cy, rx * 2 * scale, ry * 2 * scale);
    }
  }

  private ink(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    opts?: Parameters<typeof write>[6],
  ): Phaser.GameObjects.Text {
    const node = write(this, x, y, value, size, color, opts);
    this.world.add(node);
    return node;
  }

  private draw(): void {
    this.world.removeAll(true);
    this.zones = [];
    this.rects = {};
    const step = currentStep(this.save, this.def);
    if (this.textures.exists('office')) {
      this.world.add(this.add.image(W / 2, H / 2, 'office').setDisplaySize(W, H));
    }
    const g = this.add.graphics();
    this.world.add(g);
    g.fillStyle(0x0c0907, 0.28);
    g.fillRect(0, 0, W, H);
    this.ink(W / 2, 28, 'HOLLOWMERE DISPATCH', 28, CSS.brass, {
      font: 'display',
      originX: 0.5,
    });
    this.ink(W / 2, 64, this.def.mentor.line, 18, CSS.cream, {
      font: 'body',
      italic: true,
      originX: 0.5,
    });
    if (step.kind === 'name') this.drawName(g);
    else this.drawOutfit(g);
    this.drawTalk(step.edith);
    const regions: Record<string, Rect> = {};
    for (const zone of this.zones) regions[zone.id] = zone;
    Object.assign(regions, this.rects);
    publish({
      regions,
      beatReady: false,
      line: `step:${step.id}|mode:create|place:door|phase:none|name:${this.save.detective.name}`,
    });
  }

  private drawName(g: Phaser.GameObjects.Graphics): void {
    parchment(g, 360, 150, 560, 340);
    this.ink(W / 2, 174, 'The office door', 22, CSS.ink, { font: 'display', originX: 0.5 });
    this.ink(W / 2, 214, 'A brass plate is waiting for a name.', 18, '#5c4636', {
      originX: 0.5,
      italic: true,
    });
    g.fillStyle(0xfff8ea, 1);
    g.fillRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
    g.lineStyle(2, HEX.brassDeep, 1);
    g.strokeRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
    this.rects.plate = { x: 360, y: 150, w: 560, h: 340 };
    showNameplate(this.game.canvas, PLATE, (raw) => this.engrave(raw));
  }

  private drawOutfit(g: Phaser.GameObjects.Graphics): void {
    hideNameplate();
    parchment(g, 250, 120, 780, 400);
    this.ink(W / 2, 142, this.save.detective.name || 'Detective', 26, CSS.ink, {
      font: 'display',
      originX: 0.5,
    });
    this.ink(W / 2, 176, 'Choose what you will wear into the shop.', 18, '#5c4636', {
      originX: 0.5,
      italic: true,
    });
    this.row(
      g,
      'Coat',
      COATS.map((coat) => ({ id: `coat-${coat.id}`, label: coat.label, color: coat.color })),
      214,
      (id) => {
        this.save.detective.coat = id.replace('coat-', '') as CoatId;
        persist(this.save);
        audio.blip(500);
        this.draw();
      },
    );
    this.row(
      g,
      'Hat',
      HATS.map((hat) => ({ id: `hat-${hat.id}`, label: hat.label })),
      318,
      (id) => {
        this.save.detective.hat = id.replace('hat-', '') as HatId;
        persist(this.save);
        audio.blip(560);
        this.draw();
      },
    );
    this.ink(280, 430, 'Field kit, still locked', 16, '#6b5344', { bold: true });
    this.locked(g, 470, 418, 'Brass EMF casing');
    this.locked(g, 700, 418, 'Lantern flashlight');
    const ready = this.save.detective.coat !== '' && this.save.detective.hat !== '';
    brassPlaque(g, 490, 458, 300, 46, ready);
    this.ink(640, 481, 'Report for duty', 18, ready ? CSS.cream : CSS.dim, {
      font: 'display',
      originX: 0.5,
      originY: 0.5,
    });
    this.zone('duty', 490, 458, 300, 46, () => this.report());
    this.rects.wardrobe = { x: 250, y: 200, w: 780, h: 250 };
  }

  private locked(g: Phaser.GameObjects.Graphics, x: number, y: number, label: string): void {
    woodPanel(g, x, y, 210, 32, 0.9);
    this.ink(x + 12, y + 6, label, 14, CSS.dim);
    g.fillStyle(HEX.brass, 1);
    g.fillRect(x + 186, y + 10, 12, 10);
    g.fillStyle(0x1a120c, 1);
    g.fillRect(x + 189, y + 14, 6, 4);
  }

  private row(
    g: Phaser.GameObjects.Graphics,
    title: string,
    items: { id: string; label: string; color?: number }[],
    y: number,
    onPick: (id: string) => void,
  ): void {
    this.ink(280, y, title, 14, '#6b5344', { bold: true, font: 'display' });
    const w = 230;
    items.forEach((item, index) => {
      const x = 280 + index * (w + 12);
      const selected =
        (item.id.startsWith('coat-') && this.save.detective.coat === item.id.slice(5)) ||
        (item.id.startsWith('hat-') && this.save.detective.hat === item.id.slice(4));
      brassPlaque(g, x, y + 24, w, 52, selected);
      if (item.color !== undefined) {
        g.fillStyle(item.color, 1);
        g.fillRect(x + 10, y + 36, 22, 28);
        g.lineStyle(1, HEX.brass, 1);
        g.strokeRect(x + 10, y + 36, 22, 28);
      }
      this.ink(x + (item.color !== undefined ? 42 : w / 2), y + 50, item.label, 16, CSS.cream, {
        originX: item.color !== undefined ? 0 : 0.5,
        originY: 0.5,
      });
      this.zone(item.id, x, y + 24, w, 52, () => onPick(item.id));
    });
  }

  private drawTalk(line: string): void {
    const g = this.add.graphics();
    this.world.add(g);
    const y = H - 118;
    woodPanel(g, 16, y, W - 32, 102, 0.94);
    if (this.textures.exists('edith')) {
      const portrait = this.add.image(32, y + 12, 'edith').setOrigin(0, 0).setDisplaySize(78, 78);
      this.world.add(portrait);
      const frame = this.add.graphics();
      portraitFrame(frame, 32, y + 12, 78);
      this.world.add(frame);
    }
    this.ink(126, y + 16, 'EDITH CRANE', 13, CSS.brass, { font: 'display' });
    this.ink(126, y + 40, line, 22, CSS.cream, { w: 1000 });
  }

  private zone(id: string, x: number, y: number, w: number, h: number, onClick: () => void): void {
    this.zones.push({ id, x, y, w, h, onClick });
    this.rects[id] = { x, y, w, h };
  }

  private onDown(p: Point): void {
    audio.unlock();
    notePointer(p);
    const zone = [...this.zones].reverse().find((z) => p.x >= z.x && p.y >= z.y && p.x <= z.x + z.w && p.y <= z.y + z.h);
    this.down = zone ? { id: zone.id, x: p.x, y: p.y } : null;
  }

  private onUp(p: Point): void {
    const down = this.down;
    this.down = null;
    if (!down) return;
    if (Math.hypot(p.x - down.x, p.y - down.y) > 18) return;
    this.zones.find((z) => z.id === down.id)?.onClick?.();
  }

  private engrave(raw: string): void {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}][\p{L}'’\- ]{0,15}$/u.test(name)) {
      setNameError('Use a name of letters, up to 16 characters.');
      return;
    }
    setNameError('');
    setDetectiveName(this.save, name);
    audio.blip(640);
    this.draw();
  }

  private report(): void {
    if (this.save.detective.coat === '' || this.save.detective.hat === '') {
      this.float('Choose a coat and a hat.');
      return;
    }
    beginCase(this.save, this.def);
    audio.chime();
    this.scene.start('field');
  }

  private float(message: string): void {
    const text = this.ink(W / 2, 530, message, 18, '#f0b0aa', { originX: 0.5, bold: true });
    this.tweens.add({ targets: text, y: 500, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }
}
