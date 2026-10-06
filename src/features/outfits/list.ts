/**
 * The Outfits segment of the Wardrobe tab: filter chips and card captions.
 * Pure — safe to import from tests.
 */
import { OCCASION_LABEL, OCCASIONS, SEASON_LABEL, SEASONS, type Occasion, type Season } from '@/features/items/catalog';
import { seasonsLabel } from '@/features/items/describe';

/** Favourites, one occasion and one season combine; all off is "All". */
export type OutfitFilters = { favorites: boolean; occasion: Occasion | null; season: Season | null };

export const NO_OUTFIT_FILTERS: OutfitFilters = { favorites: false, occasion: null, season: null };

type Listable = { isFavorite: boolean; occasion: Occasion | null; seasons: Season[] };

export function isFiltering(f: OutfitFilters): boolean {
  return f.favorites || f.occasion !== null || f.season !== null;
}

/** An outfit tagged for no season is an all-year outfit, so it fits every season. */
export function filterOutfits<T extends Listable>(outfits: readonly T[], f: OutfitFilters): T[] {
  return outfits.filter(
    (o) =>
      (!f.favorites || o.isFavorite) &&
      (f.occasion === null || o.occasion === f.occasion) &&
      (f.season === null || o.seasons.length === 0 || o.seasons.includes(f.season)),
  );
}

export type OutfitChip =
  | { kind: 'all'; label: string }
  | { kind: 'favorites'; label: string }
  | { kind: 'occasion'; value: Occasion; label: string }
  | { kind: 'season'; value: Season; label: string };

/** All, Favourites, then the occasions and seasons some outfit actually has, in catalogue order. */
export function outfitChips(outfits: readonly Listable[]): OutfitChip[] {
  const occasions = new Set(outfits.map((o) => o.occasion));
  const seasons = new Set(outfits.flatMap((o) => o.seasons));
  return [
    { kind: 'all', label: 'All' },
    { kind: 'favorites', label: 'Favourites' },
    ...OCCASIONS.filter((o) => occasions.has(o)).map((value) => ({
      kind: 'occasion' as const,
      value,
      label: OCCASION_LABEL[value],
    })),
    ...SEASONS.filter((s) => seasons.has(s)).map((value) => ({
      kind: 'season' as const,
      value,
      label: SEASON_LABEL[value],
    })),
  ];
}

export function chipSelected(chip: OutfitChip, f: OutfitFilters): boolean {
  switch (chip.kind) {
    case 'all':
      return !isFiltering(f);
    case 'favorites':
      return f.favorites;
    case 'occasion':
      return f.occasion === chip.value;
    case 'season':
      return f.season === chip.value;
  }
}

/** Tapping a chip: All clears; the others toggle, one occasion and one season at a time. */
export function toggleChip(chip: OutfitChip, f: OutfitFilters): OutfitFilters {
  switch (chip.kind) {
    case 'all':
      return NO_OUTFIT_FILTERS;
    case 'favorites':
      return { ...f, favorites: !f.favorites };
    case 'occasion':
      return { ...f, occasion: f.occasion === chip.value ? null : chip.value };
    case 'season':
      return { ...f, season: f.season === chip.value ? null : chip.value };
  }
}

/** Drops filters that no outfit offers any more (the last work outfit was deleted…). */
export function pruneFilters(f: OutfitFilters, chips: readonly OutfitChip[]): OutfitFilters {
  const has = (kind: 'occasion' | 'season', value: string) => chips.some((c) => c.kind === kind && c.value === value);
  return {
    favorites: f.favorites,
    occasion: f.occasion && has('occasion', f.occasion) ? f.occasion : null,
    season: f.season && has('season', f.season) ? f.season : null,
  };
}

/** "Work · Autumn, Winter · 4 pieces" */
export function outfitMeta(outfit: { occasion: Occasion | null; seasons: Season[]; pieceCount: number }): string {
  const pieces = `${outfit.pieceCount} ${outfit.pieceCount === 1 ? 'piece' : 'pieces'}`;
  return [outfit.occasion ? OCCASION_LABEL[outfit.occasion] : null, seasonsLabel(outfit.seasons), pieces]
    .filter(Boolean)
    .join(' · ');
}

/** The caption above the cards. */
export function outfitCountLine(shown: number, f: OutfitFilters): string {
  if (f.favorites && !f.occasion && !f.season) return `${shown} ${shown === 1 ? 'favourite' : 'favourites'}`;
  const n = `${shown} ${shown === 1 ? 'outfit' : 'outfits'}`;
  return isFiltering(f) ? n : `${n} · hold one for more`;
}
