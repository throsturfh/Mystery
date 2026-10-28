import Phaser from 'phaser';
import { audio } from '../audio';
import { H, W } from '../config';
import { ENTRY } from '../story';
import { loadSave, writeSave, type RoomId } from '../save';
import { idleKey, paintHero, walkKey } from '../tint';

const FONT = 'Cormorant Garamond, Georgia, serif';

type Dest = 'shop' | 'lantern';

/** A short walk along the same street the map just showed. */
export class StreetScene extends Phaser.Scene {
  private dest: Dest = 'shop';
  private hero!: Phaser.GameObjects.Image;
  private x = 200;
  private frame = 0;
  private stride = 0;
  private goal = 760;
  private done = false;
  private leaving = false;

  constructor() {
    super('street');
  }

  init(data: { dest?: Dest }): void {
    this.dest = data.dest === 'lantern' ? 'lantern' : 'shop';
    this.done = false;
    this.leaving = false;
    this.frame = 0;
    this.stride = 0;
    this.x = 180;
  }

  create(): void {
    window.__screen = 'street';
    audio.ambient('street');
    const save = loadSave();
    paintHero(this, {
      name: save.name,
      detective: save.detective,
      coat: save.coat,
      hat: save.hat,
      scarf: save.scarf,
      tone: save.tone,
    });
    this.add.image(0, 0, 'street').setOrigin(0, 0).setDisplaySize(W, H);
    this.x = 180;
    this.goal = this.dest === 'lantern' ? 1040 : 620;
    const profile = { name: save.name, detective: save.detective, coat: save.coat, hat: save.hat, scarf: save.scarf, tone: save.tone };
    this.hero = this.add.image(this.x, 640, idleKey(profile)).setOrigin(0.5, 1).setScale(0.28);
    if (save.detective === 'sara' && this.textures.exists('skuggi')) {
      this.add.image(this.x - 70, 648, 'skuggi').setOrigin(0.5, 1).setScale(0.28).setName('skuggi');
    }
    this.events.once('shutdown', () => {
      this.leaving = true;
      this.time.removeAllEvents();
      this.tweens.killAll();
    });
    this.add.text(W / 2, 36, this.dest === 'lantern' ? 'On toward Lantern Lane' : 'Along the street to the bookshop', {
      fontFamily: FONT,
      fontStyle: 'italic',
      fontSize: '26px',
      color: '#f6edd6',
      stroke: '#140e0a',
      strokeThickness: 5,
    }).setOrigin(0.5).setResolution(2);
  }

  update(_time: number, delta: number): void {
    if (this.leaving || !this.scene.isActive() || !this.hero?.active) return;
    const save = loadSave();
    const profile = { name: save.name, detective: save.detective, coat: save.coat, hat: save.hat, scarf: save.scarf, tone: save.tone };
    const dt = Math.min(0.05, delta / 1000);
    const step = 140 * dt;
    if (this.x < this.goal) {
      this.x = Math.min(this.goal, this.x + step);
      this.stride += step;
      if (this.stride > 14) {
        this.stride = 0;
        this.frame = (this.frame + 1) % 6;
        if (this.frame % 3 === 0) audio.play('foot');
      }
      const key = walkKey(profile, this.frame);
      if (this.hero.texture.key !== key) this.hero.setTexture(key);
    } else {
      const key = idleKey(profile);
      if (this.hero.texture.key !== key) this.hero.setTexture(key);
      this.hero.setPosition(this.x, 600).setScale(0.24);
      this.arrive();
      return;
    }
    const t = (this.x - 180) / Math.max(1, this.goal - 180);
    const y = 640 - t * (this.dest === 'lantern' ? 70 : 40);
    const sc = 0.32 - t * 0.08;
    this.hero.setPosition(this.x, y).setScale(sc).setFlipX(false);
    const dog = this.children.getByName('skuggi') as Phaser.GameObjects.Image | null;
    if (dog?.active) dog.setPosition(this.x - 78, y + 8).setScale(sc * 0.9);
  }

  private arrive(): void {
    if (this.done || this.leaving) return;
    this.done = true;
    if (this.dest === 'lantern') {
      this.add.text(W / 2, 92, 'No. 9 is still sealed. The envelope can wait.', {
        fontFamily: FONT,
        fontStyle: 'italic',
        fontSize: '24px',
        color: '#f6edd6',
        stroke: '#140e0a',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(20).setResolution(2);
      this.time.delayedCall(1400, () => this.leave('map'));
      return;
    }
    const save = loadSave();
    const room: RoomId = 'shop';
    const spawn = ENTRY.shop.door;
    save.room = room;
    save.entry = 'door';
    save.x = spawn?.x ?? 280;
    save.y = spawn?.y ?? 575;
    save.face = spawn?.face ?? 1;
    writeSave(save);
    this.time.delayedCall(40, () => this.leave('adventure'));
  }

  private leave(next: string): void {
    if (this.leaving || !this.scene.isActive()) return;
    this.leaving = true;
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.scene.start(next);
  }
}
