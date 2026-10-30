/** Lotta's painted trot and idle. She shares Sara's source-pixel scale, so the two stay 1:1. */

export const LOTTA_FRAME_W = 430;
export const LOTTA_FRAME_H = 260;
/** Paw anchor. Every trot and idle frame uses this canvas. */
export const LOTTA_ORIGIN_X = 215 / LOTTA_FRAME_W;
export const LOTTA_ORIGIN_Y = 247.5 / LOTTA_FRAME_H;
export const LOTTA_TROT_FRAMES = 8;
export const LOTTA_IDLE_FRAMES = 24;
export const LOTTA_FPS = 12;
/** Source pixels her stance paws travel on each trot frame. */
export const LOTTA_TROT_STEP = 32.2;

export const GLANCE_POSES = ['back', 'up', 'side'] as const;
export type GlancePose = (typeof GLANCE_POSES)[number];
export type HeadPose = 'forward' | GlancePose;

const GLANCE_TILT: Record<GlancePose, number> = {
  back: -3,
  up: 4,
  side: 2.5,
};

const PIVOT_X = 285.95;

/** Per-frame head shift. Pivot y is the rotation point after the shift. */
const TROT_HEAD: { dy: number; py: number }[] = [
  { dy: -1, py: 111.15 },
  { dy: 0, py: 112.35 },
  { dy: 1, py: 113.55 },
  { dy: 0, py: 112.35 },
  { dy: -1, py: 111.15 },
  { dy: 0, py: 112.35 },
  { dy: 1, py: 113.55 },
  { dy: 0, py: 112.35 },
];

const IDLE_DY = [
  0, 0, 0, 0,
  0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4,
  0, 0, 0, 0, 0, 0, 0,
  -0.4, -0.4,
];

export function lottaFrameKey(anim: 'idle' | 'trot', index: number): string {
  return `lotta-${anim}-${index.toString().padStart(2, '0')}`;
}

export function lottaBodyKey(anim: 'idle' | 'trot', index: number): string {
  return `lotta-body-${anim}-${index.toString().padStart(2, '0')}`;
}

export function lottaHeadKey(pose: HeadPose): string {
  return `lotta-head-${pose}`;
}

export function headPlacement(anim: 'idle' | 'trot', frame: number): { dy: number; pivotX: number; pivotY: number } {
  if (anim === 'trot') {
    const row = TROT_HEAD[frame] ?? TROT_HEAD[0]!;
    return { dy: row.dy, pivotX: PIVOT_X, pivotY: row.py };
  }
  const dy = IDLE_DY[frame] ?? 0;
  return { dy, pivotX: PIVOT_X, pivotY: 112.35 + dy };
}

export function glanceTilt(pose: GlancePose, weight: number): number {
  return GLANCE_TILT[pose] * weight;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Ease 0→1 over 0.3s, hold, ease 1→0 over the last 0.3s. */
export function glanceWeight(elapsed: number, duration: number): number {
  const ease = 0.3;
  if (elapsed <= ease) return smoothstep(elapsed / ease);
  const out = duration - ease;
  if (elapsed >= out) return smoothstep((duration - elapsed) / ease);
  return 1;
}

/**
 * Body, then the head shifted by dy and tilted about the pivot.
 * Lighter compositing rebuilds the feathered neck. Positive tilt is counter-clockwise.
 */
export function composeLottaHead(
  canvas: HTMLCanvasElement,
  body: CanvasImageSource,
  head: CanvasImageSource,
  dy: number,
  pivotX: number,
  pivotY: number,
  tiltDeg: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(body, 0, 0);
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate((-tiltDeg * Math.PI) / 180);
  ctx.translate(-pivotX, -pivotY + dy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(head, 0, 0);
  ctx.restore();
}
