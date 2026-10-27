import type Phaser from 'phaser';
import type { ClueDef, CoatId, HatId } from './types';

type Pen = Phaser.GameObjects.Graphics;

function oval(g: Pen, cx: number, cy: number, w: number, h: number): void {
  g.fillEllipse(cx - w / 2, cy - h / 2, w, h);
}

function strokeOval(g: Pen, cx: number, cy: number, w: number, h: number): void {
  g.strokeEllipse(cx - w / 2, cy - h / 2, w, h);
}

const SPINES = [0x6e2e2e, 0x2e4a6e, 0x2f5a45, 0x8a6232, 0x4a3a55, 0x7a3e2a, 0x1e3a4a, 0xa37b3a, 0x3e3a32];

export const COAT: Record<CoatId | '', { body: number; lapel: number; label: string }> = {
  '': { body: 0x6a625c, lapel: 0x514c47, label: 'Unissued' },
  charcoal: { body: 0x3e4654, lapel: 0x2c3340, label: 'Charcoal wool' },
  tweed: { body: 0x8d4e34, lapel: 0x6b3a26, label: 'Rust tweed' },
  navy: { body: 0x243456, lapel: 0x182640, label: 'Midnight navy' },
};

export const HAT_LABEL: Record<HatId, string> = {
  fedora: 'Felt fedora',
  newsboy: 'Newsboy cap',
  beret: 'Wool beret',
};

function bookcase(g: Pen, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x4a3428, 1);
  g.fillRoundedRect(x, y, w, h, 4);
  g.fillStyle(0x3a281e, 1);
  g.fillRect(x, y + h - 8, w, 8);
  const rows = 3;
  const bookW = 7;
  for (let row = 0; row < rows; row++) {
    const by = y + 8 + row * ((h - 16) / rows);
    const bh = (h - 16) / rows - 8;
    let bx = x + 6;
    let i = 0;
    while (bx < x + w - 10) {
      const wobble = ((i * 3) % 5) - 2;
      g.fillStyle(SPINES[(i + row * 2) % SPINES.length], 1);
      g.fillRect(bx, by + Math.max(0, wobble), bookW, bh);
      g.fillStyle(0xf0d59a, 0.75);
      g.fillRect(bx + 1, by + Math.max(0, wobble) + 3, bookW - 2, 1);
      bx += bookW + 2;
      i++;
    }
  }
}

function sconce(g: Pen, x: number, y: number): void {
  g.fillStyle(0xc6a15a, 1);
  g.fillRect(x - 2, y, 4, 16);
  g.fillStyle(0xffe1a8, 0.95);
  g.fillCircle(x, y + 18, 6);
  g.fillStyle(0xffc56e, 0.16);
  g.fillCircle(x, y + 28, 36);
  g.fillStyle(0xffc56e, 0.08);
  g.fillCircle(x, y + 36, 58);
}

function plankFloor(g: Pen, y: number, w: number, h: number): void {
  g.fillStyle(0x2a211b, 1);
  g.fillRect(0, y, w, h - y);
  g.lineStyle(1, 0x3d3128, 0.9);
  const rows = 7;
  for (let i = 1; i < rows; i++) {
    const yy = y + (i * (h - y)) / rows;
    g.lineBetween(0, yy, w, yy);
  }
}

function findClue(clues: ClueDef[], id: string, fallback: { x: number; y: number }): { x: number; y: number } {
  return clues.find((c) => c.id === id) ?? fallback;
}

