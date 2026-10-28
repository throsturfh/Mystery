import Phaser from 'phaser';
import { AdventureScene } from './AdventureScene';
import { TitleScene } from './TitleScene';

const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

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
    this.load.image('detective', asset('detective.png'));
    this.load.image('mask-detective', asset('masks/detective.png'));
    for (let i = 0; i < 6; i++) {
      this.load.image(`walk-${i}`, asset(`walk-${i}.png`));
      this.load.image(`mask-walk-${i}`, asset(`masks/walk-${i}.png`));
    }
    this.load.image('june', asset('june.png'));
    for (const icon of ['lantern', 'lantern-lit', 'matches', 'key', 'pencil', 'ledger']) {
      this.load.image(`icon-${icon}`, asset(`icons/icon-${icon}.png`));
    }
    this.load.image('icon-greenbook', asset('icons/icon-greenbook.png'));
    this.load.image('shelf-key', asset('icons/shelf-key.png'));
    this.load.image('shelf-book', asset('icons/shelf-book.png'));
    this.load.image('prop-book', asset('prop-book.png'));
    this.load.image('prop-matches', asset('prop-matches.png'));
    this.load.image('prop-match-cover', asset('prop-match-cover.png'));
    this.load.image('prop-ledger', asset('prop-ledger.png'));
    this.load.image('prop-pencil', asset('prop-pencil.png'));
  }

  create(): void {
    this.paintMoth();
    this.paintBust();
    this.paintEnvelope();
    this.scene.start('title');
  }

  private paintMoth(): void {
    const g = this.add.graphics();
    g.fillStyle(0x9fd8c8, 0.35);
    g.fillCircle(40, 24, 22);
    g.fillStyle(0xd7fff2, 0.95);
    g.fillEllipse(18, 22, 28, 16);
    g.fillEllipse(62, 22, 28, 16);
    g.fillStyle(0xf4fff8, 0.8);
    g.fillEllipse(16, 18, 16, 8);
    g.fillEllipse(64, 18, 16, 8);
    g.fillStyle(0x1c2820, 1);
    g.fillEllipse(40, 24, 8, 18);
    g.fillStyle(0xf3e6c8, 1);
    g.fillCircle(38, 16, 2);
    g.generateTexture('moth', 80, 48);
    g.destroy();
    const medal = this.add.graphics();
    medal.fillStyle(0xe6c98a, 1);
    medal.fillCircle(16, 16, 12);
    medal.fillStyle(0x8a6430, 1);
    medal.fillCircle(16, 16, 5);
    medal.generateTexture('medal', 32, 32);
    medal.destroy();
    const jar = this.add.graphics();
    jar.fillStyle(0x6a8f86, 0.9);
    jar.fillRoundedRect(8, 10, 20, 22, 4);
    jar.fillStyle(0xc9ebe0, 0.8);
    jar.fillCircle(14, 16, 3);
    jar.fillCircle(20, 20, 2);
    jar.generateTexture('jar', 36, 36);
    jar.destroy();
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

  private paintEnvelope(): void {
    const g = this.add.graphics();
    g.fillStyle(0xf6edd6, 1);
    g.fillRoundedRect(0, 8, 150, 96, 6);
    g.lineStyle(3, 0x8a6430, 1);
    g.strokeRoundedRect(0, 8, 150, 96, 6);
    g.lineStyle(2, 0xc6a15a, 1);
    g.lineBetween(4, 12, 75, 58);
    g.lineBetween(146, 12, 75, 58);
    g.fillStyle(0x9a2c2c, 1);
    g.fillCircle(118, 36, 8);
    g.generateTexture('envelope', 150, 110);
    g.destroy();
  }
}

export const scenes = [BootScene, TitleScene, AdventureScene];
