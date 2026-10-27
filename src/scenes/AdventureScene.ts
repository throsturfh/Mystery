import Phaser from 'phaser';
import { audio } from '../audio';
import { HUD_TOP, SHOW_SPOTS, SPEAKER_COLOR, SPEAKER_NAME, W } from '../config';
import { closestPoint, hitEllipse } from '../geom';
import {
  clearSave,
  ITEM_NAME,
  loadSave,
  writeSave,
  type ItemId,
  type RoomId,
  type Save,
  type Speaker,
} from '../save';
import {
  combine,
  ENTRY,
  ghostShouldShow,
  hintFor,
  onEnter,
  perform,
  PROP_AT,
  spotsFor,
  useItemOn,
  walkFor,
  type Ctx,
  type Spot,
  type Verb,
} from '../story';

type Mode = 'play' | 'speech' | 'choice' | 'fade';

const FONT = 'Cormorant Garamond, Georgia, serif';
const DISPLAY = 'Cinzel, Georgia, serif';

export class AdventureScene extends Phaser.Scene {
  private save!: Save;
  private mode: Mode = 'play';
  private busyScript = false;
  private pendingEnter = false;
  private spots: Spot[] = [];
  private props: Phaser.GameObjects.GameObject[] = [];
  private fx = 940;
  private fy = 568;
  private face: 1 | -1 = -1;
  private walking = false;
  private goal: { x: number; y: number } | null = null;
  private walkResolve: ((ok: boolean) => void) | null = null;
  private bob = 0;
  private pose: 'none' | 'look' | 'pick' = 'none';
  private poseUntil = 0;
  private hero!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private ghost?: Phaser.GameObjects.Image;
  private ghostBaseY = 0;
  private forceGhost = false;
  private lookMode = false;
  private selected: ItemId | null = null;
  private pointerDown = false;
  private downX = 0;
  private downY = 0;
  private moved = 0;
  private downSlot: number | null = null;
  private dragItem: ItemId | null = null;
  private longFired = false;
  private longCall: Phaser.Time.TimerEvent | null = null;
  private advance: (() => void) | null = null;
  private choiceResolve: ((index: number) => void) | null = null;
  private speechObjs: Phaser.GameObjects.GameObject[] = [];
  private choiceObjs: Phaser.GameObjects.GameObject[] = [];
  private choiceHits: { index: number; x: number; y: number; w: number; h: number }[] = [];
  private hudGfx!: Phaser.GameObjects.Graphics;
  private slotImgs: Phaser.GameObjects.Image[] = [];
  private dragIcon!: Phaser.GameObjects.Image;
  private caption!: Phaser.GameObjects.Text;
  private lookText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private resetText!: Phaser.GameObjects.Text;
  private plaque!: Phaser.GameObjects.Text;
  private lane!: Phaser.GameObjects.Text;
  private envelope?: Phaser.GameObjects.Image;
  private resetArm = false;
  private line: string | null = null;
  private ctx!: Ctx;
  private scenery: { img: Phaser.GameObjects.Image; show: () => boolean }[] = [];
  private june?: Phaser.GameObjects.Image;

  constructor() {
    super('adventure');
  }

