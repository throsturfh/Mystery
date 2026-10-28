import Phaser from 'phaser';
import { H, W } from '../config';
import { loadSave, writeSave, type Save } from '../save';

const FONT = 'Cormorant Garamond, Georgia, serif';
const DISPLAY = 'Cinzel, Georgia, serif';

type Spot = { id: 'shop' | 'lantern' | 'office'; x: number; y: number; label: string; open: boolean };

/** Painted district. Cases are marked only when they are unlocked. */
export class MapScene extends Phaser.Scene {
  private save!: Save;
  private spots: Spot[] = [];

  constructor() {
    super('map');
  }

  create(): void {
    window.__screen = 'map';
    this.save = loadSave();
    if (this.save.flags.seenEnding) this.save.cases.lantern = true;
    writeSave(this.save);
    this.add.image(0, 0, 'map').setOrigin(0, 0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, 64, 0x140e0a, 0.55).setOrigin(0, 0);
    this.add.text(36, 18, 'Hollowmere', {
      fontFamily: DISPLAY,
      fontSize: '28px',
      color: '#e6c98a',
    }).setResolution(2);
    this.add.text(36, 48, 'Choose a door. Locked houses keep their own weather.', {
      fontFamily: FONT,
      fontStyle: 'italic',
      fontSize: '18px',
      color: '#f3e6c8',
    }).setResolution(2);

    this.spots = [
      { id: 'office', x: 360, y: 268, label: 'Dispatch', open: false },
      { id: 'shop', x: 840, y: 248, label: 'Bellweather Bookshop', open: this.save.cases.bookshop },
      { id: 'lantern', x: 1120, y: 220, label: 'No. 9 Lantern Lane', open: this.save.cases.lantern },
    ];
    this.add.text(360, 300, 'You are here', {
      fontFamily: FONT,
      fontStyle: 'italic',
      fontSize: '15px',
      color: '#f3e6c8',
      stroke: '#140e0a',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setResolution(2);
    for (const spot of this.spots) {
      if (!spot.open) continue;
      const g = this.add.graphics();
      g.fillStyle(0xc6a15a, 0.95);
      g.fillCircle(spot.x, spot.y, 14);
      g.lineStyle(2, 0xf6edd6, 1);
      g.strokeCircle(spot.x, spot.y, 18);
      this.add.text(spot.x, spot.y - 28, spot.label, {
        fontFamily: DISPLAY,
        fontSize: '16px',
        color: '#f6edd6',
        stroke: '#140e0a',
        strokeThickness: 4,
      }).setOrigin(0.5, 1).setResolution(2);
    }
    this.button(36, H - 72, 200, 48, 'Back');
    this.input.once('pointerdown', () => undefined);
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
  }

  private button(x: number, y: number, w: number, h: number, label: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x24180f, 0.94);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, 0xc6a15a, 1);
    g.strokeRoundedRect(x, y, w, h, 8);
    this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: DISPLAY,
      fontSize: '20px',
      color: '#f6edd6',
    }).setOrigin(0.5).setResolution(2);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const x = p.worldX;
    const y = p.worldY;
    if (x >= 36 && x <= 236 && y >= H - 72 && y <= H - 24) {
      this.scene.start('adventure');
      return;
    }
    const hit = this.spots.find((spot) => spot.open && Math.hypot(spot.x - x, spot.y - y) < 48);
    if (!hit || hit.id === 'office') return;
    this.scene.start('street', { dest: hit.id });
  }
}
