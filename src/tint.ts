import type Phaser from 'phaser';
import type { Profile } from './profile';

const FRAMES = ['detective', 'walk-0', 'walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5'] as const;

function layerKey(frame: string, part: string): string {
  return `L-${frame}-${part}`;
}

function compose(scene: Phaser.Scene, outKey: string, frame: string, profile: Profile): void {
  const base = scene.textures.get(layerKey(frame, 'base')).getSourceImage() as HTMLImageElement;
  const coat = scene.textures.get(layerKey(frame, `coat-${profile.coat}`)).getSourceImage() as CanvasImageSource;
  const scarf = scene.textures.get(layerKey(frame, `scarf-${profile.scarf}`)).getSourceImage() as CanvasImageSource;
  const hat = scene.textures.get(layerKey(frame, `hat-${profile.hat}`)).getSourceImage() as CanvasImageSource;
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(coat, 0, 0);
  ctx.drawImage(scarf, 0, 0);
  ctx.drawImage(hat, 0, 0);
  if (scene.textures.exists(outKey)) scene.textures.remove(outKey);
  scene.textures.addCanvas(outKey, canvas);
}

/** Stack pre-painted body, coat, scarf and hat. No runtime colour masking. */
export function paintHero(scene: Phaser.Scene, profile: Profile): void {
  compose(scene, 'hero', 'detective', profile);
  for (let i = 0; i < 6; i++) compose(scene, `hero-${i}`, `walk-${i}`, profile);
}

export function idleKey(_profile: Profile): string {
  return 'hero';
}

export function walkKey(_profile: Profile, frame: number): string {
  return `hero-${frame}`;
}

export const LAYER_FRAMES = FRAMES;
