import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { wardrobes, zones } from '@/db/schema';
import { placedItemsIn, placementContext, writeBatch } from '@/features/items/mutations';
import { planKindChange, planRehome, type BatchPlan } from '@/features/items/transitions';
import { cleanName } from '@/lib/text';
import { newId } from '@/lib/ids';

import { sortOrders, WARDROBE_KIND_ICON, WARDROBE_NAME_MAX, type WardrobeKind, type WardrobePlan } from './wardrobes';

/** Inserts a planned wardrobe and its zones; returns the new wardrobe's id. */
export function createWardrobe(plan: WardrobePlan): string {
  const id = newId();
  db.transaction((tx) => {
    tx.insert(wardrobes)
      .values({ id, ...plan.wardrobe })
      .run();
    tx.insert(zones)
      .values(plan.zones.map((z) => ({ id: newId(), wardrobeId: id, ...z })))
      .run();
  });
  return id;
}

/** Saves a new order (the first everyday wardrobe is home). */
export function reorderWardrobes(ids: readonly string[]) {
  db.transaction((tx) => {
    for (const { id, sortOrder } of sortOrders(ids)) {
      tx.update(wardrobes).set({ sortOrder }).where(eq(wardrobes.id, id)).run();
    }
  });
}

export function renameWardrobe(id: string, raw: string) {
  const name = cleanName(raw, WARDROBE_NAME_MAX);
  if (name) db.update(wardrobes).set({ name }).where(eq(wardrobes.id, id)).run();
}

/**
 * Turns a wardrobe into storage or back. Its pieces follow in the same
 * transaction: stored when it becomes storage (anything out goes home),
 * back in use when it stops being storage.
 */
export function changeWardrobeKind(id: string, kind: WardrobeKind): BatchPlan {
  return db.transaction((tx) => {
    tx.update(wardrobes).set({ icon: WARDROBE_KIND_ICON[kind] }).where(eq(wardrobes.id, id)).run();
    const plan = planKindChange(placedItemsIn(tx, id), kind === 'storage', placementContext(tx), new Date());
    writeBatch(tx, plan);
    return plan;
  });
}

/**
 * Soft-deletes a wardrobe and its zones, re-homing every piece in it to
 * `targetId` (or home, for pieces the target won't take). Check
 * `deletionPlan` first: the last wardrobe, or the last everyday one, stays.
 */
export function deleteWardrobe(id: string, targetId: string): BatchPlan {
  return db.transaction((tx) => {
    const deletedAt = new Date();
    tx.update(wardrobes).set({ deletedAt }).where(eq(wardrobes.id, id)).run();
    tx.update(zones)
      .set({ deletedAt })
      .where(and(eq(zones.wardrobeId, id), isNull(zones.deletedAt)))
      .run();
    const plan = planRehome(placedItemsIn(tx, id), targetId, placementContext(tx), deletedAt);
    writeBatch(tx, plan);
    return plan;
  });
}