export function paintShop(g: Pen, w: number, h: number, clues: ClueDef[]): void {
  const bell = findClue(clues, 'doorbell', { x: 46, y: 78 });
  const shelf = findClue(clues, 'shelves', { x: 274, y: 118 });
  g.fillStyle(0x17243a, 1);
  g.fillRect(0, 0, w, h);
  const floorY = Math.floor(h * 0.6);
  g.fillStyle(0x121c30, 1);
  g.fillRect(0, 0, w, floorY);
  g.fillStyle(0x3d2c24, 1);
  g.fillRect(0, floorY - 16, w, 16);
  plankFloor(g, floorY, w, h);

  const doorX = bell.x - 30;
  const doorY = bell.y + 6;
  g.fillStyle(0x241910, 1);
  g.fillRoundedRect(doorX, doorY, 60, 150, 4);
  g.fillStyle(0x1b3348, 0.95);
  g.fillRoundedRect(doorX + 8, doorY + 14, 44, 40, 2);
  g.fillRoundedRect(doorX + 8, doorY + 62, 44, 40, 2);
  g.lineStyle(2, 0x6b5438, 1);
  g.strokeRoundedRect(doorX, doorY, 60, 150, 4);
  g.fillStyle(0xd4b36a, 1);
  g.fillCircle(doorX + 50, doorY + 86, 3);

  g.fillStyle(0xc6a15a, 1);
  g.fillRect(bell.x - 1, bell.y - 18, 2, 14);
  g.fillCircle(bell.x, bell.y, 8);
  g.fillTriangle(bell.x - 7, bell.y + 1, bell.x + 7, bell.y + 1, bell.x, bell.y + 12);
  g.fillStyle(0x8a6430, 1);
  g.fillCircle(bell.x, bell.y + 11, 2);

  bookcase(g, shelf.x - 74, shelf.y - 78, 148, 168);

  g.fillStyle(0x5a3e2b, 1);
  g.fillRoundedRect(w * 0.32, floorY - 10, w * 0.4, 34, 4);
  g.fillStyle(0x6d4c34, 1);
  g.fillRect(w * 0.32, floorY - 10, w * 0.4, 8);
  g.fillStyle(0x6e2a2a, 0.9);
  oval(g, w * 0.46, floorY + 52, 130, 40);

  g.fillStyle(0xf3e6c8, 1);
  g.fillRoundedRect(w * 0.38, floorY - 28, 36, 16, 2);
  g.fillStyle(0x2e4a6e, 1);
  g.fillRect(w * 0.38 + 4, floorY - 26, 6, 12);
  g.fillStyle(0x8a6232, 1);
  g.fillRect(w * 0.38 + 12, floorY - 26, 6, 12);
  g.fillStyle(0x2f5a45, 1);
  g.fillRect(w * 0.38 + 20, floorY - 26, 6, 12);

  sconce(g, 130, 36);
  sconce(g, w - 54, 36);

  g.fillStyle(0x4a3428, 1);
  g.fillRoundedRect(w / 2 - 78, 18, 156, 26, 4);
}

export function paintNook(g: Pen, w: number, h: number, clues: ClueDef[]): void {
  const chair = findClue(clues, 'armchair', { x: 132, y: 206 });
  const book = findClue(clues, 'novel', { x: 262, y: 168 });
  g.fillStyle(0x141e32, 1);
  g.fillRect(0, 0, w, h);
  const floorY = Math.floor(h * 0.62);
  g.fillStyle(0x10192b, 1);
  g.fillRect(0, 0, w, floorY);
  g.fillStyle(0x2c241c, 1);
  g.fillRect(0, floorY - 14, w, 14);
  plankFloor(g, floorY, w, h);

  g.fillStyle(0x0e1a28, 1);
  g.fillRoundedRect(w - 118, 28, 96, 120, 4);
  g.fillStyle(0x1d3c58, 0.85);
  g.fillRect(w - 110, 36, 80, 104);
  g.lineStyle(2, 0x6b5438, 1);
  g.strokeRoundedRect(w - 118, 28, 96, 120, 4);
  g.lineBetween(w - 70, 36, w - 70, 140);
  g.lineBetween(w - 110, 88, w - 30, 88);

  g.fillStyle(0x6b3a32, 0.8);
  oval(g, chair.x, floorY + 36, 150, 46);

  g.fillStyle(0x2f4638, 1);
  g.fillRoundedRect(chair.x - 46, chair.y - 58, 92, 78, 18);
  g.fillStyle(0x3d5a48, 1);
  g.fillRoundedRect(chair.x - 34, chair.y - 46, 68, 48, 12);
  g.fillStyle(0x24382c, 1);
  g.fillRoundedRect(chair.x - 58, chair.y + 8, 22, 18, 6);
  g.fillRoundedRect(chair.x + 36, chair.y + 8, 22, 18, 6);
  g.fillStyle(0x2a4034, 1);
  g.fillRoundedRect(chair.x - 46, chair.y + 18, 92, 28, 8);
  g.fillStyle(0xc6a15a, 0.8);
  g.fillCircle(chair.x - 16, chair.y - 10, 3);
  g.fillCircle(chair.x + 16, chair.y - 10, 3);
  g.fillStyle(0x8d9a86, 0.35);
  oval(g, chair.x + 10, chair.y + 24, 36, 16);

  g.fillStyle(0x5a3e2b, 1);
  g.fillRoundedRect(book.x - 28, book.y + 8, 56, 14, 3);
  g.fillStyle(0x6e2e2e, 1);
  g.fillRoundedRect(book.x - 18, book.y - 16, 36, 26, 2);
  g.fillStyle(0xf3e6c8, 1);
  g.fillRect(book.x - 14, book.y - 12, 14, 18);
  g.fillStyle(0xd4b36a, 1);
  g.fillRect(book.x - 2, book.y - 20, 4, 22);

  g.fillStyle(0x3a2a22, 1);
  g.fillRect(book.x + 8, floorY - 78, 6, 70);
  g.fillStyle(0xffe1a8, 1);
  g.fillCircle(book.x + 11, floorY - 86, 8);
  g.fillStyle(0xffc56e, 0.18);
  g.fillCircle(book.x + 11, floorY - 40, 70);

  bookcase(g, 16, 36, 70, 120);
}

