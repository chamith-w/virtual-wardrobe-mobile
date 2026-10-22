import type { Category, ItemStatus, Occasion, Season } from '@/features/items/catalog';
import { paletteColor } from '@/lib/color';
import { addDays, toDayKey } from '@/lib/dates';

import { SUGGESTION_CONFIG } from './config';
import { layerWarmth, slotOf, type SuggestItem } from './garments';
import { nextDiverse, pickDiverse, sharedCount, suggestOutfits, wearItAgain, type SuggestInput } from './engine';
import { outfitHarmony } from './harmony';
import { bandFor, isRainy, layerPlan, seasonFor } from './weather';

const TODAY = new Date(2026, 9, 14, 9); // mid-October: autumn up north

const color = (name: string) => {
  const p = paletteColor(name);
  return { hex: p.hex, name: p.name };
};

let n = 0;
function piece(
  name: string,
  category: Category,
  colorName: string,
  extra: Partial<Omit<SuggestItem, 'colors'>> & { seasons?: Season[]; occasions?: Occasion[] } = {},
): SuggestItem {
  n++;
  return {
    id: extra.id ?? name.toLowerCase().replace(/\s+/g, '-'),
    name,
    category,
    subcategory: null,
    material: null,
    tags: [],
    colors: [color(colorName)],
    seasons: [],
    occasions: [],
    status: 'in_wardrobe' as ItemStatus,
    isFavorite: false,
    wearCount: 10,
    lastWornAt: addDays(TODAY, -10 - (n % 5)),
    createdAt: addDays(TODAY, -400),
    ...extra,
  };
}

const wardrobe: SuggestItem[] = [
  piece('Ecru shirt', 'shirts', 'Ecru'),
  piece('White tee', 'tshirts', 'White'),
  piece('Blush blouse', 'tops', 'Blush'),
  piece('Charcoal merino', 'knitwear', 'Charcoal', { subcategory: 'Crewneck' }),
  piece('Cream cardigan', 'knitwear', 'Cream', { subcategory: 'Cardigan' }),
  piece('Indigo jeans', 'jeans', 'Indigo'),
  piece('Stone chinos', 'trousers', 'Stone'),
  piece('Black trousers', 'trousers', 'Black'),
  piece('Rust dress', 'dresses', 'Rust', { seasons: ['summer', 'autumn'] }),
  piece('White sneakers', 'shoes', 'White', { subcategory: 'Sneakers', material: 'Leather' }),
  piece('Black loafers', 'shoes', 'Black', { subcategory: 'Loafers', material: 'Leather' }),
  piece('Rubber boots', 'shoes', 'Olive', { subcategory: 'Rain boots', material: 'Rubber' }),
  piece('Navy blazer', 'jackets', 'Navy', { subcategory: 'Blazer', material: 'Wool twill' }),
  piece('Denim jacket', 'jackets', 'Denim', { subcategory: 'Trucker', material: 'Cotton denim' }),
  piece('Stone trench', 'coats', 'Stone', { subcategory: 'Trench', material: 'Cotton gabardine' }),
  piece('Camel wool coat', 'coats', 'Camel', { subcategory: 'Overcoat', material: 'Wool' }),
  piece('Camel tote', 'bags', 'Camel'),
  piece('Merino socks', 'socks', 'Charcoal'),
];

const base = (over: Partial<SuggestInput> = {}): SuggestInput => ({
  items: wardrobe,
  weather: { feelsLikeC: 18, precipitationProbability: 0, code: 2 },
  recentWear: [],
  today: TODAY,
  seed: 42,
  ...over,
});

const byId = new Map(wardrobe.map((i) => [i.id, i]));
const slots = (ids: readonly string[]) => ids.map((id) => slotOf(byId.get(id)!));

