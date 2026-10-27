import Phaser from 'phaser';
import { AdventureScene } from './AdventureScene';

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
  }

  create(): void {
    this.paintIcons();
    this.paintBust();
    this.paintEnvelope();
    this.scene.start('adventure');
  }

  private paintIcons(): void {
    this.icon('icon-lantern', (g) => this.lantern(g, false));
    this.icon('icon-lantern-lit', (g) => this.lantern(g, true));
    this.icon('icon-matches', (g) => {
      g.fillStyle(0xc6a15a, 1);
      g.fillRoundedRect(14, 30, 28, 18, 3);
      g.fillStyle(0xf3e6c8, 1);
      g.fillRect(18, 34, 20, 4);
      g.lineStyle(3, 0xf6edd6, 1);
      g.lineBetween(40, 18, 48, 40);
      g.fillStyle(0x9a2c2c, 1);
      g.fillCircle(40, 16, 3);
    });
    this.icon('icon-key', (g) => {
      g.fillStyle(0xe6c98a, 1);
      g.fillCircle(24, 26, 10);
      g.fillStyle(0x24180f, 1);
      g.fillCircle(24, 26, 4);
      g.fillStyle(0xe6c98a, 1);
      g.fillRect(32, 23, 20, 6);
      g.fillRect(44, 23, 4, 10);
      g.fillRect(38, 23, 4, 8);
    });
    this.icon('icon-pencil', (g) => {
      g.fillStyle(0xe6c98a, 1);
      g.fillRect(30, 8, 8, 40);
      g.fillStyle(0xf3e6c8, 1);
      g.fillRect(30, 40, 8, 8);
      g.fillStyle(0x1c140e, 1);
      g.fillTriangle(30, 48, 38, 48, 34, 58);
      g.fillStyle(0xc45a4a, 1);
      g.fillRect(30, 8, 8, 6);
    });
    this.icon('icon-ledger', (g) => {
      g.fillStyle(0x6b4632, 1);
      g.fillRoundedRect(14, 10, 36, 44, 3);
      g.fillStyle(0xf3e6c8, 1);
      g.fillRect(18, 14, 28, 36);
      g.lineStyle(1, 0x8a6430, 1);
      g.lineBetween(22, 24, 42, 24);
      g.lineBetween(22, 30, 42, 30);
      g.lineBetween(22, 36, 36, 36);
    });
    this.icon('icon-book', (g) => {
      g.fillStyle(0x214e3c, 1);
      g.fillRoundedRect(16, 10, 32, 44, 3);
      g.fillStyle(0xe6c98a, 1);
      g.fillRect(18, 14, 4, 36);
      g.fillRect(22, 22, 18, 3);
    });
  }

  private lantern(g: Phaser.GameObjects.Graphics, lit: boolean): void {
    g.fillStyle(0x8a6430, 1);
    g.fillRect(28, 10, 8, 8);
    g.fillStyle(0xc6a15a, 1);
    g.fillRoundedRect(20, 18, 24, 28, 4);
    g.lineStyle(2, 0x3a2618, 1);
    g.strokeRoundedRect(20, 18, 24, 28, 4);
    g.fillStyle(lit ? 0xffe1a8 : 0x6b5430, 1);
    g.fillCircle(32, 30, lit ? 7 : 4);
    if (lit) {
      g.fillStyle(0xffc56e, 0.35);
      g.fillCircle(32, 30, 14);
    }
  }

  private icon(key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void {
    const g = this.add.graphics();
    g.fillStyle(0x1a120c, 1);
    g.fillRoundedRect(4, 4, 56, 56, 8);
    draw(g);
    g.generateTexture(key, 64, 64);
    g.destroy();
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

export const scenes = [BootScene, AdventureScene];