export function paintStock(g: Pen, w: number, h: number, clues: ClueDef[]): void {
  const desk = findClue(clues, 'pages', { x: 214, y: 198 });
  g.fillStyle(0x1a2230, 1);
  g.fillRect(0, 0, w, h);
  const floorY = Math.floor(h * 0.64);
  g.fillStyle(0x171d28, 1);
  g.fillRect(0, 0, w, floorY);
  g.fillStyle(0x2a313c, 1);
  g.fillRect(0, floorY - 10, w, 10);
  g.fillStyle(0x242018, 1);
  g.fillRect(0, floorY, w, h - floorY);

  g.lineStyle(1, 0xc9d2e2, 0.35);
  g.beginPath();
  g.moveTo(w - 28, 18);
  g.lineTo(w - 8, 36);
  g.moveTo(w - 36, 22);
  g.lineTo(w - 12, 46);
  g.strokePath();

  g.fillStyle(0x5a4636, 1);
  g.fillRoundedRect(28, 70, 78, 36, 3);
  g.fillRoundedRect(36, 100, 78, 36, 3);
  g.fillRoundedRect(24, 132, 86, 32, 3);
  g.lineStyle(1, 0xcbb892, 0.4);
  g.strokeRoundedRect(28, 70, 78, 36, 3);

  g.fillStyle(0x4a3428, 1);
  g.fillRoundedRect(desk.x - 78, desk.y - 10, 170, 78, 4);
  g.fillStyle(0x6b4b34, 1);
  g.fillRect(desk.x - 78, desk.y - 10, 170, 10);
  g.fillStyle(0xf3e6c8, 1);
  g.fillRect(desk.x - 10, desk.y + 8, 28, 36);
  g.fillStyle(0xe7d7b4, 1);
  g.fillRect(desk.x + 22, desk.y + 16, 24, 28);
  g.fillStyle(0x6e2e2e, 1);
  g.fillRect(desk.x - 8, desk.y + 14, 8, 22);
  g.lineStyle(1, 0x8a6430, 0.8);
  g.lineBetween(desk.x - 6, desk.y + 20, desk.x - 2, desk.y + 28);

  g.fillStyle(0xc9d4e4, 0.9);
  g.fillCircle(w / 2, 28, 8);
  g.lineStyle(2, 0x8a93a3, 1);
  g.lineBetween(w / 2, 8, w / 2, 20);
  g.fillStyle(0xd5e4ff, 0.08);
  g.fillCircle(w / 2, 90, 80);

  bookcase(g, w - 96, 48, 78, 110);
}