describe('weather rules', () => {
  it('bands the feels-like temperature from config', () => {
    expect(bandFor(SUGGESTION_CONFIG.bands.hotFrom)).toBe('hot');
    expect(bandFor(SUGGESTION_CONFIG.bands.coldBelow - 0.1)).toBe('cold');
    expect(bandFor(18)).toBe('mild');
  });

  it('calls rain from a wet WMO code or a high chance of rain', () => {
    expect(isRainy({ feelsLikeC: 15, precipitationProbability: 10, code: 61 })).toBe(true);
    expect(isRainy({ feelsLikeC: 15, precipitationProbability: 60, code: 3 })).toBe(true);
    expect(isRainy({ feelsLikeC: 15, precipitationProbability: 20, code: 3 })).toBe(false);
  });

  it('dresses for a mild, dry day without a forecast', () => {
    expect(layerPlan(null)).toMatchObject({ band: 'mild', rain: false, layer: 'light' });
  });

  it('flips the season south of the equator', () => {
    expect(seasonFor(TODAY, 51)).toBe('autumn');
    expect(seasonFor(TODAY, -33)).toBe('spring');
  });
});

describe('candidates', () => {
  it('builds top + bottom + shoes or dress + shoes from available pieces, never basics', () => {
    const out = suggestOutfits(base());
    expect(out.length).toBeGreaterThan(3);
    for (const s of out) {
      const kinds = slots(s.itemIds);
      const hasCore = kinds.includes('dress')
        ? !kinds.includes('bottom')
        : kinds.includes('top') && kinds.includes('bottom');
      expect(hasCore).toBe(true);
      expect(kinds).toContain('shoes');
      expect(s.itemIds).not.toContain('merino-socks');
    }
  });

  it('never suggests a piece that is worn, washing, lent or stored', () => {
    const items = wardrobe.map((i) =>
      i.id === 'indigo-jeans'
        ? { ...i, status: 'laundry' as const }
        : i.id === 'ecru-shirt'
          ? { ...i, status: 'worn' as const }
          : i,
    );
    const ids = suggestOutfits(base({ items })).flatMap((s) => s.itemIds);
    expect(ids).not.toContain('indigo-jeans');
    expect(ids).not.toContain('ecru-shirt');
  });

  it('returns nothing when there is no top-and-bottom or dress', () => {
    const items = wardrobe.filter((i) => ['shoes', 'bags'].includes(i.category));
    expect(suggestOutfits(base({ items }))).toEqual([]);
  });
});

describe('layering per temperature band', () => {
  const top3 = (feelsLikeC: number, rain = false) =>
    pickDiverse(
      suggestOutfits(base({ weather: { feelsLikeC, precipitationProbability: rain ? 90 : 0, code: rain ? 63 : 1 } })),
    );

  it('hot: no layer and no knitwear', () => {
    for (const s of top3(29)) {
      expect(slots(s.itemIds)).not.toContain('layer');
      expect(s.itemIds.some((id) => byId.get(id)!.category === 'knitwear')).toBe(false);
    }
  });

  it('mild: one light layer, never a heavy coat', () => {
    for (const s of top3(18)) {
      const layers = s.itemIds.filter((id) => layerWarmth(byId.get(id)!) !== null && slotOf(byId.get(id)!) === 'layer');
      expect(layers.length).toBeLessThanOrEqual(1);
      expect(s.itemIds).not.toContain('camel-wool-coat');
      expect(s.traits.layered).toBe(true);
    }
  });

  it('cold: outerwear plus something warm, the warm coat first', () => {
    const picks = top3(4);
    expect(picks[0]!.itemIds).toContain('camel-wool-coat');
    for (const s of picks) {
      expect(slots(s.itemIds)).toContain('layer');
      expect(s.itemIds.some((id) => byId.get(id)!.category === 'knitwear')).toBe(true);
    }
  });

  it('rain: reaches for waterproof outerwear and shoes', () => {
    const [best] = top3(15, true);
    expect(best!.itemIds).toContain('stone-trench');
    expect(best!.itemIds).toContain('rubber-boots');
    expect(best!.traits.waterproof).toBe(true);
  });

  it('suggestions change with the temperature', () => {
    const keys = (t: number) =>
      top3(t)
        .map((s) => s.key)
        .join(',');
    expect(keys(29)).not.toEqual(keys(4));
  });
});

