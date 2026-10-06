import { eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { items, wardrobes, zones } from '@/db/schema';

import type { ArchiveReason, Category, ItemStatus } from './catalog';
import {
  applyStatus,
  moveToWardrobe,
  zoneAfterCategoryChange,
  type PlacedItem,
  type PlacementPatch,
} from './placement';

type Executor = Pick<typeof db, 'select' | 'update'>;

function placementContext(ex: Executor) {
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

function placedItem(ex: Executor, id: string): PlacedItem | undefined {
  return ex
    .select({
      wardrobeId: items.wardrobeId,
      zoneId: items.zoneId,
      category: items.category,
      status: items.status,
      lentTo: items.lentTo,
      lentAt: items.lentAt,
    })
    .from(items)
    .where(eq(items.id, id))
    .get();
}

/**
 * Sets a status from the switcher (or "Wear today"). "In storage" also moves
 * the piece to the storage wardrobe and back — see placement.ts.
 */
export function applyItemStatus(ex: Executor, id: string, next: ItemStatus, now = new Date()): PlacementPatch | null {
  const item = placedItem(ex, id);
  if (!item) return null;
  const ctx = placementContext(ex);
  const patch = applyStatus(item, next, ctx.wardrobes, ctx.zones, now);
  ex.update(items).set(patch).where(eq(items.id, id)).run();
  return patch;
}

export function setItemStatus(id: string, next: ItemStatus): PlacementPatch | null {
  return db.transaction((tx) => applyItemStatus(tx, id, next));
}

/** "Move to…": another wardrobe, keeping the same kind of zone where possible. */
export function moveItemToWardrobe(id: string, wardrobeId: string): PlacementPatch | null {
  return db.transaction((tx) => {
    const item = placedItem(tx, id);
    if (!item) return null;
    const ctx = placementContext(tx);
    const patch = moveToWardrobe(item, wardrobeId, ctx.wardrobes, ctx.zones, new Date());
    tx.update(items).set(patch).where(eq(items.id, id)).run();
    return patch;
  });
}

/** Long-press drag between zones of the same wardrobe. */
export function moveItemToZone(id: string, zoneId: string) {
  db.update(items).set({ zoneId }).where(eq(items.id, id)).run();
}

/**
 * The minimal editor (phase 3 brings the full details sheet). A new category
 * can carry the piece to that category's zone — see zoneAfterCategoryChange.
 */
export function updateItemBasics(id: string, patch: { name: string; category: Category }) {
  db.transaction((tx) => {
    const item = placedItem(tx, id);
    if (!item) return;
    const zoneId = zoneAfterCategoryChange(item, patch.category, placementContext(tx).zones);
    tx.update(items).set({ name: patch.name, category: patch.category, zoneId }).where(eq(items.id, id)).run();
  });
}

export function setLentTo(id: string, name: string) {
  db.update(items)
    .set({ lentTo: name.trim() || null })
    .where(eq(items.id, id))
    .run();
}

export function setFavorite(id: string, isFavorite: boolean) {
  db.update(items).set({ isFavorite }).where(eq(items.id, id)).run();
}

/** Leaves the wardrobe for good; wear history stays for Insights. */
export function archiveItem(id: string, reason: ArchiveReason, note: string) {
  db.update(items)
    .set({ status: 'archived', archivedReason: reason, archivedNote: note.trim() || null, lentTo: null, lentAt: null })
    .where(eq(items.id, id))
    .run();
}