export function paintOffice(g: Pen, w: number, h: number, folder: { x: number; y: number }): void {
  g.fillStyle(0x141e30, 1);
  g.fillRect(0, 0, w, h);
  const floorY = Math.floor(h * 0.72);
  g.fillStyle(0x10192a, 1);
  g.fillRect(0, 0, w, floorY);
  plankFloor(g, floorY, w, h);

  g.fillStyle(0x0e1a28, 1);
  g.fillRoundedRect(w - 130, 36, 100, 78, 4);
  g.fillStyle(0x1c3a54, 0.8);
  g.fillRect(w - 122, 44, 84, 62);

  g.fillStyle(0x2a211c, 1);
  g.fillRoundedRect(18, 48, 54, 120, 3);
  g.fillStyle(0xd4b36a, 1);
  g.fillRoundedRect(24, 78, 42, 22, 2);

  g.fillStyle(0x5a3e2b, 1);
  g.fillRoundedRect(70, folder.y - 8, 230, 86, 6);
  g.fillStyle(0x6b4b34, 1);
  g.fillRect(70, folder.y - 8, 230, 12);

  g.fillStyle(0xc9a15a, 1);
  g.fillRect(folder.x + 40, folder.y - 70, 8, 48);
  g.fillStyle(0xffe1a8, 1);
  g.fillCircle(folder.x + 44, folder.y - 78, 10);
  g.fillStyle(0xffc56e, 0.16);
  g.fillCircle(folder.x + 20, folder.y - 10, 80);

  g.fillStyle(0xf4e7cb, 1);
  g.fillRoundedRect(folder.x - 28, folder.y - 36, 64, 78, 3);
  g.fillStyle(0x8e2e32, 1);
  g.fillRect(folder.x - 28, folder.y - 28, 64, 10);
  g.fillStyle(0xd4b36a, 1);
  g.fillCircle(folder.x + 4, folder.y - 10, 6);

  drawEdith(g, 150, folder.y - 28, 0.72);
}

export function paintDoor(g: Pen, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x2a211c, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  g.fillStyle(0x3a2c24, 1);
  g.fillRoundedRect(x + 14, y + 18, w - 28, h * 0.38, 4);
  g.fillRoundedRect(x + 14, y + h * 0.48, w - 28, h * 0.28, 4);
  g.lineStyle(3, 0x1a140f, 1);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.fillStyle(0xd4b36a, 1);
  g.fillCircle(x + w - 28, y + h * 0.55, 5);
  g.fillStyle(0x6b5430, 1);
  g.fillRoundedRect(x + 36, y + h * 0.22, w - 72, 54, 4);
  g.fillStyle(0xf3e6c8, 1);
  g.fillRoundedRect(x + 42, y + h * 0.22 + 6, w - 84, 42, 3);
}

export function drawEdith(g: Pen, x: number, y: number, scale = 1): void {
  const s = scale;
  g.fillStyle(0x3e4654, 1);
  g.fillRoundedRect(x - 22 * s, y, 44 * s, 36 * s, 10);
  g.fillStyle(0xf0c7a4, 1);
  g.fillCircle(x, y - 8 * s, 16 * s);
  g.fillStyle(0xd9dde6, 1);
  oval(g, x, y - 22 * s, 28 * s, 16 * s);
  g.fillCircle(x - 10 * s, y - 16 * s, 6 * s);
  g.fillCircle(x + 10 * s, y - 16 * s, 6 * s);
  g.fillStyle(0x2a2118, 1);
  g.fillCircle(x - 5 * s, y - 8 * s, 1.5 * s);
  g.fillCircle(x + 5 * s, y - 8 * s, 1.5 * s);
  g.lineStyle(1.4, 0x2a2420, 0.9);
  g.strokeCircle(x - 5 * s, y - 8 * s, 4.5 * s);
  g.strokeCircle(x + 5 * s, y - 8 * s, 4.5 * s);
  g.lineBetween(x - 0.5 * s, y - 8 * s, x + 0.5 * s, y - 8 * s);
  g.beginPath();
  g.arc(x, y - 2 * s, 5 * s, 0.2, Math.PI - 0.2, false);
  g.strokePath();
}

