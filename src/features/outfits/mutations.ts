import { and, eq, gte, inArray, isNull, ne } from 'drizzle-orm';

import { db } from '@/db/client';
import { items, outfitItems, outfits, plannedOutfits } from '@/db/schema';
import type { Occasion, Season } from '@/features/items/catalog';
import { toDayKey, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

import { placeNewPiece } from './canvas';
import { copyName } from './defaults';

/**
 * Adds an item to an outfit (at its role's spot on the board, on top of the
 * stack) or removes it. Returns the new membership. The saved snapshot no
 * longer matches, so it's cleared and the outfit list draws a fresh one.
 */
export function toggleItemInOutfit(outfitId: string, itemId: string): boolean {
  return db.transaction((tx) => {
    const link = tx
      .select({ id: outfitItems.id, deletedAt: outfitItems.deletedAt })
      .from(outfitItems)
      .where(and(eq(outfitItems.outfitId, outfitId), eq(outfitItems.itemId, itemId)))
      .get();
    tx.update(outfits).set({ snapshotUri: null }).where(eq(outfits.id, outfitId)).run();

    if (link && !link.deletedAt) {
      tx.update(outfitItems).set({ deletedAt: new Date() }).where(eq(outfitItems.id, link.id)).run();
      return false;
    }

    const others = tx
      .select({
        x: outfitItems.x,
        y: outfitItems.y,
        scale: outfitItems.scale,
        rotation: outfitItems.rotation,
        z: outfitItems.zIndex,
      })
      .from(outfitItems)
      .where(and(eq(outfitItems.outfitId, outfitId), isNull(outfitItems.deletedAt)))
      .all();
    const category = tx.select({ category: items.category }).from(items).where(eq(items.id, itemId)).get()?.category;
    const spot = category ? placeNewPiece(category, others) : { x: 0.5, y: 0.5, scale: 0.9, rotation: 0 };
    const top = others.reduce((z, o) => Math.max(z, o.z), -1);
    const pose = { ...spot, zIndex: top + 1, locked: false };

    // (outfit, item) is unique, so a soft-deleted link is revived rather than re-inserted.
    if (link)
      tx.update(outfitItems)
        .set({ ...pose, deletedAt: null })
        .where(eq(outfitItems.id, link.id))
        .run();
    else
      tx.insert(outfitItems)
        .values({ id: newId(), outfitId, itemId, ...pose })
        .run();
    return true;
  });
}

export function setOutfitFavorite(outfitId: string, isFavorite: boolean) {
  db.update(outfits).set({ isFavorite }).where(eq(outfits.id, outfitId)).run();
}

export type SavedPiece = {
  itemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
  locked: boolean;
};

/**
 * Writes the builder's board: creates the outfit (no `id`) or updates it,
 * then makes its pieces exactly `pieces`, reviving links that were removed
 * before and soft-deleting ones no longer on the board. Returns the id.
 * The snapshot is rendered afterwards (`snapshotOutfit`).
 */
export function saveOutfit(outfit: {
  id: string | null;
  name: string;
  occasion: Occasion | null;
  seasons: Season[];
  pieces: SavedPiece[];
}): string {
  return db.transaction((tx) => {
    const outfitId = outfit.id ?? newId();
    const fields = { name: outfit.name, occasion: outfit.occasion, seasons: outfit.seasons };
    if (outfit.id) tx.update(outfits).set(fields).where(eq(outfits.id, outfitId)).run();
    else
      tx.insert(outfits)
        .values({ id: outfitId, ...fields })
        .run();

    const links = tx
      .select({ id: outfitItems.id, itemId: outfitItems.itemId, deletedAt: outfitItems.deletedAt })
      .from(outfitItems)
      .where(eq(outfitItems.outfitId, outfitId))
      .all();
    const byItem = new Map(links.map((l) => [l.itemId, l]));
    const keep = new Set(outfit.pieces.map((p) => p.itemId));

    for (const p of outfit.pieces) {
      const pose = { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation, zIndex: p.z, locked: p.locked };
      const link = byItem.get(p.itemId);
      if (link)
        tx.update(outfitItems)
          .set({ ...pose, deletedAt: null })
          .where(eq(outfitItems.id, link.id))
          .run();
      else
        tx.insert(outfitItems)
          .values({ id: newId(), outfitId, itemId: p.itemId, ...pose })
          .run();
    }
    const gone = links.filter((l) => !keep.has(l.itemId) && !l.deletedAt).map((l) => l.id);
    if (gone.length > 0)
      tx.update(outfitItems).set({ deletedAt: new Date() }).where(inArray(outfitItems.id, gone)).run();
    return outfitId;
  });
}

/** A copy of an outfit and its layout, named "… copy". Its snapshot is drawn afresh by the list. */
export function duplicateOutfit(outfitId: string): { id: string; name: string } | null {
  return db.transaction((tx) => {
    const source = tx
      .select()
      .from(outfits)
      .where(and(eq(outfits.id, outfitId), isNull(outfits.deletedAt)))
      .get();
    if (!source) return null;
    const names = tx
      .select({ name: outfits.name })
      .from(outfits)
      .where(isNull(outfits.deletedAt))
      .all()
      .map((o) => o.name);
    const copy = { id: newId(), name: copyName(source.name, names) };
    tx.insert(outfits)
      .values({ ...copy, occasion: source.occasion, seasons: source.seasons, isFavorite: false, snapshotUri: null })
      .run();
    const pieces = tx
      .select()
      .from(outfitItems)
      .where(and(eq(outfitItems.outfitId, outfitId), isNull(outfitItems.deletedAt)))
      .all();
    if (pieces.length > 0)
      tx.insert(outfitItems)
        .values(
          pieces.map((p) => ({
            id: newId(),
            outfitId: copy.id,
            itemId: p.itemId,
            x: p.x,
            y: p.y,
            scale: p.scale,
            rotation: p.rotation,
            zIndex: p.zIndex,
            locked: p.locked,
          })),
        )
        .run();
    return copy;
  });
}

/**
 * Soft-deletes an outfit and drops its upcoming plans. Past wear logs keep
 * pointing at it, so the journal still knows what was worn.
 */
export function deleteOutfit(outfitId: string, today: DayKey = toDayKey(new Date())) {
  db.transaction((tx) => {
    const now = new Date();
    tx.update(outfits).set({ deletedAt: now }).where(eq(outfits.id, outfitId)).run();
    tx.update(plannedOutfits)
      .set({ deletedAt: now })
      .where(
        and(eq(plannedOutfits.outfitId, outfitId), gte(plannedOutfits.date, today), isNull(plannedOutfits.deletedAt)),
      )
      .run();
  });
}

/**
 * Plans an outfit for a day. A day holds one plan, so this replaces whatever
 * was planned; returns the name of the outfit it replaced, if any. (Phase 6
 * builds the calendar and drag-to-plan on top of this.)
 */
export function planOutfit(outfitId: string, date: DayKey): { replaced: string | null; already: boolean } {
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: plannedOutfits.id, outfitId: plannedOutfits.outfitId, name: outfits.name })
      .from(plannedOutfits)
      .innerJoin(outfits, eq(outfits.id, plannedOutfits.outfitId))
      .where(and(eq(plannedOutfits.date, date), isNull(plannedOutfits.deletedAt), isNull(outfits.deletedAt)))
      .all();
    if (existing.some((p) => p.outfitId === outfitId)) return { replaced: null, already: true };
    const others = existing.filter((p) => p.outfitId !== outfitId);
    if (others.length > 0)
      tx.update(plannedOutfits)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(plannedOutfits.date, date), ne(plannedOutfits.outfitId, outfitId), isNull(plannedOutfits.deletedAt)),
        )
        .run();
    tx.insert(plannedOutfits).values({ id: newId(), date, outfitId }).run();
    return { replaced: others[0]?.name ?? null, already: false };
  });
}
