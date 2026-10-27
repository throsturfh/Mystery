import Phaser from 'phaser';
import { audio } from '../audio';
import { brassPlaque, parchment, portraitFrame } from '../chrome';
import { CSS, H, HEX, W } from '../config';
import { getCase } from '../data/cases';
import { notePointer, publish, type Rect } from '../debug';
import { bindCanvasPointer, type Point } from '../pointer';
import { starLines } from '../stars';
import { fileReport, getSave, resetSave, toggleMute } from '../state';
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

export class ReportScene extends Phaser.Scene {
  private save!: SaveData;
  private def!: CaseDef;
  private world!: Phaser.GameObjects.Container;
  private zones: Zone[] = [];
  private down: Zone | null = null;

  constructor() {
    super('report');
  }

  create(): void {
    this.save = getSave();
    this.def = getCase(this.save.caseId);
    this.world = this.add.container(0, 0);
    this.cameras.main.setBackgroundColor('#140e0a');
    bindCanvasPointer(this, {
      down: (p) => this.onDown(p),
      move: () => undefined,
      up: (p) => this.onUp(p),
    });
    this.draw();
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
    g.fillStyle(0x0c0907, 0.55);
    g.fillRect(0, 0, W, H);
    parchment(g, 150, 16, 980, 688);
    this.ink(W / 2, 36, 'Filed copy', 13, '#6b5344', { originX: 0.5, font: 'display' });
    this.ink(W / 2, 58, this.def.title, 26, CSS.ink, { originX: 0.5, font: 'display' });
    this.ink(W / 2, 94, this.def.setting, 16, '#6b5344', { originX: 0.5, italic: true });

    const lines = starLines(this.save, this.def);
    lines.forEach((line, index) => {
      const y = 128 + index * 64;
      this.star(g, 196, y + 14, line.earned);
      this.ink(230, y, `Star ${line.star}`, 15, CSS.ink, { font: 'display' });
      this.ink(230, y + 22, line.text, 16, line.earned ? '#214e3c' : '#8e2e32', { w: 620 });
    });

    this.ink(190, 340, 'Carried to the next case', 15, '#6b5344', { font: 'display' });
    const rewards = [
      `EMF meter kept at level ${this.save.tools.emf.level}`,
      'Flashlight issued, first tap-value upgrade fitted',
      "Trophy: Ambrose's bookmark",
      'Cosmetic: brass bookworm lapel pin',
      `Evidence bonus +${this.save.bankedEvidenceBonus}`,
    ];
    rewards.forEach((line, index) => this.ink(190, 368 + index * 22, line, 16, CSS.ink, { w: 560 }));

    if (this.textures.exists('edith')) {
      const portrait = this.add.image(820, 348, 'edith').setOrigin(0, 0).setDisplaySize(92, 92);
      this.world.add(portrait);
      const frame = this.add.graphics();
      portraitFrame(frame, 820, 348, 92);
      this.world.add(frame);
    }
    g.fillStyle(HEX.paper, 1);
    g.fillRect(940, 360, 28, 40);
    g.fillStyle(0x8e2e32, 1);
    g.fillRect(940, 360, 6, 40);
    g.fillStyle(HEX.brass, 1);
    g.fillCircle(980, 430, 8);
    g.lineStyle(2, HEX.brassDeep, 1);
    g.strokeCircle(980, 430, 8);

    this.ink(190, 500, `Missed beats ${this.save.encounterMisses}`, 16, '#6b5344');
    this.ink(430, 500, this.save.fearStayedLow ? 'Fear stayed low' : 'Fear left the low band', 16, '#6b5344');
    this.ink(190, 526, `${this.save.resources.emf} EMF readings logged`, 16, '#6b5344');
    this.ink(190, 556, this.def.mentor.line, 16, CSS.ink, { italic: true, w: 700 });

    this.hit(g, 'report-next', 190, 612, 240, 40, 'File and return', true, () => {
      fileReport(this.save, this.def);
      audio.blip(520);
      this.scene.start('ending');
    });
    this.hit(g, 'sound', 448, 612, 140, 40, this.save.muted ? 'Muted' : 'Sound', false, () => {
      audio.setMuted(toggleMute(this.save));
      if (!this.save.muted) audio.blip();
      this.draw();
    });
    this.hit(g, 'reset', 604, 612, 200, 40, 'Reset progress', false, () => this.confirm());

    const regions: Record<string, Rect> = {};
    for (const zone of this.zones) regions[zone.id] = zone;
    const stars = lines.filter((line) => line.earned).map((line) => line.star).join('.');
    publish({
      regions,
      beatReady: false,
      line: `step:report|mode:report|place:office|phase:card|stars:${stars}|bonus:${this.save.bankedEvidenceBonus}|low:${this.save.fearStayedLow ? 1 : 0}|miss:${this.save.encounterMisses}|light:${this.save.tools.flashlight.tapLevel}|pinwear:${this.save.detective.pin ? 1 : 0}|trophy:${this.save.trophyBookmark ? 1 : 0}`,
    });
  }

  private star(g: Phaser.GameObjects.Graphics, x: number, y: number, earned: boolean): void {
    g.fillStyle(earned ? HEX.brass : 0xcbb892, earned ? 1 : 0.45);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? 12 : 5;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  private confirm(): void {
    this.draw();
    const g = this.add.graphics();
    this.world.add(g);
    g.fillStyle(0x0c0907, 0.45);
    g.fillRect(0, 0, W, H);
    parchment(g, 390, 250, 500, 200);
    this.ink(W / 2, 280, 'Wipe the case file?', 26, CSS.ink, { originX: 0.5, font: 'display' });
    this.hit(g, 'reset-yes', 430, 360, 160, 48, 'Wipe', true, () => {
      resetSave();
      window.location.reload();
    });
    this.hit(g, 'reset-no', 620, 360, 160, 48, 'Keep', false, () => this.draw());
    const regions: Record<string, Rect> = {};
    for (const zone of this.zones) regions[zone.id] = zone;
    publish({ regions, beatReady: false, line: 'step:report|mode:confirm|phase:card' });
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
    this.ink(x + w / 2, y + h / 2, label, 16, CSS.cream, { font: 'display', originX: 0.5, originY: 0.5 });
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