export function drawEdithMedallion(g: Pen, x: number, y: number, r: number): void {
  g.fillStyle(0x10192b, 1);
  g.fillCircle(x, y, r);
  g.lineStyle(2, 0xd4b36a, 1);
  g.strokeCircle(x, y, r);
  drawEdith(g, x, y + r * 0.35, r / 36);
}

export function drawHat(g: Pen, x: number, y: number, hat: HatId | '', s: number): void {
  if (hat === '' || hat === 'fedora') {
    g.fillStyle(0x2a2724, 1);
    oval(g, x, y + 8 * s, 36 * s, 10 * s);
    g.fillRoundedRect(x - 10 * s, y - 16 * s, 20 * s, 22 * s, 4);
    g.fillStyle(0x8a6430, 1);
    g.fillRect(x - 10 * s, y - 2 * s, 20 * s, 3 * s);
    return;
  }
  if (hat === 'newsboy') {
    g.fillStyle(0x3a332c, 1);
    oval(g, x, y + 6 * s, 34 * s, 12 * s);
    oval(g, x, y - 4 * s, 26 * s, 18 * s);
    g.fillStyle(0xd4b36a, 1);
    g.fillCircle(x, y - 4 * s, 2 * s);
    return;
  }
  g.fillStyle(0x243456, 1);
  oval(g, x + 2 * s, y, 34 * s, 16 * s);
  g.fillStyle(0x1a2744, 1);
  oval(g, x + 4 * s, y - 2 * s, 20 * s, 10 * s);
}

export function drawBookwormPin(g: Pen, x: number, y: number, s = 1): void {
  g.fillStyle(0xd4b36a, 1);
  oval(g, x, y, 14 * s, 8 * s);
  g.lineStyle(1.2, 0x8a6430, 1);
  g.beginPath();
  g.arc(x, y, 3.5 * s, Math.PI * 0.2, Math.PI * 1.4, false);
  g.strokePath();
  g.fillStyle(0x8a6430, 1);
  g.fillCircle(x + 4 * s, y - 1 * s, 1 * s);
}

export function drawDetective(
  g: Pen,
  x: number,
  y: number,
  coat: CoatId | '',
  hat: HatId | '',
  pin: boolean,
  scale = 1,
): void {
  const s = scale;
  const col = COAT[coat];
  g.fillStyle(0x000000, 0.25);
  oval(g, x, y + 58 * s, 46 * s, 12 * s);
  g.fillStyle(0x2a2420, 1);
  g.fillRoundedRect(x - 12 * s, y + 18 * s, 10 * s, 36 * s, 3);
  g.fillRoundedRect(x + 2 * s, y + 18 * s, 10 * s, 36 * s, 3);
  g.fillStyle(0x1a1410, 1);
  g.fillRoundedRect(x - 14 * s, y + 50 * s, 14 * s, 7 * s, 2);
  g.fillRoundedRect(x + 2 * s, y + 50 * s, 14 * s, 7 * s, 2);
  g.fillStyle(col.body, 1);
  g.fillRoundedRect(x - 22 * s, y - 28 * s, 44 * s, 52 * s, 12);
  g.fillStyle(col.lapel, 1);
  g.fillTriangle(x, y - 18 * s, x - 14 * s, y - 26 * s, x - 8 * s, y + 6 * s);
  g.fillTriangle(x, y - 18 * s, x + 14 * s, y - 26 * s, x + 8 * s, y + 6 * s);
  g.fillStyle(0xf3e6c8, 1);
  g.fillTriangle(x, y - 4 * s, x - 6 * s, y - 20 * s, x + 6 * s, y - 20 * s);
  g.fillStyle(0xf0c7a4, 1);
  g.fillCircle(x, y - 40 * s, 14 * s);
  g.fillStyle(0x2a2118, 1);
  g.fillCircle(x - 5 * s, y - 41 * s, 1.4 * s);
  g.fillCircle(x + 5 * s, y - 41 * s, 1.4 * s);
  g.lineStyle(1.2, 0x8a5a48, 0.9);
  g.beginPath();
  g.arc(x, y - 36 * s, 5 * s, 0.25, Math.PI - 0.25, false);
  g.strokePath();
  drawHat(g, x, y - 52 * s, hat === '' ? 'fedora' : hat, s);
  if (pin) drawBookwormPin(g, x + 12 * s, y - 6 * s, s);
}

