import type Phaser from 'phaser';
import { H, W } from './config';

export interface Point {
  x: number;
  y: number;
}

export function canvasPoint(canvas: HTMLCanvasElement, ev: PointerEvent): Point {
  const r = canvas.getBoundingClientRect();
  const width = r.width || 1;
  const height = r.height || 1;
  return {
    x: ((ev.clientX - r.left) / width) * W,
    y: ((ev.clientY - r.top) / height) * H,
  };
}

export function bindCanvasPointer(
  scene: Phaser.Scene,
  cbs: { down: (p: Point) => void; move: (p: Point) => void; up: (p: Point) => void },
): void {
  const canvas = scene.game.canvas;
  canvas.style.touchAction = 'none';
  let active: number | null = null;
  const down = (ev: PointerEvent) => {
    if (active !== null) return;
    active = ev.pointerId;
    ev.preventDefault();
    cbs.down(canvasPoint(canvas, ev));
  };
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== active) return;
    cbs.move(canvasPoint(canvas, ev));
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== active) return;
    active = null;
    cbs.up(canvasPoint(canvas, ev));
  };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  scene.events.once('shutdown', () => {
    canvas.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  });
}
