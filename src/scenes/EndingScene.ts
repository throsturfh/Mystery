import Phaser from 'phaser';
import { audio } from '../audio';
import { brassPlaque, parchment, portraitFrame, woodPanel } from '../chrome';
import { CSS, H, HEX, W } from '../config';
import { getCase } from '../data/cases';
import { notePointer, publish, type Rect } from '../debug';
import { bindCanvasPointer, type Point } from '../pointer';
import { getSave, persist, resetSave, toggleMute } from '../state';
import type { CaseDef, SaveData } from '../types';
import { write } from '../ui';

interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
}

export class EndingScene extends Phaser.Scene {
  private save!: SaveData;
  private def!: CaseDef;
  private world!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Graphics;
  private zones: Zone[] = [];
  private down: Zone | null = null;
  private started = 0;
  private card = false;
  private fluttered = false;

  constructor() {
    super('ending');
  }

  create(): void {
    this.save = getSave();
    this.def = getCase(this.save.caseId);
    this.world = this.add.container(0, 0).setDepth(1);
    this.fx = this.add.graphics().setDepth(5);
    this.cameras.main.setBackgroundColor('#140e0a');
    this.card = this.save.seenEnvelope;
    this.started = performance.now();
    bindCanvasPointer(this, {
      down: (p) => this.onDown(p),
      move: () => undefined,
      up: (p) => this.onUp(p),
    });
    this.draw();
  }

  update(): void {
    const elapsed = this.save.seenEnvelope && this.card ? 4000 : performance.now() - this.started;
    if (!this.card && elapsed > 3200) {
      this.card = true;
      this.save.seenEnvelope = true;
      persist(this.save);
      this.draw();
    }
    if (!this.fluttered && elapsed > 1400 && elapsed < 1600) {
      this.fluttered = true;
      audio.flutter();
    }
    this.fx.clear();
    const slide = Math.max(0, Math.min(1, (elapsed - 700) / 900));
    const envY = 300 - slide * 150;
    this.fx.fillStyle(0xf3e6c8, 0.98);
    this.fx.fillRect(560, envY, 180, 110);
    this.fx.lineStyle(2, HEX.brassDeep, 1);
    this.fx.strokeRect(560, envY, 180, 110);
    this.fx.lineStyle(1, HEX.paperEdge, 1);
    this.fx.strokeRect(572, envY + 12, 156, 86);
    if (slide > 0.85) {
      const label = this.children.getByName('hook-label');
      if (!label) {
        write(this, 650, envY + 28, this.def.nextHook.label, 13, CSS.ink, {
          font: 'body',
          w: 148,
          align: 'center',
          originX: 0.5,
        })
          .setDepth(6)
          .setName('hook-label');
      } else if (label instanceof Phaser.GameObjects.Text) label.setY(envY + 36);
    }
    const flap = Math.sin(elapsed / 80);
    const mothT = Math.max(0, Math.min(1, (elapsed - 1300) / 1600));
    const mx = 650 + mothT * 160;
    const my = envY - 16 - Math.sin(mothT * Math.PI) * 80;
    if (elapsed > 1200) this.moth(mx, my, flap);
  }

  private moth(x: number, y: number, flap: number): void {
    this.fx.fillStyle(0xf7f1e4, 0.95);
    this.fx.fillEllipse(x - 10, y - flap * 6, 18, 12);
    this.fx.fillEllipse(x + 10, y + flap * 6, 18, 12);
    this.fx.fillStyle(0x1c140e, 1);
    this.fx.fillCircle(x, y, 2.4);
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
    if (this.textures.exists('office')) {
      this.world.add(this.add.image(W / 2, H / 2, 'office').setDisplaySize(W, H));
    }
    const g = this.add.graphics();
    this.world.add(g);
    g.fillStyle(0x0c0907, 0.28);
    g.fillRect(0, 0, W, H);
    this.ink(W / 2, 28, 'HOLLOWMERE DISPATCH', 22, CSS.brass, { originX: 0.5, font: 'display' });

    if (this.card) {
      parchment(g, 300, 300, 680, 250);
      this.ink(W / 2, 322, this.def.nextHook.title, 26, CSS.ink, { originX: 0.5, font: 'display' });
      this.ink(W / 2, 358, this.def.nextHook.label, 16, '#6b5344', { originX: 0.5, italic: true, font: 'display', w: 480 });
      const lines = [
        'Detective and case board',
        `EMF meter, level ${this.save.tools.emf.level}`,
        'Flashlight, brighter tap',
        "Ambrose's bookmark",
        `Evidence bonus +${this.save.bankedEvidenceBonus}`,
      ];
      lines.forEach((line, index) => this.ink(340, 396 + index * 22, line, 16, CSS.ink, { w: 440 }));
      this.hit(g, 'ending-reset', 800, 470, 140, 40, 'Reset', true, () => this.confirm());
      this.hit(g, 'sound', 800, 418, 140, 40, this.save.muted ? 'Off' : 'Sound', false, () => {
        audio.setMuted(toggleMute(this.save));
        this.draw();
      });
    }

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
    this.ink(126, y + 44, this.def.steps.find((step) => step.kind === 'ending')?.edith ?? '', 22, CSS.cream, { w: 1000 });

    const regions: Record<string, Rect> = {};
    for (const zone of this.zones) regions[zone.id] = zone;
    publish({
      regions,
      beatReady: false,
      line: `step:envelope|mode:ending|place:office|phase:${this.card ? 'card' : 'anim'}|bonus:${this.save.bankedEvidenceBonus}|name:${this.save.detective.name}`,
    });
  }

  private confirm(): void {
    const g = this.add.graphics().setDepth(8);
    parchment(g, 390, 250, 500, 200);
    const title = write(this, W / 2, 280, 'Wipe the case file?', 26, CSS.ink, {
      font: 'display',
      originX: 0.5,
    }).setDepth(9);
    this.hit(g, 'reset-yes', 430, 360, 160, 48, 'Wipe', true, () => {
      resetSave();
      window.location.reload();
    });
    this.hit(g, 'reset-no', 620, 360, 160, 48, 'Keep', false, () => {
      g.destroy();
      title.destroy();
      this.zones = this.zones.filter((zone) => zone.id !== 'reset-yes' && zone.id !== 'reset-no');
      this.draw();
    });
    const regions: Record<string, Rect> = {};
    for (const zone of this.zones) regions[zone.id] = zone;
    publish({ regions, beatReady: false, line: 'step:envelope|mode:confirm|phase:card' });
  }

  private hit(
    g: Phaser.GameObjects.Graphics,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    hot: boolean,
    onClick: () => void,
  ): void {
    brassPlaque(g, x, y, w, h, hot);
    const text = write(this, x + w / 2, y + h / 2, label, 15, CSS.cream, {
      font: 'display',
      originX: 0.5,
      originY: 0.5,
      w: w - 12,
      align: 'center',
    });
    if (g.parentContainer) g.parentContainer.add(text);
    else text.setDepth(9);
    this.zones.push({ id, x, y, w, h, onClick });
  }

  private onDown(p: Point): void {
    audio.unlock();
    notePointer(p);
    this.down = [...this.zones].reverse().find((zone) => p.x >= zone.x && p.y >= zone.y && p.x <= zone.x + zone.w && p.y <= zone.y + zone.h) ?? null;
  }

  private onUp(p: Point): void {
    const down = this.down;
    this.down = null;
    if (!down) return;
    if (p.x < down.x || p.y < down.y || p.x > down.x + down.w || p.y > down.y + down.h) return;
    down.onClick();
  }
}