describe('colour harmony', () => {
  it('pairs neutrals with everything', () => {
    expect(outfitHarmony([color('Black'), color('Stone'), color('Rust')])).toBeGreaterThan(0.8);
  });

  it('rewards complementary and analogous hues over a clash', () => {
    const complementary = outfitHarmony([color('Rust'), color('Denim')]);
    const analogous = outfitHarmony([color('Rust'), color('Mustard')]);
    const clash = outfitHarmony([
      { hex: '#D02A2A', name: 'Scarlet' },
      { hex: '#2AA02A', name: 'Kelly' },
    ]);
    expect(complementary).toBeGreaterThan(clash);
    expect(analogous).toBeGreaterThan(clash);
    expect(clash).toBeLessThan(0.5);
  });

  it('marks down a busy mix of accent hues', () => {
    const calm = outfitHarmony([color('Rust'), color('Stone'), color('Black')]);
    const busy = outfitHarmony([color('Rust'), color('Sky'), color('Sage'), color('Lilac')]);
    expect(calm).toBeGreaterThan(busy);
  });

  it('prefers the outfit whose colours sit together', () => {
    const items = [
      piece('Red top', 'tops', 'Red', { id: 'red-top' }),
      piece('Sage skirt', 'skirts', 'Sage', { id: 'sage-skirt' }),
      piece('Denim skirt', 'skirts', 'Denim', { id: 'denim-skirt' }),
      piece('Black boots', 'shoes', 'Black', { id: 'black-boots' }),
    ];
    const [best] = suggestOutfits(base({ items, weather: { feelsLikeC: 28, precipitationProbability: 0, code: 0 } }));
    expect(best!.itemIds).toContain('denim-skirt');
  });
});

describe('season and occasion', () => {
  it('penalises a piece out of season', () => {
    const items = [
      piece('Linen shirt', 'shirts', 'White', { id: 'linen', seasons: ['summer'] }),
      piece('Flannel shirt', 'shirts', 'White', { id: 'flannel', seasons: ['autumn', 'winter'] }),
      piece('Jeans', 'jeans', 'Indigo', { id: 'jeans' }),
      piece('Boots', 'shoes', 'Black', { id: 'boots' }),
    ];
    const [best] = suggestOutfits(base({ items, weather: { feelsLikeC: 28, precipitationProbability: 0, code: 0 } }));
    expect(best!.itemIds).toContain('flannel');
  });

  it('matches the occasion asked for', () => {
    const items = [
      piece('Work shirt', 'shirts', 'White', { id: 'work', occasions: ['work'] }),
      piece('Weekend tee', 'tshirts', 'White', { id: 'weekend', occasions: ['weekend'] }),
      piece('Trousers', 'trousers', 'Black', { id: 'trousers' }),
      piece('Loafers', 'shoes', 'Black', { id: 'loafers' }),
    ];
    const hot = { feelsLikeC: 28, precipitationProbability: 0, code: 0 };
    expect(suggestOutfits(base({ items, weather: hot, occasion: 'work' }))[0]!.itemIds).toContain('work');
    expect(suggestOutfits(base({ items, weather: hot, occasion: 'weekend' }))[0]!.itemIds).toContain('weekend');
  });
});

describe('freshness and favourites', () => {
  const pair = (a: Partial<SuggestItem>, b: Partial<SuggestItem>) => [
    piece('Shirt A', 'shirts', 'White', { id: 'a', ...a }),
    piece('Shirt B', 'shirts', 'White', { id: 'b', ...b }),
    piece('Jeans', 'jeans', 'Indigo', { id: 'jeans' }),
    piece('Boots', 'shoes', 'Black', { id: 'boots' }),
  ];
  const hot = { feelsLikeC: 28, precipitationProbability: 0, code: 0 };
  const lastWorn = { lastWornAt: addDays(TODAY, -12), wearCount: 10 };

  it('penalises a piece worn in the last seven days', () => {
    const items = pair(lastWorn, lastWorn);
    const recentWear = [{ date: toDayKey(addDays(TODAY, -1)), itemIds: ['a'] }];
    const [best] = suggestOutfits(base({ items, weather: hot, recentWear }));
    expect(best!.itemIds).toContain('b');
  });

  it('lets a piece back in once the week has passed', () => {
    const items = pair(lastWorn, lastWorn);
    const old = suggestOutfits(
      base({ items, weather: hot, recentWear: [{ date: toDayKey(addDays(TODAY, -9)), itemIds: ['a'] }] }),
    );
    expect(old[0]!.traits.fresh).toBe(true);
  });

  it('boosts an under-worn piece', () => {
    const items = pair(lastWorn, { lastWornAt: addDays(TODAY, -120), wearCount: 2 });
    const [best] = suggestOutfits(base({ items, weather: hot }));
    expect(best!.itemIds).toContain('b');
    expect(best!.traits.underworn).toEqual({ id: 'b', idleDays: 120 });
  });

  it('gives favourites a bonus', () => {
    const items = pair(lastWorn, { ...lastWorn, isFavorite: true });
    const [best] = suggestOutfits(base({ items, weather: hot }));
    expect(best!.itemIds).toContain('b');
    expect(best!.traits.favorite).toBe(true);
  });
});

