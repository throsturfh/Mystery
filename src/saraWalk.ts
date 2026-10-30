import type Phaser from 'phaser';
import { figurePixels } from './figure';

export const SARA_WALK_KEY = 'sara-walk';
export const SARA_WALK_FRAMES = 12;
/** The painted cycle is authored at 12 fps. Stride length is one frame, so the soles stay planted. */
export const SARA_WALK_FPS = 12;

/**
 * Contact-pose opaque span (bottom - top) of the painted walk,
 * so the cycle lands at the same on-screen height as the standing portrait.
 */
const FIGURE_PX = 512;
/** In-world size against the other figures. Depth scaling stays inside figurePixels. */
export const SARA_SIZE = 1.1;
const FRAME_W = 380;
const FRAME_H = 620;
/** Artist anchor, on the baseline under the soles. */
const FOOT_Y = 607.5;
const BODY_X = 190;
/** Source pixels she advances on each painted frame. */
const STEP_SRC = 32.1;

export const SARA_ORIGIN_X = BODY_X / FRAME_W;
export const SARA_ORIGIN_Y = FOOT_Y / FRAME_H;

export function saraFrameKey(index: number): string {
  return `sara-walk-${index.toString().padStart(2, '0')}`;
}

export function saraScale(y: number): number {
  return (figurePixels(y) * SARA_SIZE) / FIGURE_PX;
}

/** Screen pixels per second. One frame is one planted step. */
export function saraSpeed(y: number): number {
  return STEP_SRC * saraScale(y) * SARA_WALK_FPS;
}

export function playSaraWalk(sprite: Phaser.GameObjects.Sprite, y: number): void {
  const anims = sprite.anims;
  if (!anims.isPlaying || anims.currentAnim?.key !== SARA_WALK_KEY) {
    sprite.play({ key: SARA_WALK_KEY, repeat: -1 });
  }
  sprite.setOrigin(SARA_ORIGIN_X, SARA_ORIGIN_Y);
  sprite.setScale(saraScale(y));
}

export function stopSaraWalk(sprite: Phaser.GameObjects.Sprite): void {
  if (sprite.anims.isPlaying) sprite.anims.stop();
  sprite.setOrigin(0.5, 1);
}
