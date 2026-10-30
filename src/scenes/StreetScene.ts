import Phaser from 'phaser';
import { audio } from '../audio';
import { H, W } from '../config';
import { ENTRY } from '../story';
import { loadSave, writeSave, type RoomId } from '../save';
import { EDMUND_SIZE, playEdmundWalk, stopEdmundWalk, edmundSpeed } from '../edmundWalk';
import { figurePixels, opaqueHeight, strideCount } from '../figure';
import { LOTTA_FPS, LOTTA_IDLE_FRAMES, LOTTA_ORIGIN_X, LOTTA_ORIGIN_Y, LOTTA_TROT_FRAMES, lottaIdleKey, lottaScale, lottaStride, lottaTrotKey } from '../lotta';
import { SARA_SIZE, SARA_WALK_KEY, playSaraWalk, saraSpeed, stopSaraWalk } from '../saraWalk';
import { idleKey, paintHero, walkKey } from '../tint';

const FONT = 'Cormorant Garamond, Georgia, serif';

type Dest = 'shop' | 'lantern';

/** A short walk along the same street the map just showed. */
export class StreetScene extends Phaser.Scene {
  private dest: Dest = 'shop';
  private hero!: Phaser.GameObjects.Sprite;
  private x = 200;
  private frame = 0;
  private stride = 0;
  private dogTravel = 0;
  private dogClock = 0;
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
    this.dogTravel = 0;
    this.dogClock = 0;
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
    this.hero = this.add.sprite(this.x, 640, idleKey(profile)).setOrigin(0.5, 1).setScale(0.28);
    this.hero.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (this.done) return;
      const who = loadSave().detective;
      const painted = (who === 'crowe' && anim.key === 'edmund-walk') || (who === 'sara' && anim.key === SARA_WALK_KEY);
      if (painted && (frame.index === 1 || frame.index === 7)) audio.play('foot');
    });
    if (save.detective === 'sara' && this.textures.exists(lottaTrotKey('fwd', 0))) {
      this.add.image(this.x - 170, 648, lottaIdleKey(0)).setOrigin(LOTTA_ORIGIN_X, LOTTA_ORIGIN_Y).setName('lotta');
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
    const crowe = save.detective === 'crowe';
    const sara = save.detective === 'sara';
    const tNow = (this.x - 180) / Math.max(1, this.goal - 180);
    const yNow = 640 - tNow * (this.dest === 'lantern' ? 70 : 40);
    const step = (crowe ? edmundSpeed(yNow) : sara ? saraSpeed(yNow) : 140) * dt;
    let moved = 0;
    if (this.x < this.goal) {
      const before = this.x;
      this.x = Math.min(this.goal, this.x + step);
      moved = this.x - before;
      if (!crowe && !sara) {
        this.stride += step;
        if (this.stride > 14) {
          this.stride = 0;
          this.frame = (this.frame + 1) % strideCount(save.detective);
          if (this.frame % 3 === 0) audio.play('foot');
        }
        const key = walkKey(profile, this.frame);
        if (this.hero.texture.key !== key) this.hero.setTexture(key);
      }
    } else {
      if (crowe) stopEdmundWalk(this.hero);
      if (sara) stopSaraWalk(this.hero);
      const key = idleKey(profile);
      if (this.hero.texture.key !== key) this.hero.setTexture(key);
      this.hero.setPosition(this.x, 600);
      this.fitStreet(this.hero, 600, crowe ? EDMUND_SIZE : sara ? SARA_SIZE : 1);
      const dog = this.children.getByName('lotta') as Phaser.GameObjects.Image | null;
      if (dog?.active) {
        this.dogClock += dt;
        const idle = lottaIdleKey(Math.floor(this.dogClock * LOTTA_FPS) % LOTTA_IDLE_FRAMES);
        if (this.textures.exists(idle) && dog.texture.key !== idle) dog.setTexture(idle);
        dog.setFlipX(false);
        dog.setPosition(this.x - 170, 600).setOrigin(LOTTA_ORIGIN_X, LOTTA_ORIGIN_Y).setScale(lottaScale(600));
      }
      this.arrive();
      return;
    }
    const t = (this.x - 180) / Math.max(1, this.goal - 180);
    const y = 640 - t * (this.dest === 'lantern' ? 70 : 40);
    this.hero.setPosition(this.x, y).setFlipX(false);
    if (crowe) playEdmundWalk(this.hero, y);
    else if (sara) playSaraWalk(this.hero, y);
    else this.fitStreet(this.hero, y);
    const dog = this.children.getByName('lotta') as Phaser.GameObjects.Image | null;
    if (dog?.active) {
      this.dogTravel += moved / Math.max(0.0001, lottaScale(y));
      const frame = Math.floor(this.dogTravel / lottaStride()) % LOTTA_TROT_FRAMES;
      const key = lottaTrotKey('fwd', frame);
      if (this.textures.exists(key) && dog.texture.key !== key) dog.setTexture(key);
      dog.setPosition(this.x - 170, y).setOrigin(LOTTA_ORIGIN_X, LOTTA_ORIGIN_Y).setScale(lottaScale(y));
    }
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

  private fitStreet(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, y: number, portion = 1): void {
    const source = image.texture.getSourceImage() as CanvasImageSource;
    image.setScale((figurePixels(y) * portion) / opaqueHeight(source, image.texture.key));
  }

  private leave(next: string): void {
    if (this.leaving || !this.scene.isActive()) return;
    this.leaving = true;
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.scene.start(next);
  }
}
