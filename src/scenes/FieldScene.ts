import Phaser from 'phaser';
import { audio } from '../audio';
import { brassPlaque, corkBoard, parchment, portraitFrame, woodPanel } from '../chrome';
import { BAR, CSS, H, HEX, SHOW_SPOTS, W } from '../config';
import { getCase } from '../data/cases';
import { notePointer, publish, type Rect } from '../debug';
import { hotspotBounds } from '../hotspot';
import { bindCanvasPointer, type Point } from '../pointer';
import { boardComplete, linkQuotaMet, threadReady } from '../stars';
import {
  addEvidence,
  advance,
  ambientCap,
  applyTime,
  closeCase,
  completeEncounter,
  currentStep,
  dismissAway,
  fearBand,
  formatAway,
  formatClock,
  getSave,
  giveEmf,
  grantEctoplasm,
  isRoomOpen,
  linkClues,
  markFound,
  noteClue,
  persist,
  pinClue,
  placeEmf,
  resetSave,
  stepIndex,
  takeTea,
  toggleMute,
  unlockEvidenceRoom,
  upgradeEmf,
} from '../state';
import type { CaseDef, ClueDef, HiddenObject, SaveData, TutorialStep } from '../types';
import { write } from '../ui';

type Mode = 'play' | 'board' | 'upgrade' | 'file' | 'away' | 'menu' | 'confirm';
type Phase = 'arrive' | 'rhythm' | 'offer' | 'settle' | 'read' | 'tip' | 'fade';
type BeatStage = 'charge' | 'open' | 'gap';

interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  priority: number;
  onClick?: () => void;
  drag?: boolean;
}

interface Enc {
  phase: Phase;
  until: number;
  dur: number;
  beat: number;
  beatStage: BeatStage;
  hit: boolean;
  misses: number;
}

interface Cold {
  room: string;
  x: number;
  y: number;
  remaining: number;
  tutorial: boolean;
}

interface Ambient {
  id: string;
  room: string;
  x: number;
  y: number;
  wait: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
}

export class FieldScene extends Phaser.Scene {
  private save!: SaveData;
  private def!: CaseDef;
  private world!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Graphics;
  private gfx!: Phaser.GameObjects.Graphics;
  private ghostSprite!: Phaser.GameObjects.Image;
  private tapLabel!: Phaser.GameObjects.Text;
  private dragLabel!: Phaser.GameObjects.Text;
  private baseZones: Zone[] = [];
  private zones: Zone[] = [];
  private rects: Record<string, Rect> = {};
  private pinCenters: Record<string, { x: number; y: number }> = {};
  private mode: Mode = 'play';
  private returnMode: Mode = 'play';
  private place = 'shop';
  private enc: Enc | null = null;
  private cold: Cold | null = null;
  private nextColdAt: number | null = null;
  private ambients: Ambient[] = [];
  private bits: Bit[] = [];
  private armed: string | null = null;
  private down: { id: string; x: number; y: number; drag: boolean } | null = null;
  private ghost: { id: string; x: number; y: number } | null = null;
  private missLamp = -1;
  private missUntil = 0;
  private acc = 0;
  private lastLine = '';
  private hintId: string | null = null;
  private hintUntil = 0;
  private hintReadyAt = 0;
  private hintShown = 0;
  private needle = 0;

  constructor() {
    super('field');
  }

  create(): void {
    this.save = getSave();
    this.def = getCase(this.save.caseId);
    this.ambients = [];
    this.cold = null;
    this.nextColdAt = null;
    this.enc = null;
    this.bits = [];
    this.mode = 'play';
    this.armed = null;
    this.ghost = null;
    this.world = this.add.container(0, 0).setDepth(10);
    this.fx = this.add.graphics().setDepth(30);
    this.ghostSprite = this.add.image(W / 2, 420, 'ambrose').setDepth(20).setVisible(false);
    this.ghostSprite.setBlendMode(Phaser.BlendModes.SCREEN);
    this.ghostSprite.setOrigin(0.5, 0.92);
    this.tapLabel = write(this, 0, 0, 'Tap', 18, CSS.ink, { bold: true, originX: 0.5, originY: 0.5 })
      .setDepth(40)
      .setVisible(false);
    this.dragLabel = write(this, 0, 0, '', 16, CSS.ink, { w: 180, align: 'center', originX: 0.5, originY: 0.5 })
      .setDepth(40)
      .setVisible(false);
    this.cameras.main.setBackgroundColor('#140e0a');
    bindCanvasPointer(this, {
      down: (p) => this.onDown(p),
      move: (p) => this.onMove(p),
      up: (p) => this.onUp(p),
    });
    this.events.once('shutdown', () => audio.humStop());
    this.restorePlace();
    if (this.save.awayNotice && currentStep(this.save, this.def).kind !== 'briefing') this.mode = 'away';
    this.draw();
  }

  update(_time: number, delta: number): void {
    this.acc += delta;
    if (this.acc >= 1000 || Date.now() - this.save.lastTick > 2000) {
      this.acc = 0;
      const before = `${this.save.resources.evidence}|${this.save.resources.ectoplasm}|${this.save.resources.emf}|${this.save.resources.fear}`;
      const exploring = this.mode === 'play' && !this.enc && this.place !== 'office' && this.step().kind !== 'recap';
      applyTime(this.save, Date.now(), { fear: exploring, economy: this.def.economy });
      const after = `${this.save.resources.evidence}|${this.save.resources.ectoplasm}|${this.save.resources.emf}|${this.save.resources.fear}`;
      if (this.save.awayNotice && this.mode === 'play' && !this.enc) {
        this.mode = 'away';
        this.draw();
      } else if (before !== after && this.mode === 'play' && !this.enc) {
        this.draw();
      }
    }
    const cool = this.hintReadyAt > performance.now() ? Math.ceil((this.hintReadyAt - performance.now()) / 1000) : 0;
    if (cool !== this.hintShown && this.mode === 'play' && !this.enc) {
      this.hintShown = cool;
      this.draw();
    }
    this.tickCold(delta);
    this.tickEncounter(performance.now());
    this.tickAmbients();
    const dt = delta / 1000;
    for (const bit of this.bits) {
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.life -= dt;
    }
    this.bits = this.bits.filter((bit) => bit.life > 0);
    this.needle += delta * (this.meterHot() ? 0.012 : 0.003);
    this.rebuildZones();
    this.drawFx();
    this.emitDebug(false);
  }

  private step(): TutorialStep {
    return currentStep(this.save, this.def);
  }

  private roomOpen(id: string): boolean {
    return SHOW_SPOTS || id === 'office' || id === 'shop' || isRoomOpen(this.save, this.def, id);
  }

  private restorePlace(): void {
    const step = this.step();
    if (step.kind === 'briefing') {
      this.place = 'office';
      return;
    }
    if (step.kind === 'cold-spot') {
      this.place = 'nook';
      return;
    }
    if (step.kind === 'encounter' && !this.save.encounterDone) {
      this.place = 'stock';
      return;
    }
    if (SHOW_SPOTS || isRoomOpen(this.save, this.def, this.save.place) || this.save.place === 'office' || this.save.place === 'shop') {
      this.place = this.save.place || 'shop';
    } else this.place = 'shop';
  }

  private painter(): string {
    return this.def.rooms.find((room) => room.id === this.place)?.painter ?? 'shop';
  }

  private listed(): HiddenObject[] {
    const all = this.def.objects.filter((obj) => obj.roomId === this.place);
    if (this.step().kind === 'briefing' && this.place === 'office') return all.filter((obj) => obj.id === 'folder');
    return all;
  }

  private objPoint(obj: HiddenObject): { x: number; y: number } {
    if (obj.spot.kind === 'ellipse') return { x: obj.spot.cx * W, y: obj.spot.cy * H };
    const [x, y] = obj.spot.points[0];
    return { x: x * W, y: y * H };
  }

  private draw(): void {
    this.world.removeAll(true);
    this.baseZones = [];
    this.pinCenters = {};
    this.rects = {};
    if (this.textures.exists(this.painter())) {
      this.world.add(this.add.image(W / 2, H / 2, this.painter()).setDisplaySize(W, H));
    }
    const g = this.add.graphics();
    this.world.add(g);
    this.gfx = g;
    this.drawScene(g);
    if (this.isModal()) {
      g.fillStyle(0x070504, 0.84);
      g.fillRect(0, 0, W, H);
    } else {
      this.drawChrome(g);
      if (this.enc?.phase === 'offer') this.drawOfferCard();
    }
    if (this.mode === 'file') this.drawFile();
    if (this.mode === 'upgrade') this.drawUpgrade();
    if (this.step().kind === 'recap' && (this.mode === 'play' || this.mode === 'menu' || this.mode === 'confirm')) {
      this.drawRecap();
    }
    if (this.mode === 'board') this.drawBoard();
    if (this.mode === 'away') this.drawAway();
    if (this.mode === 'menu') this.drawMenu();
    if (this.mode === 'confirm') this.drawConfirm();
    this.rebuildZones();
    this.emitDebug(true);
  }

