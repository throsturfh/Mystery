import { EDMUND_ORIGIN_X, EDMUND_ORIGIN_Y, edmundScale } from './edmundWalk';

export const EDMUND_REACH_KEY = 'edmund-reach';
export const EDMUND_REACH_FPS = 12;
export const EDMUND_REACH_FRAMES = 16;
const FRAME_W = 760;
const FRAME_H = 1240;

type Phase = 'empty' | 'holding';

type ReachAnchor = {
  handX: number;
  handY: number;
  phase: Phase;
};

/** Palm points from hand-anchors.json. Holding starts at frame 10. */
const ANCHORS: ReachAnchor[] = [
  { handX: 390.5, handY: 687.2, phase: 'empty' },
  { handX: 395.9, handY: 704.0, phase: 'empty' },
  { handX: 396.8, handY: 598.5, phase: 'empty' },
  { handX: 425.4, handY: 576.5, phase: 'empty' },
  { handX: 497.9, handY: 616.8, phase: 'empty' },
  { handX: 555.8, handY: 579.7, phase: 'empty' },
  { handX: 624.8, handY: 560.9, phase: 'empty' },
  { handX: 662.3, handY: 491.6, phase: 'empty' },
  { handX: 662.8, handY: 492.0, phase: 'empty' },
  { handX: 646.7, handY: 474.5, phase: 'empty' },
  { handX: 644.9, handY: 506.0, phase: 'holding' },
  { handX: 602.8, handY: 554.9, phase: 'holding' },
  { handX: 517.0, handY: 573.4, phase: 'holding' },
  { handX: 442.6, handY: 605.1, phase: 'holding' },
  { handX: 407.4, handY: 593.2, phase: 'holding' },
  { handX: 406.4, handY: 593.3, phase: 'holding' },
];

export function reachFrameKey(index: number): string {
  return `edmund-reach-${index.toString().padStart(2, '0')}`;
}

export function reachFingersKey(index: number): string {
  return `edmund-reach-fingers-${index.toString().padStart(2, '0')}`;
}

export function reachAnchor(index: number): ReachAnchor {
  return ANCHORS[Math.max(0, Math.min(ANCHORS.length - 1, index))]!;
}

/** World point of the palm. Same foot origin and 10% scale as the walk. */
export function reachHand(x: number, y: number, depthY: number, flip: boolean, frame: number): { x: number; y: number } {
  const anchor = reachAnchor(frame);
  const scale = edmundScale(depthY);
  let dx = anchor.handX - EDMUND_ORIGIN_X * FRAME_W;
  const dy = anchor.handY - EDMUND_ORIGIN_Y * FRAME_H;
  if (flip) dx = -dx;
  return { x: x + dx * scale, y: y + dy * scale };
}
