/** On-screen figure sizes. Front height is about three quarters of a doorway. */

export const FIGURE = {
  frontPx: 320,
  backPx: 248,
  /** How many painted stride frames each detective uses. */
  strides: {
    crowe: 12,
    sara: 6,
    barty: 10,
    pip: 10,
    ondine: 10,
  } as Record<string, number>,
};

export function figurePixels(y: number): number {
  const t = Math.max(0, Math.min(1, (y - 535) / (602 - 535)));
  return FIGURE.backPx + t * (FIGURE.frontPx - FIGURE.backPx);
}

export function strideCount(detective: string): number {
  return FIGURE.strides[detective] ?? 6;
}

const heights = new Map<string, number>();

/** Opaque pixel height of a texture, so a short walk frame is not drawn smaller. */
export function opaqueHeight(source: CanvasImageSource, cacheKey: string): number {
  const cached = heights.get(cacheKey);
  if (cached) return cached;
  const width = 'width' in source ? Number(source.width) : 0;
  const height = 'height' in source ? Number(source.height) : 0;
  if (!width || !height) return 1;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return height;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height;
  let bottom = 0;
  const step = Math.max(1, Math.floor(width / 180));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        break;
      }
    }
  }
  const span = Math.max(1, bottom - top);
  heights.set(cacheKey, span);
  return span;
}
