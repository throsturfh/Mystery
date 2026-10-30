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

type AnchorFrame = { dy: number; pivotY: number };

type LottaRig = {
  pivotX: number;
  idle: AnchorFrame[];
  trot: AnchorFrame[];
  ease: number;
  waitMin: number;
  waitMax: number;
  holdMin: number;
  holdMax: number;
  tilt: Record<GlancePose, number>;
};

const FALLBACK_TILT: Record<GlancePose, number> = {
  back: -3,
  up: 4,
  side: 2.5,
};

/** Used until head-anchors.json and glance-timing.json load. Same numbers as those files. */
const FALLBACK: LottaRig = {
  pivotX: 285.95,
  trot: [
    { dy: -1, pivotY: 111.15 },
    { dy: 0, pivotY: 112.35 },
    { dy: 1, pivotY: 113.55 },
    { dy: 0, pivotY: 112.35 },
    { dy: -1, pivotY: 111.15 },
    { dy: 0, pivotY: 112.35 },
    { dy: 1, pivotY: 113.55 },
    { dy: 0, pivotY: 112.35 },
  ],
  idle: [
    0, 0, 0, 0,
    0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4,
    0, 0, 0, 0, 0, 0, 0,
    -0.4, -0.4,
  ].map((dy) => ({ dy, pivotY: 112.35 + dy })),
  ease: 0.3,
  waitMin: 4,
  waitMax: 7,
  holdMin: 1,
  holdMax: 1.5,
  tilt: FALLBACK_TILT,
};

let rig: LottaRig = FALLBACK;

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function frames(value: unknown, count: number, fallback: AnchorFrame[]): AnchorFrame[] {
  if (!Array.isArray(value) || value.length < count) return fallback;
  return value.slice(0, count).map((row, index) => {
    const src = row && typeof row === 'object' ? (row as { dy?: unknown; pivotY?: unknown }) : {};
    const base = fallback[index] ?? fallback[0]!;
    return { dy: num(src.dy, base.dy), pivotY: num(src.pivotY, base.pivotY) };
  });
}

/** Neck join and glance clock from the painted JSON. Falls back if a file is missing or incomplete. */
export function installLottaRig(anchors: unknown, timing: unknown): void {
  const anchor = anchors && typeof anchors === 'object' ? (anchors as { pivotX?: unknown; idle?: unknown; trot?: unknown }) : {};
  const clock = timing && typeof timing === 'object' ? (timing as { easeSeconds?: unknown; waitMin?: unknown; waitMax?: unknown; holdMin?: unknown; holdMax?: unknown; tilt?: unknown }) : {};
  const tiltSrc = clock.tilt && typeof clock.tilt === 'object' ? (clock.tilt as Record<string, unknown>) : {};
  rig = {
    pivotX: num(anchor.pivotX, FALLBACK.pivotX),
    idle: frames(anchor.idle, LOTTA_IDLE_FRAMES, FALLBACK.idle),
    trot: frames(anchor.trot, LOTTA_TROT_FRAMES, FALLBACK.trot),
    ease: num(clock.easeSeconds, FALLBACK.ease),
    waitMin: num(clock.waitMin, FALLBACK.waitMin),
    waitMax: num(clock.waitMax, FALLBACK.waitMax),
    holdMin: num(clock.holdMin, FALLBACK.holdMin),
    holdMax: num(clock.holdMax, FALLBACK.holdMax),
    tilt: {
      back: num(tiltSrc.back, FALLBACK.tilt.back),
      up: num(tiltSrc.up, FALLBACK.tilt.up),
      side: num(tiltSrc.side, FALLBACK.tilt.side),
    },
  };
}

export function nextGlanceWait(): number {
  return rig.waitMin + Math.random() * Math.max(0, rig.waitMax - rig.waitMin);
}

export function nextGlanceHold(): number {
  return rig.holdMin + Math.random() * Math.max(0, rig.holdMax - rig.holdMin);
}

/** Seconds a glance takes to ease in, out, or back to forward when she starts to trot. */
export function glanceEaseSeconds(): number {
  return rig.ease;
}

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
  const row = (anim === 'trot' ? rig.trot : rig.idle)[frame] ?? (anim === 'trot' ? rig.trot[0] : rig.idle[0])!;
  return { dy: row.dy, pivotX: rig.pivotX, pivotY: row.pivotY };
}

export function glanceTilt(pose: GlancePose, weight: number): number {
  return rig.tilt[pose] * weight;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Ease 0→1 over the painted ease, hold, then ease 1→0 over the same span. */
export function glanceWeight(elapsed: number, duration: number): number {
  const ease = Math.min(rig.ease, duration / 2);
  if (ease <= 0) return elapsed < duration ? 1 : 0;
  if (elapsed <= ease) return smoothstep(elapsed / ease);
  const out = duration - ease;
  if (elapsed >= out) return smoothstep((duration - elapsed) / ease);
  return 1;
}

/**
 * Body, then a crossfade from the forward head to the glance head.
 * Both heads rotate about the neck join. Lighter compositing rebuilds the feathered neck.
 * Positive tilt is counter-clockwise. weight 0 is forward, weight 1 is the glance.
 */
export function composeLottaGlance(
  canvas: HTMLCanvasElement,
  body: CanvasImageSource,
  forward: CanvasImageSource,
  glance: CanvasImageSource,
  dy: number,
  pivotX: number,
  pivotY: number,
  tiltDeg: number,
  weight: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = Math.max(0, Math.min(1, weight));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(body, 0, 0);
  paintHead(ctx, forward, dy, pivotX, pivotY, 0, 1 - w);
  paintHead(ctx, glance, dy, pivotX, pivotY, tiltDeg * w, w);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function paintHead(
  ctx: CanvasRenderingContext2D,
  head: CanvasImageSource,
  dy: number,
  pivotX: number,
  pivotY: number,
  tiltDeg: number,
  alpha: number,
): void {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate((-tiltDeg * Math.PI) / 180);
  ctx.translate(-pivotX, -pivotY + dy);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(head, 0, 0);
  ctx.restore();
}