describe('diversity', () => {
  it('no two of the top three share more than one piece', () => {
    for (const feelsLikeC of [29, 18, 4]) {
      const picks = pickDiverse(
        suggestOutfits(base({ weather: { feelsLikeC, precipitationProbability: 0, code: 1 } })),
      );
      expect(picks).toHaveLength(3);
      for (let i = 0; i < picks.length; i++)
        for (let j = i + 1; j < picks.length; j++) expect(sharedCount(picks[i]!, picks[j]!)).toBeLessThanOrEqual(1);
    }
  });

  it('Shuffle takes the next-best candidate that stays diverse, then cycles', () => {
    const ranked = suggestOutfits(base());
    const [a, b, c] = pickDiverse(ranked);
    const shown = new Set([c!.key]);
    const next = nextDiverse(ranked, [a!, b!], c!.key, shown);
    expect(next).not.toBeNull();
    expect(next!.key).not.toBe(c!.key);
    expect(sharedCount(next!, a!)).toBeLessThanOrEqual(1);
    expect(sharedCount(next!, b!)).toBeLessThanOrEqual(1);
    // Later than c in the ranking: it was the next best left.
    expect(ranked.indexOf(next!)).toBeGreaterThan(ranked.indexOf(c!));
  });
});

describe('determinism', () => {
  it('gives the same suggestions for the same seed', () => {
    expect(suggestOutfits(base({ seed: 7 }))).toEqual(suggestOutfits(base({ seed: 7 })));
  });

  it('does not depend on the order pieces arrive in', () => {
    const forward = suggestOutfits(base({ seed: 7 })).map((s) => s.key);
    const reversed = suggestOutfits(base({ seed: 7, items: [...wardrobe].reverse() })).map((s) => s.key);
    expect(reversed).toEqual(forward);
  });
});

describe('wear it again', () => {
  it('picks an idle piece that suits the day and builds the outfit around it', () => {
    const items = wardrobe.map((i) =>
      i.id === 'blush-blouse' ? { ...i, lastWornAt: addDays(TODAY, -112), wearCount: 2 } : i,
    );
    const result = wearItAgain(base({ items }));
    expect(result?.item.id).toBe('blush-blouse');
    expect(result?.outfit.itemIds).toContain('blush-blouse');
  });

  it('skips knitwear on a hot day', () => {
    const items = wardrobe.map((i) =>
      i.id === 'charcoal-merino' ? { ...i, lastWornAt: addDays(TODAY, -200), wearCount: 1 } : i,
    );
    const result = wearItAgain(base({ items, weather: { feelsLikeC: 30, precipitationProbability: 0, code: 0 } }));
    expect(result?.item.id).not.toBe('charcoal-merino');
  });
});

describe('wear it again, alongside the cards', () => {
  it('prefers a piece the cards aren’t already showing', () => {
    const items = wardrobe.map((i) =>
      i.id === 'blush-blouse' || i.id === 'rust-dress' ? { ...i, lastWornAt: addDays(TODAY, -150), wearCount: 1 } : i,
    );
    const first = wearItAgain(base({ items }));
    const other = wearItAgain(base({ items }), new Set([first!.item.id]));
    expect(other?.item.id).not.toBe(first?.item.id);
    expect(['blush-blouse', 'rust-dress']).toContain(other?.item.id);
  });
});
