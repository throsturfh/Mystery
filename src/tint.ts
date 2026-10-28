import type Phaser from 'phaser';
import { isDefaultLook, type Profile } from './profile';

const hex = (color: string): [number, number, number] => [
  parseInt(color.slice(1, 3), 16),
  parseInt(color.slice(3, 5), 16),
  parseInt(color.slice(5, 7), 16),
];

function paint(source: CanvasImageSource, width: number, height: number, profile: Profile, colors: { coat: string; hat: string; scarf: string }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0);
  if (isDefaultLook(profile)) return canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  let y0 = height;
  let y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (d[(y * width + x) * 4 + 3]! > 40) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  const span = Math.max(1, y1 - y0);
  const coat = hex(colors.coat);
  const hat = hex(colors.hat);
  const scarf = hex(colors.scarf);
  const tint = (i: number, target: [number, number, number]) => {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    const lum = 0.35 * r + 0.5 * g + 0.15 * b;
    const tl = Math.max(1, 0.35 * target[0] + 0.5 * target[1] + 0.15 * target[2]);
    const scale = lum / tl;
    d[i] = Math.max(0, Math.min(255, target[0] * scale));
    d[i + 1] = Math.max(0, Math.min(255, target[1] * scale));
    d[i + 2] = Math.max(0, Math.min(255, target[2] * scale));
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = d[i] ?? 0;
      const g = d[i + 1] ?? 0;
      const b = d[i + 2] ?? 0;
      const a = d[i + 3] ?? 0;
      if (a < 40) continue;
      const lantern = r > 170 && g > 100 && b < 140 && r + g > 320;
      if (lantern) continue;
      const skin = r > 155 && g > 120 && b > 90 && Math.abs(r - g) < 55 && r > b && y > y0 + 0.12 * span && y < y0 + 0.34 * span;
      if (skin) continue;
      const skinHere = y > y0 + 0.1 * span && y < y0 + 0.36 * span && r > 140 && g > 90 && b > 70 && r > b && Math.abs(r - g) < 80;
      const scarfHere =
        profile.scarf !== 'plaid' &&
        !skinHere &&
        y > y0 + 0.2 * span &&
        y < y0 + 0.42 * span &&
        x > width * 0.3 &&
        x < width * 0.62 &&
        r > 40;
      const hatHere = profile.hat !== 'brown' && y < y0 + 0.17 * span && !skinHere && r < 170;
      const coatHere =
        profile.coat !== 'tan' &&
        !scarfHere &&
        !skinHere &&
        r > b + 18 &&
        r > 60 &&
        g > 35 &&
        y > y0 + 0.26 * span &&
        y < y0 + 0.93 * span &&
        lumOf(r, g, b) > 42;
      if (scarfHere) tint(i, scarf);
      else if (hatHere) tint(i, hat);
      else if (coatHere) tint(i, coat);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function lumOf(r: number, g: number, b: number): number {
  return 0.35 * r + 0.5 * g + 0.15 * b;
}

function colorsFor(profile: Profile): { coat: string; hat: string; scarf: string } {
  const coats: Record<string, string> = { tan: '#8d7348', olive: '#5c6840', charcoal: '#4a4642', wine: '#7a3a48' };
  const hats: Record<string, string> = { brown: '#5a4030', black: '#2c2824', moss: '#3e4a32', plum: '#4a2838' };
  const scarves: Record<string, string> = { plaid: '#8a3030', pine: '#2f5a40', gold: '#a07830', ink: '#2a4068' };
  return {
    coat: coats[profile.coat] ?? '#8d7348',
    hat: hats[profile.hat] ?? '#5a4030',
    scarf: scarves[profile.scarf] ?? '#8a3030',
  };
}

function put(scene: Phaser.Scene, key: string, sourceKey: string, profile: Profile): void {
  const texture = scene.textures.get(sourceKey);
  const image = texture.getSourceImage() as HTMLImageElement;
  const canvas = paint(image, image.width, image.height, profile, colorsFor(profile));
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

export function paintHero(scene: Phaser.Scene, profile: Profile): void {
  put(scene, 'hero', 'detective', profile);
  for (let i = 0; i < 6; i++) put(scene, `hero-${i}`, `walk-${i}`, profile);
}

export function idleKey(profile: Profile): string {
  return isDefaultLook(profile) ? 'detective' : 'hero';
}

export function walkKey(profile: Profile, frame: number): string {
  return isDefaultLook(profile) ? `walk-${frame}` : `hero-${frame}`;
}
