import type Phaser from 'phaser';
import { isDefaultLook, type Profile } from './profile';

const COAT: Record<string, [number, number, number]> = {
  tan: [141, 115, 72],
  olive: [92, 104, 64],
  charcoal: [74, 70, 66],
  wine: [122, 58, 72],
};

const HAT: Record<string, [number, number, number]> = {
  brown: [90, 64, 48],
  black: [44, 40, 36],
  moss: [62, 74, 50],
  plum: [74, 40, 56],
};

const SCARF: Record<string, [number, number, number]> = {
  plaid: [138, 48, 48],
  pine: [47, 90, 64],
  gold: [160, 120, 48],
  ink: [42, 64, 104],
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  if (s <= 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}

/** Keep the pixel's lightness, take the garment hue, and blend saturation so folds stay folds. */
function shift(r: number, g: number, b: number, target: [number, number, number]): [number, number, number] {
  const [, ss, sl] = rgbToHsl(r, g, b);
  const [th, ts] = rgbToHsl(target[0], target[1], target[2]);
  const sat = Math.min(1, ts * (0.55 + 0.55 * Math.min(1, ss + 0.15)));
  return hslToRgb(th, sat, sl);
}

function paint(
  source: CanvasImageSource,
  mask: CanvasImageSource | null,
  width: number,
  height: number,
  profile: Profile,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0);
  if (!mask || isDefaultLook(profile)) return canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const mctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!mctx) return canvas;
  mctx.drawImage(mask, 0, 0, width, height);
  const md = mctx.getImageData(0, 0, width, height).data;
  const d = image.data;
  const coat = COAT[profile.coat] ?? COAT.tan!;
  const hat = HAT[profile.hat] ?? HAT.brown!;
  const scarf = SCARF[profile.scarf] ?? SCARF.plaid!;
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i + 3] ?? 0) < 40) continue;
    if ((md[i + 3] ?? 0) < 20) continue;
    const mr = md[i] ?? 0;
    const mg = md[i + 1] ?? 0;
    const mb = md[i + 2] ?? 0;
    let target: [number, number, number] | null = null;
    if (mr > 128) target = hat;
    else if (mg > 128) target = coat;
    else if (mb > 128) target = scarf;
    if (!target) continue;
    const next = shift(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0, target);
    d[i] = next[0];
    d[i + 1] = next[1];
    d[i + 2] = next[2];
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function put(scene: Phaser.Scene, key: string, sourceKey: string, maskKey: string, profile: Profile): void {
  const texture = scene.textures.get(sourceKey);
  const image = texture.getSourceImage() as HTMLImageElement;
  const mask = scene.textures.exists(maskKey) ? (scene.textures.get(maskKey).getSourceImage() as CanvasImageSource) : null;
  const canvas = paint(image, mask, image.width, image.height, profile);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

export function paintHero(scene: Phaser.Scene, profile: Profile): void {
  put(scene, 'hero', 'detective', 'mask-detective', profile);
  for (let i = 0; i < 6; i++) put(scene, `hero-${i}`, `walk-${i}`, `mask-walk-${i}`, profile);
}

export function idleKey(profile: Profile): string {
  return isDefaultLook(profile) ? 'detective' : 'hero';
}

export function walkKey(profile: Profile, frame: number): string {
  return isDefaultLook(profile) ? `walk-${frame}` : `hero-${frame}`;
}
