import {
  contrastRatio,
  FASHION_PALETTE,
  hexToHsl,
  hexToRgb,
  hueDistance,
  isNeutral,
  mixHex,
  paletteColor,
  rgbToHex,
} from './color';

describe('hexToHsl', () => {
  it('converts primaries and greys', () => {
    expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(hexToHsl('#00FF00').h).toBeCloseTo(120, 5);
    expect(hexToHsl('#0000FF').h).toBeCloseTo(240, 5);
    expect(hexToHsl('#808080')).toMatchObject({ h: 0, s: 0 });
  });
});

describe('hueDistance', () => {
  it('wraps around the wheel', () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(90, 60)).toBe(30);
  });
});

describe('isNeutral', () => {
  it('uses the palette flag for named colours', () => {
    expect(isNeutral({ hex: '#B98B5E', name: 'Camel' })).toBe(true);
    expect(isNeutral({ hex: '#B5542E', name: 'Rust' })).toBe(false);
  });

  it('falls back to saturation and lightness for other colours', () => {
    expect(isNeutral({ hex: '#7A7875' })).toBe(true);
    expect(isNeutral({ hex: '#FAFAF8' })).toBe(true);
    expect(isNeutral({ hex: '#2AA02A' })).toBe(false);
  });
});

describe('hex conversion', () => {
  it('parses long and short hex', () => {
    expect(hexToRgb('#B98B5E')).toEqual({ r: 185, g: 139, b: 94 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('round-trips and clamps', () => {
    expect(rgbToHex(hexToRgb('#2F4B3A'))).toBe('#2F4B3A');
    expect(rgbToHex({ r: 300, g: -4, b: 12.6 })).toBe('#FF000D');
  });
});

describe('mixHex', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('FASHION_PALETTE', () => {
  it('has unique names and valid hex values', () => {
    const names = FASHION_PALETTE.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of FASHION_PALETTE) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('looks colours up case-insensitively', () => {
    expect(paletteColor('camel').hex).toBe('#B98B5E');
    expect(() => paletteColor('Chartreuse')).toThrow();
  });
});
