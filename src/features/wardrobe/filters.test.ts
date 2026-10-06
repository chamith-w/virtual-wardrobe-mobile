import { paletteColor } from '@/lib/color';

import {
  activeFilterCount,
  colorSortKey,
  EMPTY_FILTERS,
  facetsOf,
  matchesFilters,
  matchesQuery,
  sortItems,
  sortSubtitle,
  toggleIn,
  type FilterableItem,
  type SortableItem,
} from './filters';

const c = (name: string) => {
  const p = paletteColor(name);
  return { hex: p.hex, name: p.name };
};

type Row = FilterableItem & SortableItem & { id: string };

const row = (id: string, over: Partial<Row>): Row => ({
  id,
  name: id,
  category: 'tshirts',
  subcategory: null,
  colors: [c('White')],
  brand: null,
  material: null,
  seasons: [],
  occasions: [],
  status: 'in_wardrobe',
  tags: [],
  createdAt: new Date(2026, 0, 1),
  wearCount: 0,
  lastWornAt: null,
  price: null,
  ...over,
});

const blazer = row('blazer', {
  name: 'Navy blazer',
  category: 'jackets',
  subcategory: 'Blazer',
  colors: [c('Navy')],
  brand: 'Arden Studio',
  material: 'Wool twill',
  seasons: ['autumn', 'winter'],
  occasions: ['work'],
  price: 240,
  wearCount: 18,
  createdAt: new Date(2025, 11, 1),
});
const dress = row('dress', {
  name: 'Rust slip dress',
  category: 'dresses',
  colors: [c('Rust')],
  brand: 'Atelier Sora',
  material: '100% silk',
  seasons: ['summer'],
  occasions: ['evening'],
  status: 'lent',
  price: 160,
  wearCount: 6,
  createdAt: new Date(2026, 1, 20),
});
const tee = row('tee', { name: 'White tee', price: 28, wearCount: 40, createdAt: new Date(2026, 3, 2) });
const scarf = row('scarf', { name: 'Rust scarf', category: 'scarves', colors: [c('Rust')], wearCount: 5 });

describe('matchesQuery', () => {
  it('needs every word to appear in name, brand, material, category or colour', () => {
    expect(matchesQuery(blazer, 'navy wool')).toBe(true);
    expect(matchesQuery(blazer, 'arden')).toBe(true);
    expect(matchesQuery(blazer, 'outerwear')).toBe(true);
    expect(matchesQuery(blazer, 'navy silk')).toBe(false);
    expect(matchesQuery(dress, '  ')).toBe(true);
  });
});

describe('matchesFilters', () => {
  it('passes everything with no filters', () => {
    expect(matchesFilters(blazer, EMPTY_FILTERS)).toBe(true);
  });

  it('ORs within a group and ANDs across groups', () => {
    const f = { ...EMPTY_FILTERS, groups: ['dresses' as const, 'accessories' as const], colors: ['Rust'] };
    expect(matchesFilters(dress, f)).toBe(true);
    expect(matchesFilters(scarf, f)).toBe(true);
    expect(matchesFilters(blazer, f)).toBe(false);
    expect(matchesFilters(dress, { ...f, statuses: ['in_wardrobe'] })).toBe(false);
  });

  it('treats pieces without seasons as all-year', () => {
    const f = { ...EMPTY_FILTERS, seasons: ['summer' as const] };
    expect(matchesFilters(tee, f)).toBe(true);
    expect(matchesFilters(blazer, f)).toBe(false);
  });

  it('filters by brand and occasion', () => {
    expect(matchesFilters(blazer, { ...EMPTY_FILTERS, brands: ['Arden Studio'] })).toBe(true);
    expect(matchesFilters(tee, { ...EMPTY_FILTERS, brands: ['Arden Studio'] })).toBe(false);
    expect(matchesFilters(dress, { ...EMPTY_FILTERS, occasions: ['work'] })).toBe(false);
  });
});

describe('helpers', () => {
  it('toggles membership', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('counts active filters', () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, colors: ['Rust', 'Navy'], brands: ['x'] })).toBe(3);
  });
});

