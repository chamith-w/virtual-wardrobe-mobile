import { applyStatus, moveToWardrobe, zoneFor, type PlacedItem, type WardrobeLite, type ZoneLite } from './placement';

const wardrobes: WardrobeLite[] = [
  { id: 'home', icon: 'home', sortOrder: 0 },
  { id: 'storage', icon: 'archive', sortOrder: 1 },
];

const zones: ZoneLite[] = [
  { id: 'h-rail', wardrobeId: 'home', type: 'rail', sortOrder: 0 },
  { id: 'h-shelf', wardrobeId: 'home', type: 'shelf', sortOrder: 1 },
  { id: 'h-drawer', wardrobeId: 'home', type: 'drawer', sortOrder: 3 },
  { id: 'h-shoes', wardrobeId: 'home', type: 'shoes', sortOrder: 6 },
  { id: 's-rail', wardrobeId: 'storage', type: 'rail', sortOrder: 0 },
  { id: 's-shelf', wardrobeId: 'storage', type: 'shelf', sortOrder: 1 },
];

const now = new Date(2026, 9, 5);

const coat: PlacedItem = {
  wardrobeId: 'home',
  zoneId: 'h-rail',
  category: 'coats',
  status: 'in_wardrobe',
  lentTo: null,
  lentAt: null,
};

describe('zoneFor', () => {
  it('keeps the kind of zone the piece is in', () => {
    expect(zoneFor(zones, 'storage', 'knitwear', 'shelf')).toBe('s-shelf');
  });

  it('falls back to the category default, then folded zones, then the first zone', () => {
    expect(zoneFor(zones, 'storage', 'coats')).toBe('s-rail');
    expect(zoneFor(zones, 'storage', 'socks')).toBe('s-shelf');
    expect(zoneFor(zones, 'storage', 'shoes')).toBe('s-rail');
    expect(zoneFor(zones, 'nowhere', 'shoes')).toBeNull();
  });
});

describe('moveToWardrobe', () => {
  it('marks a piece as stored when it moves into storage', () => {
    expect(moveToWardrobe(coat, 'storage', wardrobes, zones, now)).toMatchObject({
      wardrobeId: 'storage',
      zoneId: 's-rail',
      status: 'storage',
    });
  });

  it('returns a stored piece to the wardrobe', () => {
    const stored: PlacedItem = { ...coat, wardrobeId: 'storage', zoneId: 's-rail', status: 'storage' };
    expect(moveToWardrobe(stored, 'home', wardrobes, zones, now)).toMatchObject({
      wardrobeId: 'home',
      zoneId: 'h-rail',
      status: 'in_wardrobe',
    });
  });
});

describe('applyStatus', () => {
  it('carries a piece to storage when "In storage" is picked', () => {
    expect(applyStatus(coat, 'storage', wardrobes, zones, now)).toMatchObject({
      wardrobeId: 'storage',
      status: 'storage',
    });
  });

  it('brings a stored piece home for any other status', () => {
    const stored: PlacedItem = { ...coat, wardrobeId: 'storage', zoneId: 's-rail', status: 'storage' };
    expect(applyStatus(stored, 'laundry', wardrobes, zones, now)).toMatchObject({
      wardrobeId: 'home',
      zoneId: 'h-rail',
      status: 'laundry',
    });
  });

  it('only changes status (and lending) otherwise', () => {
    expect(applyStatus(coat, 'lent', wardrobes, zones, now)).toEqual({
      wardrobeId: 'home',
      zoneId: 'h-rail',
      status: 'lent',
      lentTo: null,
      lentAt: now,
    });
  });

  it('leaves the piece in place when there is no storage wardrobe', () => {
    expect(applyStatus(coat, 'storage', [wardrobes[0]!], zones, now)).toMatchObject({
      wardrobeId: 'home',
      status: 'storage',
    });
  });
});
