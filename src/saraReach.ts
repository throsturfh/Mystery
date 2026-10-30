import { SARA_ORIGIN_X, SARA_ORIGIN_Y, saraScale } from './saraWalk';

export const SARA_REACH_KEY = 'sara-reach';
export const SARA_REACH_FPS = 12;
export const SARA_REACH_FRAMES = 16;
const FRAME_W = 380;
const FRAME_H = 620;
/** Painted key sprite, in the same pixels as the reach frames. */
export const SARA_KEY_W = 42;
export const SARA_KEY_H = 16;

type Phase = 'empty' | 'holding';

type KeyDraw = {
  angle: number;
  x: number;
  y: number;
};

type ReachAnchor = {
  handX: number;
  handY: number;
  phase: Phase;
  key?: KeyDraw;
};

/** Grip points from hand-anchors.json. Holding starts at frame 10. The key has its own centre and clockwise angle. */
const ANCHORS: ReachAnchor[] = [
  { handX: 196.15, handY: 342.0, phase: 'empty' },
  { handX: 196.15, handY: 342.0, phase: 'empty' },
  { handX: 212.6, handY: 352.45, phase: 'empty' },
  { handX: 238.8, handY: 323.15, phase: 'empty' },
  { handX: 242.45, handY: 280.4, phase: 'empty' },
  { handX: 248.1, handY: 243.15, phase: 'empty' },
  { handX: 249.6, handY: 215.8, phase: 'empty' },
  { handX: 278.85, handY: 199.9, phase: 'empty' },
  { handX: 299.65, handY: 220.05, phase: 'empty' },
  { handX: 299.65, handY: 220.05, phase: 'empty' },
  { handX: 292.3, handY: 226.9, phase: 'holding', key: { angle: 110, x: 285.1, y: 246.65 } },
  { handX: 292.3, handY: 226.9, phase: 'holding', key: { angle: 110, x: 285.1, y: 246.65 } },
  { handX: 256.85, handY: 224.3, phase: 'holding', key: { angle: 80, x: 260.5, y: 245.0 } },
  { handX: 236.65, handY: 230.3, phase: 'holding', key: { angle: 62, x: 246.5, y: 248.85 } },
  { handX: 236.65, handY: 230.3, phase: 'holding', key: { angle: 62, x: 246.5, y: 248.85 } },
  { handX: 236.65, handY: 230.3, phase: 'holding', key: { angle: 62, x: 246.5, y: 248.85 } },
];

export function saraReachFrameKey(index: number): string {
  return `sara-reach-${index.toString().padStart(2, '0')}`;
}

export function saraReachFingersKey(index: number): string {
  return `sara-reach-fingers-${index.toString().padStart(2, '0')}`;
}

export function saraReachAnchor(index: number): ReachAnchor {
  return ANCHORS[Math.max(0, Math.min(ANCHORS.length - 1, index))]!;
}

/** World point of a canvas pixel. Same foot origin and 10% scale as the walk. */
export function saraReachPoint(x: number, y: number, depthY: number, flip: boolean, px: number, py: number): { x: number; y: number } {
  const scale = saraScale(depthY);
  let dx = px - SARA_ORIGIN_X * FRAME_W;
  const dy = py - SARA_ORIGIN_Y * FRAME_H;
  if (flip) dx = -dx;
  return { x: x + dx * scale, y: y + dy * scale };
}
