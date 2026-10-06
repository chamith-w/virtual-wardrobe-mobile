/**
 * The Outfits segment of the Wardrobe tab: filter chips, card captions and
 * tile heights. Pure — safe to import from tests.
 */
import { OCCASION_LABEL, OCCASIONS, type Occasion, type Season } from '@/features/items/catalog';
import { seasonsLabel } from '@/features/items/describe';

export type OutfitFilter = 'all' | 'favorites' | Occasion;

type Listable = { isFavorite: boolean; occasion: Occasion | null };

export function filterOutfits<T extends Listable>(outfits: readonly T[], filter: OutfitFilter): T[] {
  if (filter === 'all') return [...outfits];
  if (filter === 'favorites') return outfits.filter((o) => o.isFavorite);
  return outfits.filter((o) => o.occasion === filter);
}

/** All, Favourites, then only the occasions that some outfit actually has. */
export function outfitFilterOptions(outfits: readonly Listable[]): { value: OutfitFilter; label: string }[] {
  const used = new Set(outfits.map((o) => o.occasion));
  return [
    { value: 'all', label: 'All' },
    { value: 'favorites', label: 'Favourites' },
    ...OCCASIONS.filter((o) => used.has(o)).map((o) => ({ value: o, label: OCCASION_LABEL[o] })),
  ];
}

/** "Work · Autumn, Winter · 4 pieces" */
export function outfitMeta(outfit: { occasion: Occasion | null; seasons: Season[]; pieceCount: number }): string {
  const pieces = `${outfit.pieceCount} ${outfit.pieceCount === 1 ? 'piece' : 'pieces'}`;
  return [outfit.occasion ? OCCASION_LABEL[outfit.occasion] : null, seasonsLabel(outfit.seasons), pieces]
    .filter(Boolean)
    .join(' · ');
}

/** Board height for an outfit card: taller when there's a layer and an accessory to fit. */
export function outfitTileHeight(pieceCount: number): number {
  return pieceCount >= 5 ? 206 : 170;
}
