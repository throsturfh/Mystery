import Phaser from 'phaser';
import { audio } from '../audio';
import { getCase } from '../data/cases';
import { applyTime, getSave } from '../state';

const ASSET = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image('shop', ASSET('shop.jpg'));
    this.load.image('nook', ASSET('nook.jpg'));
    this.load.image('stock', ASSET('stock.jpg'));
    this.load.image('office', ASSET('office.jpg'));
    this.load.image('edith', ASSET('edith.jpg'));
    this.load.image('ambrose', ASSET('ambrose.png'));
  }

  create(): void {
    document.getElementById('loading')?.remove();
    this.game.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    const save = getSave();
    const def = getCase(save.caseId);
    audio.setMuted(save.muted);
    applyTime(save, Date.now(), { fear: false, economy: def.economy });
    const named = save.detective.name && save.detective.coat && save.detective.hat;
    if (!named || save.caseStatus === 'create') this.scene.start('create');
    else if (save.caseStatus === 'report') this.scene.start('report');
    else if (save.caseStatus === 'closed') this.scene.start('ending');
    else this.scene.start('field');
  }
}
