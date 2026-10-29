/** Stage-1 Edmund tests. Set A is painted from a 3D pose guide. Set B is drawn flat, frame by frame. */

export type EdmundSet = 'a' | 'b';
export type EdmundFacing = 'side' | 'front' | 'back';

export const EDMUND = {
  cellW: 420,
  cellH: 520,
  cols: 8,
  pivotX: 210,
  pivotY: 500,
  /** Hat-top to sole, the height the office scale is based on. */
  figureMeters: 1.92,
  stepMeters: 0.64,
  /** On-screen height at the front and back of the office walk. */
  frontPx: 245,
  backPx: 220,
  side: { start: 0, count: 12, perStep: 6, fps: 12 },
  front: { start: 12, count: 8, perStep: 4, fps: 10 },
  back: { start: 20, count: 8, perStep: 4, fps: 10 },
  idle: { start: 28, count: 8, fps: 8 },
  take: { start: 36, count: 10, fps: 12, grasp: 5 },
} as const;

const KEY = 'edmund-set';

export function edmundDemo(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
}

/** Skip the title when a stage-1 recording is asking for the office directly. */
export function edmundDirect(): boolean {
  if (typeof location === 'undefined') return false;
  const query = new URLSearchParams(location.search);
  return query.has('demo') || query.has('still');
}

export function readEdmundSet(): EdmundSet {
  if (typeof location !== 'undefined') {
    const query = new URLSearchParams(location.search).get('edmund');
    if (query === 'a' || query === 'b') return query;
  }
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored === 'a' || stored === 'b') return stored;
  } catch {
    /* private mode */
  }
  return 'a';
}

export function writeEdmundSet(set: EdmundSet): void {
  try {
    sessionStorage.setItem(KEY, set);
  } catch {
    /* private mode */
  }
}

/** Office only. Other rooms keep the previous figure size so the unrevised rooms still fit. */
export function edmundPixels(y: number, room: string, fallback: number): number {
  if (room !== 'office') return fallback;
  const t = Math.max(0, Math.min(1, (y - 488) / (608 - 488)));
  return EDMUND.backPx + t * (EDMUND.frontPx - EDMUND.backPx);
}

export function clipFor(facing: EdmundFacing): { start: number; count: number; fps: number; perStep: number } {
  if (facing === 'front') return EDMUND.front;
  if (facing === 'back') return EDMUND.back;
  return EDMUND.side;
}
