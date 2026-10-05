import { gridTileHeight, swayFactor, trayTilt, zoneMeta, zoneSections } from './closet';

describe('zoneSections', () => {
  it('groups zones by type in order of first appearance', () => {
    const sections = zoneSections([
      { id: 'd1', type: 'drawer' as const, sortOrder: 3 },
      { id: 'r', type: 'rail' as const, sortOrder: 0 },
      { id: 's2', type: 'shelf' as const, sortOrder: 2 },
      { id: 's1', type: 'shelf' as const, sortOrder: 1 },
      { id: 'd2', type: 'drawer' as const, sortOrder: 4 },
    ]);
    expect(sections.map((s) => [s.type, s.zones.map((z) => z.id)])).toEqual([
      ['rail', ['r']],
      ['shelf', ['s1', 's2']],
      ['drawer', ['d1', 'd2']],
    ]);
  });
});

describe('zoneMeta', () => {
  it('counts pieces and those that are out', () => {
    expect(zoneMeta([{ status: 'in_wardrobe' }])).toBe('1 piece');
    expect(zoneMeta([{ status: 'in_wardrobe' }, { status: 'lent' }, { status: 'laundry' }])).toBe('3 pieces · 2 out');
    expect(zoneMeta([])).toBe('0 pieces');
  });
});

describe('swayFactor', () => {
  it('keeps heavy coats stiff and lets silk and dresses swing', () => {
    expect(swayFactor({ category: 'coats', material: '80% wool, 20% cashmere' })).toBe(0.7);
    expect(swayFactor({ category: 'dresses', material: '100% silk', subcategory: 'Slip' })).toBe(1.35);
    expect(swayFactor({ category: 'shirts', material: 'Silk crepe de chine' })).toBe(1.22);
    expect(swayFactor({ category: 'shirts' })).toBe(1.12);
  });

  it('stays inside the documented range', () => {
    for (const category of ['coats', 'jackets', 'dresses', 'skirts', 'tops'] as const) {
      const k = swayFactor({ category, material: 'silk wool puffer' });
      expect(k).toBeGreaterThanOrEqual(0.7);
      expect(k).toBeLessThanOrEqual(1.35);
    }
  });
});

describe('trayTilt', () => {
  it('is deterministic and within ±6°', () => {
    expect(trayTilt('abc')).toBe(trayTilt('abc'));
    for (const id of ['a', 'bb', 'f3b2c1', '1f9e7c3a-27e2-4b0e-9f0d-5d7a0e4b8c11']) {
      expect(Math.abs(trayTilt(id))).toBeLessThanOrEqual(6);
    }
  });
});

describe('gridTileHeight', () => {
  it('is tall for garments and short for shoes', () => {
    expect(gridTileHeight('coats')).toBe(176);
    expect(gridTileHeight('knitwear')).toBe(176);
    expect(gridTileHeight('shoes')).toBe(112);
    expect(gridTileHeight('bags')).toBe(134);
  });
});
