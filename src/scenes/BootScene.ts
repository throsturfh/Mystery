import Phaser from 'phaser';
import { AUDIO_FILES, audio } from '../audio';
import { EDMUND_REACH_FPS, EDMUND_REACH_FRAMES, EDMUND_REACH_KEY, reachFingersKey, reachFrameKey } from '../edmundReach';
import { EDMUND_WALK_FPS, EDMUND_WALK_FRAMES, EDMUND_WALK_KEY, edmundFrameKey } from '../edmundWalk';
import {
  GLANCE_POSES,
  LOTTA_IDLE_FRAMES,
  LOTTA_SETTLE_FRAMES,
  LOTTA_STAND_GLANCE_FRAMES,
  LOTTA_TROT_FRAMES,
  lottaIdleKey,
  lottaSettleKey,
  lottaStandKey,
  lottaTrotKey,
  lottaTrotVariants,
} from '../lotta';
import { SARA_REACH_FPS, SARA_REACH_FRAMES, SARA_REACH_KEY, saraReachFingersKey, saraReachFrameKey } from '../saraReach';
import { SARA_WALK_FPS, SARA_WALK_FRAMES, SARA_WALK_KEY, saraFrameKey } from '../saraWalk';
import { stripRestingLantern } from '../restingArm';
import { paintSaraFrames } from '../tint';
import { AdventureScene } from './AdventureScene';
import { MapScene } from './MapScene';
import { StreetScene } from './StreetScene';
import { TitleScene } from './TitleScene';

