import { paletteColor } from './color';
import { deltaE2000, detectColors, hexToLab, kmeans, nearestNamed, opaquePixels, rgbToLab } from './color-extract';

/** An RGBA buffer from runs of [hex, pixel count, alpha]. */
function pixels(runs: [string, number, number?][]): Uint8Array {
  const total = runs.reduce((n, [, count]) => n + count, 0);
  const data = new Uint8Array(total * 4);
  let i = 0;
  for (const [hex, count, alpha = 255] of runs) {
    const n = parseInt(hex.slice(1), 16);
    for (let p = 0; p < count; p++) {
      data[i++] = (n >> 16) & 255;
      data[i++] = (n >> 8) & 255;
      data[i++] = n & 255;
      data[i++] = alpha;
    }
  }
  return data;
}

describe('rgbToLab', () => {
  it('maps white, black and pure red to their reference values', () => {
    const white = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(white.L).toBeCloseTo(100, 1);
    expect(white.a).toBeCloseTo(0, 1);
    expect(white.b).toBeCloseTo(0, 1);
    expect(rgbToLab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 5);
    const red = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(red.L).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 1);
    expect(red.b).toBeCloseTo(67.2, 1);
  });
});

describe('deltaE2000', () => {
  // Reference pairs from Sharma, Wu & Dalal (2005), table 1.
  it.each([
    [{ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ L: 50, a: -1.3802, b: -84.2814 }, { L: 50, a: 0, b: -82.7485 }, 1.0],
    [{ L: 50, a: 2.49, b: -0.001 }, { L: 50, a: -2.49, b: 0.0009 }, 7.1792],
    [{ L: 50, a: 2.5, b: 0 }, { L: 73, a: 25, b: -18 }, 27.1492],
  ])('matches the published value %#', (x, y, expected) => {
    expect(deltaE2000(x, y)).toBeCloseTo(expected, 3);
    expect(deltaE2000(y, x)).toBeCloseTo(expected, 3);
  });

  it('is zero for identical colours', () => {
    expect(deltaE2000(hexToLab('#B98B5E'), hexToLab('#B98B5E'))).toBe(0);
  });
});

describe('nearestNamed', () => {
  it('names a palette colour as itself and a near miss as its neighbour', () => {
    expect(nearestNamed(hexToLab(paletteColor('Camel').hex)).color.name).toBe('Camel');
    expect(nearestNamed(hexToLab('#BE8E60')).color.name).toBe('Camel');
    expect(nearestNamed(hexToLab('#28364F')).color.name).toBe('Navy');
    expect(nearestNamed(hexToLab('#F7F5F0')).color.name).toBe('White');
  });
});

describe('opaquePixels', () => {
  it('ignores pixels with alpha under the threshold', () => {
    const { labs } = opaquePixels(
      pixels([
        ['#FF0000', 5, 0],
        ['#00FF00', 3, 127],
        ['#0000FF', 2, 128],
      ]),
    );
    expect(labs).toHaveLength(2);
  });
});

describe('kmeans', () => {
  it('separates two clear groups deterministically', () => {
    const { labs, rgbs } = opaquePixels(
      pixels([
        ['#B98B5E', 60],
        ['#26354E', 40],
      ]),
    );
    const first = kmeans(labs, rgbs, 2)
      .map((c) => c.count)
      .sort();
    const again = kmeans(labs, rgbs, 2)
      .map((c) => c.count)
      .sort();
    expect(first).toEqual([40, 60]);
    expect(again).toEqual(first);
  });

  it('returns fewer clusters than k when there are fewer colours', () => {
    const { labs, rgbs } = opaquePixels(pixels([['#B98B5E', 50]]));
    expect(kmeans(labs, rgbs, 3)).toHaveLength(1);
  });
});

describe('detectColors', () => {
  it('finds a camel coat with chocolate trim on a transparent background', () => {
    const colors = detectColors(
      pixels([
        ['#000000', 900, 0],
        ['#BC8D60', 700],
        ['#583B2A', 300],
      ]),
    );
    expect(colors.map((c) => c.name)).toEqual(['Camel', 'Chocolate']);
    expect(colors[0]?.coverage).toBeCloseTo(0.7, 2);
    expect(colors[0]?.hex).toBe(paletteColor('Camel').hex);
  });

  it('drops colours under 8% of the garment', () => {
    const colors = detectColors(
      pixels([
        ['#26354E', 950],
        ['#B8322A', 50],
      ]),
    );
    expect(colors.map((c) => c.name)).toEqual(['Navy']);
  });

  it('folds light and shadow of one colour into a single name', () => {
    const colors = detectColors(
      pixels([
        ['#B5542E', 500],
        ['#A84F2C', 300],
        ['#BB5A33', 200],
      ]),
    );
    expect(colors.map((c) => c.name)).toEqual(['Rust']);
  });

  it('returns at most three colours, largest first', () => {
    const colors = detectColors(
      pixels([
        ['#F5F3EE', 300],
        ['#26354E', 250],
        ['#B8322A', 200],
        ['#C9A03B', 150],
        ['#2F4B3A', 100],
      ]),
    );
    expect(colors.length).toBeLessThanOrEqual(3);
    expect(colors.map((c) => c.name)).toContain('White');
    const coverages = colors.map((c) => c.coverage);
    expect(coverages).toEqual([...coverages].sort((a, b) => b - a));
  });

  it('is empty for a fully transparent image', () => {
    expect(detectColors(pixels([['#B98B5E', 100, 0]]))).toEqual([]);
  });
});
