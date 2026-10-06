import { CUTOUT_SIDE, fitInside, ITEM_IMAGE_FILES, itemImagePath, THUMB_SIDE } from './images';

describe('itemImagePath', () => {
  it('keeps every image of a piece in its own folder', () => {
    const id = '0d95090d-e8c4-4717-b9ef-6a6cebac844c';
    expect(itemImagePath(id, 'original')).toBe(`items/${id}/original.jpg`);
    expect(itemImagePath(id, 'cutout')).toBe(`items/${id}/cutout.webp`);
    expect(itemImagePath(id, 'thumb')).toBe(`items/${id}/thumb.webp`);
  });

  it('refuses ids that could escape the folder', () => {
    expect(() => itemImagePath('../secrets', 'thumb')).toThrow();
  });

  it('saves cutouts and thumbs as WebP (alpha) and originals as JPEG', () => {
    expect(ITEM_IMAGE_FILES.cutout.endsWith('.webp')).toBe(true);
    expect(ITEM_IMAGE_FILES.original.endsWith('.jpg')).toBe(true);
  });
});

describe('fitInside', () => {
  it('scales the longer side down to the limit', () => {
    expect(fitInside(3024, 4032, CUTOUT_SIDE)).toEqual({ width: 900, height: 1200 });
    expect(fitInside(1600, 900, THUMB_SIDE)).toEqual({ width: 400, height: 225 });
  });

  it('never upscales and survives degenerate sizes', () => {
    expect(fitInside(300, 200, CUTOUT_SIDE)).toEqual({ width: 300, height: 200 });
    expect(fitInside(0, 10, 100)).toEqual({ width: 0, height: 0 });
    expect(fitInside(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});
