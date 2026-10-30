/**
 * Painted reach frames keep the resting lantern arm and add a second arm.
 * Erase the lantern and the arm that holds it, so the reaching hand is the only one.
 * Cuts are in unflipped canvas pixels: the lantern sits to the right of the torso.
 *
 * Edmund's lantern arm hangs clear of his coat, so a vertical cut removes it.
 *
 * Sara is stacked from sara-reach/layers. The lantern sleeve is painted into the
 * base and into every coat, and it runs back into the jacket. A vertical cut
 * either leaves that sleeve (a second arm) or, pushed further left, slices the
 * coat and the reaching hand, which crosses the same side of the canvas.
 * The sleeve is followed as its own ribbon back to the shoulder. The reaching
 * hand stays: it is the skin around the grip anchor. Walk frames are not touched,
 * so the lantern arm returns when the reach ends.
 */
import { saraReachAnchor } from './saraReach';

const EDMUND = { seedX: 560, seedY0: 680, seedY1: 880, cutX: 545, cutY: 600 } as const;

type Cut = { seedX: number; seedY0: number; seedY1: number; cutX: number; cutY: number };

/** Phaser takes the 2d context with willReadFrequently. A later getContext('2d') is null on some browsers. */
export function canvas2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true }) ?? canvas.getContext('2d');
}

export function stripRestingLantern(canvas: HTMLCanvasElement, who: 'crowe' | 'sara', frame = 0): void {
  if (who === 'sara') {
    stripSara(canvas, frame);
    return;
  }
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

/**
 * Sara's lantern cuff is a stable shape on the right of every reach frame.
 * Walk that ribbon left until it thickens into the jacket, clear the lantern
 * hanging from it, and keep the reaching hand.
 */
function stripSara(canvas: HTMLCanvasElement, frame: number): void {
  const ctx = canvas2d(canvas);
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const anchor = saraReachAnchor(frame);
  const hand = reachingHand(data, w, h, anchor.handX, anchor.handY);
  const sleeve = sleeveRibbon(data, w, h, hand);
  const lantern = lanternBody(data, w, h, sleeve, hand);
  const mask = dilateMask(orMask(sleeve, lantern), w, h, 2);
  const keep = dilateMask(hand, w, h, 1);
  for (let p = 0; p < mask.length; p++) if (keep[p]) mask[p] = 0;
  clear(data, mask);
  clearSpecks(data, w, h);
  ctx.putImageData(image, 0, 0);
}

function reachingHand(data: Uint8ClampedArray, w: number, h: number, ax: number, ay: number): Uint8Array {
  const skin = new Uint8Array(w * h);
  const radius = 58;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(ax - radius));
  const x1 = Math.min(w - 1, Math.ceil(ax + radius));
  const y0 = Math.max(0, Math.floor(ay - radius));
  const y1 = Math.min(h - 1, Math.ceil(ay + radius));
  let sx = Math.round(ax);
  let sy = Math.round(ay);
  let best = Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - ax;
      const dy = y - ay;
      if (dx * dx + dy * dy > r2) continue;
      const p = y * w + x;
      if (!isSkin(data, p * 4)) continue;
      skin[p] = 1;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        sx = x;
        sy = y;
      }
    }
  }
  if (best === Infinity) return new Uint8Array(w * h);
  const hand = floodMask(skin, w, h, sx, sy);
  const grown = dilateMask(hand, w, h, 1);
  for (let p = 0; p < grown.length; p++) {
    const alpha = data[p * 4 + 3] ?? 0;
    if (alpha <= 16) grown[p] = 0;
  }
  return grown;
}