  private text(
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

  private zone(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    priority: number,
    onClick?: () => void,
    drag = false,
  ): void {
    this.baseZones.push({ id, x, y, w, h, priority, onClick, drag });
    this.rects[id] = { x, y, w, h };
  }

  private button(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    hot: boolean,
    onClick: () => void,
    priority = 22,
  ): void {
    brassPlaque(this.gfx, x, y, w, h, hot);
    this.text(x + w / 2, y + h / 2, label, 14, CSS.cream, {
      font: 'display',
      originX: 0.5,
      originY: 0.5,
      w: w - 12,
      align: 'center',
    });
    this.zone(id, x, y, w, h, priority, onClick);
  }

  private isModal(): boolean {
    return this.mode !== 'play' || this.step().kind === 'recap';
  }

  private drawScene(g: Phaser.GameObjects.Graphics): void {
    this.zone('scene', 0, 0, W, BAR.y, 1, () => this.onMiss());
    const showChair = !(this.step().kind === 'cold-spot' && this.place === 'nook');
    for (const obj of this.listed()) {
      if (this.save.objectsFound.includes(obj.id)) continue;
      if (obj.cold && !showChair) continue;
      const bounds = hotspotBounds(obj.spot, W, H);
      this.zone(`obj-${obj.id}`, bounds.x, bounds.y, bounds.w, bounds.h, 3, () => this.collect(obj));
    }
    if (this.mode === 'play' && !this.enc) {
      const room = this.def.rooms.find((item) => item.id === this.place);
      if (room && this.save.tutorialIndex >= stepIndex(this.def, 'evidence')) {
        this.ensureAmbients(room.id);
        const cap = ambientCap(this.save.resources.fear, this.def.economy);
        const spots = this.ambients.filter((spot) => spot.room === room.id).slice(0, cap);
        for (const spot of spots) {
          if (spot.wait > performance.now()) continue;
          const x = spot.x * W;
          const y = spot.y * H;
          g.fillStyle(HEX.ambient, 0.18);
          g.fillCircle(x, y, 22);
          g.lineStyle(2, HEX.cold, 0.85);
          g.strokeCircle(x, y, 18);
          this.zone(spot.id, x - 24, y - 24, 48, 48, 2, () => this.onAmbient(spot.id));
        }
      }
      if (this.save.tools.emf.placedRoom === this.place) this.drawPlacedMeter(g);
    }
    if (SHOW_SPOTS) {
      for (const obj of this.def.objects.filter((item) => item.roomId === this.place)) {
        const pt = this.objPoint(obj);
        this.text(pt.x, pt.y, obj.name, 14, '#ffe38a', { originX: 0.5, originY: 1.2, bold: true });
      }
    }
  }

  private drawPlacedMeter(g: Phaser.GameObjects.Graphics): void {
    const x = 36;
    const y = BAR.y - 78;
    woodPanel(g, x, y, 92, 58, 0.92);
    g.lineStyle(2, HEX.brass, 1);
    g.beginPath();
    g.arc(x + 28, y + 36, 16, Math.PI, 0, false);
    g.strokePath();
    const ang = Math.PI + (0.4 + 0.5 * Math.sin(this.needle)) * Math.PI;
    g.lineStyle(2, 0xf0d59a, 1);
    g.lineBetween(x + 28, y + 36, x + 28 + Math.cos(ang) * 14, y + 36 + Math.sin(ang) * 14);
    this.text(x + 50, y + 16, 'Live', 14, CSS.good, { bold: true });
    this.text(x + 50, y + 34, `Lv ${this.save.tools.emf.level}`, 13, CSS.brass);
  }

  private drawChrome(g: Phaser.GameObjects.Graphics): void {
    this.drawResources(g);
    this.drawTools(g);
    woodPanel(g, BAR.x, BAR.y, BAR.w, BAR.h, 0.97);
    this.zone('bar', BAR.x, BAR.y, BAR.w, BAR.h, 5);
    const showCase = this.save.tutorialIndex >= stepIndex(this.def, 'pin') && !this.enc;
    const talkY = BAR.y + 6;
    const talkH = 46;
    const rowY = talkY + talkH + 6;
    const rowBottom = BAR.y + BAR.h - 8;
    const sideW = 104;
    const sideH = rowBottom - rowY;
    this.drawTalk(g, 14, talkY, W - 28, talkH);
    brassPlaque(g, 12, rowY, sideW, sideH, false);
    const cool = this.hintReadyAt - performance.now();
    this.text(12 + sideW / 2, rowY + 22, 'Hint', 16, CSS.cream, { font: 'display', originX: 0.5 });
    this.text(12 + sideW / 2, rowY + 44, cool > 0 ? `${Math.ceil(cool / 1000)}s` : 'Ready', 13, CSS.brass, {
      originX: 0.5,
    });
    if (!this.enc) this.zone('hint', 12, rowY, sideW, sideH, 8, () => this.onHint());
    const menuX = W - 12 - sideW;
    brassPlaque(g, menuX, rowY, sideW, sideH, false);
    this.text(menuX + sideW / 2, rowY + sideH / 2, 'Menu', 16, CSS.cream, {
      font: 'display',
      originX: 0.5,
      originY: 0.5,
    });
    if (!this.enc) this.zone('menu', menuX, rowY, sideW, sideH, 8, () => this.openMenu());
    let right = menuX - 8;
    if (showCase) {
      const caseX = right - sideW;
      brassPlaque(g, caseX, rowY, sideW, sideH, true);
      const left = this.save.cluesFound.filter((id) => !this.save.cluesPinned.includes(id)).length;
      this.text(caseX + sideW / 2, rowY + 18, 'Case', 16, CSS.cream, { font: 'display', originX: 0.5 });
      this.text(caseX + sideW / 2, rowY + 40, left > 0 ? `${left} new` : 'Board', 13, CSS.brass, { originX: 0.5 });
      this.zone('case', caseX, rowY, sideW, sideH, 8, () => this.openBoard());
      right = caseX - 8;
    }
    const left = 12 + sideW + 8;
    this.drawTabs(g, left, right, rowY);
    this.drawItems(g, left, right, rowY + 30);
  }

  private drawResources(g: Phaser.GameObjects.Graphics): void {
    woodPanel(g, 820, 12, 444, 100, 0.92);
    const bits: [string, string][] = [
      ['Evidence', String(this.save.resources.evidence)],
      ['Ectoplasm', String(this.save.resources.ectoplasm)],
      ['EMF', String(this.save.resources.emf)],
    ];
    bits.forEach((bit, index) => {
      const x = 836 + index * 108;
      this.text(x, 18, bit[0], 12, CSS.brass, { font: 'display' });
      this.text(x, 34, bit[1], 20, CSS.cream, { font: 'display' });
    });
    this.text(1248, 20, formatClock(this.save.storyMinutes), 15, CSS.cream, { originX: 1 });
    const band = fearBand(this.save.resources.fear, this.def.economy);
    const fearColor = band === 'high' ? HEX.fearHigh : band === 'mid' ? HEX.fearMid : HEX.fearLow;
    const label = band === 'high' ? 'Jumpy' : band === 'mid' ? 'Uneasy' : 'Low';
    this.text(836, 62, 'Fear', 12, CSS.brass, { font: 'display' });
    this.text(1136, 62, label, 12, CSS.brass, { font: 'display', originX: 1 });
    g.fillStyle(0x0c0907, 1);
    g.fillRect(836, 80, 300, 14);
    g.fillStyle(fearColor, 0.95);
    g.fillRect(836, 80, Math.max(8, (300 * this.save.resources.fear) / 100), 14);
    g.lineStyle(1, HEX.brass, 0.9);
    g.strokeRect(836, 80, 300, 14);
    this.rects.fear = { x: 820, y: 58, w: 330, h: 40 };
  }

  private drawTools(g: Phaser.GameObjects.Graphics): void {
    if (this.enc) return;
    const tools: { id: string; title: string; sub: string; run: () => void; hot: boolean }[] = [
      {
        id: 'tool-emf',
        title: 'EMF',
        sub: this.emfSub(),
        run: () => this.onToolEmf(),
        hot:
          this.step().kind === 'receive-tool' ||
          this.step().kind === 'upgrade-tool' ||
          (this.step().kind === 'place-tea' && !this.save.tools.emf.placedRoom),
      },
      {
        id: 'tool-tea',
        title: 'Tea',
        sub: this.save.teaTaken ? 'Empty' : '1 hour',
        run: () => this.onTea(),
        hot: this.step().kind === 'place-tea' && !!this.save.tools.emf.placedRoom,
      },
      {
        id: 'tool-light',
        title: 'Lamp',
        sub: this.save.tools.flashlight.owned ? 'Tuned' : 'Locked',
        run: () => this.onLight(),
        hot: false,
      },
    ];
    tools.forEach((tool, index) => {
      const y = 122 + index * 58;
      brassPlaque(g, 1206, y, 62, 52, tool.hot);
      this.text(1237, y + 8, tool.title, 12, CSS.cream, { font: 'display', originX: 0.5 });
      this.text(1237, y + 28, tool.sub, 11, CSS.brass, { originX: 0.5, w: 56, align: 'center' });
      this.zone(tool.id, 1206, y, 62, 52, 8, tool.run);
    });
  }

  private emfSub(): string {
    const tool = this.save.tools.emf;
    if (!tool.owned) return this.step().kind === 'receive-tool' ? 'Take' : 'Soon';
    if (this.step().kind === 'place-tea' && !tool.placedRoom) return 'Place';
    return `Lv ${tool.level}`;
  }

  private drawTabs(g: Phaser.GameObjects.Graphics, left: number, right: number, y: number): void {
    const rooms = this.def.rooms;
    const gap = 6;
    const tw = (right - left - gap * (rooms.length - 1)) / rooms.length;
    const th = 26;
    rooms.forEach((room, index) => {
      const x = left + index * (tw + gap);
      const open = this.roomOpen(room.id);
      const here = this.place === room.id;
      brassPlaque(g, x, y, tw, th, here);
      if (open) {
        this.text(x + tw / 2, y + th / 2, room.short, 14, CSS.cream, {
          font: 'display',
          originX: 0.5,
          originY: 0.5,
        });
      } else {
        const sub = room.unlock === 'evidence' ? `${room.cost ?? 15} Evidence` : 'Link clues';
        this.text(x + tw / 2, y + 1, room.short, 11, CSS.dim, { font: 'display', originX: 0.5 });
        this.text(x + tw / 2, y + 13, sub, 10, CSS.brass, { originX: 0.5 });
      }
      if (!this.enc) this.zone(`tab-${room.id}`, x, y, tw, th, 8, () => this.onTab(room.id));
    });
  }

  private drawItems(g: Phaser.GameObjects.Graphics, left: number, right: number, top: number): void {
    const items = this.listed();
    const height = BAR.y + BAR.h - 8 - top;
    this.rects.items = { x: left, y: top, w: right - left, h: height };
    if (items.length === 0) {
      this.text(left + 8, top + 16, 'Nothing left to list in this room.', 18, CSS.dim, { italic: true });
      return;
    }
    const cols = Math.min(6, items.length);
    const rows = Math.ceil(items.length / cols);
    const gap = 4;
    const cw = (right - left - gap * (cols - 1)) / cols;
    const ch = (height - gap * (rows - 1)) / rows;
    items.forEach((obj, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = left + col * (cw + gap);
      const y = top + row * (ch + gap);
      const found = this.save.objectsFound.includes(obj.id);
      parchment(g, x, y, cw, ch);
      const size = ch < 24 || obj.name.length > 14 ? 12 : 14;
      this.text(x + cw / 2, y + ch / 2, obj.name, size, found ? '#7a6552' : CSS.ink, {
        originX: 0.5,
        originY: 0.5,
        w: cw - 8,
        align: 'center',
      });
      if (found) {
        g.lineStyle(2, 0x7a2e2a, 0.85);
        g.lineBetween(x + 8, y + ch / 2, x + cw - 8, y + ch / 2);
      }
    });
  }

  private drawTalk(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    const step = this.step();
    const action = this.talkAction();
    parchment(g, x, y, w, h, 0.9);
    const portrait = h - 6;
    this.paintPortrait(x + 3, y + 3, portrait);
    const textX = x + portrait + 12;
    const buttonW = action ? 176 : 0;
    const textW = w - (textX - x) - buttonW - 12;
    const hint = this.hintLine();
    this.text(textX, y + 2, 'EDITH CRANE', 10, '#6b5344', { font: 'display' });
    this.text(textX, y + (hint ? 14 : 18), step.edith, 14, CSS.ink, { w: textW });
    if (hint) this.text(textX, y + 30, hint, 12, '#6b5344', { w: textW, italic: true });
    if (action) this.button(action.id, x + w - buttonW - 8, y + 8, buttonW, h - 16, action.label, true, action.run, 8);
  }

  private paintPortrait(x: number, y: number, size: number): void {
    if (!this.textures.exists('edith')) return;
    const portrait = this.add.image(x, y, 'edith').setOrigin(0, 0).setDisplaySize(size, size);
    this.world.add(portrait);
    const frame = this.add.graphics();
    portraitFrame(frame, x, y, size);
    this.world.add(frame);
  }

  private talkAction(): { id: string; label: string; run: () => void } | null {
    if (this.mode !== 'play' || this.enc) return null;
    if (this.step().kind === 'explain') return { id: 'continue', label: 'I understand', run: () => this.onContinue() };
    if (this.step().kind === 'stamp') return { id: 'stamp', label: 'Stamp the case', run: () => this.onStamp() };
    return null;
  }

  private hintLine(): string {
    const step = this.step();
    const save = this.save;
    if (step.kind === 'collect') {
      const missing = step.clueIds.filter((id) => !save.cluesFound.includes(id)).map((id) => this.shortClue(id));
      const base = `Evidence ${save.resources.evidence} / ${step.need}.`;
      return missing.length ? `${base} Still odd: ${missing.join(' & ')}.` : `${base} Keep going down the list.`;
    }
    if (step.kind === 'unlock-room') return `${save.resources.evidence} Evidence on hand.`;
    if (step.kind === 'receive-tool') return 'It waits on the right.';
    if (step.kind === 'cold-spot') return this.place === 'nook' ? 'Tap the shrinking ring.' : 'The cold is in the reading nook.';
    if (step.kind === 'upgrade-tool') return `${save.resources.ectoplasm} Ectoplasm. Tune costs ${this.def.economy.upgradeCost}.`;
    if (step.kind === 'place-tea') {
      return save.tools.emf.placedRoom ? 'Tap the thermos to skip an hour.' : 'Tap EMF to set the meter down.';
    }
    if (step.kind === 'recap') return 'Idle readings keep coming, even with the app closed.';
    if (step.kind === 'explain') return 'Stay in the low band for the third star.';
    if (step.kind === 'pin') return 'Open Case, then drag a note up onto the board.';
    if (step.kind === 'link') return 'Pin two notes, then tie them with red string.';
    if (step.kind === 'encounter') {
      if (!this.enc) return this.place === 'stock' ? 'The old desk drawer is the odd thing.' : 'The stockroom is open.';
      if (this.enc.phase === 'rhythm') return 'Tap the bright lamp before it fades.';
      if (this.enc.phase === 'offer') return 'Drag the missing pages to Ambrose.';
      if (this.enc.phase === 'fade') return 'The doorbell rings once, softly.';
      return 'He is looking for the end of the story.';
    }
    if (step.kind === 'stamp') {
      if (this.def.clues.some((clue) => !save.cluesFound.includes(clue.id))) return 'Something in the rooms is still untouched.';
      if (!boardComplete(save, this.def)) return 'The board can still take another string.';
      return 'The file is ready for your stamp.';
    }
    return '';
  }

  private shortClue(id: string): string {
    if (id === 'shelves') return 'the shelves';
    if (id === 'doorbell') return 'the doorbell';
    if (id === 'armchair') return 'the armchair';
    if (id === 'novel') return 'the torn novel';
    return 'the desk';
  }

  private drawOfferCard(): void {
    parchment(this.gfx, 36, 420, 260, 96);
    this.text(52, 438, 'The missing pages', 20, CSS.ink, { font: 'display', w: 230 });
    this.text(52, 472, 'Drag them to him', 16, '#6b5344', { italic: true });
  }

  private drawFile(): void {
    this.zone('blocker', 0, 0, W, H, 20);
    parchment(this.gfx, 280, 150, 720, 390);
    this.text(320, 174, this.def.title, 28, CSS.ink, { font: 'display', w: 640 });
    this.text(320, 216, this.def.setting, 18, '#6b5344', { italic: true, font: 'body' });
    this.def.briefing.forEach((line, index) => {
      this.text(320, 260 + index * 64, line, 18, CSS.ink, { w: 640 });
    });
    this.button('enter-shop', 470, 470, 280, 46, 'Enter the shop', true, () => this.enterShop());
  }

  private drawUpgrade(): void {
    this.zone('blocker', 0, 0, W, H, 20);
    parchment(this.gfx, 340, 160, 600, 300);
    const level = this.save.tools.emf.level;
    this.text(372, 184, 'EMF meter', 28, CSS.ink, { font: 'display' });
    this.text(372, 226, `Level ${level || 1}`, 20, '#6b5344', { font: 'display' });
    this.text(
      372,
      266,
      level >= 2
        ? 'Tuned. Cold spots arrive faster, and a placed meter logs 12 EMF readings an hour.'
        : 'Level 2 finds cold spots faster and raises idle readings from 5 to 12 an hour.',
      20,
      CSS.ink,
      { w: 540 },
    );
    if (level < 2) {
      this.button('tune', 372, 390, 320, 46, `Tune for ${this.def.economy.upgradeCost} Ectoplasm`, true, () => this.onTune());
    }
    this.button('close-upgrade', 820, 390, 90, 46, 'Close', false, () => {
      this.mode = 'play';
      this.draw();
    });
  }

  private drawRecap(): void {
    this.zone('blocker', 0, 0, W, H, 20);
    parchment(this.gfx, 340, 170, 600, 280);
    this.text(372, 196, 'One hour on the clock', 26, CSS.ink, { font: 'display' });
    const now = formatClock(this.save.storyMinutes);
    const then = formatClock(this.save.storyMinutes - 60);
    this.text(372, 242, `${then}  →  ${now}`, 22, '#6b5344');
    this.text(372, 284, `+${this.save.lastTeaGain} EMF readings`, 28, '#214e3c', { font: 'display' });
    this.text(372, 330, 'The meter kept its own watch.', 20, CSS.ink);
    this.button('recap-ok', 372, 380, 240, 46, 'Back to the shop', true, () => this.onRecap());
  }

  private drawAway(): void {
    const notice = this.save.awayNotice;
    this.zone('blocker', 0, 0, W, H, 20);
    parchment(this.gfx, 340, 180, 600, 270);
    this.text(372, 206, 'While you were away', 26, CSS.ink, { font: 'display' });
    const hours = notice ? formatAway(notice.hours) : '';
    this.text(372, 252, notice?.capped ? `${hours}, the cap` : hours, 20, '#6b5344');
    this.text(372, 292, `+${notice?.emf ?? 0} EMF readings`, 28, '#214e3c', { font: 'display' });
    this.text(372, 340, 'Rest is counted up to 8 hours.', 20, CSS.ink);
    this.button('away-ok', 372, 384, 200, 46, 'Continue', true, () => {
      dismissAway(this.save);
      this.mode = 'play';
      this.draw();
    });
  }

  private drawMenu(): void {
    this.zone('blocker', 0, 0, W, H, 20, () => this.closeMenu());
    parchment(this.gfx, 360, 140, 560, 400);
    this.text(392, 164, 'Field notes', 28, CSS.ink, { font: 'display' });
    this.text(
      392,
      214,
      'Evidence comes from the objects on the list, and from the pale anomalies that gather as fear rises. Ectoplasm tunes the meter. EMF readings gather while a meter is placed, including while the app is closed.',
      20,
      CSS.ink,
      { w: 500 },
    );
    this.button('sound', 392, 390, 200, 46, this.save.muted ? 'Sound off' : 'Sound on', false, () => this.onSound());
    this.button('reset', 610, 390, 200, 46, 'Reset progress', true, () => this.openConfirm());
    this.button('close-menu', 392, 456, 200, 46, 'Close', false, () => this.closeMenu());
  }

  private drawConfirm(): void {
    this.zone('blocker', 0, 0, W, H, 20);
    parchment(this.gfx, 390, 230, 500, 220);
    this.text(420, 258, 'Wipe the case file?', 26, CSS.ink, { font: 'display' });
    this.text(420, 304, 'The door plate comes off with it.', 18, '#6b5344', { italic: true });
    this.button('reset-yes', 420, 360, 160, 48, 'Wipe', true, () => {
      resetSave();
      window.location.reload();
    });
    this.button('reset-no', 600, 360, 160, 48, 'Keep', false, () => {
      this.mode = this.returnMode === 'confirm' ? 'play' : this.returnMode;
      this.draw();
    });
  }

  private drawBoard(): void {
    this.zone('blocker', 0, 0, W, H, 20);
    woodPanel(this.gfx, 16, 12, W - 32, H - 24, 1);
    this.text(36, 22, 'Case board', 20, CSS.brass, { font: 'display' });
    this.button('close-board', W - 188, 18, 148, 34, 'Close', false, () => {
      this.mode = 'play';
      this.armed = null;
      this.draw();
    });
    parchment(this.gfx, 32, 58, W - 64, 52, 0.98);
    this.paintPortrait(40, 64, 40);
    this.text(92, 66, 'EDITH CRANE', 11, '#6b5344', { font: 'display' });
    this.text(92, 82, this.step().edith, 16, CSS.ink, { w: W - 180 });

    const unpinned = this.def.clues.filter(
      (clue) => this.save.cluesFound.includes(clue.id) && !this.save.cluesPinned.includes(clue.id),
    );
    const trayH = unpinned.length > 0 ? 108 : 32;
    const trayY = H - 28 - trayH;
    const surface = { x: 32, y: 122, w: W - 64, h: trayY - 132 };
    corkBoard(this.gfx, surface.x, surface.y, surface.w, surface.h);
    this.zone('board-surface', surface.x, surface.y, surface.w, surface.h, 22, () => {
      if (this.armed?.startsWith('tray-')) this.pin(this.armed.slice(5));
    });
    if (threadReady(this.save, this.def)) {
      const labelW = 420;
      parchment(this.gfx, surface.x + (surface.w - labelW) / 2, surface.y + 10, labelW, 28);
      this.text(surface.x + surface.w / 2, surface.y + 14, this.def.thread.title, 15, CSS.ink, {
        originX: 0.5,
        font: 'display',
      });
    }
    const slots = this.slots(surface);
    const tilts = [-6.5, 5.4, 4.2, -5.8, 3.2];
    const pins = new Map<string, { x: number; y: number }>();
    this.save.cluesPinned.forEach((id, index) => {
      const slot = slots[index];
      if (!slot) return;
      const pin = this.pinPoint(slot, tilts[index] ?? 0);
      pins.set(id, pin);
      this.pinCenters[id] = pin;
    });
    this.save.cluesPinned.forEach((id, index) => {
      const slot = slots[index];
      const clue = this.def.clues.find((item) => item.id === id);
      if (!slot || !clue) return;
      this.note(slot, clue, true, tilts[index] ?? 0);
    });
    if (unpinned.length === 0) {
      this.text(surface.x, trayY + 4, 'Every found clue is on the board.', 16, CSS.cream, { italic: true });
    } else {
      const gap = 10;
      const cw = Math.min(280, (surface.w - gap * (unpinned.length - 1)) / unpinned.length);
      const total = unpinned.length * cw + (unpinned.length - 1) * gap;
      const x0 = surface.x + (surface.w - total) / 2;
      unpinned.forEach((clue, index) => {
        this.note({ x: x0 + index * (cw + gap), y: trayY, w: cw, h: trayH - 6 }, clue, false, 0);
      });
    }
    const yarn = this.add.graphics();
    this.world.add(yarn);
    for (const [a, b] of this.save.links) {
      const pa = pins.get(a);
      const pb = pins.get(b);
      if (!pa || !pb) continue;
      this.yarn(yarn, pa.x, pa.y, pb.x, pb.y);
    }
    yarn.fillStyle(0x6a1818, 1);
    for (const pin of pins.values()) {
      yarn.fillCircle(pin.x + 1, pin.y + 2, 12);
      yarn.fillStyle(0xc43131, 1);
      yarn.fillCircle(pin.x, pin.y, 11);
      yarn.fillStyle(0xf0c2b8, 0.9);
      yarn.fillCircle(pin.x - 3, pin.y - 3, 3.4);
      yarn.fillStyle(0x6a1818, 1);
    }
  }

  private slots(surface: Rect): Rect[] {
    const top = surface.y + (threadReady(this.save, this.def) ? 64 : 28);
    const cw = Math.min(420, (surface.w - 64) / 2);
    const ch = 128;
    const left = surface.x + 20;
    const right = surface.x + surface.w - cw - 20;
    const row2 = top + ch + 28;
    const row3 = row2 + ch + 32;
    return [
      { x: left, y: top, w: cw, h: ch },
      { x: right, y: top + 6, w: cw, h: ch },
      { x: left + 12, y: row2, w: cw, h: ch },
      { x: right - 10, y: row2 + 8, w: cw, h: ch },
      { x: surface.x + (surface.w - cw) / 2, y: row3, w: cw, h: ch },
    ];
  }

  private pinPoint(rect: Rect, tilt: number): { x: number; y: number } {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const localY = -rect.h / 2 + 10;
    const rad = (tilt * Math.PI) / 180;
    return { x: cx - localY * Math.sin(rad), y: cy + localY * Math.cos(rad) };
  }

  private note(rect: Rect, clue: ClueDef, pinned: boolean, tilt: number): { x: number; y: number } {
    const id = pinned ? `pin-${clue.id}` : `tray-${clue.id}`;
    const armed = this.armed === id;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const holder = this.add.container(cx, cy).setAngle(tilt);
    this.world.add(holder);
    const paper = this.add.graphics();
    holder.add(paper);
    paper.fillStyle(0x2a160e, 0.4);
    paper.fillRect(-rect.w / 2 + 7, -rect.h / 2 + 8, rect.w, rect.h);
    parchment(paper, -rect.w / 2, -rect.h / 2, rect.w, rect.h);
    if (armed) {
      paper.lineStyle(2, HEX.brass, 1);
      paper.strokeRect(-rect.w / 2 - 3, -rect.h / 2 - 3, rect.w + 6, rect.h + 6);
    }
    const label = write(this, -rect.w / 2 + 16, -rect.h / 2 + 26, clue.title, 15, CSS.ink, {
      w: rect.w - 32,
      font: 'body',
    });
    holder.add(label);
    this.zone(id, rect.x, rect.y, rect.w, rect.h, 24, () => (pinned ? this.onPin(clue.id) : this.onTray(clue.id)), true);
    const pin = this.pinPoint(rect, tilt);
    const localY = -rect.h / 2 + 10;
    paper.fillStyle(0x3a1010, 1);
    paper.fillCircle(1, localY + 2, 11);
    paper.fillStyle(pinned ? 0xc43131 : 0xc6a15a, 1);
    paper.fillCircle(0, localY, 10);
    paper.fillStyle(0xf6e7c8, 0.95);
    paper.fillCircle(-3, localY - 3, 3.2);
    return pin;
  }

  private yarn(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const sag = 36 + Math.min(48, Math.hypot(x2 - x1, y2 - y1) * 0.05);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 + sag;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const u = 1 - t;
      pts.push({
        x: u * u * x1 + 2 * u * t * mx + t * t * x2,
        y: u * u * y1 + 2 * u * t * my + t * t * y2,
      });
    }
    const stroke = (color: number, width: number, ox: number, oy: number) => {
      g.lineStyle(width, color, 1);
      g.beginPath();
      g.moveTo(pts[0].x + ox, pts[0].y + oy);
      for (const point of pts.slice(1)) g.lineTo(point.x + ox, point.y + oy);
      g.strokePath();
    };
    stroke(0x4a1014, 16, 3, 4);
    stroke(0xd62828, 11, 0, 0);
    stroke(0xf4b4b0, 4, -2, -2);
  }

