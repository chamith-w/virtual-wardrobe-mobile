/**
 * Planner writes on top of the outfits' `planOutfit`: plans are always of a
 * saved outfit, so planning a suggestion saves it first, unless an outfit
 * with exactly those pieces already exists.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { items, outfitItems, outfits, plannedOutfits } from '@/db/schema';
import { placeLook } from '@/features/outfits/canvas';
import { suggestOccasion, suggestOutfitName, suggestSeasons } from '@/features/outfits/defaults';
import { deleteOutfit, planOutfit, saveOutfit } from '@/features/outfits/mutations';
import type { DayKey } from '@/lib/dates';

/** Same pieces, in any order. */
export function samePieces(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** A live saved outfit with exactly these pieces, if there is one. */
export function findOutfitWithPieces(itemIds: readonly string[]): { id: string; name: string } | null {
  if (itemIds.length === 0) return null;
  const rows = db
    .select({ id: outfits.id, name: outfits.name, itemId: outfitItems.itemId })
    .from(outfitItems)
    .innerJoin(outfits, and(eq(outfits.id, outfitItems.outfitId), isNull(outfits.deletedAt)))
    .where(isNull(outfitItems.deletedAt))
    .all();
  const byOutfit = new Map<string, { id: string; name: string; ids: string[] }>();
  for (const r of rows) {
    const o = byOutfit.get(r.id) ?? { id: r.id, name: r.name, ids: [] };
    o.ids.push(r.itemId);
    byOutfit.set(r.id, o);
  }
  const match = [...byOutfit.values()].find((o) => samePieces(o.ids, itemIds));
  return match ? { id: match.id, name: match.name } : null;
}

/** Saves a set of pieces as an outfit, each in its role's spot, named from its colours. */
export function saveLook(itemIds: readonly string[]): { id: string; name: string } {
  const rows = db
    .select({
      id: items.id,
      category: items.category,
      colors: items.colors,
      occasions: items.occasions,
      seasons: items.seasons,
    })
    .from(items)
    .where(inArray(items.id, [...itemIds]))
    .all();
  const ordered = itemIds.flatMap((id) => rows.find((r) => r.id === id) ?? []);
  const poses = placeLook(ordered.map((r) => r.category));
  const placed = ordered.map((r, i) => ({ itemId: r.id, ...poses[i]!, z: i, locked: false }));
  const name = suggestOutfitName(ordered);
  const id = saveOutfit({
    id: null,
    name,
    occasion: suggestOccasion(ordered),
    seasons: suggestSeasons(ordered),
    pieces: placed,
  });
  return { id, name };
}

export type PlannedLook = {
  outfitId: string;
  name: string;
  /** A new outfit was saved for it (so taking the plan back can delete it). */
  created: boolean;
  replaced: string | null;
  already: boolean;
};

/** Plans a set of pieces for a day, saving them as an outfit unless one already matches. */
export function planLook(itemIds: readonly string[], date: DayKey): PlannedLook {
  const existing = findOutfitWithPieces(itemIds);
  const outfit = existing ?? saveLook(itemIds);
  const result = planOutfit(outfit.id, date);
  return { outfitId: outfit.id, name: outfit.name, created: !existing, ...result };
}

/** Clears a day's plan. Returns the outfit that was planned, if any. */
export function clearPlan(date: DayKey): string | null {
  return db.transaction((tx) => {
    const plan = tx
      .select({ outfitId: plannedOutfits.outfitId })
      .from(plannedOutfits)
      .where(and(eq(plannedOutfits.date, date), isNull(plannedOutfits.deletedAt)))
      .get();
    if (!plan) return null;
    tx.update(plannedOutfits)
      .set({ deletedAt: new Date() })
      .where(and(eq(plannedOutfits.date, date), isNull(plannedOutfits.deletedAt)))
      .run();
    return plan.outfitId;
  });
}

/** Takes back `planLook`: the plan goes, and so does the outfit if it was saved just for it. */
export function unplanLook(look: Pick<PlannedLook, 'outfitId' | 'created'>, date: DayKey) {
  clearPlan(date);
  if (look.created) deleteOutfit(look.outfitId);
}
