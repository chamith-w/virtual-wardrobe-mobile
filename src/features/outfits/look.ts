/**
 * A look that isn't a saved outfit yet (a suggestion, a logged day) laid out
 * like a board: each piece in its role's spot, as the builder places them
 * (a cardigan over a dress hangs in the layer's spot).
 * Pure — safe to import from tests.
 */
import type { ItemColor } from '@/db/schema';
import type { Category } from '@/features/items/catalog';

import { placeLook } from './canvas';
import type { OutfitPiece } from './useOutfits';

type LookSource = {
  id: string;
  name: string;
  category: Category;
  colors: ItemColor[];
  thumbUri: string | null;
  cutoutUri: string | null;
};

export function lookPieces(items: readonly LookSource[]): OutfitPiece[] {
  const unique = items.filter((item, i) => items.findIndex((x) => x.id === item.id) === i);
  const poses = placeLook(unique.map((i) => i.category));
  return unique.map((item, i) => ({
    itemId: item.id,
    name: item.name,
    category: item.category,
    colors: item.colors,
    thumbUri: item.thumbUri,
    cutoutUri: item.cutoutUri,
    ...poses[i]!,
    zIndex: i,
  }));
}
