/**
 * Where the garment sits inside its cutout image. Phase 3 cutouts are cropped
 * close, but others (the demo set, kept originals) carry transparent margins,
 * and the board's outline, snapping and hit tests should hug the garment.
 * Pure — safe to import from tests.
 */

/** A rectangle in fractions of the image (0–1). */
export type UnitRect = { x: number; y: number; width: number; height: number };

export const FULL_IMAGE: UnitRect = { x: 0, y: 0, width: 1, height: 1 };

/** Alpha at or above this counts as garment, so soft shadows and fringes don't. */
const ALPHA_THRESHOLD = 40;

/**
 * The bounds of the opaque pixels in an RGBA buffer, grown by one sample on
 * each side (a 64px sample is coarse) and as a fraction of the image. The
 * whole image when nothing is opaque.
 */
export function opaqueBounds(data: Uint8Array, width: number, height: number): UnitRect {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < ALPHA_THRESHOLD) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return FULL_IMAGE;
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(width - 1, x1 + 1);
  y1 = Math.min(height - 1, y1 + 1);
  return { x: x0 / width, y: y0 / height, width: (x1 - x0 + 1) / width, height: (y1 - y0 + 1) / height };
}

/** Width ÷ height of the garment itself, for an image of `imageAspect` (width ÷ height). */
export function garmentAspect(bounds: UnitRect, imageAspect: number): number {
  return (bounds.width / bounds.height) * imageAspect;
}

/**
 * Where to draw the whole image so its garment fills a `width` × `height`
 * box centred on the origin.
 */
export function imageRectForGarment(
  bounds: UnitRect,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const w = width / bounds.width;
  const h = height / bounds.height;
  return { x: -width / 2 - bounds.x * w, y: -height / 2 - bounds.y * h, width: w, height: h };
}
