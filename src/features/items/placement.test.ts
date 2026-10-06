import {
  applyStatus,
  moveToWardrobe,
  zoneAfterCategoryChange,
  zoneFor,
  type PlacedItem,
  wardrobeForNewPiece,
  type WardrobeLite,
  type ZoneLite,
} from './placement';

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
  statusChangedAt: null,
  lentTo: null,
  lentAt: null,
  remindAt: null,
  readyAt: null,
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
      statusChangedAt: now,
      lentTo: null,
      lentAt: now,
      remindAt: null,
      readyAt: null,
    });
  });

  it('leaves the piece in place when there is no storage wardrobe', () => {
    expect(applyStatus(coat, 'storage', [wardrobes[0]!], zones, now)).toMatchObject({
      wardrobeId: 'home',
      status: 'storage',
    });
  });
});

describe('zoneAfterCategoryChange', () => {
  it('follows the new category when the piece sat in its default kind of zone', () => {
    const top = { wardrobeId: 'home', zoneId: 'h-rail', category: 'tops' as const };
    expect(zoneAfterCategoryChange(top, 'tshirts', zones)).toBe('h-shelf');
  });

  it('stays put when the new category uses the same kind of zone', () => {
    const shirt = { wardrobeId: 'home', zoneId: 'h-rail', category: 'shirts' as const };
    expect(zoneAfterCategoryChange(shirt, 'dresses', zones)).toBe('h-rail');
  });

  it('respects a zone the user dragged the piece to', () => {
    // A coat moved onto a shelf by hand stays there when retagged as a jacket.
    const coatOnShelf = { wardrobeId: 'home', zoneId: 'h-shelf', category: 'coats' as const };
    expect(zoneAfterCategoryChange(coatOnShelf, 'jackets', zones)).toBe('h-shelf');
  });

  it('places a piece with no zone, or a zone in another wardrobe', () => {
    expect(zoneAfterCategoryChange({ wardrobeId: 'home', zoneId: null, category: 'tops' }, 'shoes', zones)).toBe(
      'h-shoes',
    );
    expect(zoneAfterCategoryChange({ wardrobeId: 'home', zoneId: 's-rail', category: 'tops' }, 'socks', zones)).toBe(
      'h-drawer',
    );
  });

  it('changes nothing when the category is unchanged', () => {
    expect(zoneAfterCategoryChange({ wardrobeId: 'home', zoneId: 'h-shoes', category: 'tops' }, 'tops', zones)).toBe(
      'h-shoes',
    );
  });
});

describe('wardrobeForNewPiece', () => {
  it('uses the wardrobe on show', () => {
    expect(wardrobeForNewPiece(wardrobes, 'home')?.id).toBe('home');
  });

  it('never hangs a new piece in storage', () => {
    expect(wardrobeForNewPiece(wardrobes, 'storage')?.id).toBe('home');
  });

  it('defaults to home, or to whatever exists', () => {
    expect(wardrobeForNewPiece(wardrobes, null)?.id).toBe('home');
    expect(wardrobeForNewPiece([{ id: 'box', icon: 'archive', sortOrder: 0 }], null)?.id).toBe('box');
    expect(wardrobeForNewPiece([], null)).toBeUndefined();
  });
});
