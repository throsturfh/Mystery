/** Edmund's new frame-by-frame sheets. The office and the other detectives stay as they are. */

export type EdmundFacing = 'side' | 'front' | 'back';

export const EDMUND_SHEET = {
  key: 'edmund-steps',
  cellW: 640,
  cellH: 1080,
  cols: 8,
  pivotX: 300,
  pivotY: 1020,
  side: { start: 0, count: 12, perStep: 6, fps: 12 },
  front: { start: 12, count: 8, perStep: 4, fps: 10 },
  back: { start: 20, count: 8, perStep: 4, fps: 10 },
  idle: { start: 28, count: 8, fps: 8 },
  take: { start: 36, count: 10, fps: 12, grasp: 5 },
} as const;

export function edmundDemo(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
}

export function clipFor(facing: EdmundFacing) {
  if (facing === 'front') return EDMUND_SHEET.front;
  if (facing === 'back') return EDMUND_SHEET.back;
  return EDMUND_SHEET.side;
}
