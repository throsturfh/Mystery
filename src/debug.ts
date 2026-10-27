import { H, W } from './config';
import { getSave, persist } from './state';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function announce(text: string): void {
  const live = document.getElementById('live');
  if (live) live.textContent = text;
  const step = document.getElementById('debug-step');
  if (step) step.textContent = text;
}

export function publish(opts: {
  regions: Record<string, Rect>;
  beatReady: boolean;
  line: string;
}): void {
  announce(opts.line);
  const prev = window.__hollowmere;
  window.__hollowmere = {
    ready: true,
    width: W,
    height: H,
    regions: opts.regions,
    beatReady: opts.beatReady,
    last: prev?.last ?? null,
    getSave: () => structuredClone(getSave()),
    debugSetLastTick: (ts: number) => {
      const save = getSave();
      save.lastTick = ts;
      persist(save);
    },
  };
}

export function notePointer(p: { x: number; y: number }): void {
  if (window.__hollowmere) window.__hollowmere.last = { x: p.x, y: p.y };
}
