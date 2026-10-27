export type Pt = { x: number; y: number };

export function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const crosses = a.y > p.y !== b.y > p.y;
    const xAt = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-6) + a.x;
    if (crosses && p.x < xAt) inside = !inside;
  }
  return inside;
}

function closestSeg(p: Pt, a: Pt, b: Pt): Pt {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

/** Convex walkable floors: inside points stay put, outside points snap to the edge. */
export function closestPoint(p: Pt, poly: Pt[]): Pt {
  if (pointInPoly(p, poly)) return { x: p.x, y: p.y };
  let best = poly[0]!;
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const q = closestSeg(p, poly[i]!, poly[(i + 1) % poly.length]!);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

export function hitEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}
