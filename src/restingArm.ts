/**
 * Painted reach frames keep the resting lantern arm and add a second arm.
 * Erase the lantern and the arm that holds it, so the reaching hand is the only one.
 * Cuts are in unflipped canvas pixels: the lantern sits to the right of the torso.
 */
const CUT = {
  crowe: { seedX: 560, seedY0: 680, seedY1: 880, cutX: 545, cutY: 600 },
  sara: { seedX: 270, seedY0: 280, seedY1: 400, cutX: 255, cutY: 230 },
} as const;

export function stripRestingLantern(canvas: HTMLCanvasElement, who: 'crowe' | 'sara'): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const cut = CUT[who];
  let best = -1;
  let sx = 0;
  let sy = 0;
  const y1 = Math.min(h - 1, cut.seedY1);
  for (let y = cut.seedY0; y <= y1; y++) {
    for (let x = cut.seedX; x < w; x++) {
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
  if (best < 0) return;

  const seen = new Uint8Array(w * h);
  const mask = new Uint8Array(w * h);
  const stack: number[] = [sx, sy];
  seen[sy * w + sx] = 1;
  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const p = y * w + x;
    const alpha = data[p * 4 + 3] ?? 0;
    if (alpha <= 12 || x < cut.cutX || y < cut.cutY) continue;
    mask[p] = 1;
    const next: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of next) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (seen[np]) continue;
      seen[np] = 1;
      stack.push(nx, ny);
    }
  }

  const dilate = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          dilate[ny * w + nx] = 1;
        }
      }
    }
  }
  for (let p = 0; p < w * h; p++) {
    if (dilate[p]) data[p * 4 + 3] = 0;
  }
  ctx.putImageData(image, 0, 0);
}
