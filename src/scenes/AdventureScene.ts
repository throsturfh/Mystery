import Phaser from 'phaser';
import { audio, type SfxName } from '../audio';
import { HUD_TOP, SHOW_SPOTS, SPEAKER_COLOR, SPEAKER_NAME, W } from '../config';
import { hideCreatorField } from '../creatorDom';
import { closestPoint, hitEllipse } from '../geom';
import { lookLine } from '../quips';
import type { Profile } from '../profile';
import { clearSave, ITEM_NAME, journalEntries, loadSave, starsFor, writeSave, type ItemId, type RoomId, type Save, type Speaker } from '../save';
import { buzz, loadSettings } from '../settings';
import {
  combine,
  ENTRY,
  ghostShouldShow,
  hintFor,
  onEnter,
  perform,
  spotsFor,
  useItemOn,
  walkFor,
  type Ctx,
  type Spot,
  type Verb,
} from '../story';
import { detectiveById } from '../detectives';
import { EDMUND, clipFor, edmundDemo, edmundPixels, readEdmundSet, writeEdmundSet, type EdmundFacing, type EdmundSet } from '../edmundTest';
import { figurePixels, opaqueHeight, strideCount } from '../figure';
import { idleKey, paintHero, walkKey } from '../tint';
import { aside } from '../voices';

