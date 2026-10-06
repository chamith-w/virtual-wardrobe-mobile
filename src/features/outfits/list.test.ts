import {
  chipSelected,
  filterOutfits,
  NO_OUTFIT_FILTERS,
  outfitChips,
  outfitCountLine,
  outfitMeta,
  pruneFilters,
  toggleChip,
  type OutfitFilters,
} from './list';

const outfits = [
  { id: 'monday', isFavorite: true, occasion: 'work' as const, seasons: ['autumn' as const, 'winter' as const] },
  { id: 'gallery', isFavorite: false, occasion: 'evening' as const, seasons: ['autumn' as const] },
  { id: 'walk', isFavorite: true, occasion: 'weekend' as const, seasons: ['summer' as const] },
  { id: 'loose', isFavorite: false, occasion: null, seasons: [] },
];
const ids = (f: Partial<OutfitFilters>) => filterOutfits(outfits, { ...NO_OUTFIT_FILTERS, ...f }).map((o) => o.id);

describe('filterOutfits', () => {
  it('keeps everything with no filters', () => {
    expect(ids({})).toEqual(['monday', 'gallery', 'walk', 'loose']);
  });

  it('filters by favourites, occasion and season, combined', () => {
    expect(ids({ favorites: true })).toEqual(['monday', 'walk']);
    expect(ids({ occasion: 'evening' })).toEqual(['gallery']);
    expect(ids({ season: 'autumn', favorites: true })).toEqual(['monday']);
    expect(ids({ occasion: 'formal' })).toEqual([]);
  });

  it('counts an outfit with no seasons as all year', () => {
    expect(ids({ season: 'spring' })).toEqual(['loose']);
    expect(ids({ season: 'summer' })).toEqual(['walk', 'loose']);
  });
});

describe('chips', () => {
  it('offers only occasions and seasons in use, in catalogue order', () => {
    expect(outfitChips(outfits).map((c) => c.label)).toEqual([
      'All',
      'Favourites',
      'Work',
      'Weekend',
      'Evening',
      'Summer',
      'Autumn',
      'Winter',
    ]);
  });

  it('toggles, with one occasion and one season at a time', () => {
    const chips = outfitChips(outfits);
    const [all, favs, work, weekend] = chips;
    const autumn = chips.find((c) => c.label === 'Autumn')!;
    let f = toggleChip(work, NO_OUTFIT_FILTERS);
    f = toggleChip(weekend, f);
    f = toggleChip(autumn, f);
    f = toggleChip(favs, f);
    expect(f).toEqual({ favorites: true, occasion: 'weekend', season: 'autumn' });
    expect(chipSelected(all, f)).toBe(false);
    expect(chipSelected(weekend, f)).toBe(true);
    expect(toggleChip(weekend, f).occasion).toBeNull();
    expect(toggleChip(all, f)).toEqual(NO_OUTFIT_FILTERS);
    expect(chipSelected(all, NO_OUTFIT_FILTERS)).toBe(true);
  });

  it('drops filters nothing offers any more', () => {
    const chips = outfitChips(outfits.filter((o) => o.id !== 'gallery'));
    expect(pruneFilters({ favorites: true, occasion: 'evening', season: 'winter' }, chips)).toEqual({
      favorites: true,
      occasion: null,
      season: 'winter',
    });
  });
});

describe('captions', () => {
  it('describes occasion, seasons and size', () => {
    expect(outfitMeta({ occasion: 'work', seasons: ['winter', 'autumn'], pieceCount: 4 })).toBe(
      'Work · Autumn, Winter · 4 pieces',
    );
    expect(outfitMeta({ occasion: null, seasons: [], pieceCount: 1 })).toBe('All year · 1 piece');
  });

  it('counts what is shown', () => {
    expect(outfitCountLine(6, NO_OUTFIT_FILTERS)).toBe('6 outfits · hold one for more');
    expect(outfitCountLine(1, { ...NO_OUTFIT_FILTERS, favorites: true })).toBe('1 favourite');
    expect(outfitCountLine(2, { ...NO_OUTFIT_FILTERS, season: 'autumn' })).toBe('2 outfits');
  });
});