  private openBoard(): void {
    if (this.enc) return;
    this.mode = 'board';
    this.draw();
  }

  private openMenu(): void {
    this.returnMode = this.mode === 'menu' || this.mode === 'confirm' ? this.returnMode : this.mode;
    this.mode = 'menu';
    this.draw();
  }

  private closeMenu(): void {
    this.mode = this.returnMode === 'menu' || this.returnMode === 'confirm' ? 'play' : this.returnMode;
    this.draw();
  }

  private openConfirm(): void {
    this.returnMode = 'menu';
    this.mode = 'confirm';
    this.draw();
  }

  private openFile(): void {
    audio.blip(500, 0.08, 'triangle', 0.04);
    this.mode = 'file';
    this.draw();
  }

  private enterShop(): void {
    if (this.step().kind === 'briefing') advance(this.save, this.def);
    this.place = 'shop';
    this.save.place = 'shop';
    persist(this.save);
    this.mode = 'play';
    audio.blip(620);
    this.draw();
  }

  private onTab(id: string): void {
    if (this.enc) return;
    if (!this.roomOpen(id)) {
      const room = this.def.rooms.find((item) => item.id === id);
      const step = this.step();
      if (room?.unlock === 'evidence' && step.kind === 'unlock-room' && step.roomId === id) {
        if (!unlockEvidenceRoom(this.save, this.def, id)) {
          this.float('Need 15 Evidence', W / 2, 500, CSS.bad);
          return;
        }
        this.place = id;
        this.save.place = id;
        persist(this.save);
        advance(this.save, this.def);
        audio.blip(640);
        this.draw();
        return;
      }
      this.float(room?.unlock === 'evidence' ? 'Not yet' : 'Link two clues on the board first', W / 2, 500, CSS.warn);
      return;
    }
    this.place = id;
    this.save.place = id;
    persist(this.save);
    audio.blip(420, 0.05, 'sine', 0.03);
    this.draw();
  }

