import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { useState } from 'react';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, outfitItems, outfits, type ItemColor } from '@/db/schema';
import type { Category, ItemStatus, Occasion, Season } from '@/features/items/catalog';

import type { BoardPiece } from '../board';
import { placeNewPiece } from '../canvas';

/** What the builder needs to know about a garment: drawing, the tray, shuffle and save defaults. */
export type BuilderItem = {
  id: string;
  name: string;
  category: Category;
  colors: ItemColor[];
  seasons: Season[];
  occasions: Occasion[];
  status: ItemStatus;
  isFavorite: boolean;
  thumbUri: string | null;
  cutoutUri: string | null;
};

/**
 * Every garment that isn't deleted, newest first, keyed by id. Archived ones
 * are included so an old outfit still draws; the tray and Shuffle only offer
 * available pieces.
 */
export function useBuilderItems() {
  const { data, loaded } = useLiveData(
    async () =>
      new Map(
        (
          await db
            .select({
              id: items.id,
              name: items.name,
              category: items.category,
              colors: items.colors,
              seasons: items.seasons,
              occasions: items.occasions,
              status: items.status,
              isFavorite: items.isFavorite,
              thumbUri: items.thumbUri,
              cutoutUri: items.cutoutUri,
            })
            .from(items)
            .where(isNull(items.deletedAt))
            .orderBy(desc(items.createdAt))
        ).map((i) => [i.id, i]),
      ) as ReadonlyMap<string, BuilderItem>,
    [items],
    [],
    new Map() as ReadonlyMap<string, BuilderItem>,
  );
  return { items: data, loaded };
}

export type SavedOutfit = {
  id: string;
  name: string;
  occasion: Occasion | null;
  seasons: Season[];
  isFavorite: boolean;
  pieces: BoardPiece[];
};

/** An outfit as saved, read once when the builder opens (undefined for a new one, null if it's gone). */
function readOutfit(id: string | null): SavedOutfit | null | undefined {
  if (!id) return undefined;
  const outfit = db
    .select({
      id: outfits.id,
      name: outfits.name,
      occasion: outfits.occasion,
      seasons: outfits.seasons,
      isFavorite: outfits.isFavorite,
    })
    .from(outfits)
    .where(and(eq(outfits.id, id), isNull(outfits.deletedAt)))
    .get();
  if (!outfit) return null;
  const pieces = db
    .select({
      itemId: outfitItems.itemId,
      x: outfitItems.x,
      y: outfitItems.y,
      scale: outfitItems.scale,
      rotation: outfitItems.rotation,
      z: outfitItems.zIndex,
      locked: outfitItems.locked,
    })
    .from(outfitItems)
    .innerJoin(items, and(eq(items.id, outfitItems.itemId), isNull(items.deletedAt)))
    .where(and(eq(outfitItems.outfitId, id), isNull(outfitItems.deletedAt)))
    .orderBy(asc(outfitItems.zIndex))
    .all();
  return { ...outfit, pieces };
}

/** The outfit being edited, read synchronously on mount so its board appears with the screen. */
export function useSavedOutfit(id: string | null) {
  const [saved] = useState(() => readOutfit(id));
  return saved;
}

/**
 * A new board's starting pieces (`?item=` from item detail, `?items=` from a
 * suggestion), each in its role's spot. Read synchronously so they're on the
 * board from the first frame.
 */
export function readPreload(ids: readonly string[]): BoardPiece[] {
  if (ids.length === 0) return [];
  const rows = db
    .select({ id: items.id, category: items.category })
    .from(items)
    .where(and(inArray(items.id, [...ids]), isNull(items.deletedAt)))
    .all();
  const pieces: BoardPiece[] = [];
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    if (!row || pieces.some((p) => p.itemId === id)) continue;
    pieces.push({ itemId: id, ...placeNewPiece(row.category, pieces), z: pieces.length, locked: false });
  }
  return pieces;
}
