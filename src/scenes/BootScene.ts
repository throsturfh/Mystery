import Phaser from 'phaser';
import { AdventureScene } from './AdventureScene';
import { MapScene } from './MapScene';
import { StreetScene } from './StreetScene';
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
    this.load.image('map', asset('map.jpg'));
    this.load.image('street', asset('street.jpg'));
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
    for (const icon of ['lantern', 'lantern-lit', 'matches', 'key', 'pencil', 'ledger']) {
      this.load.image(`icon-${icon}`, asset(`icons/icon-${icon}.png`));
    }
    this.load.image('icon-greenbook', asset('icons/icon-greenbook.png'));
    this.load.image('shelf-key', asset('icons/shelf-key.png'));
    this.load.image('shelf-book', asset('icons/shelf-book.png'));
    this.load.image('prop-book', asset('prop-book.png'));
    this.load.image('prop-matches', asset('prop-matches.png'));
    this.load.image('prop-ledger', asset('prop-ledger.png'));
    this.load.image('prop-pencil', asset('prop-pencil.png'));
    this.load.image('prop-letter', asset('prop-letter.png'));
    this.load.image('trophy-medal', asset('trophy-medal.png'));
  }

  create(): void {
    this.paintBust();
    this.scene.start('title');
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