  private onToolEmf(): void {
    const step = this.step();
    if (step.kind === 'receive-tool' && !this.save.tools.emf.owned) {
      giveEmf(this.save);
      audio.chime();
      advance(this.save, this.def);
      this.float('EMF meter on your belt', W / 2, 500);
      this.draw();
      return;
    }
    if (!this.save.tools.emf.owned) return;
    if (step.kind === 'place-tea' && !this.save.tools.emf.placedRoom) {
      if (this.place === 'office') {
        this.float('Set it down in the shop.', W / 2, 500, CSS.warn);
        return;
      }
      placeEmf(this.save, this.place);
      audio.blip(480);
      this.float('Meter set down', W / 2, 500, CSS.ecto);
      this.draw();
      return;
    }
    this.mode = 'upgrade';
    this.draw();
  }

  private onTune(): void {
    if (!upgradeEmf(this.save, this.def)) {
      this.float('Need more Ectoplasm', W / 2, 500, CSS.bad);
      return;
    }
    audio.chime();
    if (this.step().kind === 'upgrade-tool') advance(this.save, this.def);
    this.mode = 'play';
    this.float('EMF meter level 2', W / 2, 500, CSS.ecto);
    this.draw();
  }

  private onTea(): void {
    if (!this.save.tools.emf.placedRoom) {
      this.float('Set the meter down first', W / 2, 500, CSS.warn);
      return;
    }
    if (this.save.teaTaken) {
      this.float('The pot is empty', W / 2, 500, CSS.dim);
      return;
    }
    if (this.step().kind !== 'place-tea') return;
    takeTea(this.save, this.def);
    audio.pour();
    advance(this.save, this.def);
    this.draw();
  }

