import type Phaser from 'phaser';
import { HEX } from './config';

type Pen = Phaser.GameObjects.Graphics;

export function woodPanel(g: Pen, x: number, y: number, w: number, h: number, alpha = 0.94): void {
  g.fillStyle(HEX.woodDark, alpha);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x4a301c, 0.55);
  g.fillRect(x, y, w, 7);
  g.fillRect(x, y + h - 7, w, 7);
  g.lineStyle(2, HEX.brass, 0.95);
  g.strokeRect(x + 7, y + 7, w - 14, h - 14);
  g.lineStyle(1, 0x6e5428, 0.9);
  g.strokeRect(x + 11, y + 11, w - 22, h - 22);
  g.fillStyle(HEX.brass, 1);
  const studs: [number, number][] = [
    [x + 7, y + 7],
    [x + w - 7, y + 7],
    [x + 7, y + h - 7],
    [x + w - 7, y + h - 7],
  ];
  for (const [cx, cy] of studs) g.fillCircle(cx, cy, 3.2);
}

export function parchment(g: Pen, x: number, y: number, w: number, h: number, alpha = 0.97): void {
  g.fillStyle(0x3a2618, 0.28 * alpha);
  g.fillRect(x + 4, y + 5, w, h);
  g.fillStyle(HEX.paper, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, HEX.brassDeep, 1);
  g.strokeRect(x, y, w, h);
  g.lineStyle(1, HEX.paperEdge, 0.9);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);
}

export function brassPlaque(g: Pen, x: number, y: number, w: number, h: number, hot = false): void {
  g.fillStyle(hot ? 0x5c4324 : 0x2a1c12, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(hot ? 0x8a6430 : 0x3a2618, 1);
  g.fillRect(x, y, w, 3);
  g.lineStyle(2, hot ? 0xf0d59a : HEX.brass, 1);
  g.strokeRect(x, y, w, h);
  g.fillStyle(0xe6c98a, 1);
  g.fillCircle(x + 5, y + 5, 2);
  g.fillCircle(x + w - 5, y + 5, 2);
  g.fillCircle(x + 5, y + h - 5, 2);
  g.fillCircle(x + w - 5, y + h - 5, 2);
}

export function corkBoard(g: Pen, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x8b5a38, 1);
  g.fillRect(x, y, w, h);
  for (let row = 0; row < h; row += 6) {
    g.fillStyle(row % 12 === 0 ? 0x6b4228 : 0xa56b42, 0.55);
    g.fillRect(x, y + row, w, 3);
  }
  for (let i = 0; i < 160; i++) {
    const px = x + 8 + ((i * 97 + 19) % Math.max(1, w - 16));
    const py = y + 8 + ((i * 53 + 11) % Math.max(1, h - 16));
    g.fillStyle(i % 3 === 0 ? 0x3a2414 : 0xe4c39a, i % 3 === 0 ? 0.7 : 0.45);
    g.fillCircle(px, py, 2.2 + (i % 4));
  }
  g.lineStyle(8, 0x2a1a10, 1);
  g.strokeRect(x + 3, y + 3, w - 6, h - 6);
  g.lineStyle(2, HEX.brass, 0.85);
  g.strokeRect(x + 12, y + 12, w - 24, h - 24);
}

/** Brass rim only. The portrait image sits inside; a fill here would hide it. */
export function portraitFrame(g: Pen, x: number, y: number, size: number): void {
  g.lineStyle(4, 0x3a2618, 1);
  g.strokeRect(x - 5, y - 5, size + 10, size + 10);
  g.lineStyle(3, HEX.brass, 1);
  g.strokeRect(x - 3, y - 3, size + 6, size + 6);
  g.lineStyle(1, 0xf0d59a, 0.9);
  g.strokeRect(x, y, size, size);
}