const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
const CAST = ['sara', 'barty', 'pip', 'ondine'] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image('office', asset('office.jpg'));
    this.load.image('shop', asset('shop.jpg'));
    this.load.image('nook', asset('nook.jpg'));
    this.load.image('stock', asset('stock.jpg'));
    this.load.image('edith', asset('edith.jpg'));
    this.load.image('ambrose', asset('ambrose.png'));
    this.load.image('map', asset('map.jpg'));
    this.load.image('street', asset('street.jpg'));
    this.load.image('trophy', asset('trophy.jpg'));
    this.load.image('june', asset('june.png'));
    this.load.image('june-nokeys', asset('june-nokeys.png'));
    const frames = ['detective', 'walk-0', 'walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5'];
    const coats = ['tan', 'olive', 'charcoal', 'wine'];
    const hats = ['brown', 'black', 'moss', 'plum'];
    const scarves = ['plaid', 'pine', 'gold', 'ink'];
    for (const frame of frames) {
      this.load.image(`L-${frame}-base`, asset(`layers/${frame}-base.png`));
      for (const id of coats) this.load.image(`L-${frame}-coat-${id}`, asset(`layers/${frame}-coat-${id}.png`));
      for (const id of hats) this.load.image(`L-${frame}-hat-${id}`, asset(`layers/${frame}-hat-${id}.png`));
      for (const id of scarves) this.load.image(`L-${frame}-scarf-${id}`, asset(`layers/${frame}-scarf-${id}.png`));
    }
    for (let i = 0; i < LOTTA_IDLE_FRAMES; i++) {
      const name = i.toString().padStart(2, '0');
      this.load.image(lottaIdleKey(i), asset(`lotta/frames/idle/${name}.webp`));
    }
    for (const variant of lottaTrotVariants()) {
      for (let i = 0; i < LOTTA_TROT_FRAMES; i++) {
        const name = i.toString().padStart(2, '0');
        this.load.image(lottaTrotKey(variant, i), asset(`lotta/frames/trot/${variant}/${name}.webp`));
      }
    }
    for (const pose of GLANCE_POSES) {
      for (let i = 0; i < LOTTA_STAND_GLANCE_FRAMES; i++) {
        const name = i.toString().padStart(2, '0');
        this.load.image(lottaStandKey(pose, i), asset(`lotta/frames/glance-stand/${pose}/${name}.webp`));
      }
    }
    for (let from = 0; from < LOTTA_TROT_FRAMES; from++) {
      for (let i = 0; i < LOTTA_SETTLE_FRAMES; i++) {
        const name = from.toString().padStart(2, '0');
        this.load.image(lottaSettleKey(from, i), asset(`lotta/frames/settle/from${name}_${i}.webp`));
      }
    }
    this.loadSaraPainted(coats, hats, scarves);
    for (let i = 0; i < EDMUND_WALK_FRAMES; i++) {
      const name = i.toString().padStart(2, '0');
      this.load.image(edmundFrameKey(i), asset(`edmund-walk/walk-${name}.png`));
    }
    for (let i = 0; i < EDMUND_REACH_FRAMES; i++) {
      const name = i.toString().padStart(2, '0');
      this.load.image(reachFrameKey(i), asset(`edmund-reach/reach-${name}.png`));
      if (i >= 10) this.load.image(reachFingersKey(i), asset(`edmund-reach/reach-${name}-fingers.png`));
    }
    for (const who of CAST) {
      const castFrames = who === 'sara' ? frames : [...frames, 'walk-6', 'walk-7', 'walk-8', 'walk-9'];
      for (const frame of castFrames) {
        this.load.image(`L-${who}-${frame}-base`, asset(`cast/${who}/${frame}-base.png`));
        for (const id of coats) this.load.image(`L-${who}-${frame}-coat-${id}`, asset(`cast/${who}/${frame}-coat-${id}.png`));
        for (const id of hats) this.load.image(`L-${who}-${frame}-hat-${id}`, asset(`cast/${who}/${frame}-hat-${id}.png`));
        for (const id of scarves) this.load.image(`L-${who}-${frame}-scarf-${id}`, asset(`cast/${who}/${frame}-scarf-${id}.png`));
      }
    }
    for (const [key, file] of Object.entries(AUDIO_FILES)) {
      this.load.audio(key, `${import.meta.env.BASE_URL}audio/${file}`);
    }
    for (const icon of ['lantern', 'lantern-lit', 'matches', 'key', 'pencil', 'ledger']) {
      this.load.image(`icon-${icon}`, asset(`icons/icon-${icon}.png`));
    }
    this.load.image('icon-greenbook', asset('icons/icon-greenbook.png'));
    this.load.image('shelf-key', asset('icons/shelf-key.png'));
    this.load.image('shelf-book', asset('icons/shelf-book.png'));
    this.load.image('prop-book', asset('prop-book.png'));
    this.load.image('prop-matches', asset('prop-matches.png'));
    this.load.image('prop-ledger', asset('prop-ledger.png'));
    this.load.image('prop-ledger-written', asset('prop-ledger-written.png'));
    this.load.image('prop-pencil', asset('prop-pencil.png'));
    this.load.image('prop-letter', asset('prop-letter.png'));
    this.load.image('trophy-medal', asset('trophy-medal.png'));
  }

  create(): void {
    this.paintBust();
    this.paintShelfBook();
    this.anims.create({
      key: EDMUND_WALK_KEY,
      frames: Array.from({ length: EDMUND_WALK_FRAMES }, (_, index) => ({ key: edmundFrameKey(index) })),
      frameRate: EDMUND_WALK_FPS,
      repeat: -1,
      skipMissedFrames: false,
    });
    for (let i = 0; i < EDMUND_REACH_FRAMES; i++) this.hideRestingLantern(reachFrameKey(i));
    this.anims.create({
      key: EDMUND_REACH_KEY,
      frames: Array.from({ length: EDMUND_REACH_FRAMES }, (_, index) => ({ key: reachFrameKey(index) })),
      frameRate: EDMUND_REACH_FPS,
      repeat: 0,
      skipMissedFrames: false,
    });
    paintSaraFrames(this, {
      name: 'Sara Kristín',
      detective: 'sara',
      coat: 'tan',
      hat: 'brown',
      scarf: 'plaid',
      tone: 'sarcastic',
    });
    this.anims.create({
      key: SARA_WALK_KEY,
      frames: Array.from({ length: SARA_WALK_FRAMES }, (_, index) => ({ key: saraFrameKey(index) })),
      frameRate: SARA_WALK_FPS,
      repeat: -1,
      skipMissedFrames: false,
    });
    this.anims.create({
      key: SARA_REACH_KEY,
      frames: Array.from({ length: SARA_REACH_FRAMES }, (_, index) => ({ key: saraReachFrameKey(index) })),
      frameRate: SARA_REACH_FPS,
      repeat: 0,
      skipMissedFrames: false,
    });
    audio.bind(this);
    this.scene.start('title');
  }

  /** Edmund's reach is one baked painting per frame. Drop the lantern arm before it is played. */
  private hideRestingLantern(key: string): void {
    const texture = this.textures.get(key);
    if (!texture || texture.key === '__MISSING') return;
    const source = texture.getSourceImage() as HTMLImageElement;
    if (!source?.width || !source.height) return;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(source, 0, 0);
    stripRestingLantern(canvas, 'crowe');
    this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }

  /** Sara's walk and reach colour layers. Stacked later, in the same order as the standing portrait. */
  private loadSaraPainted(coats: string[], hats: string[], scarves: string[]): void {
    const loadSet = (kind: 'walk' | 'reach', count: number) => {
      for (let i = 0; i < count; i++) {
        const frame = `${kind}-${i.toString().padStart(2, '0')}`;
        this.load.image(`L-sara-${frame}-base`, asset(`sara-${kind}/layers/${frame}-base.webp`));
        for (const id of coats) this.load.image(`L-sara-${frame}-coat-${id}`, asset(`sara-${kind}/layers/${frame}-coat-${id}.webp`));
        for (const id of hats) this.load.image(`L-sara-${frame}-hat-${id}`, asset(`sara-${kind}/layers/${frame}-hat-${id}.webp`));
        for (const id of scarves) this.load.image(`L-sara-${frame}-scarf-${id}`, asset(`sara-${kind}/layers/${frame}-scarf-${id}.webp`));
      }
    };
    loadSet('walk', SARA_WALK_FRAMES);
    loadSet('reach', SARA_REACH_FRAMES);
    for (let i = 10; i < SARA_REACH_FRAMES; i++) {
      const name = i.toString().padStart(2, '0');
      this.load.image(saraReachFingersKey(i), asset(`sara-reach/reach-${name}-fingers.webp`));
    }
    this.load.image('sara-reach-key', asset('sara-reach/key.webp'));
  }

  /** A slim upright spine, so the returned book can sit in the shelf gap. */
  private paintShelfBook(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 34;
    canvas.height = 86;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#245038';
    ctx.fillRect(5, 2, 22, 82);
    ctx.fillStyle = '#3e7a52';
    ctx.fillRect(7, 4, 8, 78);
    ctx.fillStyle = '#c6a15a';
    ctx.fillRect(8, 16, 14, 2);
    ctx.fillRect(8, 66, 14, 2);
    ctx.fillStyle = '#121c16';
    ctx.fillRect(24, 2, 3, 82);
    this.textures.addCanvas('shelf-green', canvas);
  }

  private paintBust(): void {
    const source = this.textures.get('edith').getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.ellipse(180, 200, 160, 185, 0, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max(340 / source.width, 400 / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    ctx.drawImage(source, 180 - dw / 2, 210 - dh / 2, dw, dh);
    this.textures.addCanvas('edith-bust', canvas);
  }

}

export const scenes = [BootScene, TitleScene, AdventureScene, MapScene, StreetScene];