describe('sortItems', () => {
  const rows = [blazer, dress, tee, scarf];

  it('sorts newest first', () => {
    expect(sortItems(rows, 'recent').map((r) => r.id)).toEqual(['tee', 'dress', 'scarf', 'blazer']);
  });

  it('sorts by wears both ways', () => {
    expect(sortItems(rows, 'most').map((r) => r.id)).toEqual(['tee', 'blazer', 'dress', 'scarf']);
    expect(sortItems(rows, 'least').map((r) => r.id)[0]).toBe('scarf');
  });

  it('sorts by cost per wear with unpriced pieces last', () => {
    expect(sortItems(rows, 'cpw').map((r) => r.id)).toEqual(['tee', 'blazer', 'dress', 'scarf']);
  });

  it('puts neutrals first (light to dark), then hues around the wheel', () => {
    expect(colorSortKey([c('White')])).toBeLessThan(colorSortKey([c('Navy')]));
    expect(colorSortKey([c('Navy')])).toBeLessThan(colorSortKey([c('Rust')]));
    expect(colorSortKey([c('Rust')])).toBeLessThan(colorSortKey([c('Sage')]));
    expect(colorSortKey([])).toBeGreaterThan(colorSortKey([c('Lilac')]));
  });

  it('arranges a whole rail around the wheel, neutrals grouped first', () => {
    const swatch = (name: string) => row(name, { name, colors: [c(name)] });
    const names = ['Sage', 'Navy', 'Red', 'White', 'Burgundy', 'Mustard', 'Black', 'Lilac', 'Rust', 'Camel', 'Sky'];
    const sorted = sortItems(names.map(swatch), 'color').map((r) => r.id);
    // Neutrals light to dark, then burgundy and red together, warm to cool.
    expect(sorted).toEqual([
      'White',
      'Camel',
      'Navy',
      'Black',
      'Burgundy',
      'Red',
      'Rust',
      'Mustard',
      'Sage',
      'Sky',
      'Lilac',
    ]);
  });

  it('sorts by the first colour and puts colourless pieces last', () => {
    const twoTone = row('two-tone', { colors: [c('Sky'), c('Rust')] });
    const none = row('none', { colors: [] });
    const rust = row('rust', { colors: [c('Rust')] });
    expect(sortItems([none, twoTone, rust], 'color').map((r) => r.id)).toEqual(['rust', 'two-tone', 'none']);
  });

  it('breaks colour ties by name', () => {
    const a = row('a', { name: 'B rust', colors: [c('Rust')] });
    const b = row('b', { name: 'A rust', colors: [c('Rust')] });
    expect(sortItems([a, b], 'color').map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('ranks cost per wear: unworn counts as one wear, free pieces first, no price last', () => {
    const gift = row('gift', { price: 0, wearCount: 0 });
    const unworn = row('unworn', { price: 30, wearCount: 0 });
    const cheapPerWear = row('cheap', { price: 300, wearCount: 100 });
    const unpriced = row('unpriced', { price: null, wearCount: 50 });
    expect(sortItems([unpriced, unworn, cheapPerWear, gift], 'cpw').map((r) => r.id)).toEqual([
      'gift',
      'cheap',
      'unworn',
      'unpriced',
    ]);
  });

  it('puts never-worn pieces first when sorting least worn', () => {
    const never = row('never', { wearCount: 0, lastWornAt: null });
    const once = row('once', { wearCount: 1, lastWornAt: new Date(2026, 8, 1) });
    const onceLongAgo = row('once-long-ago', { wearCount: 1, lastWornAt: new Date(2025, 0, 1) });
    expect(sortItems([once, onceLongAgo, never], 'least').map((r) => r.id)).toEqual(['never', 'once-long-ago', 'once']);
  });

  it('does not mutate the input', () => {
    const copy = [...rows];
    sortItems(rows, 'most');
    expect(rows).toEqual(copy);
  });
});

describe('sortSubtitle', () => {
  const now = new Date(2026, 9, 5);

  it('explains the active sort', () => {
    expect(sortSubtitle({ ...blazer, currency: 'USD' }, 'cpw', now)).toMatch(/per wear$/);
    expect(sortSubtitle(scarf, 'cpw', now)).toBe('No price yet');
    expect(sortSubtitle(blazer, 'most', now)).toBe('Worn 18×');
    expect(sortSubtitle(scarf, 'color', now)).toBe('Rust');
    expect(sortSubtitle({ ...tee, createdAt: new Date(2026, 9, 4) }, 'recent', now)).toBe('Added yesterday');
  });
});

describe('facetsOf', () => {
  it('lists only values that occur, with counts', () => {
    const f = facetsOf([blazer, dress, tee, scarf]);
    expect(f.groups.map((g) => g.value)).toEqual(['tops', 'dresses', 'outerwear', 'accessories']);
    expect(f.colors[0]).toMatchObject({ value: 'Rust', count: 2 });
    expect(f.statuses).toEqual([
      { value: 'in_wardrobe', count: 3 },
      { value: 'lent', count: 1 },
    ]);
    expect(f.brands.map((b) => b.value)).toEqual(['Arden Studio', 'Atelier Sora']);
  });
});