  private onLight(): void {
    const owned = this.save.tools.flashlight.owned;
    this.float(owned ? 'Ready for the next case' : 'Issued after this case', W / 2, 500, CSS.dim);
  }

  private onSound(): void {
    const muted = toggleMute(this.save);
    audio.setMuted(muted);
    if (!muted) audio.blip();
    this.draw();
  }

  private onContinue(): void {
    if (this.step().kind !== 'explain') return;
    advance(this.save, this.def);
    audio.blip(600);
    this.draw();
  }

  private onRecap(): void {
    if (this.step().kind !== 'recap') return;
    advance(this.save, this.def);
    this.draw();
  }

  private onStamp(): void {
    if (this.step().kind !== 'stamp') return;
    audio.stamp();
    closeCase(this.save, this.def);
    this.scene.start('report');
  }

  private onHint(): void {
    const now = performance.now();
    if (now < this.hintReadyAt) return;
    const left = this.listed().filter((obj) => !this.save.objectsFound.includes(obj.id) && this.hintable(obj));
    if (left.length === 0) {
      this.float('Nothing left in this room.', W / 2, 500, CSS.dim);
      return;
    }
    const pick = left[Math.floor(Math.random() * left.length)];
    this.hintId = pick.id;
    this.hintUntil = now + 2800;
    this.hintReadyAt = now + 16000;
    this.hintShown = 16;
    audio.blip(740, 0.08, 'triangle', 0.04);
    this.draw();
  }

  private hintable(obj: HiddenObject): boolean {
    if (!obj.cold) return true;
    return this.save.tutorialIndex >= stepIndex(this.def, 'cold');
  }

  private onMiss(): void {
    if (this.mode !== 'play' || this.enc) return;
    audio.blip(180, 0.03, 'sine', 0.02);
  }

  private onAmbient(id: string): void {
    const spot = this.ambients.find((item) => item.id === id);
    if (!spot || spot.wait > performance.now()) return;
    if (!this.canSearch()) return;
    const cool = this.step().kind === 'collect' ? this.def.economy.tutorialCooldownMs : this.def.economy.ambientCooldownMs;
    spot.wait = performance.now() + cool;
    addEvidence(this.save, this.def.economy.ambientEvidence);
    audio.blip(520);
    this.float(`+${this.def.economy.ambientEvidence} Evidence`, spot.x * W, spot.y * H);
    this.burst(spot.x * W, spot.y * H, HEX.cold);
    this.afterSearch();
    this.draw();
  }

  private collect(obj: HiddenObject): void {
    if (this.mode !== 'play' || this.enc) return;
    if (this.save.objectsFound.includes(obj.id)) return;
    const pt = this.objPoint(obj);
    if (obj.cold && this.save.tutorialIndex < stepIndex(this.def, 'cold')) {
      this.float('The meter has to hum first.', pt.x, pt.y, CSS.warn);
      return;
    }
    if (obj.id === 'folder' && this.step().kind === 'briefing') {
      markFound(this.save, obj.id);
      this.openFile();
      return;
    }
    if (obj.clueId === 'pages' && this.step().kind === 'encounter' && !this.save.encounterDone && !this.enc) {
      markFound(this.save, obj.id);
      noteClue(this.save, this.def, 'pages');
      this.burst(pt.x, pt.y, HEX.lamp);
      this.startEncounter();
      return;
    }
    this.grantFor(obj, pt);
    markFound(this.save, obj.id);
    audio.chime();
    this.burst(pt.x, pt.y, HEX.lamp);
    this.afterSearch();
    this.draw();
  }

