import type { Item } from '@/db/schema';
import { paletteColor } from '@/lib/color';

import {
  addTags,
  draftFromItem,
  draftToFields,
  emptyDraft,
  isFutureMonth,
  materialHas,
  MAX_COLORS,
  monthKey,
  monthStart,
  parsePrice,
  purchaseYears,
  suggestBrands,
  suggestName,
  toggleColor,
  toggleMaterial,
  validateDraft,
  withSuggestedName,
  type ItemDraft,
} from './draft';

const c = (name: string) => ({ name, hex: paletteColor(name).hex });

describe('suggestName', () => {
  const base = { colors: [c('Camel')], category: 'coats' as const, subcategory: '', material: '' };

  it('names the piece from colour and category', () => {
    expect(suggestName(base)).toBe('Camel coat');
  });

  it('adds a single naming material', () => {
    expect(suggestName({ ...base, material: '80% wool' })).toBe('Camel wool coat');
    expect(suggestName({ ...base, material: 'Wool, Cashmere' })).toBe('Camel coat');
    expect(suggestName({ ...base, material: 'Polyester' })).toBe('Camel coat');
  });

  it('uses the subcategory, alone when it already names the piece', () => {
    expect(suggestName({ ...base, colors: [c('Rust')], category: 'dresses', subcategory: 'Slip' })).toBe(
      'Rust slip dress',
    );
    expect(suggestName({ ...base, colors: [c('Navy')], category: 'jackets', subcategory: 'Blazer' })).toBe(
      'Navy blazer',
    );
    expect(
      suggestName({ ...base, colors: [c('Ecru')], category: 'shirts', subcategory: 'Linen shirt', material: 'Linen' }),
    ).toBe('Ecru linen shirt');
  });

  it('falls back gracefully', () => {
    expect(suggestName({ ...base, colors: [], category: null })).toBe('New piece');
    expect(suggestName({ ...base, category: null })).toBe('Camel piece');
    expect(suggestName({ ...base, colors: [] })).toBe('Coat');
  });
});

describe('withSuggestedName', () => {
  it('follows the fields until the user types a name', () => {
    const draft = emptyDraft('USD', { category: 'coats', colors: [c('Camel')] });
    expect(draft.name).toBe('Camel coat');
    expect(withSuggestedName({ ...draft, category: 'jackets' }).name).toBe('Camel jacket');
    expect(withSuggestedName({ ...draft, name: 'Grandpa’s coat', nameEdited: true }).name).toBe('Grandpa’s coat');
  });
});

describe('emptyDraft', () => {
  it('starts from detected colours (at most three) and the currency', () => {
    const draft = emptyDraft('EUR', { colors: [c('Camel'), c('Navy'), c('Rust'), c('Sage')] });
    expect(draft.colors).toHaveLength(MAX_COLORS);
    expect(draft.currency).toBe('EUR');
    expect(draft.category).toBeNull();
  });
});

describe('parsePrice', () => {
  it.each([
    ['', null],
    ['  ', null],
    ['49', 49],
    ['49.90', 49.9],
    ['49,90', 49.9],
    ['1,299', 1299],
    ['1,299.50', 1299.5],
    ['€ 39', 39],
    ['$1.234', 1.23],
  ])('reads %p as %p', (text, expected) => {
    expect(parsePrice(text)).toBe(expected);
  });

  it('is NaN for things that are not prices', () => {
    expect(parsePrice('cheap')).toBeNaN();
    expect(parsePrice('1.2.3')).toBeNaN();
  });
});

describe('materials', () => {
  it('detects and toggles known materials inside free text', () => {
    expect(materialHas('80% wool, 20% cashmere', 'Wool')).toBe(true);
    expect(materialHas('Woolen blend', 'Wool')).toBe(false);
    expect(toggleMaterial('80% wool, 20% cashmere', 'Cashmere')).toBe('80% wool');
    expect(toggleMaterial('80% wool', 'Silk')).toBe('80% wool, Silk');
    expect(toggleMaterial('', 'Linen')).toBe('Linen');
  });
});