export type AmbrosePose = 'stand' | 'sit' | 'read' | 'tip';

export function drawAmbrose(g: Pen, x: number, y: number, pose: AmbrosePose, alpha = 0.88): void {
  g.fillStyle(0xd7e6f6, alpha * 0.22);
  g.fillCircle(x, y, 72);
  if (pose === 'stand' || pose === 'tip') {
    g.fillStyle(0x8d6a45, alpha);
    oval(g, x - 14, y + 58, 26, 12);
    oval(g, x + 14, y + 58, 26, 12);
    g.fillStyle(0x5c6a7a, alpha);
    g.fillRoundedRect(x - 18, y + 16, 16, 40, 6);
    g.fillRoundedRect(x + 4, y + 16, 16, 40, 6);
  }
  g.fillStyle(0xc4a484, alpha);
  g.fillRoundedRect(x - 30, y - 28, 60, 52, 18);
  g.fillStyle(0xe7eef6, alpha);
  g.fillTriangle(x, y - 4, x - 12, y - 24, x + 12, y - 24);
  g.fillStyle(0xf2e6c8, alpha);
  for (let i = 0; i < 3; i++) g.fillCircle(x + 8, y - 16 + i * 12, 2.2);
  g.fillStyle(0xf3d2b8, alpha);
  g.fillCircle(x, y - 48, 20);
  g.fillStyle(0xeeeef3, alpha);
  oval(g, x - 16, y - 46, 12, 18);
  oval(g, x + 16, y - 46, 12, 18);
  oval(g, x, y - 64, 26, 12);
  g.fillStyle(0x3a342c, alpha);
  g.fillCircle(x - 7, y - 50, 1.7);
  g.fillCircle(x + 7, y - 50, 1.7);
  g.lineStyle(1.6, 0x2a2420, alpha);
  g.beginPath();
  g.arc(x - 7, y - 48, 7, 0.05, Math.PI - 0.05, false);
  g.strokePath();
  g.beginPath();
  g.arc(x + 7, y - 48, 7, 0.05, Math.PI - 0.05, false);
  g.strokePath();
  g.lineBetween(x - 14, y - 48, x - 18, y - 50);
  g.lineBetween(x + 14, y - 48, x + 18, y - 50);
  g.beginPath();
  g.arc(x, y - 42, 7, 0.2, Math.PI - 0.2, false);
  g.strokePath();
  if (pose === 'tip') {
    g.fillStyle(0xc4a484, alpha);
    g.fillRoundedRect(x + 20, y - 78, 8, 32, 4);
    g.fillStyle(0xf3d2b8, alpha);
    g.fillCircle(x + 24, y - 82, 6);
  }
  if (pose === 'read' || pose === 'sit') {
    g.fillStyle(0x6e2a2a, alpha);
    g.fillRoundedRect(x - 18, y - 6, 36, 24, 2);
    if (pose === 'read') {
      g.fillStyle(0xf4e7cb, alpha);
      g.fillRect(x - 16, y - 4, 15, 20);
      g.fillRect(x + 1, y - 4, 15, 20);
      g.lineStyle(1, 0xcbb892, alpha);
      g.lineBetween(x, y - 4, x, y + 16);
    }
  }
}

export function drawMoth(g: Pen, x: number, y: number, flap: number): void {
  const wing = 7 + Math.abs(flap) * 8;
  g.fillStyle(0xf7f4ea, 0.95);
  oval(g, x - 8, y, 16, wing);
  oval(g, x + 8, y, 16, wing);
  g.fillStyle(0xd9d3c4, 1);
  oval(g, x, y, 4, 12);
  g.lineStyle(1, 0xb7b1a4, 1);
  g.lineBetween(x - 1, y - 6, x - 5, y - 12);
  g.lineBetween(x + 1, y - 6, x + 5, y - 12);
}

