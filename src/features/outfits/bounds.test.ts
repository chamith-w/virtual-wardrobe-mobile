import { FULL_IMAGE, garmentAspect, imageRectForGarment, opaqueBounds } from './bounds';

/** A w × h RGBA buffer with the given cells opaque. */
function buffer(w: number, h: number, opaque: [number, number][]): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (const [x, y] of opaque) data[(y * w + x) * 4 + 3] = 255;
  return data;
}

describe('opaqueBounds', () => {
  it('finds the garment inside transparent margins, one sample generous', () => {
    const b = opaqueBounds(
      buffer(10, 10, [
        [4, 3],
        [6, 7],
      ]),
      10,
      10,
    );
    expect(b).toEqual({ x: 0.3, y: 0.2, width: 0.5, height: 0.7 });
  });

  it('ignores faint pixels and falls back to the whole image', () => {
    const faint = new Uint8Array(4 * 4 * 4).fill(20);
    expect(opaqueBounds(faint, 4, 4)).toEqual(FULL_IMAGE);
  });

  it('stays inside the image at the edges', () => {
    expect(
      opaqueBounds(
        buffer(4, 4, [
          [0, 0],
          [3, 3],
        ]),
        4,
        4,
      ),
    ).toEqual(FULL_IMAGE);
  });
});

describe('garment geometry', () => {
  it('measures the garment’s own aspect', () => {
    // Shoes in the middle third of a landscape image.
    expect(garmentAspect({ x: 0, y: 0.33, width: 1, height: 0.33 }, 1200 / 843)).toBeCloseTo(4.31, 1);
  });

  it('draws the image so its garment fills the box', () => {
    const bounds = { x: 0.25, y: 0.1, width: 0.5, height: 0.8 };
    const r = imageRectForGarment(bounds, 100, 160);
    expect(r).toEqual({ x: -50 - 50, y: -80 - 20, width: 200, height: 200 });
    // The garment's left edge lands on the box's left edge.
    expect(r.x + bounds.x * r.width).toBeCloseTo(-50);
    expect(r.y + (bounds.y + bounds.height) * r.height).toBeCloseTo(80);
  });
});