type Mode = 'play' | 'speech' | 'choice' | 'fade' | 'card' | 'journal' | 'menu' | 'confirm';

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
  private pose: 'none' | 'look' | 'pick' | 'give' | 'receive' | 'write' | 'shelf' | 'talk' = 'none';
  private poseUntil = 0;
  private poseFrom = 0;
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
  private plaque!: Phaser.GameObjects.Text;
  private lane!: Phaser.GameObjects.Text;
  private envelope?: Phaser.GameObjects.Image;
  private cursorIcon!: Phaser.GameObjects.Image;
  private line: string | null = null;
  private ctx!: Ctx;
  private scenery: { img: Phaser.GameObjects.Image; show: () => boolean }[] = [];
  private june?: Phaser.GameObjects.Image;
  private dog?: Phaser.GameObjects.Image;
  private spiritLabel!: Phaser.GameObjects.Text;
  private stride = 0;
  private walkFrame = 0;
  private lookCounts = new Map<string, number>();
  private fog!: Phaser.GameObjects.Graphics;
  private motes: { x: number; y: number; vx: number; a: number; r: number }[] = [];
  private tag!: Phaser.GameObjects.Text;
  private savedText!: Phaser.GameObjects.Text;
  private cardResolve: (() => void) | null = null;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private departing = false;
  private edmundSet: EdmundSet = 'a';
  private edmundFacing: EdmundFacing = 'side';
  private edmundSpan = 0;
  private edmundSole: number = EDMUND.pivotY;
  private takeFrom = 0;
  private takeUntil = 0;
  private weight?: Phaser.GameObjects.Image;
  private officeFx!: Phaser.GameObjects.Graphics;
  private testLabelA!: Phaser.GameObjects.Text;
  private testLabelB!: Phaser.GameObjects.Text;

  constructor() {
    super('adventure');
  }

  create(): void {
    hideCreatorField();
    this.slotImgs = [];
    this.props = [];
    this.scenery = [];
    this.speechObjs = [];
    this.choiceObjs = [];
    this.choiceHits = [];
    this.overlay = [];
    this.motes = [];
    this.spots = [];
    this.june = undefined;
    this.dog = undefined;
    this.ghost = undefined;
    this.envelope = undefined;
    this.selected = null;
    this.departing = false;
    this.lookMode = false;
    this.walking = false;
    this.goal = null;
    this.save = loadSave();
    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
    if (params.has('demo') || params.has('still')) {
      this.save.detective = 'crowe';
      this.save.room = 'office';
      this.save.coat = 'tan';
      this.save.hat = 'brown';
      this.save.scarf = 'plaid';
      this.save.x = params.has('still') ? 320 : 340;
      this.save.y = params.has('still') ? 512 : 545;
      this.save.face = params.has('still') ? -1 : 1;
    }
    this.edmundSet = readEdmundSet();
    this.fx = this.save.x;
    this.fy = this.save.y;
    this.face = this.save.face;
    paintHero(this, this.profile());
    audio.ambient(this.save.room);
    this.ctx = this.makeCtx();
    this.shadow = this.add.ellipse(0, 0, 86, 18, 0x000000, 0.35).setDepth(90);
    this.hero = this.add.image(0, 0, 'hero').setOrigin(0.5, 1).setDepth(700);
    this.officeFx = this.add.graphics().setDepth(20);
    this.testLabelA = this.add.text(470, 14, 'Test A', {
      fontFamily: DISPLAY,
      fontSize: '16px',
      color: '#f6edd6',
      stroke: '#140e0a',
      strokeThickness: 3,
    }).setDepth(2400).setResolution(2);
    this.testLabelB = this.add.text(590, 14, 'Test B', {
      fontFamily: DISPLAY,
      fontSize: '16px',
      color: '#f6edd6',
      stroke: '#140e0a',
      strokeThickness: 3,
    }).setDepth(2400).setResolution(2);
    this.refreshTestLabels();
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
    this.dragIcon = this.add.image(0, 0, 'icon-lantern').setDepth(2300).setVisible(false).setDisplaySize(42, 42);
    this.cursorIcon = this.add.image(0, 0, 'icon-lantern').setDepth(2350).setVisible(false).setDisplaySize(40, 40);
    this.fog = this.add.graphics().setDepth(460);
    for (let i = 0; i < 10; i++) {
      this.motes.push({ x: Math.random() * 1400 - 60, y: 548 + Math.random() * 62, vx: 10 + Math.random() * 16, a: 0.05 + Math.random() * 0.06, r: 28 + Math.random() * 36 });
    }
    this.tag = this.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#f6edd6',
      stroke: '#140e0a',
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(1900).setVisible(false).setResolution(2);
    this.savedText = this.add.text(640, 22, '', {
      fontFamily: DISPLAY,
      fontSize: '16px',
      color: '#c6a15a',
    }).setOrigin(0.5).setDepth(2300).setAlpha(0).setResolution(2);
    this.add.text(28, 18, 'Menu', {
      fontFamily: DISPLAY,
      fontSize: '18px',
      color: '#f6edd6',
      stroke: '#140e0a',
      strokeThickness: 4,
    }).setDepth(2300).setResolution(2);
    this.spiritLabel = this.add.text(1140, 26, '', {
      fontFamily: DISPLAY,
      fontSize: '16px',
      color: '#d7efe4',
      stroke: '#140e0a',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2300).setResolution(2);
    this.add.text(110, 18, 'Journal', {
      fontFamily: DISPLAY,
      fontSize: '18px',
      color: '#f6edd6',
      stroke: '#140e0a',
      strokeThickness: 4,
    }).setDepth(2300).setResolution(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.mouse?.disableContextMenu();
    const onHide = () => this.persist();
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => {
      this.departing = true;
      window.removeEventListener('pagehide', onHide);
      this.tweens.killAll();
      this.time.removeAllEvents();
      this.input.off('pointerdown');
      this.input.off('pointermove');
      this.input.off('pointerup');
      this.cameras.main?.resetFX();
      this.dog = undefined;
    });
    document.getElementById('loading')?.remove();
    this.drawRoom();
    this.place(this.fx, this.fy, this.face);
    this.drawHero(0);
    this.persist();
    void this.runEnter();
  }

  update(_time: number, delta: number): void {
    if (this.departing || !this.scene.isActive() || !this.hero?.active) return;
    const dt = Math.min(0.05, delta / 1000);
    if (this.walking && this.goal && this.isEdmund()) {
      this.stepEdmund(dt);
    } else if (this.walking && this.goal) {
      const dx = this.goal.x - this.fx;
      const dy = this.goal.y - this.fy;
      const dist = Math.hypot(dx, dy);
      const step = 240 * dt;
      if (dist <= step) {
        const face = Math.abs(dx) > 2 ? (dx < 0 ? -1 : 1) : this.face;
        this.place(this.goal.x, this.goal.y, face);
        this.walking = false;
        this.goal = null;
        const done = this.walkResolve;
        this.walkResolve = null;
        done?.(true);
      } else {
        this.stride += step;
        const per = 16;
        while (this.stride >= per) {
          this.stride -= per;
          this.walkFrame = (this.walkFrame + 1) % strideCount(this.save.detective);
          if (this.walkFrame % 3 === 0) audio.play('foot');
        }
        this.place(this.fx + (dx / dist) * step, this.fy + (dy / dist) * step, dx < 0 ? -1 : 1);
      }
    }
    this.drawFog(dt);
    this.drawOfficeLife();
    this.drawHero(dt);
    this.drawDog();
    const talking = this.mode === 'speech' || this.mode === 'choice' || this.mode === 'card' || this.mode === 'menu' || this.mode === 'confirm';
    this.plaque.setVisible(this.save.room === 'office' && this.save.flags.seenEnding === true && !talking);
    this.lane.setVisible(this.save.room === 'office' && this.save.flags.seenEnding === true && !talking);
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
        this.poseFrom = this.time.now;
        const hold = kind === 'write' ? 980 : kind === 'pick' || kind === 'shelf' ? 640 : 520;
        this.poseUntil = this.time.now + hold;
        if (this.isEdmund() && (kind === 'pick' || kind === 'receive')) this.beginTake();
      },
      refresh: () => this.refresh(),
      showGhost: (on) => this.showGhost(on),
      revealRoom: () => this.drawRoom(),
      wait: (ms) => new Promise((res) => this.time.delayedCall(ms, res)),
      profile: () => this.profile(),
      tone: () => this.save.tone,
      quip: (id, fallback) => {
        if (this.save.flags.ledgerWritten && (id === 'pencil' || id === 'ledger')) return fallback;
        const times = this.lookCounts.get(id) ?? 0;
        this.lookCounts.set(id, times + 1);
        return lookLine(id, fallback, times, this.save.tone, this.save.detective);
      },
      sfx: (name, pan) => {
        audio.play(name as SfxName, pan ?? 0);
        if (name === 'fail') buzz(28);
        if (name === 'ok') buzz([12, 18, 12]);
      },
      face: (who) => this.faceNpc(who),
      handoff: () => this.handoffKey(),
      openMap: async () => {
        if (this.departing) return;
        this.departing = true;
        this.persist();
        this.tweens.killAll();
        this.time.delayedCall(30, () => {
          if (!this.departing || !this.scene.isActive()) return;
          this.scene.start('map');
        });
      },
      card: () => this.showCard(),
      settleBook: () => this.glideBook(),
    };
  }

  private profile(): Profile {
    return {
      name: this.save.name,
      detective: this.save.detective,
      coat: this.save.coat,
      hat: this.save.hat,
      scarf: this.save.scarf,
      tone: this.save.tone,
    };
  }

  private async runEnter(): Promise<void> {
    if (this.busyScript) {
      this.pendingEnter = true;
      return;
    }
    this.busyScript = true;
    try {
      const recording = typeof location !== 'undefined' && new URLSearchParams(location.search).has('still');
      if (edmundDemo() && this.save.room === 'office' && this.save.detective === 'crowe') await this.runDemo();
      else if (recording) {
        /* Hold the door-scale pose. No case dialogue over the still. */
      } else await onEnter(this.ctx);
    } catch (err) {
      console.error(err);
    } finally {
      this.finishScript();
    }
  }

  private finishScript(): void {
    this.busyScript = false;
    audio.duck(false);
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
    audio.play('door');
    if (room === 'shop') audio.play('bell');
    audio.ambient(room);
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
    hideCreatorField();
    this.killProps();
    this.weight = undefined;
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
    this.placeSpirit();
    this.spots = spotsFor(this.save, room);
    this.refreshTestLabels();
    this.syncGhost();
    this.ensureEndingDressing();
    this.redrawHud();
  }

  private ensureEndingDressing(): void {
    const show = this.save.room === 'office' && this.save.flags.seenEnding === true;
    this.plaque.setVisible(show);
    this.lane.setVisible(show);
    if (show && !this.envelope) {
      this.envelope = this.add.image(1048, 392, 'prop-letter').setDepth(30).setScale(0.4);
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
    const pos = this.save.room === 'shop' ? { x: 180, y: 590 } : { x: 760, y: 590 };
    if (!this.ghost || !this.ghost.active) {
      this.ghost = this.add.image(pos.x, pos.y, 'ambrose').setOrigin(0.5, 1).setAlpha(0).setDepth(420);
      this.fit(this.ghost, pos.y, 0.9);
      this.tweens.add({ targets: this.ghost, alpha: 0.92, duration: 700 });
    }
    this.ghost.setPosition(pos.x, pos.y).setVisible(true).setDepth(420);
    this.ghostBaseY = pos.y;
  }

  private showGhost(on: boolean): void {
    this.forceGhost = on;
    if (on) {
      const x = this.save.room === 'shop' ? 180 : 760;
      const pan = (x - 640) / 640;
      audio.play('ghost', pan);
      audio.play('whisper', pan);
      if (this.save.detective === 'sara') audio.play('bark', pan);
      buzz([24, 30, 24]);
      this.ghostBurst(x, 590);
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
    this.dog = undefined;
  }

  private placeDog(): void {
    if (this.save.detective !== 'sara' || !this.textures.exists('skuggi')) return;
    this.dog = this.add.image(this.fx - 96, this.fy + 6, 'skuggi').setOrigin(0.5, 1).setDepth(500 + this.fy);
    this.fit(this.dog, this.fy, 0.42);
    this.props.push(this.dog);
  }

  private dogFrame = 0;
  private dogStride = 0;

  private drawDog(): void {
    const dog = this.dog;
    if (!dog?.active) return;
    const goalX = this.fx - this.face * 78;
    const goalY = this.fy + 2;
    const step = Math.hypot(goalX - dog.x, goalY - dog.y);
    dog.x += (goalX - dog.x) * 0.08;
    dog.y += (goalY - dog.y) * 0.12;
    dog.setFlipX(dog.x > this.fx);
    dog.setDepth(490 + dog.y);
    if (step > 8) {
      this.dogStride += step;
      if (this.dogStride > 14) {
        this.dogStride = 0;
        this.dogFrame = (this.dogFrame + 1) % 8;
        const key = `skuggi-walk-${this.dogFrame}`;
        if (this.textures.exists(key)) dog.setTexture(key);
      }
    } else if (dog.texture.key !== 'skuggi') {
      dog.setTexture('skuggi');
    }
    this.fit(dog, dog.y, 0.42);
    dog.setAngle(step > 8 ? Math.sin(this.time.now / 180) * 1.4 : 0);
  }

  private glideBook(): Promise<void> {
    const seat = { x: 498, y: 198, scale: 0.62 };
    return new Promise((resolve) => {
      const book = this.add.image(this.fx + this.face * 28, this.fy - 150, 'shelf-green').setOrigin(0.5, 1).setDepth(1300).setScale(1.05);
      this.tweens.add({
        targets: book,
        x: seat.x,
        y: seat.y,
        scale: seat.scale,
        duration: 880,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          book.destroy();
          resolve();
        },
      });
    });
  }

  private dogName(): string {
    return detectiveById('sara').dog ?? 'Skuggi';
  }

  private async onDog(): Promise<void> {
    const fetchable = this.fetchable();
    await this.guard(async () => {
      const line = aside(this.save.detective, 'dog', this.save.tone);
      if (!fetchable) {
        audio.play('bark');
        await this.say('detective', line || `${this.dogName()} wags. The room, for once, is keeping its secrets in their places.`);
        return;
      }
      audio.play('bark');
      await this.say('detective', `${this.dogName()}'s ears come up. He would like a job.`);
      const dog = this.dog;
      if (dog?.active) {
        await new Promise<void>((resolve) => {
          this.tweens.add({
            targets: dog,
            x: fetchable.x,
            y: fetchable.y,
            duration: 420,
            yoyo: true,
            onComplete: () => resolve(),
          });
        });
      }
      if (!this.save.items.includes(fetchable.item)) this.save.items.push(fetchable.item);
      audio.play('pickup');
      this.refresh();
      await this.say('detective', `${this.dogName()} brings you the ${ITEM_NAME[fetchable.item].toLowerCase()}, extremely proud of the procedure.`);
    });
  }

  private fetchable(): { item: ItemId; x: number; y: number } | null {
    const has = (id: ItemId) => this.save.items.includes(id);
    const f = this.save.flags;
    if (this.save.room === 'shop' && !has('pencil') && !f.ledgerWritten) return { item: 'pencil', x: 972, y: 372 };
    if (this.save.room === 'nook' && !has('matches') && !f.lanternLit) return { item: 'matches', x: 186, y: 448 };
    if (this.save.room === 'nook' && !has('book') && !f.bookShelved) return { item: 'book', x: 430, y: 342 };
    if (this.save.room === 'stock' && f.lanternLit && !has('ledger') && !f.ledgerWritten) return { item: 'ledger', x: 1048, y: 458 };
    return null;
  }

  private placeTrophies(): void {
    if (this.save.room !== 'trophy') return;
    const f = this.save.flags;
    if (f.gotKey) this.addScenery('icon-key', 512, 378, 0.5, 1, 40, () => true, 0.32);
    if (f.bookShelved) this.addScenery('prop-book', 778, 428, 0.5, 1, 40, () => true, 0.11);
    if (f.seenEnding) this.addScenery('trophy-medal', 824, 368, 0.5, 1, 40, () => true, 0.2);
  }

  private placeSpirit(): void {
    if (!this.save.spirit) return;
    const veil = this.add.graphics().setDepth(55);
    veil.fillStyle(0x12302c, 0.28);
    veil.fillRect(0, 0, 1280, HUD_TOP);
    veil.fillStyle(0x07110f, 0.45);
    veil.fillRect(0, 0, 1280, 70);
    veil.fillRect(0, HUD_TOP - 80, 1280, 80);
    veil.fillRect(0, 0, 80, HUD_TOP);
    veil.fillRect(1200, 0, 80, HUD_TOP);
    const marks = this.add.graphics().setDepth(8);
    marks.fillStyle(0xb7e6d4, 0.35);
    const steps = this.save.room === 'office' ? [260, 420, 580] : this.save.room === 'shop' ? [300, 460, 620] : [340, 520, 700];
    for (const x of steps) {
      marks.fillEllipse(x, 568, 22, 8);
      marks.fillEllipse(x + 26, 576, 18, 7);
    }
    this.props.push(veil, marks);
  }

  private ghostBurst(x: number, y: number): void {
    const settings = loadSettings();
    if (!settings.reduceEffects) {
      this.cameras.main.shake(160, 0.0035);
      const flash = this.add.rectangle(640, 320, 1280, 640, 0xd7fff2, 0.16).setDepth(460);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 220,
        yoyo: true,
        repeat: 2,
        onComplete: () => flash.destroy(),
      });
    }
    for (let i = 0; i < 5; i++) {
      const wisp = this.add.circle(x + (i - 2) * 18, y - 120, 5 + i, 0xd9fff4, 0.35).setDepth(430);
      this.tweens.add({
        targets: wisp,
        y: y - 200 - i * 8,
        alpha: 0,
        duration: 700,
        onComplete: () => wisp.destroy(),
      });
    }
  }

  private async faceNpc(who: 'edith' | 'june' | 'ambrose'): Promise<void> {
    const layout = this.npcLayout(who);
    if (!layout) return;
    const heroHalf = 104;
    const minDist = layout.half + heroHalf + 20;
    const poly = walkFor(this.save.room);
    const options = layout.spots
      .map((spot) => closestPoint(spot, poly))
      .filter((point) => Math.abs(point.x - layout.x) >= minDist - 8);
    const ranked = (options.length > 0 ? options : layout.spots.map((spot) => closestPoint(spot, poly))).sort(
      (a, b) => Math.hypot(a.x - this.fx, a.y - this.fy) - Math.hypot(b.x - this.fx, b.y - this.fy),
    );
    const dest = ranked[0] ?? closestPoint({ x: layout.x - minDist, y: layout.y }, poly);
    const ok = await this.walkTo(dest.x, dest.y);
    if (!ok) return;
    this.face = layout.x >= this.fx ? 1 : -1;
    this.turnNpc(who, this.fx < layout.x);
  }

  private npcLayout(who: 'edith' | 'june' | 'ambrose'): { x: number; y: number; half: number; spots: { x: number; y: number }[] } | null {
    if (who === 'june') return { x: 620, y: 585, half: 160, spots: [{ x: 250, y: 586 }, { x: 990, y: 586 }] };
    if (who === 'edith') return { x: 1040, y: 568, half: 50, spots: [{ x: 760, y: 576 }, { x: 1120, y: 570 }] };
    const shop = this.save.room === 'shop';
    return {
      x: shop ? 180 : 760,
      y: 590,
      half: shop ? 100 : 140,
      spots: shop ? [{ x: 420, y: 578 }] : [{ x: 470, y: 576 }, { x: 1040, y: 574 }],
    };
  }

  private turnNpc(who: 'edith' | 'june' | 'ambrose', lookLeft: boolean): void {
    if (who === 'june' && this.june?.active) this.june.setFlipX(lookLeft);
    if (who === 'ambrose' && this.ghost?.active) this.ghost.setFlipX(lookLeft);
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
    if (room === 'office') {
      this.weight = this.add.image(210, 458, 'prop-weight').setDepth(48);
      this.props.push(this.weight);
    }
    if (room === 'shop') {
      this.addScenery('shelf-green', 498, 198, 0.5, 1, 16, () => f.bookShelved === true, 0.62);
      this.addScenery('prop-pencil', 972, 372, 0.45, 0.82, 16, () => !has('pencil'), 0.28);
      this.june = this.add.image(620, 585, this.save.flags.gotKey ? 'june-nokeys' : 'june').setOrigin(0.5, 1).setDepth(500 + 585);
      this.fit(this.june, 585, 0.92);
      this.props.push(this.june);
    }
    this.placeDog();
    if (room === 'trophy') this.placeTrophies();
    if (room === 'nook') {
      this.addScenery('prop-matches', 186, 448, 0.5, 0.85, 16, () => !has('matches') && f.lanternLit !== true, 0.26);
      this.addScenery('prop-book', 430, 342, 0.5, 1, 16, () => !has('book') && f.bookShelved !== true, 0.22);
    }
    if (room === 'stock' && f.lanternLit === true) {
      this.addScenery('prop-ledger', 1048, 458, 0.5, 0.86, 16, () => !has('ledger') && f.ledgerWritten !== true, 0.28);
      this.addScenery('prop-ledger-written', 1048, 458, 0.5, 0.86, 16, () => f.ledgerWritten === true, 0.34);
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

  private fit(image: Phaser.GameObjects.Image, y: number, portion = 1): void {
    const source = image.texture.getSourceImage() as CanvasImageSource;
    const height = opaqueHeight(source, image.texture.key);
    const room = this.save?.room ?? 'office';
    const target = image === this.hero && this.isEdmund() ? edmundPixels(y, room, figurePixels(y)) : figurePixels(y);
    image.setScale((target * portion) / height);
  }

  private gesture(now: number): { angle: number; y: number } {
    if (now >= this.poseUntil || this.pose === 'none') return { angle: 0, y: 0 };
    const span = Math.max(1, this.poseUntil - this.poseFrom);
    const t = (now - this.poseFrom) / span;
    const env = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    const lean = this.face < 0 ? -1 : 1;
    if (this.pose === 'look') return { angle: -7 * env * lean, y: -2 * env };
    if (this.pose === 'pick') return { angle: 9 * env * lean, y: 5 * env };
    if (this.pose === 'shelf') return { angle: -11 * env * lean, y: -4 * env };
    if (this.pose === 'give') return { angle: -8 * env * lean, y: 0 };
    if (this.pose === 'receive') return { angle: 7 * env * lean, y: 2 * env };
    if (this.pose === 'write') return { angle: 5 * Math.sin(t * Math.PI * 3) * lean, y: 3 * env };
    if (this.pose === 'talk') return { angle: Math.sin(t * Math.PI * 4) * 2.2 * lean, y: 0 };
    return { angle: 0, y: 0 };
  }

  private drawHero(_dt: number): void {
    const posing = this.time.now < this.poseUntil;
    if (!posing) this.pose = 'none';
    const taking = this.time.now < this.takeUntil;
    if (this.isEdmund()) {
      this.drawEdmund(taking);
    } else {
      const look = this.profile();
      if (this.walking && !posing) {
        const key = walkKey(look, this.walkFrame);
        if (this.hero.texture.key !== key && this.textures.exists(key)) this.hero.setTexture(key);
      } else {
        const key = idleKey(look);
        if (this.hero.texture.key !== key) this.hero.setTexture(key);
      }
      const breath = this.walking ? 0 : Math.sin(this.time.now / 980) * 1.1;
      const gesture = this.gesture(this.time.now);
      this.hero.setOrigin(0.5, 1);
      this.fit(this.hero, this.fy);
      this.hero.setPosition(this.fx, this.fy + breath + gesture.y);
      this.hero.setFlipX(this.face < 0);
      this.hero.setAngle(gesture.angle);
    }
    this.hero.setAlpha(this.save.room === 'stock' && this.save.flags.lanternLit !== true ? 0.55 : 1);
    this.hero.setDepth(this.save.room === 'stock' && this.save.flags.lanternLit !== true ? 900 : 500 + this.fy);
    this.shadow.setPosition(this.fx, this.fy + 2);
    const shadow = (this.isEdmund() ? edmundPixels(this.fy, this.save.room, figurePixels(this.fy)) : figurePixels(this.fy)) / 245;
    this.shadow.setScale(shadow, shadow * 0.85);
    this.shadow.setAlpha(this.save.room === 'stock' && this.save.flags.lanternLit !== true ? 0.15 : 0.35);
  }

  private drawEdmund(taking: boolean): void {
    const key = `edmund-${this.edmundSet}`;
    let index = EDMUND.idle.start;
    let flip = this.face < 0;
    if (taking) {
      const span = Math.max(1, this.takeUntil - this.takeFrom);
      const frame = Math.min(EDMUND.take.count - 1, Math.floor(((this.time.now - this.takeFrom) / span) * EDMUND.take.count));
      index = EDMUND.take.start + frame;
      if (frame >= EDMUND.take.grasp && this.weight?.active) this.weight.setVisible(false);
    } else if (this.walking) {
      const clip = clipFor(this.edmundFacing);
      index = clip.start + (this.walkFrame % clip.count);
      flip = this.edmundFacing === 'side' && this.face < 0;
    } else {
      const frame = Math.floor((this.time.now / 1000) * EDMUND.idle.fps) % EDMUND.idle.count;
      index = EDMUND.idle.start + frame;
    }
    if (this.hero.texture.key !== key || this.hero.frame.name !== String(index)) this.hero.setTexture(key, index);
    this.spanOfEdmund();
    this.hero.setOrigin(EDMUND.pivotX / EDMUND.cellW, this.edmundSole / EDMUND.cellH);
    const px = edmundPixels(this.fy, this.save.room, figurePixels(this.fy));
    this.hero.setScale(px / this.spanOfEdmund());
    this.hero.setPosition(this.fx, this.fy);
    this.hero.setFlipX(flip);
    this.hero.setAngle(0);
  }

  /** Hat-top to the sole pivot, measured once so every pose shares a scale. */
  private spanOfEdmund(): number {
    if (this.edmundSpan > 0) return this.edmundSpan;
    const tex = this.textures.get(`edmund-${this.edmundSet}`);
    const frame = tex.get(EDMUND.idle.start);
    const image = frame.source.image as CanvasImageSource;
    const canvas = document.createElement('canvas');
    canvas.width = EDMUND.cellW;
    canvas.height = EDMUND.cellH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return EDMUND.pivotY;
    ctx.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, EDMUND.cellW, EDMUND.cellH);
    const data = ctx.getImageData(0, 0, EDMUND.cellW, EDMUND.cellH).data;
    let top = 0;
    let bottom: number = EDMUND.pivotY;
    for (let y = 0; y < EDMUND.cellH; y++) {
      let hit = false;
      for (let x = 0; x < EDMUND.cellW; x += 3) {
        if (data[(y * EDMUND.cellW + x) * 4 + 3] > 24) {
          hit = true;
          break;
        }
      }
      if (hit) {
        top = y;
        break;
      }
    }
    for (let y = EDMUND.cellH - 1; y >= 0; y--) {
      let hit = false;
      for (let x = 0; x < EDMUND.cellW; x += 3) {
        if (data[(y * EDMUND.cellW + x) * 4 + 3] > 24) {
          hit = true;
          break;
        }
      }
      if (hit) {
        bottom = y;
        break;
      }
    }
    this.edmundSole = bottom;
    this.edmundSpan = Math.max(1, bottom - top);
    return this.edmundSpan;
  }

  private isEdmund(): boolean {
    return this.save?.detective === 'crowe' && this.textures.exists(`edmund-${this.edmundSet}`);
  }

  private beginTake(): void {
    this.takeFrom = this.time.now;
    this.takeUntil = this.time.now + (EDMUND.take.count / EDMUND.take.fps) * 1000;
    this.poseUntil = this.takeUntil;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private playTake(): Promise<void> {
    this.walking = false;
    this.goal = null;
    this.beginTake();
    return new Promise((resolve) => {
      this.time.delayedCall(this.takeUntil - this.takeFrom, () => resolve());
    });
  }

  private stepEdmund(dt: number): void {
    if (!this.goal) return;
    const facing = this.edmundAim();
    if (facing !== this.edmundFacing) {
      this.edmundFacing = facing;
      this.walkFrame = 0;
      this.stride = 0;
    }
    const clip = clipFor(facing);
    const dx = this.goal.x - this.fx;
    const dy = this.goal.y - this.fy;
    const dist = Math.hypot(dx, dy);
    const px = edmundPixels(this.fy, this.save.room, figurePixels(this.fy));
    const advance = (EDMUND.stepMeters / clip.perStep) * (px / EDMUND.figureMeters);
    // Depth is shallow, so toward/away camera moves a little slower and the cycle stays readable.
    const speed = Math.max(36, advance * clip.fps * (facing === 'side' ? 1 : 0.62));
    if (dist <= speed * dt) {
      const face = facing === 'side' && Math.abs(dx) > 2 ? (dx < 0 ? -1 : 1) : this.face;
      this.place(this.goal.x, this.goal.y, face);
      this.walking = false;
      this.goal = null;
      this.edmundFacing = 'side';
      const done = this.walkResolve;
      this.walkResolve = null;
      done?.(true);
      return;
    }
    this.stride += speed * dt;
    while (this.stride >= advance) {
      this.stride -= advance;
      this.walkFrame = (this.walkFrame + 1) % clip.count;
      if (this.walkFrame % clip.perStep === 0) audio.play('foot');
    }
    const face: 1 | -1 = facing === 'side' ? (dx < 0 ? -1 : 1) : this.face;
    this.place(this.fx + (dx / dist) * speed * dt, this.fy + (dy / dist) * speed * dt, face);
  }

  private edmundAim(): EdmundFacing {
    if (!this.goal) return 'side';
    const dx = this.goal.x - this.fx;
    const dy = this.goal.y - this.fy;
    if (Math.abs(dy) > Math.abs(dx) * 1.1 && Math.abs(dy) > 10) return dy > 0 ? 'front' : 'back';
    return 'side';
  }

  private drawOfficeLife(): void {
    const g = this.officeFx;
    if (!g) return;
    g.clear();
    if (this.save.room !== 'office') return;
    const t = this.time.now / 1000;
    g.lineStyle(1, 0xc5d6de, 0.45);
    for (let i = 0; i < 16; i++) {
      const x = 262 + ((i * 41 + t * 36) % 190);
      const y = 178 + ((i * 57 + t * 80) % 200);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 2, y + 12);
      g.strokePath();
    }
    const glow = 0.07 + Math.sin(t * 2.1) * 0.018;
    g.fillStyle(0xe6b15a, glow);
    g.fillEllipse(1062, 368, 200, 80);
    const puff = (t * 18) % 46;
    g.fillStyle(0xf2efe6, 0.28 * (1 - puff / 46));
    g.fillCircle(1100, 352 - puff, 3 + puff * 0.08);
    g.fillStyle(0xf2efe6, 0.2 * (1 - ((puff + 20) % 46) / 46));
    g.fillCircle(1106, 352 - ((puff + 20) % 46), 2.5);
  }

  private refreshTestLabels(): void {
    const show = this.isEdmund() && this.save.room === 'office';
    this.testLabelA?.setVisible(show).setColor(this.edmundSet === 'a' ? '#e6c98a' : '#8c7d6c');
    this.testLabelB?.setVisible(show).setColor(this.edmundSet === 'b' ? '#e6c98a' : '#8c7d6c');
  }

  private switchEdmund(set: EdmundSet): void {
    if (set === this.edmundSet) return;
    this.edmundSet = set;
    this.edmundSpan = 0;
    writeEdmundSet(set);
    paintHero(this, this.profile());
    this.refreshTestLabels();
  }

  private async runDemo(): Promise<void> {
    this.place(340, 545, 1);
    await this.wait(300);
    await this.walkTo(1020, 545);
    await this.wait(1600);
    this.place(640, 508, 1);
    await this.walkTo(640, 602);
    await this.walkTo(640, 508);
    await this.walkTo(640, 602);
    await this.walkTo(360, 560);
    this.face = -1;
    await this.playTake();
    await this.wait(700);
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

  private renderSpeech(who: Speaker, text: string, waitTap: boolean): void {
    this.clearSpeech();
    this.tag.setVisible(false);
    this.plaque.setVisible(false);
    this.lane.setVisible(false);
    this.line = text;
    const speaker = who === 'detective' ? this.save.name || 'Detective' : SPEAKER_NAME[who];
    audio.duck(true);
    audio.murmur(who === 'edith' || who === 'june' || (who === 'detective' && (this.save.detective === 'sara' || this.save.detective === 'ondine')));
    audio.blip();
    const live = document.getElementById('live');
    if (live) live.textContent = `${speaker}. ${text}`;
    const panelX = 150;
    const panelW = 820;
    const body = this.add
      .text(panelX + panelW / 2, 96, text, {
        fontFamily: FONT,
        fontSize: '26px',
        color: SPEAKER_COLOR[who],
        align: 'center',
        wordWrap: { width: panelW - 120 },
      })
      .setOrigin(0.5, 0)
      .setDepth(2102)
      .setResolution(2);
    const name = this.add
      .text(panelX + panelW / 2, 62, speaker, {
        fontFamily: DISPLAY,
        fontSize: '16px',
        color: SPEAKER_COLOR[who],
      })
      .setOrigin(0.5, 0)
      .setDepth(2102)
      .setResolution(2);
    const panelH = Math.max(108, body.height + 64);
    const panel = this.add.graphics().setDepth(2100);
    panel.fillStyle(0x140e0a, 0.94);
    panel.fillRoundedRect(panelX, 48, panelW, panelH, 14);
    panel.lineStyle(2, 0xc6a15a, 1);
    panel.strokeRoundedRect(panelX, 48, panelW, panelH, 14);
    this.speechObjs.push(panel, name, body);
    if (who === 'edith') {
      const bust = this.add.image(panelX + 36, 48 + panelH / 2, 'edith-bust').setDisplaySize(44, 52).setDepth(2101);
      this.speechObjs.push(bust);
    }
    if (waitTap && !this.save.learnedTap) {
      const tap = this.add
        .text(panelX + panelW - 36, 48 + panelH - 8, 'tap', {
          fontFamily: DISPLAY,
          fontSize: '14px',
          color: '#c6a15a',
        })
        .setOrigin(1, 1)
        .setDepth(2102);
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
    g.fillStyle(this.save.spirit ? 0x1d4038 : 0x24180f, 0.94);
    g.fillRoundedRect(1024, 8, 230, 36, 8);
    g.lineStyle(2, this.save.spirit ? 0x9fd8c8 : 0xc6a15a, 1);
    g.strokeRoundedRect(1024, 8, 230, 36, 8);
    this.spiritLabel.setText(this.save.spirit ? 'Spirit lantern: on' : 'Spirit lantern');
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
      g.fillRoundedRect(c.x - 34, c.y - 34 - (hot ? 6 : 0), 68, 68, 8);
      g.lineStyle(hot ? 4 : 2, hot ? 0xf0d59a : 0x8a6430, 1);
      g.strokeRoundedRect(c.x - 34, c.y - 34 - (hot ? 6 : 0), 68, 68, 8);
      if (hot) {
        g.lineStyle(2, 0xffe7a8, 0.8);
        g.strokeRoundedRect(c.x - 38, c.y - 44, 76, 76, 10);
      }
    });
    drawBtn(848, 640, 140, 64, this.lookMode);
    drawBtn(1000, 640, 256, 64, false);
    this.layoutSlots();
    this.lookText.setPosition(918, 672).setText('Look');
    this.hintText.setPosition(1128, 672);
    const selectedName = this.selected ? ITEM_NAME[this.selected] : '';
    this.caption.setText(this.lookMode ? 'Next tap looks.' : this.selected ? `Using: ${selectedName}` : 'Tap the floor to walk.');
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
      const key = id === 'lantern' && this.save.flags.lanternLit ? 'icon-lantern-lit' : id === 'book' ? 'icon-greenbook' : `icon-${id}`;
      const lifted = this.selected === id;
      img.setTexture(key).setPosition(c.x, c.y - (lifted ? 8 : 0)).setVisible(true).setDisplaySize(48, 48);
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
      const key = this.dragItem === 'lantern' && this.save.flags.lanternLit ? 'icon-lantern-lit' : this.dragItem === 'book' ? 'icon-greenbook' : `icon-${this.dragItem}`;
      this.dragIcon.setTexture(key).setPosition(w.x, w.y).setVisible(true);
      this.cursorIcon.setVisible(false);
    } else if (this.selected && this.mode === 'play') {
      const key = this.selected === 'lantern' && this.save.flags.lanternLit ? 'icon-lantern-lit' : this.selected === 'book' ? 'icon-greenbook' : `icon-${this.selected}`;
      this.cursorIcon.setTexture(key).setPosition(w.x, w.y - 28).setVisible(true).setDisplaySize(40, 40);
      this.dragIcon.setVisible(false);
    } else {
      this.dragIcon.setVisible(false);
      this.cursorIcon.setVisible(false);
    }
    if (this.mode === 'play' && !this.busyScript) {
      const spot = this.hitSpot(w.x, w.y);
      this.showTag(spot);
      if (this.lookMode) this.caption.setText(spot ? `Look at ${spot.name}` : 'Next tap looks.');
      else if (this.selected) this.caption.setText(spot ? `Use ${ITEM_NAME[this.selected]} on ${spot.name}` : `Using: ${ITEM_NAME[this.selected]}`);
      else if (spot) this.caption.setText(verbLine(spot.verb, spot.name));
      else if (!this.pointerDown) this.caption.setText('Tap the floor to walk.');
    }
  }

  private showTag(spot: Spot | null): void {
    if (this.mode === 'speech' || this.mode === 'choice' || this.mode === 'journal' || this.mode === 'card') {
      this.tag.setVisible(false);
      return;
    }
    if (!spot || spot.y < 36) {
      this.tag.setVisible(false);
      return;
    }
    this.tag.setText(spot.name).setPosition(spot.x, Math.max(28, spot.y - spot.ry - 8)).setVisible(true);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.departing) return;
    this.pointerDown = false;
    this.longCall?.remove(false);
    this.longCall = null;
    const w = this.world(p);
    const dragged = this.dragItem;
    this.dragItem = null;
    this.dragIcon.setVisible(false);
    if (this.longFired) return;
    if (this.mode === 'fade') return;
    if (this.mode === 'card') {
      this.clearOverlay();
      this.mode = 'play';
      const go = this.cardResolve;
      this.cardResolve = null;
      go?.();
      return;
    }
    if (this.mode === 'journal' || this.mode === 'menu') {
      if (this.mode === 'menu') {
        if (this.hitRect(w.x, w.y, 390, 250, 500, 56)) {
          this.clearOverlay();
          this.mode = 'play';
          return;
        }
        if (this.hitRect(w.x, w.y, 390, 322, 500, 56)) {
          this.clearOverlay();
          this.openConfirm();
          return;
        }
        if (this.hitRect(w.x, w.y, 390, 394, 500, 56)) {
          this.clearOverlay();
          this.persist();
          this.departing = true;
          this.scene.start('title');
          return;
        }
      } else {
        this.clearOverlay();
        this.mode = 'play';
      }
      return;
    }
    if (this.mode === 'confirm') {
      if (this.hitRect(w.x, w.y, 390, 340, 230, 56)) {
        clearSave();
        window.location.reload();
      } else if (this.hitRect(w.x, w.y, 640, 340, 230, 56)) {
        this.clearOverlay();
        this.openMenu();
      }
      return;
    }
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
    if (this.hitRect(w.x, w.y, 1024, 8, 230, 36)) {
      this.save.spirit = !this.save.spirit;
      audio.play('lanternToggle');
      buzz(12);
      this.drawRoom();
      this.persist();
      return;
    }
    if (this.isEdmund() && this.save.room === 'office' && this.hitRect(w.x, w.y, 460, 4, 100, 32)) {
      this.switchEdmund('a');
      return;
    }
    if (this.isEdmund() && this.save.room === 'office' && this.hitRect(w.x, w.y, 580, 4, 100, 32)) {
      this.switchEdmund('b');
      return;
    }
    if (w.y < 48 && w.x < 96) {
      this.openMenu();
      return;
    }
    if (w.y < 48 && w.x >= 110 && w.x < 230) {
      this.openJournal();
      return;
    }
    if (this.hitRect(w.x, w.y, 1000, 640, 256, 64)) {
      this.save.hints += 1;
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
          if (spot.verb === 'edith' || spot.verb === 'june' || spot.verb === 'ambrose') await this.faceNpc(spot.verb);
          else {
            const ok = await this.walkTo(spot.walkX, spot.walkY);
            if (!ok) return;
            this.face = spot.face;
          }
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
    if (this.dog?.active && Math.hypot(w.x - this.dog.x, w.y - this.dog.y) < 78 && w.y < HUD_TOP) {
      void this.onDog();
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

  private openMenu(): void {
    this.clearOverlay();
    this.mode = 'menu';
    this.cursorIcon.setVisible(false);
    const g = this.add.graphics().setDepth(2600);
    g.fillStyle(0x140e0a, 0.72);
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0x24180f, 0.96);
    g.fillRoundedRect(360, 160, 560, 340, 16);
    g.lineStyle(3, 0xc6a15a, 1);
    g.strokeRoundedRect(360, 160, 560, 340, 16);
    this.overlay.push(g);
    const title = this.add.text(640, 200, 'Menu', { fontFamily: DISPLAY, fontSize: '36px', color: '#e6c98a' }).setOrigin(0.5).setDepth(2601).setResolution(2);
    this.overlay.push(title, this.menuButton(390, 250, 'Resume'), this.menuButton(390, 322, 'Reset case'), this.menuButton(390, 394, 'Title screen'));
  }

  private openConfirm(): void {
    this.clearOverlay();
    this.mode = 'confirm';
    const g = this.add.graphics().setDepth(2600);
    g.fillStyle(0x140e0a, 0.78);
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0x24180f, 0.98);
    g.fillRoundedRect(340, 200, 600, 240, 16);
    g.lineStyle(3, 0xc6a15a, 1);
    g.strokeRoundedRect(340, 200, 600, 240, 16);
    this.overlay.push(g);
    const title = this.add.text(640, 250, 'Start the case over?', { fontFamily: DISPLAY, fontSize: '32px', color: '#e6c98a' }).setOrigin(0.5).setDepth(2601).setResolution(2);
    const note = this.add.text(640, 300, 'This clears the Bellweather file.', { fontFamily: FONT, fontStyle: 'italic', fontSize: '22px', color: '#f3e6c8' }).setOrigin(0.5).setDepth(2601).setResolution(2);
    this.overlay.push(title, note, this.menuButton(390, 340, 'Reset', 230), this.menuButton(640, 340, 'Cancel', 230));
  }

  private menuButton(x: number, y: number, label: string, w = 500): Phaser.GameObjects.Text {
    const g = this.add.graphics().setDepth(2601);
    g.fillStyle(0x3a2618, 1);
    g.fillRoundedRect(x, y, w, 56, 8);
    g.lineStyle(2, 0xc6a15a, 1);
    g.strokeRoundedRect(x, y, w, 56, 8);
    this.overlay.push(g);
    return this.add.text(x + w / 2, y + 28, label, { fontFamily: DISPLAY, fontSize: '22px', color: '#f6edd6' }).setOrigin(0.5).setDepth(2602).setResolution(2);
  }

  private handoffKey(): Promise<void> {
    return new Promise((resolve) => {
      this.clearSpeech();
      const june = this.june;
      const toward = this.fx < (june?.x ?? 620) ? 1 : -1;
      const chest = june?.active ? june.y - june.displayHeight * 0.46 : 360;
      const from = june?.active ? { x: june.x + toward * 8, y: chest } : { x: 640, y: 380 };
      const offer = june?.active ? { x: june.x + toward * june.displayWidth * 0.55, y: chest - 18 } : { x: 700, y: 360 };
      this.pose = 'receive';
      this.poseFrom = this.time.now;
      this.poseUntil = this.time.now + 1100;
      if (june?.active) {
        this.tweens.add({
          targets: june,
          angle: toward * -6,
          x: june.x + toward * 18,
          duration: 420,
          ease: 'Sine.easeInOut',
          yoyo: true,
        });
      }
      const key = this.add.image(from.x, from.y, 'icon-key').setDepth(1400).setDisplaySize(36, 36);
      const hand = { x: this.fx + this.face * 28, y: this.fy - figurePixels(this.fy) * 0.48 };
      this.tweens.add({
        targets: key,
        x: offer.x,
        y: offer.y,
        duration: 380,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (june?.active) {
            june.setTexture('june-nokeys');
            this.fit(june, june.y, 0.92);
          }
          this.tweens.add({
            targets: key,
            x: hand.x,
            y: hand.y,
            duration: 340,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              const slot = this.slotCenter(this.save.items.length);
              this.tweens.add({
                targets: key,
                x: slot.x,
                y: slot.y,
                displayWidth: 28,
                displayHeight: 28,
                duration: 480,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                  key.destroy();
                  if (!this.save.items.includes('key')) this.save.items.push('key');
                  this.save.flags.gotKey = true;
                  audio.play('pickup');
                  this.redrawHud();
                  resolve();
                },
              });
            },
          });
        },
      });
    });
  }

  private async onSpot(spot: Spot): Promise<void> {
    const look = this.lookMode;
    const item = this.selected;
    this.lookMode = false;
    this.selected = null;
    this.redrawHud();
    await this.guard(async () => {
      if (spot.id === 'paperweight' && !look && !item && this.isEdmund()) {
        const ok = await this.walkTo(spot.walkX, spot.walkY);
        if (!ok) return;
        this.face = -1;
        await this.playTake();
        await this.say('detective', spot.look);
        return;
      }
      if (spot.verb === 'edith' || spot.verb === 'june' || spot.verb === 'ambrose') await this.faceNpc(spot.verb);
      else {
        const ok = await this.walkTo(spot.walkX, spot.walkY);
        if (!ok) return;
        this.face = spot.face;
      }
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
    this.savedText.setText('Saved').setAlpha(1);
    this.tweens.killTweensOf(this.savedText);
    this.tweens.add({ targets: this.savedText, alpha: 0, delay: 700, duration: 500 });
  }

  private openJournal(): void {
    this.clearOverlay();
    this.mode = 'journal';
    const g = this.add.graphics().setDepth(2400);
    g.fillStyle(0x140e0a, 0.94);
    g.fillRoundedRect(180, 70, 920, 500, 16);
    g.lineStyle(3, 0xc6a15a, 1);
    g.strokeRoundedRect(180, 70, 920, 500, 16);
    this.overlay.push(g);
    const title = this.add.text(640, 96, 'Journal', {
      fontFamily: DISPLAY,
      fontSize: '32px',
      color: '#e6c98a',
    }).setOrigin(0.5).setDepth(2401).setResolution(2);
    this.overlay.push(title);
    const notes = journalEntries(this.save).map((entry) => `${entry.title}. ${entry.note}`).join('\n\n');
    const body = this.add.text(220, 150, notes, {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#f6edd6',
      wordWrap: { width: 840 },
    }).setDepth(2401).setResolution(2);
    this.overlay.push(body);
    const close = this.add.text(640, 530, 'Tap to close', {
      fontFamily: DISPLAY,
      fontSize: '18px',
      color: '#c6a15a',
    }).setOrigin(0.5).setDepth(2401).setResolution(2);
    this.overlay.push(close);
  }

  private showCard(): Promise<void> {
    this.clearSpeech();
    this.clearChoices();
    this.clearOverlay();
    this.mode = 'card';
    const stars = starsFor(this.save.hints);
    const g = this.add.graphics().setDepth(2500);
    g.fillStyle(0x070504, 0.78);
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0x24180f, 0.96);
    g.fillRoundedRect(240, 140, 800, 420, 18);
    g.lineStyle(3, 0xc6a15a, 1);
    g.strokeRoundedRect(240, 140, 800, 420, 18);
    this.overlay.push(g);
    const lines = [
      this.add.text(640, 190, 'Case closed', { fontFamily: DISPLAY, fontSize: '42px', color: '#e6c98a' }).setOrigin(0.5).setDepth(2501).setResolution(2),
      this.add.text(640, 260, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, { fontFamily: DISPLAY, fontSize: '36px', color: '#f0d59a' }).setOrigin(0.5).setDepth(2501).setResolution(2),
      this.add.text(640, 320, this.save.hints === 0 ? 'No hints. Edith is almost proud.' : `Hints taken: ${this.save.hints}.`, {
        fontFamily: FONT,
        fontStyle: 'italic',
        fontSize: '24px',
        color: '#f3e6c8',
      }).setOrigin(0.5).setDepth(2501).setResolution(2),
      this.add.text(640, 390, 'To be continued', { fontFamily: DISPLAY, fontSize: '28px', color: '#f6edd6' }).setOrigin(0.5).setDepth(2501).setResolution(2),
      this.add.text(640, 440, 'No. 9 Lantern Lane', { fontFamily: FONT, fontStyle: 'italic', fontSize: '32px', color: '#e6c98a' }).setOrigin(0.5).setDepth(2501).setResolution(2),
      this.add.text(640, 510, 'Tap to close the file', { fontFamily: DISPLAY, fontSize: '16px', color: '#c6a15a' }).setOrigin(0.5).setDepth(2501).setResolution(2),
    ];
    this.overlay.push(...lines);
    return new Promise((resolve) => {
      this.cardResolve = resolve;
    });
  }

  private clearOverlay(): void {
    for (const obj of this.overlay) obj.destroy();
    this.overlay = [];
  }

  private drawFog(dt: number): void {
    const g = this.fog;
    if (!g) return;
    g.clear();
    if (this.save.room === 'office') return;
    const thick = this.save.room === 'stock' ? 0.7 : 0.45;
    for (const mote of this.motes) {
      mote.x += mote.vx * dt;
      if (mote.x > 1360) mote.x = -80;
      mote.y = Math.min(612, Math.max(548, mote.y));
      g.fillStyle(0xc5d0c8, mote.a * thick);
      g.fillEllipse(mote.x, mote.y, mote.r * 4.2, 14);
    }
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
      nameField: document.getElementById('creator-name')?.classList.contains('show') === true,
      spirit: this.save.spirit,
      tone: this.save.tone,
      detective: this.save.detective,
      june: this.june?.active ? { x: this.june.x, y: this.june.y, flip: this.june.flipX } : null,
      dog: this.dog?.active ? { x: this.dog.x, y: this.dog.y } : null,
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
    case 'map':
      return `Walk to ${name}`;
    default:
      return name;
  }
}
