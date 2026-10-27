import type { HiddenObject, Hotspot } from './types';

export function inHotspot(nx: number, ny: number, spot: Hotspot): boolean {
  if (spot.kind === 'ellipse') {
    const dx = (nx - spot.cx) / spot.rx;
    const dy = (ny - spot.cy) / spot.ry;
    return dx * dx + dy * dy <= 1;
  }
  // Even-odd fill on a simple polygon.
  let inside = false;
  const pts = spot.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const hit = yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi + 0.00001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function hotspotBounds(spot: Hotspot, width: number, height: number): { x: number; y: number; w: number; h: number } {
  if (spot.kind === 'ellipse') {
    return {
      x: (spot.cx - spot.rx) * width,
      y: (spot.cy - spot.ry) * height,
      w: spot.rx * 2 * width,
      h: spot.ry * 2 * height,
    };
  }
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const [x, y] of spot.points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX * width, y: minY * height, w: (maxX - minX) * width, h: (maxY - minY) * height };
}

export function closestObject(nx: number, ny: number, list: HiddenObject[]): HiddenObject | null {
  let best: HiddenObject | null = null;
  let bestD = Infinity;
  for (const obj of list) {
    const spot = obj.spot;
    if (!inHotspot(nx, ny, spot)) continue;
    const dx = spot.kind === 'ellipse' ? (nx - spot.cx) / spot.rx : nx - spot.points[0][0];
    const dy = spot.kind === 'ellipse' ? (ny - spot.cy) / spot.ry : ny - spot.points[0][1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      best = obj;
      bestD = d;
    }
  }
  return best;
}