  private grantFor(obj: HiddenObject, pt: { x: number; y: number }): void {
    if (obj.clueId) {
      if (noteClue(this.save, this.def, obj.clueId)) {
        this.float(`+${this.def.economy.clueEvidence} Evidence`, pt.x, pt.y);
        this.float('Clue noted', pt.x, pt.y + 26, CSS.brass);
      }
      return;
    }
    if (this.save.tutorialIndex >= stepIndex(this.def, 'evidence')) {
      addEvidence(this.save, this.def.economy.ambientEvidence);
      this.float(`+${this.def.economy.ambientEvidence} Evidence`, pt.x, pt.y);
    }
  }

  private canSearch(): boolean {
    return this.save.caseStatus === 'active' && this.save.tutorialIndex >= stepIndex(this.def, 'evidence') && !this.enc;
  }

  private afterSearch(): void {
    const step = this.step();
    if (step.kind !== 'collect') return;
    const enough = this.save.resources.evidence >= step.need;
    const clues = step.clueIds.every((id) => this.save.cluesFound.includes(id));
    if (enough && clues) advance(this.save, this.def);
  }

  private onCold(): void {
    if (!this.cold) return;
    const tutorial = this.cold.tutorial;
    const at = { x: this.cold.x * W, y: this.cold.y * H };
    this.cold = null;
    audio.humStop();
    const gain = tutorial ? this.def.economy.firstEctoplasm : this.def.economy.laterEctoplasm;
    grantEctoplasm(this.save, gain);
    if (tutorial) {
      markFound(this.save, 'chair');
      noteClue(this.save, this.def, 'armchair');
    }
    audio.chime();
    this.float(`+${gain} Ectoplasm`, at.x, at.y, CSS.ecto);
    this.burst(at.x, at.y, HEX.ecto);
    if (tutorial && this.step().kind === 'cold-spot') {
      this.nextColdAt = performance.now() + 4000;
      advance(this.save, this.def);
    } else this.nextColdAt = performance.now() + this.coldInterval();
    this.draw();
  }

  private onTray(id: string): void {
    const key = `tray-${id}`;
    this.armed = this.armed === key ? null : key;
    this.draw();
  }

  private onPin(id: string): void {
    if (this.armed?.startsWith('tray-')) {
      this.pin(this.armed.slice(5));
      return;
    }
    if (this.armed?.startsWith('pin-') && this.armed !== `pin-${id}`) {
      this.link(this.armed.slice(4), id);
      return;
    }
    const key = `pin-${id}`;
    this.armed = this.armed === key ? null : key;
    this.draw();
  }

  private pin(id: string): void {
    if (!pinClue(this.save, id)) return;
    audio.blip(700, 0.08, 'triangle', 0.04);
    this.armed = null;
    if (this.step().kind === 'pin' && this.save.cluesPinned.length >= 1) advance(this.save, this.def);
    this.draw();
  }

  private link(a: string, b: string): void {
    if (!linkClues(this.save, a, b)) return;
    audio.string();
    this.armed = null;
    if (this.step().kind === 'link' && linkQuotaMet(this.save, this.def)) advance(this.save, this.def);
    this.draw();
  }

  private startEncounter(): void {
    this.mode = 'play';
    this.place = 'stock';
    this.save.place = 'stock';
    persist(this.save);
    this.enc = {
      phase: 'arrive',
      until: performance.now() + 1000,
      dur: 1000,
      beat: 0,
      beatStage: 'charge',
      hit: false,
      misses: 0,
    };
    audio.blip(240, 0.2, 'sine', 0.03);
    this.draw();
  }

  private givePages(): void {
    if (this.enc?.phase !== 'offer') return;
    this.armed = null;
    this.enc.phase = 'settle';
    this.enc.dur = 1200;
    this.enc.until = performance.now() + 1200;
    this.place = 'nook';
    this.save.place = 'nook';
    persist(this.save);
    audio.blip(520, 0.1, 'triangle', 0.04);
    this.draw();
  }

  private onBeat(): void {
    const enc = this.enc;
    if (!enc || enc.phase !== 'rhythm' || enc.beatStage !== 'open' || enc.hit) return;
    enc.hit = true;
    audio.blip(880, 0.05);
    enc.beatStage = 'gap';
    enc.dur = 220;
    enc.until = performance.now() + 220;
  }

  private tickEncounter(now: number): void {
    const enc = this.enc;
    if (!enc || now < enc.until) return;
    if (enc.phase === 'arrive') {
      enc.phase = 'rhythm';
      enc.beat = 0;
      enc.beatStage = 'charge';
      enc.hit = false;
      enc.dur = 420;
      enc.until = now + 420;
      this.draw();
      return;
    }
    if (enc.phase === 'rhythm') {
      if (enc.beatStage === 'charge') {
        enc.beatStage = 'open';
        enc.hit = false;
        enc.dur = 1500;
        enc.until = now + 1500;
        return;
      }
      if (enc.beatStage === 'open') {
        if (!enc.hit) {
          enc.misses += 1;
          this.missLamp = enc.beat;
          this.missUntil = now + 300;
        }
        enc.beatStage = 'gap';
        enc.dur = 240;
        enc.until = now + 240;
        return;
      }
      if (enc.beat >= this.def.encounter.beats - 1) {
        enc.phase = 'offer';
        enc.until = Number.POSITIVE_INFINITY;
        this.draw();
        return;
      }
      enc.beat += 1;
      enc.beatStage = 'charge';
      enc.hit = false;
      enc.dur = 420;
      enc.until = now + 420;
      return;
    }
    if (enc.phase === 'settle') {
      enc.phase = 'read';
      enc.dur = 2200;
      enc.until = now + 2200;
      return;
    }
    if (enc.phase === 'read') {
      enc.phase = 'tip';
      enc.dur = 1100;
      enc.until = now + 1100;
      return;
    }
    if (enc.phase === 'tip') {
      enc.phase = 'fade';
      enc.dur = 1300;
      enc.until = now + 1300;
      if (!this.save.encounterRewarded) {
        grantEctoplasm(this.save, this.def.encounter.ectoplasm);
        this.save.encounterRewarded = true;
        persist(this.save);
      }
      const at = this.ambrosePoint();
      this.burst(at.x, at.y - 40, HEX.ecto);
      this.float(`+${this.def.encounter.ectoplasm} Ectoplasm`, at.x, at.y - 80, CSS.ecto);
      audio.doorbell();
      this.draw();
      return;
    }
    if (enc.phase === 'fade') this.finishEncounter();
  }

  private finishEncounter(): void {
    const misses = this.enc?.misses ?? 0;
    this.enc = null;
    this.ghostSprite.setVisible(false);
    completeEncounter(this.save, this.def, misses);
    if (this.step().kind === 'encounter') advance(this.save, this.def);
    this.draw();
  }

  private tickCold(delta: number): void {
    const step = this.step();
    if (step.kind === 'cold-spot' && !this.cold && this.nextColdAt === null) this.nextColdAt = performance.now();
    if (this.cold && this.coldVisible()) {
      this.cold.remaining -= delta;
      if (this.cold.remaining <= 0) {
        const tutorial = this.cold.tutorial;
        this.cold = null;
        audio.humStop();
        this.nextColdAt = performance.now() + (tutorial ? 700 : this.coldInterval());
      }
    }
    if (!this.cold && this.nextColdAt !== null && performance.now() >= this.nextColdAt) {
      this.nextColdAt = null;
      if (this.step().kind === 'cold-spot') this.spawnTutorialCold();
      else if (this.save.tools.emf.owned && this.save.tutorialIndex > stepIndex(this.def, 'cold')) this.spawnRandomCold();
    }
    if (this.meterHot()) audio.humStart();
    else audio.humStop();
  }

  private coldVisible(): boolean {
    return !!this.cold && this.place === this.cold.room && this.mode === 'play' && !this.enc;
  }

  private spawnTutorialCold(): void {
    const chair = this.def.objects.find((obj) => obj.id === 'chair');
    if (!chair || chair.spot.kind !== 'ellipse') return;
    this.cold = {
      room: chair.roomId,
      x: chair.spot.cx,
      y: chair.spot.cy,
      remaining: this.def.economy.coldWindowMs,
      tutorial: true,
    };
  }

  private spawnRandomCold(): void {
    const roomId = this.place !== 'office' && this.roomOpen(this.place) ? this.place : 'shop';
    const room = this.def.rooms.find((item) => item.id === roomId);
    if (!room || room.ambient.length === 0) return;
    const spot = room.ambient[Math.floor(Math.random() * room.ambient.length)];
    this.cold = { room: roomId, x: spot.x, y: spot.y, remaining: this.def.economy.coldWindowMs, tutorial: false };
  }

