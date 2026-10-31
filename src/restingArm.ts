/**
 * Edmund's painted reach frames keep the resting lantern arm and add a second arm.
 * Erase the lantern and the arm that holds it, so the reaching hand is the only one.
 * Cuts are in unflipped canvas pixels: the lantern sits to the right of the torso.
 * Edmund's lantern arm hangs clear of his coat, so a vertical cut removes it.
 *
 * Sara Kristín's reach is painted as a single arm. Do not erase her frames.
 */
const EDMUND = { seedX: 560, seedY0: 680, seedY1: 880, cutX: 545, cutY: 600 } as const;

type Cut = { seedX: number; seedY0: number; seedY1: number; cutX: number; cutY: number };

/** Phaser takes the 2d context with willReadFrequently. A later getContext('2d') is null on some browsers. */
export function canvas2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true }) ?? canvas.getContext('2d');
}

export function stripRestingLantern(canvas: HTMLCanvasElement, who: 'crowe' | 'sara'): void {
  if (who !== 'crowe') return;
  stripCut(canvas, EDMUND);
}

function stripCut(canvas: HTMLCanvasElement, cut: Cut): void {
  const ctx = canvas2d(canvas);
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const seed = warmSeed(data, w, h, cut.seedX, cut.seedY0, cut.seedY1);
  if (!seed) return;
  const mask = flood(data, w, h, seed.x, seed.y, (x, y) => x < cut.cutX || y < cut.cutY, false);
  erase(data, w, h, mask, 1);
  ctx.putImageData(image, 0, 0);
}

function warmSeed(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  seedX: number,
  seedY0: number,
  seedY1: number,
): { x: number; y: number } | null {
  let best = -1;
  let sx = 0;
  let sy = 0;
  const y1 = Math.min(h - 1, seedY1);
  const x0 = Math.max(0, seedX);
  for (let y = Math.max(0, seedY0); y <= y1; y++) {
    for (let x = x0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a > 40 && r > 180 && g > 100 && r > b + 40) {
        const score = r + g - b;
        if (score > best) {
          best = score;
          sx = x;
          sy = y;
        }
      }
    }
  }
  return best < 0 ? null : { x: sx, y: sy };
}

function flood(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
  blocked: (x: number, y: number) => boolean,
  diag: boolean,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  floodInto(data, w, h, sx, sy, mask, blocked, diag);
  return mask;
}

function floodInto(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
  mask: Uint8Array,
  blocked: (x: number, y: number) => boolean,
  diag: boolean,
): void {
  const seen = new Uint8Array(w * h);
  const x0 = Math.max(0, Math.min(w - 1, Math.round(sx)));
  const y0 = Math.max(0, Math.min(h - 1, Math.round(sy)));
  const stack: number[] = [x0, y0];
  seen[y0 * w + x0] = 1;
  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const p = y * w + x;
    const alpha = data[p * 4 + 3] ?? 0;
    if (alpha <= 10 || blocked(x, y)) continue;
    mask[p] = 1;
    const next: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    if (diag) next.push([x + 1, y + 1], [x - 1, y + 1], [x + 1, y - 1], [x - 1, y - 1]);
    for (const [nx, ny] of next) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (seen[np]) continue;
      seen[np] = 1;
      stack.push(nx, ny);
    }
  }
}

/** Clear the arm, including a fringe, and zero RGB so a premultiplied upload cannot ghost it. */
function erase(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  mask: Uint8Array,
  radius: number,
  skip?: (x: number) => boolean,
): void {
  const dilate = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || skip?.(nx)) continue;
          dilate[ny * w + nx] = 1;
        }
      }
    }
  }
  clear(data, dilate);
}

function clear(data: Uint8ClampedArray, mask: Uint8Array): void {
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const i = p * 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
  }
}
