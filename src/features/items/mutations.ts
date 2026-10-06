import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { items, wardrobes, zones, type NewItem } from '@/db/schema';
import type { DraftFields } from '@/features/items/details/draft';
import { cleanName } from '@/lib/text';

import type { ItemStatus } from './catalog';
import { zoneAfterCategoryChange, type PlacedItem } from './placement';
import { LENT_TO_MAX, type StatusExtra } from './status';
import { planBatch, planMove, planStatus, type BatchPlan, type PlacementContext, type StatusPlan } from './transitions';

type Executor = Pick<typeof db, 'select' | 'update'>;

export function placementContext(ex: Executor): PlacementContext {
  return {
    wardrobes: ex
      .select({ id: wardrobes.id, icon: wardrobes.icon, sortOrder: wardrobes.sortOrder })
      .from(wardrobes)
      .where(isNull(wardrobes.deletedAt))
      .all(),
    zones: ex
      .select({ id: zones.id, wardrobeId: zones.wardrobeId, type: zones.type, sortOrder: zones.sortOrder })
      .from(zones)
      .where(isNull(zones.deletedAt))
      .all(),
  };
}

const placedColumns = {
  id: items.id,
  wardrobeId: items.wardrobeId,
  zoneId: items.zoneId,
  category: items.category,
  status: items.status,
  statusChangedAt: items.statusChangedAt,
  lentTo: items.lentTo,
  lentAt: items.lentAt,
  remindAt: items.remindAt,
  readyAt: items.readyAt,
};

export type PlacedRow = PlacedItem & { id: string };

function placedItem(ex: Executor, id: string): PlacedRow | undefined {
  return ex.select(placedColumns).from(items).where(eq(items.id, id)).get();
}

export function placedItems(ex: Executor, ids: readonly string[]): PlacedRow[] {
  if (ids.length === 0) return [];
  return ex
    .select(placedColumns)
    .from(items)
    .where(inArray(items.id, [...ids]))
    .all();
}

/** Every piece in a wardrobe, archived ones included (they still belong somewhere). */
export function placedItemsIn(ex: Executor, wardrobeId: string): PlacedRow[] {
  return ex
    .select(placedColumns)
    .from(items)
    .where(and(eq(items.wardrobeId, wardrobeId), isNull(items.deletedAt)))
    .all();
}

/** Writes a batch plan: one UPDATE per distinct patch. */
export function writeBatch(ex: Executor, plan: BatchPlan) {
  for (const { ids, patch } of plan.updates) {
    if (Object.keys(patch).length > 0) ex.update(items).set(patch).where(inArray(items.id, ids)).run();
  }
}

/**
 * The status write, inside a transaction: plans the change against the
 * transition table (statuses, lent fields, drop-off date, storage moves) and
 * writes only what changed. Callers outside a transaction use
 * `setItemStatus` (statusService.ts), which adds the haptic and reminder clean-up.
 */
export function applyItemStatus(
  ex: Executor,
  id: string,
  next: ItemStatus,
  now = new Date(),
  extra: StatusExtra = {},
): StatusPlan | null {
  const item = placedItem(ex, id);
  if (!item) return null;
  const plan = planStatus(item, next, placementContext(ex), now, extra);
  if (plan.ok && Object.keys(plan.patch).length > 0) ex.update(items).set(plan.patch).where(eq(items.id, id)).run();
  return plan;
}

/** The same status for many pieces (wash done): pieces with identical changes share one UPDATE. */
export function applyItemsStatus(
  ex: Executor,
  ids: readonly string[],
  next: ItemStatus,
  now = new Date(),
  extra: StatusExtra = {},
): BatchPlan {
  const ctx = placementContext(ex);
  const plan = planBatch(placedItems(ex, ids), (item) => planStatus(item, next, ctx, now, extra));
  writeBatch(ex, plan);
  return plan;
}

/** "Move to…" for one or many pieces, keeping the same kind of zone where possible. */
export function moveItemsInto(ex: Executor, ids: readonly string[], wardrobeId: string, now = new Date()): BatchPlan {
  const ctx = placementContext(ex);
  const plan = planBatch(placedItems(ex, ids), (item) => planMove(item, wardrobeId, ctx, now));
  writeBatch(ex, plan);
  return plan;
}

/** Long-press drag between zones of the same wardrobe. */
export function moveItemToZone(id: string, zoneId: string) {
  db.update(items).set({ zoneId }).where(eq(items.id, id)).run();
}

/** Inserts a new piece (the add flow decides its wardrobe, zone and images). */
export function createItem(row: NewItem) {
  db.insert(items).values(row).run();
}

/**
 * Saves the details form. A new category can carry the piece to that
 * category's zone — see zoneAfterCategoryChange.
 */
export function updateItemDetails(id: string, fields: DraftFields) {
  db.transaction((tx) => {
    const item = placedItem(tx, id);
    if (!item) return;
    const zoneId = zoneAfterCategoryChange(item, fields.category, placementContext(tx).zones);
    tx.update(items)
      .set({ ...fields, zoneId })
      .where(eq(items.id, id))
      .run();
  });
}

/** Who has a lent piece. Only while it's lent: a returned piece has no borrower. */
export function setLentTo(id: string, name: string) {
  db.update(items)
    .set({ lentTo: cleanName(name, LENT_TO_MAX) })
    .where(and(eq(items.id, id), eq(items.status, 'lent')))
    .run();
}

/** The lend reminder's moment (null = off). Scheduling is the caller's job (statusService.ts). */
export function setRemindAt(id: string, remindAt: Date | null) {
  db.update(items)
    .set({ remindAt })
    .where(and(eq(items.id, id), remindAt ? eq(items.status, 'lent') : undefined))
    .run();
}

/** The dry cleaner's ready day, while the piece is there. */
export function setReadyAt(id: string, readyAt: Date | null) {
  db.update(items)
    .set({ readyAt })
    .where(and(eq(items.id, id), eq(items.status, 'dry_cleaner')))
    .run();
}

export function setFavorite(id: string, isFavorite: boolean) {
  db.update(items).set({ isFavorite }).where(eq(items.id, id)).run();
}
