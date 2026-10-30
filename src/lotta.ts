/** Lotta v6. Full painted frames, baseline on the paws. No separate head layer. */
import { saraScale } from './saraWalk';
import trotDoc from '../public/assets/lotta/trot.json';

export const LOTTA_FRAME_W = 860;
export const LOTTA_FRAME_H = 520;
/** Stable body centre. The feet travel inside the frame; this point does not. */
export const LOTTA_ANCHOR_X = 512;
export const LOTTA_BASELINE_Y = 495;
export const LOTTA_ORIGIN_X = LOTTA_ANCHOR_X / LOTTA_FRAME_W;
export const LOTTA_ORIGIN_Y = LOTTA_BASELINE_Y / LOTTA_FRAME_H;
export const LOTTA_FPS = 12;
export const LOTTA_TROT_FRAMES = 12;
export const LOTTA_IDLE_FRAMES = 24;
export const LOTTA_SETTLE_FRAMES = 6;
export const LOTTA_STAND_GLANCE_FRAMES = 14;
/** Canvas pixels the stance paw travels on each trot frame. */
export const LOTTA_TROT_STEP = 17.92;

/**
 * Height of the previous dog above her paw anchor, over the v6 dog above the baseline.
 * Keeps her the same size next to Sara.
 */
const PREVIOUS_ABOVE_PAW = 213.5;
const V6_ABOVE_BASELINE = 375;
export const LOTTA_SIZE = PREVIOUS_ABOVE_PAW / V6_ABOVE_BASELINE;

export const GLANCE_POSES = ['up', 'side', 'back'] as const;
export type GlancePose = (typeof GLANCE_POSES)[number];
export type TrotVariant = 'fwd' | 'up_half' | 'up_full' | 'side_half' | 'side_full' | 'back_full';

const TROT_VARIANTS: TrotVariant[] = ['fwd', 'up_half', 'up_full', 'side_half', 'side_full', 'back_full'];

const FALLBACK_GLANCE: Record<GlancePose, TrotVariant[]> = {
  up: ['fwd', 'up_half', 'up_half', 'up_full', 'up_full', 'up_full', 'up_full', 'up_full', 'up_full', 'up_full', 'up_full', 'up_half', 'up_half', 'fwd'],
  side: ['fwd', 'side_half', 'side_half', 'side_full', 'side_full', 'side_full', 'side_full', 'side_full', 'side_full', 'side_full', 'side_full', 'side_half', 'side_half', 'fwd'],
  back: ['fwd', 'side_half', 'side_full', 'back_full', 'back_full', 'back_full', 'back_full', 'back_full', 'back_full', 'back_full', 'back_full', 'side_full', 'side_half', 'fwd'],
};

const FALLBACK_SETTLE = [13.44, 8.96, 5.38, 2.69, 0.9, 0];

let stride = LOTTA_TROT_STEP;
let glances = FALLBACK_GLANCE;
let settleDx = FALLBACK_SETTLE;

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function variants(value: unknown, fallback: TrotVariant[]): TrotVariant[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const rows = value.filter((item): item is TrotVariant => TROT_VARIANTS.includes(item as TrotVariant));
  return rows.length > 0 ? rows : fallback;
}

/** Stride, trot-glance order, and settle offsets from the painted trot.json. */
export function installLottaRig(doc: unknown): void {
  const root = doc && typeof doc === 'object' ? (doc as {
    trot?: { stride_px_per_frame?: unknown };
    trot_glances?: Record<string, { variant_sequence?: unknown }>;
    settle?: { dx_px_per_frame?: unknown };
  }) : {};
  stride = num(root.trot?.stride_px_per_frame, LOTTA_TROT_STEP);
  const next = { ...FALLBACK_GLANCE };
  for (const pose of GLANCE_POSES) {
    next[pose] = variants(root.trot_glances?.[pose]?.variant_sequence, FALLBACK_GLANCE[pose]);
  }
  glances = next;
  if (Array.isArray(root.settle?.dx_px_per_frame) && root.settle.dx_px_per_frame.length >= LOTTA_SETTLE_FRAMES) {
    settleDx = root.settle.dx_px_per_frame.slice(0, LOTTA_SETTLE_FRAMES).map((item, index) => num(item, FALLBACK_SETTLE[index] ?? 0));
  }
}

export function lottaStride(): number {
  return stride;
}

export function trotGlanceSequence(pose: GlancePose): readonly TrotVariant[] {
  return glances[pose];
}

export function settleShift(index: number): number {
  return settleDx[index] ?? 0;
}

/** Same on-screen height as the previous Lotta, at Sara's depth scale. */
export function lottaScale(y: number): number {
  return saraScale(y) * LOTTA_SIZE;
}

/** Screen pixels per second. One painted frame is one planted step. */
export function lottaSpeed(y: number): number {
  return stride * lottaScale(y) * LOTTA_FPS;
}

export function nextGlanceWait(): number {
  return 4 + Math.random() * 3;
}

export function lottaTrotKey(variant: TrotVariant, frame: number): string {
  return `lotta-trot-${variant}-${frame.toString().padStart(2, '0')}`;
}

export function lottaIdleKey(frame: number): string {
  return `lotta-idle-${frame.toString().padStart(2, '0')}`;
}

export function lottaSettleKey(from: number, index: number): string {
  return `lotta-settle-${from.toString().padStart(2, '0')}-${index}`;
}

export function lottaStandKey(pose: GlancePose, frame: number): string {
  return `lotta-stand-${pose}-${frame.toString().padStart(2, '0')}`;
}

export function lottaTrotVariants(): readonly TrotVariant[] {
  return TROT_VARIANTS;
}

installLottaRig(trotDoc);