  private coldInterval(): number {
    const level = this.save.tools.emf.level >= 2 ? 2 : 1;
    return this.def.economy.coldIntervalMs[level];
  }

  private tickAmbients(): void {
    let woke = false;
    const now = performance.now();
    for (const spot of this.ambients) {
      if (spot.wait && spot.wait <= now) {
        spot.wait = 0;
        woke = true;
      }
    }
    if (woke && this.mode === 'play' && !this.enc) this.draw();
  }

  private ensureAmbients(roomId: string): void {
    const room = this.def.rooms.find((item) => item.id === roomId);
    if (!room) return;
    for (let i = 0; i < room.ambient.length; i++) {
      if (this.ambients.some((spot) => spot.id === `amb-${roomId}-${i}`)) continue;
      const spot = room.ambient[i];
      this.ambients.push({ id: `amb-${roomId}-${i}`, room: roomId, x: spot.x, y: spot.y, wait: 0 });
    }
  }

  private meterHot(): boolean {
    if (!this.save.tools.emf.owned || this.mode !== 'play' || this.enc) return false;
    if (this.cold && this.coldVisible()) return true;
    if (this.save.tutorialIndex < stepIndex(this.def, 'evidence')) return false;
    const cap = ambientCap(this.save.resources.fear, this.def.economy);
    return this.ambients.some((spot, index) => {
      if (spot.room !== this.place || spot.wait > performance.now()) return false;
      const ordinal = this.ambients.filter((item) => item.room === this.place).indexOf(spot);
      return ordinal < cap && index >= 0;
    });
  }

  private rebuildZones(): void {
    const zones = [...this.baseZones];
    delete this.rects.cold;
    delete this.rects['beat-active'];
    if (this.cold && this.coldVisible()) {
      const rect = { x: this.cold.x * W - 46, y: this.cold.y * H - 46, w: 92, h: 92 };
      zones.push({ id: 'cold', ...rect, priority: 6, onClick: () => this.onCold() });
      this.rects.cold = rect;
    }
    if (this.enc?.phase === 'rhythm' && this.enc.beatStage === 'open') {
      const rect = this.lampRect(this.enc.beat);
      zones.push({ id: 'beat-active', ...rect, priority: 16, onClick: () => this.onBeat() });
      this.rects['beat-active'] = rect;
    }
    if (this.enc?.phase === 'offer') {
      const card = { x: 36, y: 420, w: 260, h: 96 };
      const drop = { x: 520, y: 180, w: 280, h: 280 };
      zones.push({
        id: 'drag-pages',
        ...card,
        priority: 16,
        drag: true,
        onClick: () => {
          this.armed = this.armed === 'drag-pages' ? null : 'drag-pages';
          this.draw();
        },
      });
      zones.push({
        id: 'drop-ambrose',
        ...drop,
        priority: 14,
        onClick: () => {
          if (this.armed === 'drag-pages') this.givePages();
        },
      });
      this.rects['drag-pages'] = card;
      this.rects['drop-ambrose'] = drop;
    }
    const map: Record<string, Rect> = {};
    for (const zone of zones) map[zone.id] = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
    for (const [id, rect] of Object.entries(this.rects)) map[id] = rect;
    this.zones = zones;
    this.regionMap = map;
  }

  private regionMap: Record<string, Rect> = {};

  private drawFx(): void {
    this.fx.clear();
    if (SHOW_SPOTS && this.mode === 'play' && !this.enc) {
      this.fx.lineStyle(2, 0xff4040, 0.9);
      for (const obj of this.def.objects.filter((item) => item.roomId === this.place)) {
        if (obj.spot.kind !== 'ellipse') continue;
        const x = obj.spot.cx * W;
        const y = obj.spot.cy * H;
        this.fx.strokeEllipse(x, y, obj.spot.rx * 2 * W, obj.spot.ry * 2 * H);
      }
    }
    if (this.hintId && performance.now() < this.hintUntil) {
      const obj = this.def.objects.find((item) => item.id === this.hintId);
      if (obj && obj.roomId === this.place && obj.spot.kind === 'ellipse') {
        this.glow(obj.spot.cx * W, obj.spot.cy * H, obj.spot.rx * W + 8, obj.spot.ry * H + 8);
      }
    }
    if (this.enc && (this.enc.phase === 'arrive' || this.enc.phase === 'rhythm')) {
      const flick = Math.sin(performance.now() / 35) > 0.55 ? 0.18 : 0.04;
      this.fx.fillStyle(0xc5d7ff, flick);
      this.fx.fillRect(0, 0, W, BAR.y);
    }
    if (this.cold && this.coldVisible()) {
      const t = Math.max(0, this.cold.remaining / this.def.economy.coldWindowMs);
      const cx = this.cold.x * W;
      const cy = this.cold.y * H;
      this.fx.lineStyle(3, HEX.cold, 0.95);
      this.fx.strokeCircle(cx, cy, 18 + 28 * t);
      this.fx.fillStyle(0xc9fff0, 0.18);
      this.fx.fillCircle(cx, cy, 16);
    }
    if (this.enc?.phase === 'rhythm') {
      for (let i = 0; i < this.def.encounter.beats; i++) this.drawLamp(i);
      const open = this.enc.beatStage === 'open';
      this.tapLabel.setVisible(open);
      if (open) {
        const rect = this.lampRect(this.enc.beat);
        this.tapLabel.setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
    } else this.tapLabel.setVisible(false);
    this.drawAmbrose();
    if (this.enc?.phase === 'read' || this.enc?.phase === 'tip') {
      const at = this.ambrosePoint();
      this.fx.fillStyle(0xf3e6c8, 0.95);
      this.fx.fillRect(at.x - 28, at.y - 150, 46, 32);
      this.fx.fillStyle(0x8e2e32, 1);
      this.fx.fillRect(at.x - 26, at.y - 148, 8, 28);
    }
    for (const bit of this.bits) {
      this.fx.fillStyle(bit.color, Math.max(0, bit.life));
      this.fx.fillCircle(bit.x, bit.y, 4);
    }
    if (this.ghost?.id.startsWith('pin-')) {
      const id = this.ghost.id.slice(4);
      const from = this.pinCenters[id];
      if (from) {
        this.fx.lineStyle(3, HEX.string, 0.9);
        this.fx.lineBetween(from.x, from.y, this.ghost.x, this.ghost.y);
      }
    }
    if (this.ghost) {
      parchment(this.fx, this.ghost.x - 90, this.ghost.y - 70, 180, 48);
      this.dragLabel.setText(this.ghostTitle(this.ghost.id)).setPosition(this.ghost.x, this.ghost.y - 46).setVisible(true);
    } else this.dragLabel.setVisible(false);
    this.spotlight();
  }

  private spotlight(): void {
    const target = this.highlightTarget();
    if (!target || this.mode === 'menu' || this.mode === 'confirm') return;
    const objId = target.startsWith('obj-') ? target.slice(4) : '';
    const obj = objId ? this.def.objects.find((item) => item.id === objId) : undefined;
    if (obj && obj.spot.kind === 'ellipse') {
      this.glow(obj.spot.cx * W, obj.spot.cy * H, obj.spot.rx * W, obj.spot.ry * H);
      return;
    }
    const rect = this.rects[target] ?? this.regionMap[target];
    if (!rect || rect.w * rect.h > 140000) return;
    this.glow(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(20, rect.w / 2), Math.max(14, rect.h / 2));
  }

  private glow(cx: number, cy: number, rx: number, ry: number): void {
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 220);
    const rings: [number, number][] = [
      [3.1, 0.08],
      [2.2, 0.14],
      [1.45, 0.2],
    ];
    for (const [scale, alpha] of rings) {
      this.fx.fillStyle(0xffe3a0, alpha * pulse);
      this.fx.fillEllipse(cx, cy, rx * 2 * scale, ry * 2 * scale);
    }
  }

  private drawLamp(index: number): void {
    const rect = this.lampRect(index);
    const enc = this.enc;
    const active = enc?.beat === index;
    let fill = 0x3a2618;
    if (active && enc?.beatStage === 'charge') fill = 0x6a5430;
    if (active && enc?.beatStage === 'open') fill = 0xffc56e;
    if (active && enc?.beatStage === 'gap' && enc.hit) fill = 0xc6f0d4;
    if (this.missLamp === index && performance.now() < this.missUntil) fill = 0xd4655d;
    this.fx.fillStyle(0x1a120c, 0.85);
    this.fx.fillRect(rect.x, rect.y, rect.w, rect.h);
    this.fx.lineStyle(2, HEX.brass, 1);
    this.fx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    this.fx.fillStyle(fill, 1);
    this.fx.fillCircle(rect.x + rect.w / 2, rect.y + 28, 12);
    this.fx.fillStyle(HEX.brass, 1);
    this.fx.fillRect(rect.x + rect.w / 2 - 3, rect.y + 40, 6, 16);
  }