describe('toggleColor', () => {
  it('adds up to three colours and removes by name', () => {
    let colors = toggleColor([], c('Camel'));
    colors = toggleColor(colors, c('Navy'));
    colors = toggleColor(colors, c('Rust'));
    expect(toggleColor(colors, c('Sage'))).toHaveLength(3);
    expect(toggleColor(colors, c('Navy')).map((x) => x.name)).toEqual(['Camel', 'Rust']);
  });
});

describe('addTags', () => {
  it('splits, cleans and de-duplicates', () => {
    expect(addTags(['work'], ' Winter staple, #Investment ,work,, ')).toEqual(['work', 'winter staple', 'investment']);
  });
});

describe('months', () => {
  const now = new Date(2026, 9, 6);

  it('round-trips a month key at noon on the 1st', () => {
    expect(monthKey(new Date(2025, 7, 20))).toBe('2025-08');
    const start = monthStart('2025-08');
    expect(start?.getFullYear()).toBe(2025);
    expect(start?.getMonth()).toBe(7);
    expect(start?.getDate()).toBe(1);
    expect(start?.getHours()).toBe(12);
    expect(monthStart('2025-13')).toBeNull();
    expect(monthStart('soon')).toBeNull();
  });

  it('offers recent years and blocks future months', () => {
    expect(purchaseYears(now, 3)).toEqual([2026, 2025, 2024]);
    expect(isFutureMonth(2026, 10, now)).toBe(false);
    expect(isFutureMonth(2026, 11, now)).toBe(true);
    expect(isFutureMonth(2027, 1, now)).toBe(true);
  });
});

describe('suggestBrands', () => {
  const brands = ['Maison Lune', 'Atelier Sora', 'Arden Studio', 'Northline', 'Maison Lune'];

  it('puts prefix matches first and skips an exact match', () => {
    expect(suggestBrands('a', brands)).toEqual(['Atelier Sora', 'Arden Studio', 'Maison Lune']);
    expect(suggestBrands('maison lune', brands)).toEqual([]);
    expect(suggestBrands('', brands, 2)).toEqual(['Maison Lune', 'Atelier Sora']);
  });
});

describe('validateDraft and draftToFields', () => {
  const valid: ItemDraft = {
    ...emptyDraft('USD', { category: 'coats', colors: [c('Camel')] }),
    brand: ' Maison Lune ',
    price: '390',
    purchased: '2025-08',
    material: '80% wool, 20% cashmere',
    tags: ['investment'],
  };

  it('needs a name and a category, and a readable price', () => {
    expect(validateDraft(valid)).toEqual({});
    expect(validateDraft({ ...valid, name: '  ', nameEdited: true })).toHaveProperty('name');
    expect(validateDraft({ ...valid, category: null })).toHaveProperty('category');
    expect(validateDraft({ ...valid, price: 'lots' })).toHaveProperty('price');
    expect(validateDraft({ ...valid, price: '' })).toEqual({});
  });

  it('maps a valid draft to clean columns', () => {
    const fields = draftToFields(valid);
    expect(fields).toMatchObject({
      name: 'Camel coat',
      category: 'coats',
      subcategory: null,
      brand: 'Maison Lune',
      price: 390,
      currency: 'USD',
      material: '80% wool, 20% cashmere',
      size: null,
      careNotes: null,
      tags: ['investment'],
    });
    expect(fields?.purchaseDate?.getMonth()).toBe(7);
  });

  it('refuses an invalid draft', () => {
    expect(draftToFields({ ...valid, category: null })).toBeNull();
  });

  it('round-trips an item through the form', () => {
    const item = {
      name: 'Camel wool coat',
      category: 'coats',
      subcategory: 'Overcoat',
      colors: [c('Camel')],
      pattern: 'Solid',
      material: 'Wool',
      seasons: ['autumn', 'winter'],
      occasions: ['work'],
      size: '38',
      brand: 'Maison Lune',
      price: 390,
      currency: 'USD',
      purchaseDate: new Date(2025, 7, 1, 12),
      store: 'Online',
      careNotes: 'Dry clean',
      tags: ['investment'],
    } as unknown as Item;
    const fields = draftToFields(draftFromItem(item));
    expect(fields).toMatchObject({ name: 'Camel wool coat', subcategory: 'Overcoat', price: 390, size: '38' });
    expect(fields?.purchaseDate?.getTime()).toBe(item.purchaseDate?.getTime());
  });
});
