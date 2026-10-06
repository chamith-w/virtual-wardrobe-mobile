import type { Category } from '@/features/items/catalog';
import type { ZoneLite } from '@/features/items/placement';

import { gridTileHeight, groupByZone, resolveDrop, swayFactor, trayTilt, zoneMeta, zoneSections } from './closet';

const homeZones: ZoneLite[] = [
  { id: 'rail', wardrobeId: 'home', type: 'rail', sortOrder: 0 },
  { id: 'knit', wardrobeId: 'home', type: 'shelf', sortOrder: 1 },
  { id: 'denim', wardrobeId: 'home', type: 'shelf', sortOrder: 2 },
  { id: 'socks', wardrobeId: 'home', type: 'drawer', sortOrder: 3 },
  { id: 'shoes', wardrobeId: 'home', type: 'shoes', sortOrder: 4 },
  { id: 'tray', wardrobeId: 'home', type: 'accessories', sortOrder: 5 },
];
const piece = (id: string, category: Category, zoneId: string | null) => ({ id, category, zoneId, wardrobeId: 'home' });

describe('groupByZone', () => {
  it('keeps each piece in its own zone, in the order given', () => {
    const grouped = groupByZone(
      [piece('c', 'coats', 'rail'), piece('k', 'knitwear', 'denim'), piece('d', 'dresses', 'rail')],
      homeZones,
    );
    expect(grouped.get('rail')?.map((p) => p.id)).toEqual(['c', 'd']);
    expect(grouped.get('denim')?.map((p) => p.id)).toEqual(['k']);
    expect(grouped.has('knit')).toBe(false);
  });

  it('hangs new and orphaned pieces in their category default zone', () => {
    const grouped = groupByZone(
      [
        piece('new-coat', 'coats', null),
        piece('new-boots', 'shoes', null),
        piece('new-socks', 'socks', null),
        piece('stray-bag', 'bags', 'deleted-zone'),
        piece('tee', 'tshirts', 'storage-shelf'),
      ],
      homeZones,
    );
    expect(grouped.get('rail')?.map((p) => p.id)).toEqual(['new-coat']);
    expect(grouped.get('shoes')?.map((p) => p.id)).toEqual(['new-boots']);
    expect(grouped.get('socks')?.map((p) => p.id)).toEqual(['new-socks']);
    expect(grouped.get('tray')?.map((p) => p.id)).toEqual(['stray-bag']);
    expect(grouped.get('knit')?.map((p) => p.id)).toEqual(['tee']);
  });

  it('drops pieces when the wardrobe has no zones at all', () => {
    expect(groupByZone([piece('c', 'coats', null)], []).size).toBe(0);
  });
});

describe('resolveDrop', () => {
  const zones = [...homeZones, { id: 's-rail', wardrobeId: 'storage', type: 'rail' as const, sortOrder: 0 }];

  it('moves a coat from the rail to a shelf', () => {
    expect(resolveDrop('rail', 'knit', zones)?.id).toBe('knit');
  });

  it('ignores drops on the same zone or outside every zone', () => {
    expect(resolveDrop('rail', 'rail', zones)).toBeNull();
    expect(resolveDrop('rail', '', zones)).toBeNull();
    expect(resolveDrop('rail', 'nowhere', zones)).toBeNull();
  });

  it('never moves a piece into another wardrobe', () => {
    expect(resolveDrop('rail', 's-rail', zones)).toBeNull();
  });

  it('accepts a piece whose zone is unknown', () => {
    expect(resolveDrop(null, 'shoes', zones)?.id).toBe('shoes');
  });
});

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
