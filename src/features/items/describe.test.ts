import { detailRows, detailStats, itemByline, itemEyebrow, seasonsLabel } from './describe';

const now = new Date(2026, 9, 6, 9, 0);

describe('detailStats', () => {
  const coat = {
    wearCount: 23,
    lastWornAt: new Date(2026, 8, 30, 12),
    price: 390,
    currency: 'USD',
    createdAt: new Date(2025, 7, 20),
  };

  it('fills the four tiles', () => {
    expect(detailStats(coat, now, 'en-US')).toEqual({
      timesWorn: '23',
      costPerWear: '$17',
      lastWorn: '6 days ago',
      sinceAdded: '412 days',
    });
  });

  it('prices an unworn piece as one wear and says it was never worn', () => {
    const fresh = { ...coat, wearCount: 0, lastWornAt: null, createdAt: now };
    expect(detailStats(fresh, now, 'en-US')).toEqual({
      timesWorn: '0',
      costPerWear: '$390',
      lastWorn: 'Never',
      sinceAdded: 'Today',
    });
  });

  it('dashes the cost per wear without a price', () => {
    expect(detailStats({ ...coat, price: null }, now, 'en-US').costPerWear).toBe('—');
  });

  it('keeps cents for small amounts, including free pieces', () => {
    expect(detailStats({ ...coat, price: 28, wearCount: 40 }, now, 'en-US').costPerWear).toBe('$0.70');
    expect(detailStats({ ...coat, price: 0 }, now, 'en-US').costPerWear).toBe('$0.00');
  });

  it('says "1 day" the day after it was added', () => {
    expect(detailStats({ ...coat, createdAt: new Date(2026, 9, 5, 23, 30) }, now).sinceAdded).toBe('1 day');
  });
});

describe('itemEyebrow', () => {
  it('pairs the group with the subcategory', () => {
    expect(itemEyebrow({ category: 'coats', subcategory: 'Overcoat' })).toBe('Outerwear · Overcoat');
  });

  it('falls back to the category and avoids repeating the group', () => {
    expect(itemEyebrow({ category: 'jeans', subcategory: null })).toBe('Bottoms · Jeans');
    expect(itemEyebrow({ category: 'dresses', subcategory: '' })).toBe('Dresses');
  });
});

describe('itemByline', () => {
  it('joins brand and size, or shows whichever is known', () => {
    expect(itemByline({ brand: 'Maison Lune', size: '38' })).toBe('Maison Lune · Size 38');
    expect(itemByline({ brand: null, size: 'M' })).toBe('Size M');
    expect(itemByline({ brand: ' ', size: null })).toBeNull();
  });
});

describe('seasonsLabel', () => {
  it('orders seasons and collapses all or none to "All year"', () => {
    expect(seasonsLabel(['winter', 'autumn'])).toBe('Autumn, Winter');
    expect(seasonsLabel([])).toBe('All year');
    expect(seasonsLabel(['summer', 'winter', 'spring', 'autumn'])).toBe('All year');
  });
});

describe('detailRows', () => {
  it('lists what is known and skips the rest', () => {
    const rows = detailRows(
      {
        material: '80% wool, 20% cashmere',
        pattern: null,
        careNotes: 'Dry clean only',
        seasons: ['autumn', 'winter'],
        occasions: ['work', 'evening'],
        purchaseDate: new Date(2025, 7, 20),
        store: 'Online',
        price: 390,
        currency: 'USD',
      },
      'en-US',
    );
    expect(rows).toEqual([
      { label: 'Material', value: '80% wool, 20% cashmere' },
      { label: 'Care', value: 'Dry clean only' },
      { label: 'Seasons', value: 'Autumn, Winter' },
      { label: 'Occasions', value: 'Work, Evening' },
      { label: 'Purchased', value: 'Aug 2025 · Online' },
      { label: 'Price', value: '$390' },
    ]);
  });

  it('always shows seasons, even for a bare piece', () => {
    const bare = {
      material: null,
      pattern: null,
      careNotes: null,
      seasons: [],
      occasions: [],
      purchaseDate: null,
      store: null,
      price: null,
      currency: null,
    };
    expect(detailRows(bare)).toEqual([{ label: 'Seasons', value: 'All year' }]);
  });
});
