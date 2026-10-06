/**
 * Sizes and file names for a saved piece's images. Pure — safe to import
 * from tests. Layout: documents/items/<itemId>/{original.jpg, cutout.webp, thumb.webp}
 */

/** Longest side of the full cutout shown on item detail. */
export const CUTOUT_SIDE = 1200;
/** Longest side of the list thumbnail. */
export const THUMB_SIDE = 400;
/** Longest side of the kept original photo (and of the working copy segmentation sees). */
export const PHOTO_SIDE = 2048;

export const ITEM_IMAGE_FILES = {
  original: 'original.jpg',
  cutout: 'cutout.webp',
  thumb: 'thumb.webp',
} as const;

export type ItemImageKind = keyof typeof ITEM_IMAGE_FILES;

/** Path of an item image relative to the documents directory. */
export function itemImagePath(itemId: string, kind: ItemImageKind): string {
  if (!/^[A-Za-z0-9-]+$/.test(itemId)) throw new Error(`Unexpected item id: ${itemId}`);
  return `items/${itemId}/${ITEM_IMAGE_FILES[kind]}`;
}

/** Size that fits inside `maxSide` × `maxSide`, never upscaling. */
export function fitInside(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
