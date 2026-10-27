import type Phaser from 'phaser';
import { FONT } from './config';

export function write(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  opts?: {
    w?: number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    font?: 'display' | 'body';
    originX?: number;
    originY?: number;
  },
): Phaser.GameObjects.Text {
  const style = [opts?.bold ? 'bold' : '', opts?.italic ? 'italic' : ''].filter(Boolean).join(' ');
  const text = scene.add.text(x, y, value, {
    fontFamily: opts?.font === 'display' ? FONT.display : FONT.body,
    fontSize: `${size}px`,
    color,
    fontStyle: style || 'normal',
    align: opts?.align,
    wordWrap: opts?.w ? { width: opts.w } : undefined,
  });
  if (opts?.originX !== undefined || opts?.originY !== undefined) {
    text.setOrigin(opts.originX ?? 0, opts.originY ?? 0);
  }
  return text;
}

export function panel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  radius = 14,
  stroke = 0xd4b36a,
  sw = 2,
): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  if (sw > 0) {
    g.lineStyle(sw, stroke, 0.9);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
}
