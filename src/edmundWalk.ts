import type Phaser from 'phaser';
import { figurePixels } from './figure';

export const EDMUND_WALK_KEY = 'edmund-walk';
export const EDMUND_WALK_FRAMES = 12;
export const EDMUND_WALK_FPS = 12;

/**
 * Contact-pose opaque span (bottom - top), the same measurement as
 * opaqueHeight on public/assets/detective.png, so the painted cycle
 * lands at the v0.16 on-screen height.
 */
const FIGURE_PX = 1023;
const FRAME_W = 760;
const FRAME_H = 1240;
/** First row under the soles. The painted baseline is y=1215. */
const FOOT_Y = 1216;
/** Torso column. It stays within a few pixels across all 12 frames. */
const BODY_X = 435;
/**
 * Source pixels the planted sole travels from a leading contact
 * (frames 0 and 6) to the trailing contact six frames later.
 */
const STEP_SRC = 404;

export const EDMUND_ORIGIN_X = BODY_X / FRAME_W;
export const EDMUND_ORIGIN_Y = FOOT_Y / FRAME_H;

export function edmundFrameKey(index: number): string {
  return `edmund-walk-${index.toString().padStart(2, '0')}`;
}

export function edmundScale(y: number): number {
  return figurePixels(y) / FIGURE_PX;
}

/** Screen pixels per second. One step is six frames, so the sole stays planted. */
export function edmundSpeed(y: number): number {
  return STEP_SRC * edmundScale(y) * (EDMUND_WALK_FPS / 6);
}

export function playEdmundWalk(sprite: Phaser.GameObjects.Sprite, y: number): void {
  const anims = sprite.anims;
  if (!anims.isPlaying || anims.currentAnim?.key !== EDMUND_WALK_KEY) sprite.play(EDMUND_WALK_KEY);
  sprite.setOrigin(EDMUND_ORIGIN_X, EDMUND_ORIGIN_Y);
  sprite.setScale(edmundScale(y));
}

export function stopEdmundWalk(sprite: Phaser.GameObjects.Sprite): void {
  if (sprite.anims.isPlaying) sprite.anims.stop();
  sprite.setOrigin(0.5, 1);
}