  private lampRect(index: number): Rect {
    const w = 92;
    const gap = 16;
    const total = this.def.encounter.beats * w + (this.def.encounter.beats - 1) * gap;
    const x0 = (W - total) / 2;
    return { x: x0 + index * (w + gap), y: BAR.y - 96, w, h: 70 };
  }

  private drawAmbrose(): void {
    const enc = this.enc;
    if (!enc) {
      this.ghostSprite.setVisible(false);
      return;
    }
    const at = this.ambrosePoint();
    const sitting = enc.phase === 'settle' || enc.phase === 'read' || enc.phase === 'tip' || enc.phase === 'fade';
    this.ghostSprite.setVisible(true).setPosition(at.x, at.y).setDisplaySize(sitting ? 230 : 280, sitting ? 300 : 370);
    let alpha = 0.92;
    const remain = Math.max(0, enc.until - performance.now());
    if (enc.phase === 'arrive') alpha = 0.92 * (1 - remain / enc.dur);
    if (enc.phase === 'fade') alpha = 0.92 * (remain / enc.dur);
    if (enc.phase === 'tip') this.ghostSprite.setX(at.x + 10);
    this.ghostSprite.setAlpha(alpha);
  }

  private ambrosePoint(): { x: number; y: number } {
    if (this.enc && (this.enc.phase === 'settle' || this.enc.phase === 'read' || this.enc.phase === 'tip' || this.enc.phase === 'fade')) {
      const chair = this.def.objects.find((obj) => obj.id === 'chair');
      if (chair && chair.spot.kind === 'ellipse') return { x: chair.spot.cx * W, y: chair.spot.cy * H + 30 };
    }
    return { x: W / 2 + 40, y: 470 };
  }

  private ghostTitle(id: string): string {
    const clueId = id.startsWith('tray-') ? id.slice(5) : id.startsWith('pin-') ? id.slice(4) : id === 'drag-pages' ? 'pages' : '';
    return this.def.clues.find((clue) => clue.id === clueId)?.title ?? 'Note';
  }

  private highlightTarget(): string | null {
    const step = this.step();
    if (this.mode === 'menu' || this.mode === 'confirm' || this.mode === 'away') return null;
    if (this.mode === 'file') return 'enter-shop';
    if (this.mode === 'upgrade') return step.kind === 'upgrade-tool' && this.save.tools.emf.level < 2 ? 'tune' : null;
    if (this.mode === 'board') {
      if (
        step.kind === 'pin' ||
        (step.kind === 'stamp' && !boardComplete(this.save, this.def) && this.save.cluesFound.some((id) => !this.save.cluesPinned.includes(id)))
      ) {
        const next = this.save.cluesFound.find((id) => !this.save.cluesPinned.includes(id));
        return next ? `tray-${next}` : 'board-surface';
      }
      if (step.kind === 'link' || (step.kind === 'stamp' && !boardComplete(this.save, this.def))) return 'board-surface';
      return null;
    }
    if (step.kind === 'recap') return 'recap-ok';
    if (step.kind === 'briefing') return 'obj-folder';
    if (step.kind === 'collect') {
      const missing = step.clueIds.find((id) => !this.save.cluesFound.includes(id));
      const obj = missing ? this.def.objects.find((item) => item.clueId === missing && item.roomId === this.place) : undefined;
      if (obj) return `obj-${obj.id}`;
      const next = this.listed().find((item) => !this.save.objectsFound.includes(item.id));
      return next ? `obj-${next.id}` : 'hint';
    }
    if (step.kind === 'unlock-room') return `tab-${step.roomId}`;
    if (step.kind === 'receive-tool') return 'tool-emf';
    if (step.kind === 'cold-spot') return this.place === step.roomId && this.cold ? 'cold' : `tab-${step.roomId}`;
    if (step.kind === 'upgrade-tool') return 'tool-emf';
    if (step.kind === 'place-tea') return this.save.tools.emf.placedRoom ? 'tool-tea' : 'tool-emf';
    if (step.kind === 'explain') return 'fear';
    if (step.kind === 'pin' || step.kind === 'link') return 'case';
    if (step.kind === 'encounter') {
      if (this.enc?.phase === 'rhythm' && this.enc.beatStage === 'open') return 'beat-active';
      if (this.enc?.phase === 'offer') return 'drag-pages';
      if (this.enc) return null;
      return this.place === 'stock' ? 'obj-drawer' : 'tab-stock';
    }
    if (step.kind === 'stamp') {
      const missing = this.def.clues.find((clue) => !this.save.cluesFound.includes(clue.id));
      if (missing) {
        const obj = this.def.objects.find((item) => item.clueId === missing.id);
        if (obj && this.place === obj.roomId) return `obj-${obj.id}`;
        return `tab-${missing.roomId}`;
      }
      if (!boardComplete(this.save, this.def)) return 'case';
      return 'stamp';
    }
    return null;
  }

  private onDown(p: Point): void {
    audio.unlock();
    notePointer(p);
    const zone = this.pick(p.x, p.y);
    this.down = zone ? { id: zone.id, x: p.x, y: p.y, drag: !!zone.drag } : null;
    this.ghost = null;
  }

  private onMove(p: Point): void {
    if (!this.down?.drag) return;
    if (Math.hypot(p.x - this.down.x, p.y - this.down.y) < 12) return;
    this.ghost = { id: this.down.id, x: p.x, y: p.y };
  }

  private onUp(p: Point): void {
    const down = this.down;
    this.down = null;
    if (!down) {
      this.ghost = null;
      return;
    }
    const dist = Math.hypot(p.x - down.x, p.y - down.y);
    const dragged = down.drag && dist >= 12;
    this.ghost = null;
    if (dragged) this.onDrop(down.id, p.x, p.y);
    else this.zones.find((zone) => zone.id === down.id)?.onClick?.();
  }

  private onDrop(id: string, x: number, y: number): void {
    const target = this.pick(x, y, [id, 'blocker', 'bar']);
    if (id.startsWith('tray-')) {
      const clue = id.slice(5);
      if (target && (target.id === 'board-surface' || target.id.startsWith('pin-'))) this.pin(clue);
      return;
    }
    if (id.startsWith('pin-')) {
      const from = id.slice(4);
      if (target?.id.startsWith('pin-')) {
        const to = target.id.slice(4);
        if (to !== from) this.link(from, to);
      }
      return;
    }
    if (id === 'drag-pages' && target?.id === 'drop-ambrose') this.givePages();
  }

  private pick(x: number, y: number, ignore: string[] = []): Zone | null {
    let best: Zone | null = null;
    for (const zone of this.zones) {
      if (ignore.includes(zone.id)) continue;
      if (x < zone.x || y < zone.y || x > zone.x + zone.w || y > zone.y + zone.h) continue;
      if (!best || zone.priority > best.priority || (zone.priority === best.priority && zone.w * zone.h < best.w * best.h)) {
        best = zone;
      }
    }
    return best;
  }

  private float(message: string, x: number, y: number, color = CSS.brass): void {
    const text = write(this, x, y, message, 20, color, { bold: true, originX: 0.5, originY: 0.5, font: 'display' }).setDepth(80);
    this.tweens.add({ targets: text, y: y - 28, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const speed = 40 + Math.random() * 70;
      this.bits.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.8, color });
    }
  }

  private emitDebug(force: boolean): void {
    const line = this.debugLine();
    if (!force && line === this.lastLine) return;
    this.lastLine = line;
    publish({
      regions: this.regionMap,
      beatReady: this.enc?.phase === 'rhythm' && this.enc.beatStage === 'open',
      line,
    });
  }

  private debugLine(): string {
    const save = this.save;
    const phase = !this.enc ? 'none' : this.enc.phase === 'rhythm' ? `rhythm-${this.enc.beatStage}` : this.enc.phase;
    return [
      `step:${this.step().id}`,
      `mode:${this.mode}`,
      `place:${this.place}`,
      `phase:${phase}`,
      `ev:${save.resources.evidence}`,
      `ec:${save.resources.ectoplasm}`,
      `emf:${save.resources.emf}`,
      `fear:${save.resources.fear}`,
      `found:${[...save.cluesFound].sort().join('.')}`,
      `pin:${[...save.cluesPinned].sort().join('.')}`,
      `links:${save.links.length}`,
      `stars:${save.stars.join('.')}`,
      `miss:${save.encounterMisses}`,
      `low:${save.fearStayedLow ? 1 : 0}`,
      `tea:${save.teaTaken ? 1 : 0}`,
      `placed:${save.tools.emf.placedRoom || '-'}`,
      `lv:${save.tools.emf.level}`,
      `cold:${this.cold && this.coldVisible() ? 1 : 0}`,
      `bonus:${save.bankedEvidenceBonus}`,
      `name:${save.detective.name}`,
    ].join('|');
  }
}
