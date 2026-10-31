import type Phaser from 'phaser';
import { strideCount } from './figure';
import type { Profile } from './profile';
import { canvas2d } from './restingArm';

const FRAMES = ['detective', 'walk-0', 'walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5'] as const;

function layerKey(frame: string, part: string, detective: string): string {
  if (detective === 'crowe') return `L-${frame}-${part}`;
  return `L-${detective}-${frame}-${part}`;
}

function compose(scene: Phaser.Scene, outKey: string, frame: string, profile: Profile): void {
  const who = profile.detective || 'crowe';
  const baseTex = scene.textures.get(layerKey(frame, 'base', who));
  if (!baseTex || baseTex.key === '__MISSING') return;
  const base = baseTex.getSourceImage() as HTMLImageElement;
  const coat = scene.textures.get(layerKey(frame, `coat-${profile.coat}`, who)).getSourceImage() as CanvasImageSource;
  const scarf = scene.textures.get(layerKey(frame, `scarf-${profile.scarf}`, who)).getSourceImage() as CanvasImageSource;
  const hat = scene.textures.get(layerKey(frame, `hat-${profile.hat}`, who)).getSourceImage() as CanvasImageSource;
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas2d(canvas);
  if (!ctx) return;
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(coat, 0, 0);
  ctx.drawImage(scarf, 0, 0);
  ctx.drawImage(hat, 0, 0);
  if (scene.textures.exists(outKey)) {
    const existing = scene.textures.get(outKey).getSourceImage();
    if (existing instanceof HTMLCanvasElement) {
      if (existing.width !== canvas.width || existing.height !== canvas.height) {
        existing.width = canvas.width;
        existing.height = canvas.height;
      }
      const live = canvas2d(existing);
      live?.clearRect(0, 0, existing.width, existing.height);
      live?.drawImage(canvas, 0, 0);
      (scene.textures.get(outKey) as Phaser.Textures.CanvasTexture).refresh();
      return;
    }
  }
  if (!scene.textures.exists(outKey)) scene.textures.addCanvas(outKey, canvas);
}

/** One standing portrait, for the detective picker. Does not touch the walk cycle. */
export function paintPortrait(scene: Phaser.Scene, profile: Profile, outKey: string): void {
  compose(scene, outKey, 'detective', profile);
}

/** Stack pre-painted body, coat, scarf and hat. No runtime colour masking. */
export function paintHero(scene: Phaser.Scene, profile: Profile): void {
  compose(scene, 'hero', 'detective', profile);
  const frames = strideCount(profile.detective || 'crowe');
  for (let i = 0; i < frames; i++) compose(scene, `hero-${i}`, `walk-${i}`, profile);
  paintSaraFrames(scene, profile);
}

/** Sara's painted walk and reach, stacked in the same order as the standing portrait. */
export function paintSaraFrames(scene: Phaser.Scene, profile: Profile): void {
  if ((profile.detective || 'crowe') !== 'sara') return;
  for (let i = 0; i < 12; i++) {
    const name = i.toString().padStart(2, '0');
    compose(scene, `sara-walk-${name}`, `walk-${name}`, profile);
  }
  // Reach paintings are one arm already. A lantern erase cuts the reaching sleeve.
  for (let i = 0; i < 16; i++) {
    const name = i.toString().padStart(2, '0');
    compose(scene, `sara-reach-${name}`, `reach-${name}`, profile);
  }
}

export function idleKey(_profile: Profile): string {
  return 'hero';
}

export function walkKey(_profile: Profile, frame: number): string {
  return `hero-${frame}`;
}

export const LAYER_FRAMES = FRAMES;