  create(): void {
    this.save = loadSave();
    this.fx = this.save.x;
    this.fy = this.save.y;
    this.face = this.save.face;
    this.ctx = this.makeCtx();
    this.shadow = this.add.ellipse(0, 0, 86, 18, 0x000000, 0.35).setDepth(90);
    this.hero = this.add.image(0, 0, 'detective').setOrigin(0.5, 1).setDepth(700);
    this.hudGfx = this.add.graphics().setDepth(2000);
    this.caption = this.add
      .text(500, 672, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#f3e6c8',
        wordWrap: { width: 280 },
      })
      .setOrigin(0, 0.5)
      .setDepth(2020)
      .setResolution(2);
    this.lookText = this.makeButtonLabel('');
    this.hintText = this.makeButtonLabel('Hint');
    this.resetText = this.makeButtonLabel('Reset');
    this.plaque = this.add
      .text(W / 2, 36, 'Case closed', {
        fontFamily: DISPLAY,
        fontSize: '28px',
        color: '#e6c98a',
        stroke: '#140e0a',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setDepth(1800)
      .setVisible(false)
      .setResolution(2);
    this.lane = this.add
      .text(W / 2, 72, 'No. 9 Lantern Lane', {
        fontFamily: FONT,
        fontStyle: 'italic',
        fontSize: '24px',
        color: '#f6edd6',
        stroke: '#140e0a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(1800)
      .setVisible(false)
      .setResolution(2);
    this.dragIcon = this.add.image(0, 0, 'icon-lantern').setDepth(2300).setVisible(false).setScale(0.9);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.mouse?.disableContextMenu();
    const onHide = () => this.persist();
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => window.removeEventListener('pagehide', onHide));
    document.getElementById('loading')?.remove();
    this.drawRoom();
    this.place(this.fx, this.fy, this.face);
    this.drawHero(0);
    this.persist();
    void this.runEnter();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    if (this.walking && this.goal) {
      const dx = this.goal.x - this.fx;
      const dy = this.goal.y - this.fy;
      const dist = Math.hypot(dx, dy);
      const step = 360 * dt;
      if (dist <= step) {
        const face = Math.abs(dx) > 2 ? (dx < 0 ? -1 : 1) : this.face;
        this.place(this.goal.x, this.goal.y, face);
        this.walking = false;
        this.goal = null;
        const done = this.walkResolve;
        this.walkResolve = null;
        done?.(true);
      } else {
        this.bob += dt * 8;
        this.place(this.fx + (dx / dist) * step, this.fy + (dy / dist) * step, dx < 0 ? -1 : 1);
      }
    }
    this.drawHero(dt);
    if (this.ghost?.active) {
      this.ghost.y = this.ghostBaseY + Math.sin(this.time.now / 420) * 7;
    }
    this.publish();
  }

  private makeCtx(): Ctx {
    return {
      say: (who, text) => this.say(who, text),
      ask: (who, text, options) => this.ask(who, text, options),
      has: (item) => this.save.items.includes(item),
      add: (item) => {
        if (!this.save.items.includes(item)) this.save.items.push(item);
      },
      remove: (item) => {
        this.save.items = this.save.items.filter((id) => id !== item);
        if (this.selected === item) this.selected = null;
      },
      flag: (name) => this.save.flags[name] === true,
      setFlag: (name, value) => {
        this.save.flags[name] = value;
      },
      room: () => this.save.room,
      go: (room, entry) => this.changeRoom(room, entry),
      pose: (kind) => {
        this.pose = kind;
        this.poseUntil = this.time.now + (kind === 'pick' ? 320 : 460);
      },
      refresh: () => this.refresh(),
      showGhost: (on) => this.showGhost(on),
      revealRoom: () => this.drawRoom(),
      wait: (ms) => new Promise((res) => this.time.delayedCall(ms, res)),
    };
  }

  private async runEnter(): Promise<void> {
    if (this.busyScript) {
      this.pendingEnter = true;
      return;
    }
    this.busyScript = true;
    try {
      await onEnter(this.ctx);
    } catch (err) {
      console.error(err);
    } finally {
      this.finishScript();
    }
  }

  private finishScript(): void {
    this.busyScript = false;
    this.clearSpeech();
    this.clearChoices();
    if (this.mode !== 'fade') this.mode = 'play';
    this.refresh();
    this.persist();
    if (this.pendingEnter) {
      this.pendingEnter = false;
      void this.runEnter();
    }
  }

  private async changeRoom(room: RoomId, entry: string): Promise<void> {
    this.mode = 'fade';
    this.walking = false;
    this.goal = null;
    if (this.walkResolve) {
      const done = this.walkResolve;
      this.walkResolve = null;
      done(false);
    }
    await this.fade(false);
    this.save.room = room;
    this.save.entry = entry;
    this.forceGhost = false;
    this.drawRoom();
    const spawn = ENTRY[room][entry] ?? ENTRY[room].start ?? Object.values(ENTRY[room])[0]!;
    this.place(spawn.x, spawn.y, spawn.face);
    this.persist();
    await this.fade(true);
    this.mode = 'play';
    this.pendingEnter = true;
  }

  private fade(fadeIn: boolean): Promise<void> {
    return new Promise((resolve) => {
      const cam = this.cameras.main;
      cam.once(fadeIn ? 'camerafadeincomplete' : 'camerafadeoutcomplete', () => resolve());
      if (fadeIn) cam.fadeIn(280, 12, 9, 7);
      else cam.fadeOut(260, 12, 9, 7);
    });
  }

  private drawRoom(): void {
    this.killProps();
    this.envelope?.destroy();
    this.envelope = undefined;
    const room = this.save.room;
    const bg = this.add.image(0, 0, room).setOrigin(0, 0).setDepth(0);
    this.props.push(bg);
    const dark = room === 'stock' && this.save.flags.lanternLit !== true;
    if (dark) {
      const veil = this.add.rectangle(640, 360, 1280, 720, 0x07060a, 0.93).setDepth(150);
      const door = this.add
        .text(100, 300, 'Door', {
          fontFamily: DISPLAY,
          fontSize: '22px',
          color: '#e6c98a',
          stroke: '#140e0a',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(160)
        .setResolution(2);
      this.props.push(veil, door);
    }
    if (SHOW_SPOTS) {
      const g = this.add.graphics().setDepth(40);
      for (const s of spotsFor(this.save, room)) {
        g.lineStyle(2, 0xff66cc, 0.8);
        g.strokeEllipse(s.x, s.y, s.rx * 2, s.ry * 2);
      }
      this.props.push(g);
    }
    this.placeScenery();
    this.spots = spotsFor(this.save, room);
    this.syncGhost();
    this.ensureEndingDressing();
    this.redrawHud();
  }

  private ensureEndingDressing(): void {
    const show = this.save.room === 'office' && this.save.flags.seenEnding === true;
    this.plaque.setVisible(show);
    this.lane.setVisible(show);
    if (show && !this.envelope) {
      this.envelope = this.add.image(1000, 360, 'envelope').setDepth(30).setScale(1);
    }
    if (!show && this.envelope) {
      this.envelope.destroy();
      this.envelope = undefined;
    }
  }

  private syncGhost(): void {
    const show = this.forceGhost || ghostShouldShow(this.save);
    if (!show) {
      if (!this.forceGhost) {
        this.ghost?.destroy();
        this.ghost = undefined;
      }
      return;
    }
    const pos = this.save.room === 'shop' ? { x: 560, y: 590 } : { x: 760, y: 590 };
    if (!this.ghost || !this.ghost.active) {
      this.ghost = this.add.image(pos.x, pos.y, 'ambrose').setOrigin(0.5, 1).setAlpha(0).setDepth(420).setScale(0.62);
      this.tweens.add({ targets: this.ghost, alpha: 0.92, duration: 700 });
    }
    this.ghost.setPosition(pos.x, pos.y).setVisible(true).setDepth(420);
    this.ghostBaseY = pos.y;
  }

  private showGhost(on: boolean): void {
    this.forceGhost = on;
    if (on) {
      this.syncGhost();
      return;
    }
    const ghost = this.ghost;
    this.ghost = undefined;
    if (!ghost) return;
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 800,
      onComplete: () => ghost.destroy(),
    });
  }

  private killProps(): void {
    for (const prop of this.props) prop.destroy();
    this.props = [];
    this.scenery = [];
    this.june = undefined;
  }

  private addScenery(
    key: string,
    x: number,
    y: number,
    originX: number,
    originY: number,
    depth: number,
    show: () => boolean,
    scale = 1,
  ): void {
    const img = this.add.image(x, y, key).setOrigin(originX, originY).setDepth(depth).setScale(scale);
    img.setVisible(show());
    this.scenery.push({ img, show });
    this.props.push(img);
  }

  private placeScenery(): void {
    const room = this.save.room;
    const has = (id: 'pencil' | 'matches' | 'book' | 'ledger') => this.save.items.includes(id);
    const f = this.save.flags;
    if (room === 'shop') {
      this.addScenery('prop-pencil', 948, 362, 0.5, 0.5, 12, () => !has('pencil') && f.ledgerWritten !== true, 0.72);
      this.addScenery('prop-book', PROP_AT.shelfBook.x, PROP_AT.shelfBook.y, 0.5, 0.5, 12, () => f.bookShelved === true, 0.9);
      this.june = this.add.image(620, 585, 'june').setOrigin(0.5, 1).setScale(0.33).setDepth(500 + 540);
      this.props.push(this.june);
    }
    if (room === 'nook') {
      this.addScenery('prop-match-cover', 158, 440, 0, 0, 14, () => has('matches') || f.lanternLit === true);
      this.addScenery('prop-book', PROP_AT.book.x, PROP_AT.book.y, 0, 0, 12, () => !has('book') && f.bookShelved !== true);
    }
    if (room === 'stock' && f.lanternLit === true) {
      this.addScenery('prop-ledger', PROP_AT.ledger.x, PROP_AT.ledger.y, 0, 0, 12, () => !has('ledger') && f.ledgerWritten !== true);
    }
  }

  private syncScenery(): void {
    for (const piece of this.scenery) {
      if (piece.img.active) piece.img.setVisible(piece.show());
    }
  }

  private place(x: number, y: number, face: 1 | -1): void {
    const p = closestPoint({ x, y }, walkFor(this.save.room));
    this.fx = p.x;
    this.fy = p.y;
    this.face = face;
    this.save.x = p.x;
    this.save.y = p.y;
    this.save.face = face;
  }

  private scaleFor(y: number): number {
    const t = Phaser.Math.Clamp((y - 535) / (602 - 535), 0, 1);
    return 0.32 + t * 0.1;
  }

  private drawHero(_dt: number): void {
    const step = Math.sin(this.bob);
    const sc = this.scaleFor(this.fy);
    let sx = sc;
    let sy = sc;
    let angle = 0;
    let yoff = Math.sin(this.time.now / 520) * 1.5;
    const posing = this.time.now < this.poseUntil;
    if (!posing) this.pose = 'none';
    if (this.walking && !posing) {
      const frame = Math.abs(Math.floor(this.bob)) % 4;
      const key = `detective-${frame}`;
      if (this.hero.texture.key !== key) this.hero.setTexture(key);
      sx *= 1 - step * 0.035;
      sy *= 1 + step * 0.045;
      angle = step * 2.2;
      yoff = -Math.abs(step) * 7;
    } else if (this.hero.texture.key !== 'detective') {
      this.hero.setTexture('detective');
    }
    if (posing && this.pose === 'look') {
      sy *= 1.06;
      angle += this.face < 0 ? 6 : -6;
    }
    if (posing && this.pose === 'pick') {
      sx *= 1.12;
      sy *= 0.88;
      angle += this.face < 0 ? -7 : 7;
    }
    this.hero.setPosition(this.fx, this.fy + yoff);
    this.hero.setFlipX(this.face < 0);
    this.hero.setScale(sx, sy);
    this.hero.setAngle(angle);
    this.hero.setAlpha(this.save.room === 'stock' && this.save.flags.lanternLit !== true ? 0.55 : 1);
    this.hero.setDepth(this.save.room === 'stock' && this.save.flags.lanternLit !== true ? 900 : 500 + this.fy);
    this.shadow.setPosition(this.fx, this.fy + 2);
    this.shadow.setScale(sc / 0.37, sc / 0.37);
    this.shadow.setAlpha(this.save.room === 'stock' && this.save.flags.lanternLit !== true ? 0.15 : 0.35);
  }

  private walkTo(x: number, y: number): Promise<boolean> {
    if (this.walkResolve) {
      const old = this.walkResolve;
      this.walkResolve = null;
      old(false);
    }
    const dest = closestPoint({ x, y }, walkFor(this.save.room));
    if (Math.hypot(dest.x - this.fx, dest.y - this.fy) < 8) {
      if (Math.abs(dest.x - this.fx) > 2) this.face = dest.x < this.fx ? -1 : 1;
      return Promise.resolve(true);
    }
    this.goal = dest;
    this.walking = true;
    return new Promise((resolve) => {
      this.walkResolve = resolve;
    });
  }

  private say(who: Speaker, text: string): Promise<void> {
    this.renderSpeech(who, text, true);
    this.mode = 'speech';
    return new Promise((resolve) => {
      this.advance = resolve;
    });
  }

  private ask(who: Speaker, text: string, options: string[]): Promise<number> {
    this.renderSpeech(who, text, false);
    this.renderChoices(options);
    this.mode = 'choice';
    return new Promise((resolve) => {
      this.choiceResolve = resolve;
    });
  }

  private anchor(who: Speaker): { x: number; y: number } {
    if (who === 'detective') {
      const top = this.hero.y - this.hero.displayHeight - 6;
      return { x: this.hero.x, y: Phaser.Math.Clamp(top, 150, 520) };
    }
    if (who === 'edith') return { x: 860, y: 150 };
    if (who === 'june' && this.june?.active) {
      return { x: this.june.x, y: this.june.y - this.june.displayHeight - 10 };
    }
    if (who === 'june') return { x: 620, y: 200 };
    if (this.ghost?.visible) return { x: this.ghost.x, y: this.ghost.y - this.ghost.displayHeight - 8 };
    return { x: 900, y: 220 };
  }

  private renderSpeech(who: Speaker, text: string, waitTap: boolean): void {
    this.clearSpeech();
    this.line = text;
    audio.blip(who === 'ambrose' ? 680 : who === 'edith' ? 490 : who === 'june' ? 560 : 610, 0.07, 0.028);
    const live = document.getElementById('live');
    if (live) live.textContent = `${SPEAKER_NAME[who]}. ${text}`;
    const anchor = this.anchor(who);
    const body = this.add
      .text(anchor.x, anchor.y, text, {
        fontFamily: FONT,
        fontSize: '30px',
        color: SPEAKER_COLOR[who],
        align: 'center',
        wordWrap: { width: 460 },
        stroke: '#140e0a',
        strokeThickness: 6,
      })
      .setOrigin(0.5, 1)
      .setDepth(2100)
      .setResolution(2);
    const name = this.add
      .text(anchor.x, body.y - body.height - 2, SPEAKER_NAME[who], {
        fontFamily: DISPLAY,
        fontSize: '16px',
        color: SPEAKER_COLOR[who],
        stroke: '#140e0a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(2100)
      .setResolution(2);
    const half = Math.max(body.width, name.width) / 2 + 12;
    const minX = half;
    const maxX = 1280 - half;
    const shift = anchor.x < minX ? minX - anchor.x : anchor.x > maxX ? maxX - anchor.x : 0;
    if (shift) {
      body.x += shift;
      name.x += shift;
    }
    const top = name.y - name.height;
    if (top < 6) {
      const down = 6 - top;
      body.y += down;
      name.y += down;
    }
    this.speechObjs.push(body, name);
    if (who === 'edith') {
      const medal = this.add
        .image(name.x - name.width / 2 - 30, name.y - name.height / 2, 'edith-bust')
        .setDisplaySize(44, 52)
        .setDepth(2101);
      if (medal.x < 28) {
        const shift = 28 - medal.x;
        medal.x += shift;
        body.x += shift;
        name.x += shift;
      }
      this.speechObjs.push(medal);
    }
    if (waitTap && !this.save.learnedTap) {
      const tap = this.add
        .text(body.x, body.y + 6, 'tap', {
          fontFamily: DISPLAY,
          fontSize: '14px',
          color: '#c6a15a',
        })
        .setOrigin(0.5, 0)
        .setDepth(2100)
        .setAlpha(0.85);
      this.speechObjs.push(tap);
    }
  }

  private renderChoices(options: string[]): void {
    this.clearChoices();
    const w = 640;
    const h = 50;
    const gap = 8;
    const total = options.length * h + (options.length - 1) * gap;
    let y = HUD_TOP - 16 - total;
    const x = (1280 - w) / 2;
    options.forEach((label, index) => {
      const g = this.add.graphics().setDepth(2200);
      g.fillStyle(0xf3e6c8, 0.96);
      g.fillRoundedRect(x, y, w, h, 10);
      g.lineStyle(2, 0x8a6430, 1);
      g.strokeRoundedRect(x, y, w, h, 10);
      const text = this.add
        .text(x + w / 2, y + h / 2, label, {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#1c140e',
          align: 'center',
          wordWrap: { width: w - 28 },
        })
        .setOrigin(0.5)
        .setDepth(2201)
        .setResolution(2);
      this.choiceObjs.push(g, text);
      this.choiceHits.push({ index, x, y, w, h });
      y += h + gap;
    });
  }

  private clearSpeech(): void {
    for (const obj of this.speechObjs) obj.destroy();
    this.speechObjs = [];
    this.advance = null;
    this.line = null;
  }

  private clearChoices(): void {
    for (const obj of this.choiceObjs) obj.destroy();
    this.choiceObjs = [];
    this.choiceHits = [];
    this.choiceResolve = null;
  }

  private refresh(): void {
    this.spots = spotsFor(this.save, this.save.room);
    this.syncScenery();
    this.ensureEndingDressing();
    this.syncGhost();
    this.redrawHud();
  }

  private redrawHud(): void {
    const g = this.hudGfx;
    g.clear();
    g.fillStyle(0x140e0a, 1);
    g.fillRect(0, HUD_TOP, 1280, 720 - HUD_TOP);
    g.fillStyle(0x3a2618, 1);
    g.fillRect(0, HUD_TOP, 1280, 12);
    g.lineStyle(2, 0xc6a15a, 1);
    g.beginPath();
    g.moveTo(0, HUD_TOP);
    g.lineTo(1280, HUD_TOP);
    g.strokePath();
    const drawBtn = (x: number, y: number, w: number, h: number, hot: boolean) => {
      g.fillStyle(hot ? 0x5c4324 : 0x24180f, 1);
      g.fillRoundedRect(x, y, w, h, 8);
      g.lineStyle(2, hot ? 0xf0d59a : 0xc6a15a, 1);
      g.strokeRoundedRect(x, y, w, h, 8);
    };
    this.save.items.forEach((id, index) => {
      const c = this.slotCenter(index);
      const hot = this.selected === id;
      g.fillStyle(hot ? 0x5c4324 : 0x1a120c, 1);
      g.fillRoundedRect(c.x - 34, c.y - 34, 68, 68, 8);
      g.lineStyle(2, hot ? 0xf0d59a : 0x8a6430, 1);
      g.strokeRoundedRect(c.x - 34, c.y - 34, 68, 68, 8);
    });
    drawBtn(748, 640, 90, 64, this.resetArm);
    drawBtn(848, 640, 140, 64, this.lookMode);
    drawBtn(1000, 640, 256, 64, false);
    this.layoutSlots();
    this.lookText.setPosition(918, 672).setText('Look');
    this.hintText.setPosition(1128, 672);
    this.resetText.setPosition(793, 672).setText(this.resetArm ? 'Again?' : 'Reset');
    const selectedName = this.selected ? ITEM_NAME[this.selected] : '';
    this.caption.setText(this.lookMode ? 'Next tap looks.' : selectedName || 'Tap the floor to walk.');
  }

  private layoutSlots(): void {
    while (this.slotImgs.length < this.save.items.length) {
      const img = this.add.image(0, 0, 'icon-lantern').setDepth(2010);
      this.slotImgs.push(img);
    }
    this.slotImgs.forEach((img, index) => {
      const id = this.save.items[index];
      if (!id) {
        img.setVisible(false);
        return;
      }
      const c = this.slotCenter(index);
      const key = id === 'lantern' && this.save.flags.lanternLit ? 'icon-lantern-lit' : `icon-${id}`;
      img.setTexture(key).setPosition(c.x, c.y).setVisible(true).setScale(1);
    });
  }

  private slotCenter(index: number): { x: number; y: number } {
    return { x: 16 + index * 74 + 32, y: 672 };
  }

  private makeButtonLabel(label: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, label, {
        fontFamily: DISPLAY,
        fontSize: '20px',
        color: '#f6edd6',
      })
      .setOrigin(0.5)
      .setDepth(2022)
      .setResolution(2);
  }

  private world(p: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: p.worldX, y: p.worldY };
  }

  private hitSpot(x: number, y: number): Spot | null {
    if (y >= HUD_TOP) return null;
    for (const spot of this.spots) {
      if (hitEllipse(x, y, spot.x, spot.y, spot.rx, spot.ry)) return spot;
    }
    return null;
  }

  private hitSlot(x: number, y: number): number | null {
    for (let i = 0; i < this.save.items.length; i++) {
      const c = this.slotCenter(i);
      if (Math.abs(x - c.x) <= 36 && Math.abs(y - c.y) <= 36) return i;
    }
    return null;
  }

  private hitRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return x >= rx && y >= ry && x <= rx + rw && y <= ry + rh;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    audio.unlock();
    const w = this.world(p);
    this.pointerDown = true;
    this.downX = w.x;
    this.downY = w.y;
    this.moved = 0;
    this.longFired = false;
    this.dragItem = null;
    this.downSlot = this.hitSlot(w.x, w.y);
    this.longCall?.remove(false);
    this.longCall = null;
    if (this.mode === 'play' && !this.busyScript && this.downSlot === null && w.y < HUD_TOP) {
      const spot = this.hitSpot(w.x, w.y);
      if (spot) {
        this.longCall = this.time.delayedCall(480, () => {
          if (!this.pointerDown || this.moved > 14 || this.mode !== 'play' || this.busyScript) return;
          this.longFired = true;
          void this.doLook(spot);
        });
      }
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const w = this.world(p);
    if (this.pointerDown) this.moved = Math.max(this.moved, Math.hypot(w.x - this.downX, w.y - this.downY));
    if (this.pointerDown && this.downSlot !== null && this.moved > 12 && this.mode === 'play' && !this.busyScript) {
      const id = this.save.items[this.downSlot];
      if (id) this.dragItem = id;
    }
    if (this.dragItem) {
      const key = this.dragItem === 'lantern' && this.save.flags.lanternLit ? 'icon-lantern-lit' : `icon-${this.dragItem}`;
      this.dragIcon.setTexture(key).setPosition(w.x, w.y).setVisible(true);
    } else {
      this.dragIcon.setVisible(false);
    }
    if (this.mode === 'play' && !this.busyScript) {
      const spot = this.hitSpot(w.x, w.y);
      if (this.lookMode) this.caption.setText(spot ? `Look at ${spot.name}` : 'Next tap looks.');
      else if (this.selected) this.caption.setText(spot ? `Use ${ITEM_NAME[this.selected]} on ${spot.name}` : ITEM_NAME[this.selected]);
      else if (spot) this.caption.setText(verbLine(spot.verb, spot.name));
      else if (!this.pointerDown) this.caption.setText('Tap the floor to walk.');
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.pointerDown = false;
    this.longCall?.remove(false);
    this.longCall = null;
    const w = this.world(p);
    const dragged = this.dragItem;
    this.dragItem = null;
    this.dragIcon.setVisible(false);
    if (this.longFired) return;
    if (this.mode === 'fade') return;
    if (this.mode === 'choice') {
      const hit = this.choiceHits.find((box) => this.hitRect(w.x, w.y, box.x, box.y, box.w, box.h));
      if (hit && this.choiceResolve) {
        const go = this.choiceResolve;
        this.choiceResolve = null;
        this.clearChoices();
        this.mode = 'play';
        go(hit.index);
      }
      return;
    }
    if (this.mode === 'speech') {
      if (!this.advance) return;
      this.save.learnedTap = true;
      const go = this.advance;
      this.advance = null;
      go();
      return;
    }
    if (this.busyScript) return;
    if (this.hitRect(w.x, w.y, 748, 640, 90, 64)) {
      this.onReset();
      return;
    }
    if (this.hitRect(w.x, w.y, 1000, 640, 256, 64)) {
      void this.guard(() => this.say('edith', hintFor(this.save)));
      return;
    }
    if (this.hitRect(w.x, w.y, 848, 640, 140, 64)) {
      this.lookMode = !this.lookMode;
      this.selected = null;
      this.redrawHud();
      return;
    }
    if (dragged) {
      const slot = this.hitSlot(w.x, w.y);
      const spot = this.hitSpot(w.x, w.y);
      void this.guard(async () => {
        if (slot !== null) {
          const other = this.save.items[slot];
          if (other && other !== dragged) await combine(dragged, other, this.ctx);
          return;
        }
        if (spot) {
          const ok = await this.walkTo(spot.walkX, spot.walkY);
          if (!ok) return;
          this.face = spot.face;
          await useItemOn(dragged, spot, this.ctx);
          return;
        }
        await this.say('detective', 'You think better of setting it down.');
      });
      return;
    }
    const slot = this.hitSlot(w.x, w.y);
    if (this.downSlot !== null && slot === this.downSlot && this.moved < 12) {
      const id = this.save.items[slot];
      if (!id) return;
      if (this.selected && this.selected !== id) {
        const first = this.selected;
        this.selected = null;
        void this.guard(() => combine(first, id, this.ctx));
        return;
      }
      this.selected = this.selected === id ? null : id;
      this.lookMode = false;
      this.redrawHud();
      return;
    }
    if (w.y >= HUD_TOP) return;
    const spot = this.hitSpot(w.x, w.y);
    if (spot) {
      void this.onSpot(spot);
      return;
    }
    void this.guard(() => this.walkTo(w.x, w.y).then(() => undefined));
  }

  private onReset(): void {
    if (!this.resetArm) {
      this.resetArm = true;
      this.time.delayedCall(3500, () => {
        this.resetArm = false;
        this.redrawHud();
      });
      this.redrawHud();
      return;
    }
    clearSave();
    window.location.reload();
  }

  private async onSpot(spot: Spot): Promise<void> {
    const look = this.lookMode;
    const item = this.selected;
    this.lookMode = false;
    this.selected = null;
    this.redrawHud();
    await this.guard(async () => {
      const ok = await this.walkTo(spot.walkX, spot.walkY);
      if (!ok) return;
      this.face = spot.face;
      if (look) {
        this.ctx.pose('look');
        await this.say('detective', spot.look);
        return;
      }
      if (item) {
        await useItemOn(item, spot, this.ctx);
        return;
      }
      await perform(spot, this.ctx);
    });
  }

  private async doLook(spot: Spot): Promise<void> {
    this.lookMode = false;
    await this.guard(async () => {
      this.ctx.pose('look');
      await this.say('detective', spot.look);
    });
  }

  private async guard(work: () => Promise<void>): Promise<void> {
    if (this.busyScript || this.mode === 'fade') return;
    this.busyScript = true;
    try {
      await work();
    } catch (err) {
      console.error(err);
    } finally {
      this.finishScript();
    }
  }

  private persist(): void {
    this.save.x = this.fx;
    this.save.y = this.fy;
    this.save.face = this.face;
    writeSave(this.save);
  }

  private publish(): void {
    const choices = this.choiceHits.map((box) => ({
      label: (this.choiceObjs.find((obj) => obj instanceof Phaser.GameObjects.Text && Math.abs((obj as Phaser.GameObjects.Text).y - (box.y + box.h / 2)) < 2) as Phaser.GameObjects.Text | undefined)?.text ?? '',
      x: box.x + box.w / 2,
      y: box.y + box.h / 2,
    }));
    const choiceLabels = this.choiceObjs.filter((obj): obj is Phaser.GameObjects.Text => obj instanceof Phaser.GameObjects.Text);
    window.__hollow = {
      room: this.save.room,
      mode: this.mode,
      speech: this.line,
      choices: this.choiceHits.map((box, index) => ({
        label: choiceLabels[index]?.text ?? choices[index]?.label ?? '',
        x: box.x + box.w / 2,
        y: box.y + box.h / 2,
      })),
      spots: this.spots.map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y })),
      items: this.save.items.map((id, index) => ({ id, ...this.slotCenter(index) })),
      player: { x: this.fx, y: this.fy },
      flags: { ...this.save.flags },
      moving: this.walking,
      busy: this.busyScript || this.mode !== 'play',
      dark: this.save.room === 'stock' && this.save.flags.lanternLit !== true,
      envelope: this.save.flags.seenEnding === true,
    };
  }

  }

function verbLine(verb: Verb, name: string): string {
  switch (verb) {
    case 'look':
    case 'dark':
      return `Look at ${name}`;
    case 'edith':
    case 'june':
    case 'ambrose':
      return `Talk to ${name}`;
    case 'pencil':
    case 'matches':
    case 'book':
    case 'ledger':
      return `Pick up ${name}`;
    case 'stock':
      return `Open ${name}`;
    case 'shelf':
      return `Use ${name}`;
    case 'exit':
      return `Walk to ${name}`;
    default:
      return name;
  }
}