/** Lantern cuff, then left along the sleeve until it joins the jacket. */
function sleeveRibbon(data: Uint8ClampedArray, w: number, h: number, skip: Uint8Array): Uint8Array {
  const mask = new Uint8Array(w * h);
  const xStart = Math.min(w - 1, 272);
  const y0 = 248;
  const y1 = Math.min(h - 1, 318);
  for (let y = y0; y <= y1; y++) {
    for (let x = xStart; x < w; x++) {
      const p = y * w + x;
      if (skip[p] || (data[p * 4 + 3] ?? 0) <= 16) continue;
      mask[p] = 1;
    }
  }
  const maxThick = 52;
  for (let x = xStart - 1; x >= 160; x--) {
    let prevMin = h;
    let prevMax = -1;
    for (let y = 0; y < h; y++) {
      if (!mask[y * w + x + 1]) continue;
      if (y < prevMin) prevMin = y;
      if (y > prevMax) prevMax = y;
    }
    if (prevMax < 0) break;
    const lo = Math.max(0, prevMin - 4);
    const hi = Math.min(h - 1, prevMax + 4);
    let count = 0;
    let full = 0;
    let fullMin = h;
    let fullMax = -1;
    for (let y = 0; y < h; y++) {
      const p = y * w + x;
      if ((data[p * 4 + 3] ?? 0) <= 16) continue;
      full += 1;
      if (y < fullMin) fullMin = y;
      if (y > fullMax) fullMax = y;
      if (y >= lo && y <= hi && !skip[p]) count += 1;
    }
    if (count === 0 || count > maxThick) break;
    if (full > maxThick + 24 && (fullMin < lo - 12 || fullMax > hi + 12)) break;
    for (let y = lo; y <= hi; y++) {
      const p = y * w + x;
      if (skip[p] || (data[p * 4 + 3] ?? 0) <= 16) continue;
      mask[p] = 1;
    }
  }
  return mask;
}

function lanternBody(data: Uint8ClampedArray, w: number, h: number, sleeve: Uint8Array, hand: Uint8Array): Uint8Array {
  const near = dilateMask(sleeve, w, h, 5);
  let best = -1;
  let sx = 0;
  let sy = 0;
  for (let y = 290; y < Math.min(h, 430); y++) {
    for (let x = 285; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a > 16 && r > 175 && g > 90 && r > b + 35) {
        const score = r + g - b;
        if (score > best) {
          best = score;
          sx = x;
          sy = y;
        }
      }
    }
  }
  if (best < 0) return new Uint8Array(w * h);
  const allowed = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (hand[p]) continue;
      if ((data[p * 4 + 3] ?? 0) <= 16) continue;
      if (near[p] || (x >= 268 && y >= 252)) allowed[p] = 1;
    }
  }
  return floodMask(allowed, w, h, sx, sy);
}

/** Drop leftover flecks of the lantern hand that are no longer attached to the body. */
function clearSpecks(data: Uint8ClampedArray, w: number, h: number): void {
  const seen = new Uint8Array(w * h);
  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      const p0 = y0 * w + x0;
      if (seen[p0] || (data[p0 * 4 + 3] ?? 0) <= 20) continue;
      const stack = [x0, y0];
      seen[p0] = 1;
      const pts: number[] = [];
      let minX = x0;
      while (stack.length > 0) {
        const y = stack.pop()!;
        const x = stack.pop()!;
        pts.push(x, y);
        if (x < minX) minX = x;
        const next: Array<[number, number]> = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        for (const [nx, ny] of next) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (seen[np] || (data[np * 4 + 3] ?? 0) <= 20) continue;
          seen[np] = 1;
          stack.push(nx, ny);
        }
      }
      if (pts.length > 16 && pts.length < 440 && minX > 220) {
        for (let i = 0; i < pts.length; i += 2) {
          const x = pts[i]!;
          const y = pts[i + 1]!;
          const p = (y * w + x) * 4;
          data[p] = 0;
          data[p + 1] = 0;
          data[p + 2] = 0;
          data[p + 3] = 0;
        }
      }
    }
  }
}

function isSkin(data: Uint8ClampedArray, i: number): boolean {
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  const a = data[i + 3] ?? 0;
  return a > 40 && r > 115 && g > 52 && g * 100 > r * 40 && b > 18 && r > b + 12 && g > b;
}

function floodMask(allowed: Uint8Array, w: number, h: number, sx: number, sy: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h);
  const x0 = Math.max(0, Math.min(w - 1, sx));
  const y0 = Math.max(0, Math.min(h - 1, sy));
  const stack = [x0, y0];
  seen[y0 * w + x0] = 1;
  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const p = y * w + x;
    if (!allowed[p]) continue;
    mask[p] = 1;
    const next: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
      [x + 1, y + 1],
      [x - 1, y + 1],
      [x + 1, y - 1],
      [x - 1, y - 1],
    ];
    for (const [nx, ny] of next) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (seen[np]) continue;
      seen[np] = 1;
      stack.push(nx, ny);
    }
  }
  return mask;
}

function dilateMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}

function orMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] || b[i] ? 1 : 0;
  return out;
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
