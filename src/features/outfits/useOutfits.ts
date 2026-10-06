import { and, asc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { db } from '@/db/client';
import { useLiveData } from '@/db/live';
import { items, outfitItems, outfits } from '@/db/schema';

export type OutfitPiece = {
  itemId: string;
  name: string;
  thumbUri: string | null;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
};

export type OutfitSummary = { id: string; name: string; isFavorite: boolean; pieces: OutfitPiece[] };

type PieceRow = OutfitPiece & { outfitId: string; outfitName: string; isFavorite: boolean };

function groupOutfits(rows: PieceRow[]): OutfitSummary[] {
  const byId = new Map<string, OutfitSummary>();
  for (const r of rows) {
    const outfit = byId.get(r.outfitId) ?? { id: r.outfitId, name: r.outfitName, isFavorite: r.isFavorite, pieces: [] };
    outfit.pieces.push({
      itemId: r.itemId,
      name: r.name,
      thumbUri: r.thumbUri,
      x: r.x,
      y: r.y,
      scale: r.scale,
      rotation: r.rotation,
      zIndex: r.zIndex,
    });
    byId.set(r.outfitId, outfit);
  }
  return [...byId.values()];
}

const pieceColumns = {
  outfitId: outfits.id,
  outfitName: outfits.name,
  isFavorite: outfits.isFavorite,
  itemId: outfitItems.itemId,
  name: items.name,
  thumbUri: items.thumbUri,
  x: outfitItems.x,
  y: outfitItems.y,
  scale: outfitItems.scale,
  rotation: outfitItems.rotation,
  zIndex: outfitItems.zIndex,
};

/** Outfits that include an item, each with all of its pieces (for mini previews). */
export function useItemOutfits(itemId: string | undefined) {
  const mine = alias(outfitItems, 'mine');
  const { data, loaded } = useLiveData(
    async () =>
      groupOutfits(
        await db
          .select(pieceColumns)
          .from(mine)
          .innerJoin(outfits, and(eq(outfits.id, mine.outfitId), isNull(outfits.deletedAt)))
          .innerJoin(outfitItems, and(eq(outfitItems.outfitId, outfits.id), isNull(outfitItems.deletedAt)))
          .innerJoin(items, and(eq(items.id, outfitItems.itemId), isNull(items.deletedAt)))
          .where(and(eq(mine.itemId, itemId ?? ''), isNull(mine.deletedAt)))
          .orderBy(asc(outfits.createdAt), asc(outfitItems.zIndex)),
      ),
    [outfitItems, outfits, items],
    [itemId],
    [] as OutfitSummary[],
  );
  return { outfits: data, loaded };
}

/** Every outfit with its piece ids — for the "Add to outfit" picker. */
export function useOutfitPicker() {
  return useLiveData(
    async () => {
      const rows = await db
        .select({ id: outfits.id, name: outfits.name, itemId: outfitItems.itemId })
        .from(outfits)
        .leftJoin(outfitItems, and(eq(outfitItems.outfitId, outfits.id), isNull(outfitItems.deletedAt)))
        .where(isNull(outfits.deletedAt))
        .orderBy(asc(outfits.createdAt));
      const byId = new Map<string, { id: string; name: string; itemIds: string[] }>();
      for (const r of rows) {
        const o = byId.get(r.id) ?? { id: r.id, name: r.name, itemIds: [] };
        if (r.itemId) o.itemIds.push(r.itemId);
        byId.set(r.id, o);
      }
      return [...byId.values()];
    },
    [outfits, outfitItems],
    [],
    [] as { id: string; name: string; itemIds: string[] }[],
  );
}