export function drawEnvelope(g: Pen, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0xf7f1e4, 1);
  g.fillRoundedRect(x, y, w, h, 4);
  g.lineStyle(1.5, 0xd9c7a4, 1);
  g.strokeRoundedRect(x, y, w, h, 4);
  g.lineBetween(x + 2, y + 2, x + w / 2, y + h * 0.55);
  g.lineBetween(x + w - 2, y + 2, x + w / 2, y + h * 0.55);
}

export function drawStar(g: Pen, x: number, y: number, r: number, fill: number, alpha = 1): void {
  g.fillStyle(fill, alpha);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

export function drawLock(g: Pen, x: number, y: number, s = 1): void {
  g.lineStyle(2, 0xd4b36a, 1);
  g.strokeRoundedRect(x, y + 7 * s, 14 * s, 11 * s, 2);
  g.beginPath();
  g.arc(x + 7 * s, y + 7 * s, 5 * s, Math.PI, 0, false);
  g.strokePath();
}

export function drawEmfIcon(g: Pen, x: number, y: number, level: number): void {
  g.fillStyle(0x1b140f, 1);
  g.fillRoundedRect(x, y, 28, 20, 4);
  g.lineStyle(1.5, 0x9ad7ff, 1);
  g.strokeRoundedRect(x, y, 28, 20, 4);
  g.fillStyle(0xd4b36a, 1);
  g.fillCircle(x + 14, y + 10, 5);
  g.lineStyle(1.5, 0xf3e6c8, 1);
  g.lineBetween(x + 14, y + 10, x + 18, y + 6);
  if (level >= 2) {
    g.lineStyle(1, 0x86f0b0, 0.9);
    strokeOval(g, x + 14, y + 10, 18, 14);
  }
}

export function drawFlashIcon(g: Pen, x: number, y: number): void {
  g.fillStyle(0x3a4458, 1);
  g.fillRoundedRect(x + 8, y, 12, 10, 2);
  g.fillStyle(0x6a7488, 1);
  g.fillRect(x + 4, y + 10, 20, 8);
  g.fillStyle(0xd5def0, 0.8);
  g.fillCircle(x + 14, y + 22, 6);
}

export function drawTeaIcon(g: Pen, x: number, y: number): void {
  g.fillStyle(0x8a6430, 1);
  g.fillRoundedRect(x + 4, y + 6, 16, 16, 3);
  g.lineStyle(2, 0xd4b36a, 1);
  g.strokeCircle(x + 22, y + 14, 4);
  g.lineStyle(1, 0xc9d4e4, 0.7);
  g.lineBetween(x + 8, y + 4, x + 8, y);
  g.lineBetween(x + 12, y + 5, x + 12, y + 1);
}

export function drawFolderIcon(g: Pen, x: number, y: number): void {
  g.fillStyle(0xc6a15a, 1);
  g.fillRoundedRect(x, y + 4, 22, 14, 2);
  g.fillRect(x, y + 2, 10, 6);
  g.fillStyle(0xf3e6c8, 1);
  g.fillRect(x + 3, y + 8, 14, 2);
}

export function drawSpeaker(g: Pen, x: number, y: number, muted: boolean): void {
  g.fillStyle(0xf0d59a, 1);
  g.fillRect(x, y + 5, 4, 8);
  g.fillTriangle(x + 4, y + 5, x + 4, y + 13, x + 10, y + 2);
  g.fillTriangle(x + 4, y + 5, x + 4, y + 13, x + 10, y + 16);
  if (muted) {
    g.lineStyle(2, 0xf0b0aa, 1);
    g.lineBetween(x + 14, y + 4, x + 22, y + 14);
    g.lineBetween(x + 22, y + 4, x + 14, y + 14);
  } else {
    g.lineStyle(1.5, 0xf0d59a, 0.9);
    g.beginPath();
    g.arc(x + 12, y + 9, 6, -0.8, 0.8, false);
    g.strokePath();
  }
}

export function drawMiniHead(g: Pen, x: number, y: number, coat: CoatId | '', hat: HatId | ''): void {
  g.fillStyle(COAT[coat].body, 1);
  g.fillCircle(x, y, 16);
  g.fillStyle(0xf0c7a4, 1);
  g.fillCircle(x, y - 1, 8);
  drawHat(g, x, y - 10, hat === '' ? 'fedora' : hat, 0.55);
}
