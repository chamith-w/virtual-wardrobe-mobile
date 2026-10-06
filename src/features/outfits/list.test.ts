import { filterOutfits, outfitFilterOptions, outfitMeta, outfitTileHeight } from './list';

const outfits = [
  { id: 'monday', isFavorite: true, occasion: 'work' as const },
  { id: 'gallery', isFavorite: false, occasion: 'evening' as const },
  { id: 'walk', isFavorite: true, occasion: 'weekend' as const },
  { id: 'loose', isFavorite: false, occasion: null },
];

describe('filterOutfits', () => {
  it('keeps everything, favourites, or one occasion', () => {
    expect(filterOutfits(outfits, 'all').map((o) => o.id)).toEqual(['monday', 'gallery', 'walk', 'loose']);
    expect(filterOutfits(outfits, 'favorites').map((o) => o.id)).toEqual(['monday', 'walk']);
    expect(filterOutfits(outfits, 'evening').map((o) => o.id)).toEqual(['gallery']);
    expect(filterOutfits(outfits, 'formal')).toEqual([]);
  });
});

describe('outfitFilterOptions', () => {
  it('offers only occasions in use, in catalogue order', () => {
    expect(outfitFilterOptions(outfits).map((o) => o.label)).toEqual([
      'All',
      'Favourites',
      'Work',
      'Weekend',
      'Evening',
    ]);
  });
});

describe('outfitMeta', () => {
  it('describes occasion, seasons and size', () => {
    expect(outfitMeta({ occasion: 'work', seasons: ['winter', 'autumn'], pieceCount: 4 })).toBe(
      'Work · Autumn, Winter · 4 pieces',
    );
    expect(outfitMeta({ occasion: null, seasons: [], pieceCount: 1 })).toBe('All year · 1 piece');
  });
});

describe('outfitTileHeight', () => {
  it('is taller for fuller outfits', () => {
    expect(outfitTileHeight(3)).toBeLessThan(outfitTileHeight(5));
  });
});
